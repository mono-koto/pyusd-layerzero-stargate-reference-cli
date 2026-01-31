/**
 * Solana client utilities for cross-chain transfers
 *
 * Handles Solana-specific transaction signing and submission.
 */

import {
  Connection,
  Keypair,
  VersionedMessage,
  VersionedTransaction,
  clusterApiUrl,
} from '@solana/web3.js'
import bs58 from 'bs58'

// Default Solana RPC (mainnet-beta)
const DEFAULT_SOLANA_RPC = clusterApiUrl('mainnet-beta')

/**
 * Parse a Solana private key from various formats
 *
 * Supports:
 * - Base58 encoded (Solana CLI format, ~88 chars)
 * - Hex encoded with 0x prefix
 * - Hex encoded without prefix
 */
export function parseSolanaPrivateKey(privateKey: string): Uint8Array {
  let keyBytes: Uint8Array

  // Try base58 first (most common for Solana)
  if (!privateKey.startsWith('0x') && privateKey.length > 60) {
    try {
      keyBytes = bs58.decode(privateKey)
      if (keyBytes.length === 64) {
        return keyBytes
      }
    } catch {
      // Not valid base58, try hex
    }
  }

  // Try hex (with or without 0x prefix)
  const hexKey = privateKey.replace(/^0x/, '')
  keyBytes = Buffer.from(hexKey, 'hex')

  if (keyBytes.length !== 64) {
    throw new Error(
      `Invalid Solana private key: expected 64 bytes, got ${keyBytes.length}. ` +
        'Key should be base58 encoded (Solana CLI format) or 64-byte hex.'
    )
  }

  return keyBytes
}

/**
 * Create a Solana keypair from a private key string
 */
export function createSolanaKeypair(privateKey: string): Keypair {
  const keyBytes = parseSolanaPrivateKey(privateKey)
  return Keypair.fromSecretKey(keyBytes)
}

/**
 * Get the public key (address) from a Solana private key
 */
export function getSolanaAddressFromPrivateKey(privateKey: string): string {
  const keypair = createSolanaKeypair(privateKey)
  return keypair.publicKey.toBase58()
}

/**
 * Create a Solana connection
 */
export function createSolanaConnection(rpcUrl?: string): Connection {
  return new Connection(rpcUrl || DEFAULT_SOLANA_RPC, 'confirmed')
}

/**
 * Execute a Stargate transaction on Solana
 *
 * The Stargate API returns transactions as base64-encoded data.
 * This can be either a full VersionedTransaction or just the message.
 * We deserialize, sign, and submit them.
 */
export async function executeSolanaTransaction(
  connection: Connection,
  keypair: Keypair,
  transactionData: string // base64 encoded
): Promise<string> {
  // Deserialize the transaction data
  const transactionBuffer = Buffer.from(transactionData, 'base64')

  let transaction: VersionedTransaction

  // Try to deserialize as a full VersionedTransaction first
  // If that fails, try as a VersionedMessage
  try {
    transaction = VersionedTransaction.deserialize(transactionBuffer)
  } catch {
    // Fallback: deserialize as a VersionedMessage and create transaction
    const message = VersionedMessage.deserialize(transactionBuffer)
    transaction = new VersionedTransaction(message)
  }

  // Get the message to understand the signers
  const message = transaction.message
  const staticAccountKeys = message.staticAccountKeys
  const numSigners = message.header.numRequiredSignatures
  const ourPubkeyBase58 = keypair.publicKey.toBase58()

  // Find the index of our pubkey in the static account keys
  const signerIndex = staticAccountKeys.findIndex(
    (key) => key.toBase58() === ourPubkeyBase58
  )

  // Check if our keypair is a required signer
  if (signerIndex === -1 || signerIndex >= numSigners) {
    // Our pubkey is not in the required signers list
    // This likely means the transaction was built for a different sender address
    const requiredSigners = staticAccountKeys.slice(0, numSigners).map(k => k.toBase58())
    throw new Error(
      `Keypair public key (${ourPubkeyBase58}) is not a required signer for this transaction. ` +
      `Transaction requires ${numSigners} signature(s). ` +
      `Required signers: ${requiredSigners.join(', ')}. ` +
      `Ensure the SOLANA_PRIVATE_KEY matches the address used to request the quote.`
    )
  }

  // Sign the transaction
  // VersionedTransaction.sign() adds the signature at the correct index based on
  // where the signer's pubkey appears in the static account keys
  transaction.sign([keypair])

  // Send and confirm with proper commitment level
  const signature = await connection.sendTransaction(transaction, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })

  // Wait for confirmation
  const latestBlockHash = await connection.getLatestBlockhash()
  await connection.confirmTransaction({
    signature,
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
  })

  return signature
}

/**
 * Check if a string looks like a Solana address (base58, 32-44 chars)
 */
export function isSolanaAddress(address: string): boolean {
  // Solana addresses are base58 encoded, typically 32-44 characters
  if (address.length < 32 || address.length > 44) {
    return false
  }
  // Check if it's valid base58
  try {
    const decoded = bs58.decode(address)
    return decoded.length === 32
  } catch {
    return false
  }
}

/**
 * Get SPL token balance for a Solana address
 *
 * @param rpcUrl - Solana RPC URL
 * @param walletAddress - Owner wallet address (base58)
 * @param tokenMintAddress - SPL token mint address (base58)
 * @returns Balance in token base units
 */
export async function getSolanaTokenBalance(
  rpcUrl: string,
  walletAddress: string,
  tokenMintAddress: string
): Promise<bigint> {
  const { PublicKey } = await import('@solana/web3.js')
  const { getAssociatedTokenAddress, getAccount, TokenAccountNotFoundError } = await import('@solana/spl-token')

  const connection = createSolanaConnection(rpcUrl)
  const walletPubkey = new PublicKey(walletAddress)
  const mintPubkey = new PublicKey(tokenMintAddress)

  try {
    // Get the associated token account address
    const ataAddress = await getAssociatedTokenAddress(mintPubkey, walletPubkey)

    // Fetch the token account info
    const tokenAccount = await getAccount(connection, ataAddress)

    return BigInt(tokenAccount.amount.toString())
  } catch (error) {
    // If token account doesn't exist, balance is 0
    if (error instanceof TokenAccountNotFoundError) {
      return BigInt(0)
    }
    // Check for account not found error (different error type in some versions)
    if (error instanceof Error && error.message.includes('could not find account')) {
      return BigInt(0)
    }
    throw error
  }
}
