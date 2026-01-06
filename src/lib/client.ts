import {createPublicClient, createWalletClient, http, type PublicClient, type WalletClient} from 'viem'
import {privateKeyToAccount} from 'viem/accounts'

import {getChainConfig, getViemChain} from './chains'

/**
 * Create a public client for reading from a chain
 */
export function createPublicClientForChain(chainKey: string): PublicClient {
  const config = getChainConfig(chainKey)
  const viemChain = getViemChain(chainKey)

  return createPublicClient({
    chain: viemChain,
    transport: http(config.rpcUrl),
  })
}

/**
 * Create a wallet client for signing transactions
 */
export function createWalletClientForChain(chainKey: string, privateKey: `0x${string}`): WalletClient {
  const config = getChainConfig(chainKey)
  const viemChain = getViemChain(chainKey)
  const account = privateKeyToAccount(privateKey)

  return createWalletClient({
    account,
    chain: viemChain,
    transport: http(config.rpcUrl),
  })
}

/**
 * Get the account address from a private key
 */
export function getAddressFromPrivateKey(privateKey: `0x${string}`): `0x${string}` {
  const account = privateKeyToAccount(privateKey)
  return account.address
}
