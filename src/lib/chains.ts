import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  arbitrum,
  avalanche,
  type Chain,
  mainnet,
  polygon,
  sei,
} from 'viem/chains'

import type { ChainConfig, ChainType } from '../types/index'

const __dirname = dirname(fileURLToPath(import.meta.url))
const configDir = join(__dirname, '../../config')
const configPath = join(configDir, 'chains.json')

// Config file structure (from Stargate API)
interface ConfigFile {
  source: string
  updatedAt: string
  chains: Record<string, {
    chainKey: string
    chainType: ChainType
    name: string
    chainId: number
    symbol: 'PYUSD' | 'PYUSD0'
    tokenAddress: string
    decimals: number
    nativeCurrency: {
      symbol: string
      decimals: number
    }
    rpcUrl?: string
  }>
}

/**
 * Load chain configs from config/chains.json
 *
 * Applies RPC URL overrides from environment variables (e.g., RPC_ETHEREUM).
 */
function loadChainConfigs(): Record<string, ChainConfig> {
  if (!existsSync(configPath)) {
    console.error(`Error: Config file not found at ${configPath}`)
    console.error(`Please run: npm run cli update-chains`)
    process.exit(1)
  }

  try {
    const raw = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(raw) as ConfigFile

    const result: Record<string, ChainConfig> = {}

    for (const [chainKey, chain] of Object.entries(config.chains)) {
      // Apply RPC override from env if present
      const envKey = `RPC_${chainKey.toUpperCase().replace(/-/g, '_')}`
      const rpcUrl = process.env[envKey] || chain.rpcUrl || getDefaultRpcUrl(chainKey)

      result[chainKey] = {
        chainKey,
        chainType: chain.chainType,
        name: chain.name,
        chainId: chain.chainId,
        symbol: chain.symbol,
        tokenAddress: chain.tokenAddress as `0x${string}`,
        decimals: chain.decimals,
        nativeCurrency: chain.nativeCurrency,
        rpcUrl,
      }
    }

    return result
  } catch (error) {
    console.error(`Error: Failed to parse ${configPath}`)
    if (error instanceof Error) {
      console.error(error.message)
    }
    process.exit(1)
  }
}

/**
 * Get default RPC URL for known chains
 */
function getDefaultRpcUrl(chainKey: string): string {
  const defaults: Record<string, string> = {
    ethereum: 'https://eth.llamarpc.com',
    arbitrum: 'https://arb1.arbitrum.io/rpc',
    avalanche: 'https://api.avax.network/ext/bc/C/rpc',
    sei: 'https://evm-rpc.sei-apis.com',
    abstract: 'https://api.mainnet.abs.xyz',
    ink: 'https://rpc-qnd.inkonchain.com',
    plumephoenix: 'https://rpc.plume.org',
  }
  return defaults[chainKey] || `https://${chainKey}.rpc.default`
}

// Load configs at module load time
export const CHAIN_CONFIGS = loadChainConfigs()

// Map chain keys to viem chain definitions
const VIEM_CHAINS: Record<string, Chain> = {
  arbitrum,
  avalanche,
  ethereum: mainnet,
  polygon,
  sei,
}

export function getChainConfig(chainKey: string): ChainConfig {
  const config = CHAIN_CONFIGS[chainKey.toLowerCase()]
  if (!config) {
    const supported = Object.keys(CHAIN_CONFIGS).join(', ')
    throw new Error(`Chain "${chainKey}" not supported. Supported chains: ${supported}`)
  }

  return config
}

export function getViemChain(chainKey: string): Chain {
  const chain = VIEM_CHAINS[chainKey.toLowerCase()]
  if (chain) {
    return chain
  }

  // For chains not in viem, build a minimal chain definition
  const config = getChainConfig(chainKey)
  return {
    id: config.chainId,
    name: config.name,
    nativeCurrency: {
      name: config.nativeCurrency.symbol,
      symbol: config.nativeCurrency.symbol,
      decimals: config.nativeCurrency.decimals,
    },
    rpcUrls: {
      default: { http: [config.rpcUrl] },
    },
  }
}

export function getSupportedChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS)
}

export function isEvmChain(config: ChainConfig): boolean {
  return config.chainType === 'evm'
}

export function getPyusdChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter((c) => c.symbol === 'PYUSD')
}

export function getPyusd0Chains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter((c) => c.symbol === 'PYUSD0')
}

/**
 * Get chain configs for a transfer.
 *
 * Simple lookup - just returns the configs for the source and destination chains.
 * Stargate API handles all routing automatically.
 */
export function resolveChainConfigsForTransfer(
  sourceKey: string,
  destKey: string
): { srcConfig: ChainConfig; dstConfig: ChainConfig } {
  return {
    srcConfig: getChainConfig(sourceKey),
    dstConfig: getChainConfig(destKey),
  }
}
