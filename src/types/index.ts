import type { Address } from 'viem'

export type ChainType = 'evm' | 'solana' | 'tron'

// Chain configuration (from Stargate API)
export interface ChainConfig {
  chainKey: string
  chainType: ChainType
  name: string
  chainId: number
  symbol: 'PYUSD' | 'PYUSD0'
  tokenAddress: Address
  decimals: number
  nativeCurrency: {
    symbol: string
    decimals: number
  }
  rpcUrl: string
}
