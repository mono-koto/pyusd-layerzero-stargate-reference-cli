import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  arbitrum,
  arbitrumSepolia,
  type Chain,
  mainnet,
  polygon,
  sepolia,
} from 'viem/chains'

import type { ChainConfig } from '../types/index'

const __dirname = dirname(fileURLToPath(import.meta.url))
const configDir = join(__dirname, '../../config')

// Determine if we're in testnet mode
export const isTestnet = process.env.TESTNET === 'true' || process.env.TESTNET === '1'

// Load chain configs from JSON files
function loadChainConfigs(): Record<string, ChainConfig> {
  const configFile = isTestnet ? 'testnet.json' : 'mainnet.json'
  const configPath = join(configDir, configFile)

  try {
    const raw = readFileSync(configPath, 'utf-8')
    const configs = JSON.parse(raw) as Record<string, Omit<ChainConfig, 'chainKey' | 'rpcUrl'> & { rpcUrl: string }>

    // Add chainKey and apply RPC overrides from env
    const result: Record<string, ChainConfig> = {}
    for (const [key, config] of Object.entries(configs)) {
      const envKey = `RPC_${key.toUpperCase().replace(/-/g, '_')}`
      result[key] = {
        ...config,
        chainKey: key,
        rpcUrl: process.env[envKey] || config.rpcUrl,
      }
    }
    return result
  } catch {
    // Fallback to hardcoded defaults if config file not found
    return getDefaultConfigs()
  }
}

function getDefaultConfigs(): Record<string, ChainConfig> {
  if (isTestnet) {
    return {
      'arbitrum-sepolia': {
        blockExplorer: 'https://sepolia.arbiscan.io',
        chainId: 421_614,
        chainKey: 'arbitrum-sepolia',
        eid: 40_231,
        name: 'Arbitrum Sepolia',
        nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
        pyusdAddress: '0x637A1259C6afd7E3AdF63993cA7E58BB438aB1B1',
        rpcUrl: process.env.RPC_ARBITRUM_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc',
      },
      'ethereum-sepolia': {
        blockExplorer: 'https://sepolia.etherscan.io',
        chainId: 11_155_111,
        chainKey: 'ethereum-sepolia',
        eid: 40_161,
        name: 'Ethereum Sepolia',
        nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
        pyusdAddress: '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9',
        rpcUrl: process.env.RPC_ETHEREUM_SEPOLIA || 'https://rpc.sepolia.org',
      },
    }
  }

  return {
    arbitrum: {
      blockExplorer: 'https://arbiscan.io',
      chainId: 42_161,
      chainKey: 'arbitrum',
      eid: 30_110,
      name: 'Arbitrum',
      nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
      pyusdAddress: '0xfab5891ed867a1195303251912013b92c4fc3a1d',
      rpcUrl: process.env.RPC_ARBITRUM || 'https://arb1.arbitrum.io/rpc',
    },
    ethereum: {
      blockExplorer: 'https://etherscan.io',
      chainId: 1,
      chainKey: 'ethereum',
      eid: 30_101,
      name: 'Ethereum',
      nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
      pyusdAddress: '0xa2c323fe5a74adffad2bf3e007e36bb029606444',
      rpcUrl: process.env.RPC_ETHEREUM || 'https://eth.llamarpc.com',
    },
    polygon: {
      blockExplorer: 'https://polygonscan.com',
      chainId: 137,
      chainKey: 'polygon',
      eid: 30_109,
      name: 'Polygon',
      nativeCurrency: { decimals: 18, name: 'POL', symbol: 'POL' },
      pyusdAddress: '0xfab5891ed867a1195303251912013b92c4fc3a1d',
      rpcUrl: process.env.RPC_POLYGON || 'https://polygon.llamarpc.com',
    },
  }
}

// Load configs at module load time
export const CHAIN_CONFIGS = loadChainConfigs()

// Map chain keys to viem chain definitions
const VIEM_CHAINS: Record<string, Chain> = {
  arbitrum,
  'arbitrum-sepolia': arbitrumSepolia,
  ethereum: mainnet,
  'ethereum-sepolia': sepolia,
  polygon,
  sepolia, // alias
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
  if (!chain) {
    throw new Error(`Chain "${chainKey}" not found`)
  }

  return chain
}

export function getSupportedChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS)
}
