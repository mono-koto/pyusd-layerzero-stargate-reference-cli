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

import type { ChainConfig } from '../types/index'

const __dirname = dirname(fileURLToPath(import.meta.url))
const configDir = join(__dirname, '../../config')
const configPath = join(configDir, 'chains.json')

// Config file structure
interface ConfigFileChain {
  name: string
  chainId: number
  eid: number
  tokenAddress: string
  oftAddress: string
  oftType: 'OFTAdapter' | 'NativeOFT' | 'ProxyOFT' // Adapter=lock/unlock, NativeOFT=single contract, ProxyOFT=mint/burn
  decimals: number
  blockExplorer: string
  rpcUrl: string
  nativeCurrency: { name?: string; symbol: string; decimals: number }
}

interface ConfigFile {
  pyusd: Record<string, ConfigFileChain>
  pyusd0: Record<string, ConfigFileChain>
}

// Cached raw config for network-specific lookups
let cachedRawConfig: ConfigFile | null = null

/**
 * Load chain configs from config/chains.json
 *
 * Flattens PYUSD and PYUSD0 chains into a single record.
 * For chains in both networks (e.g., Arbitrum), PYUSD takes precedence.
 * Applies RPC URL overrides from environment variables (e.g., RPC_ETHEREUM).
 */
function loadChainConfigs(): Record<string, ChainConfig> {
  if (!existsSync(configPath)) {
    console.error(`Error: Config file not found at ${configPath}`)
    console.error(`Please run: npm run cli update-metadata`)
    process.exit(1)
  }

  try {
    const raw = readFileSync(configPath, 'utf-8')
    cachedRawConfig = JSON.parse(raw) as ConfigFile

    const result: Record<string, ChainConfig> = {}

    // Load PYUSD chains first (they take precedence for chains in both networks)
    for (const [chainKey, chain] of Object.entries(cachedRawConfig.pyusd || {})) {
      result[chainKey] = buildChainConfig(chainKey, chain, 'pyusd')
    }

    // Load PYUSD0 chains (skip if already loaded from PYUSD)
    for (const [chainKey, chain] of Object.entries(cachedRawConfig.pyusd0 || {})) {
      if (!result[chainKey]) {
        result[chainKey] = buildChainConfig(chainKey, chain, 'pyusd0')
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

function buildChainConfig(
  chainKey: string,
  chain: ConfigFileChain,
  network: 'pyusd' | 'pyusd0'
): ChainConfig {
  // Apply RPC override from env if present
  const envKey = `RPC_${chainKey.toUpperCase().replace(/-/g, '_')}`
  const rpcUrl = process.env[envKey] || chain.rpcUrl

  return {
    chainKey,
    name: chain.name,
    chainId: chain.chainId,
    eid: chain.eid,
    tokenAddress: chain.tokenAddress as `0x${string}`,
    oftAddress: chain.oftAddress as `0x${string}`,
    oftType: chain.oftType,
    decimals: chain.decimals,
    blockExplorer: chain.blockExplorer,
    rpcUrl,
    nativeCurrency: chain.nativeCurrency,
    network,
  }
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
      name: config.nativeCurrency.name || config.nativeCurrency.symbol,
      symbol: config.nativeCurrency.symbol,
      decimals: config.nativeCurrency.decimals,
    },
    rpcUrls: {
      default: { http: [config.rpcUrl] },
    },
    blockExplorers: {
      default: { name: config.name, url: config.blockExplorer },
    },
  }
}

export function getSupportedChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS)
}

export function getPyusdChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter((c) => c.network === 'pyusd')
}

export function getPyusd0Chains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter((c) => c.network === 'pyusd0')
}

/**
 * Get chain config for a specific network (pyusd or pyusd0).
 * Bypasses the default PYUSD-takes-precedence rule.
 */
function getChainConfigForNetwork(chainKey: string, network: 'pyusd' | 'pyusd0'): ChainConfig | null {
  if (!cachedRawConfig) return null
  const chains = network === 'pyusd' ? cachedRawConfig.pyusd : cachedRawConfig.pyusd0
  const chain = chains[chainKey.toLowerCase()]
  if (!chain) return null
  return buildChainConfig(chainKey.toLowerCase(), chain, network)
}

/**
 * Resolve chain configs for a transfer, automatically selecting the right OFT network.
 *
 * PYUSD has two OFT meshes:
 * - pyusd: Ethereum, Arbitrum (OFTAdapter - lock/unlock)
 * - pyusd0: Polygon, Avalanche, Sei, etc. (ProxyOFT - mint/burn)
 *
 * Some chains (like Arbitrum) exist in both meshes with different OFT contracts.
 * This function picks the right mesh based on where the destination chain exists.
 */
export function resolveChainConfigsForTransfer(
  sourceKey: string,
  destKey: string
): { srcConfig: ChainConfig; dstConfig: ChainConfig } {
  if (!cachedRawConfig) {
    return { srcConfig: getChainConfig(sourceKey), dstConfig: getChainConfig(destKey) }
  }

  const srcKey = sourceKey.toLowerCase()
  const dstKey = destKey.toLowerCase()

  // Determine which network the destination is in
  const dstInPyusd = !!cachedRawConfig.pyusd[dstKey]
  const dstInPyusd0 = !!cachedRawConfig.pyusd0[dstKey]

  // Route to the network that has the destination
  if (!dstInPyusd && dstInPyusd0) {
    const srcConfig = getChainConfigForNetwork(srcKey, 'pyusd0')
    const dstConfig = getChainConfigForNetwork(dstKey, 'pyusd0')
    if (srcConfig && dstConfig) return { srcConfig, dstConfig }
  }

  if (dstInPyusd && !dstInPyusd0) {
    const srcConfig = getChainConfigForNetwork(srcKey, 'pyusd')
    const dstConfig = getChainConfigForNetwork(dstKey, 'pyusd')
    if (srcConfig && dstConfig) return { srcConfig, dstConfig }
  }

  // Default: use standard resolution
  return { srcConfig: getChainConfig(srcKey), dstConfig: getChainConfig(dstKey) }
}
