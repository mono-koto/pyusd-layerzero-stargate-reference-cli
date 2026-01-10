import {createPublicClient, createWalletClient, http, type PublicClient, type WalletClient} from 'viem'
import {privateKeyToAccount} from 'viem/accounts'

import {getChainConfig, getViemChain} from './chains'
import type {ChainConfig} from '../types'

/**
 * Create a public client for reading from a chain.
 * Accepts either a chain key string or a ChainConfig object.
 */
export function createPublicClientForChain(chainKeyOrConfig: string | ChainConfig): PublicClient {
  const config = typeof chainKeyOrConfig === 'string' ? getChainConfig(chainKeyOrConfig) : chainKeyOrConfig
  const viemChain = getViemChain(config.chainKey)

  return createPublicClient({
    chain: viemChain,
    transport: http(config.rpcUrl),
  })
}

/**
 * Create a wallet client for signing transactions.
 * Accepts either a chain key string or a ChainConfig object.
 */
export function createWalletClientForChain(chainKeyOrConfig: string | ChainConfig, privateKey: `0x${string}`): WalletClient {
  const config = typeof chainKeyOrConfig === 'string' ? getChainConfig(chainKeyOrConfig) : chainKeyOrConfig
  const viemChain = getViemChain(config.chainKey)
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
