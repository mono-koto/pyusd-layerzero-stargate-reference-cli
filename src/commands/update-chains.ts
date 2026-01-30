import { statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from '@commander-js/extra-typings'

const __dirname = dirname(fileURLToPath(import.meta.url))
const configDir = join(__dirname, '../../config')
const defaultConfigPath = join(configDir, 'chains.json')

const STARGATE_CHAINS_URL = 'https://stargate.finance/api/v1/chains'
const STARGATE_TOKENS_URL = 'https://stargate.finance/api/v1/tokens'

// Stargate API types
interface StargateChain {
  chainKey: string
  chainType: string // 'evm' | 'solana' | 'tron'
  chainId: number
  shortName: string
  name: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
}

interface StargateToken {
  isBridgeable: boolean
  chainKey: string
  address: string
  decimals: number
  symbol: string // 'PYUSD' | 'PYUSD0'
  name: string
}

// Output config types
export interface ChainConfig {
  chainKey: string
  chainType: string
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
}

interface ChainsConfig {
  // Metadata
  source: string
  updatedAt: string
  // Chains by chainKey
  chains: Record<string, ChainConfig>
}

export const updateChainsCommand = new Command('update-chains')
  .description('Fetch PYUSD/PYUSD0 chain config from Stargate API')
  .option('--output <file>', `Output file path (default: config/chains.json)`)
  .option('--include-non-bridgeable', 'Include tokens that cannot be bridged via Stargate', true)
  .option('--include-non-evm', 'Include non-EVM chains', true)
  .action(async (options) => {
    const outputPath = options.output || defaultConfigPath

    console.log('Fetching chain data from Stargate API...')
    console.log('')

    try {
      // Fetch chains and tokens in parallel
      const [chainsResponse, tokensResponse] = await Promise.all([
        fetch(STARGATE_CHAINS_URL),
        fetch(STARGATE_TOKENS_URL),
      ])

      if (!chainsResponse.ok) {
        throw new Error(`Failed to fetch chains: ${chainsResponse.statusText}`)
      }
      if (!tokensResponse.ok) {
        throw new Error(`Failed to fetch tokens: ${tokensResponse.statusText}`)
      }

      const chainsData = (await chainsResponse.json()) as { chains: StargateChain[] }
      const tokensData = (await tokensResponse.json()) as { tokens: StargateToken[] }

      console.log(`✓ Fetched ${chainsData.chains.length} chains`)
      console.log(`✓ Fetched ${tokensData.tokens.length} tokens`)
      console.log('')

      // Filter for PYUSD/PYUSD0 tokens
      const pyusdTokens = tokensData.tokens.filter(
        (t) => (t.symbol === 'PYUSD' || t.symbol === 'PYUSD0') &&
               (options.includeNonBridgeable || t.isBridgeable)
      )

      console.log(`Found ${pyusdTokens.length} PYUSD/PYUSD0 tokens${options.includeNonBridgeable ? '' : ' (bridgeable only)'}`)
      console.log('')

      // Build chain lookup
      const chainLookup = new Map<string, StargateChain>()
      for (const chain of chainsData.chains) {
        chainLookup.set(chain.chainKey, chain)
      }

      // Build config
      const config: ChainsConfig = {
        source: 'stargate.finance/api/v1',
        updatedAt: new Date().toISOString(),
        chains: {},
      }

      // Group by symbol for display
      const pyusdChains: string[] = []
      const pyusd0Chains: string[] = []

      for (const token of pyusdTokens) {
        const chain = chainLookup.get(token.chainKey)
        if (!chain) {
          console.log(`  ⚠ Skipping ${token.chainKey}: chain not found`)
          continue
        }

        // Only include EVM chains for now
        if (!options.includeNonEvm && chain.chainType !== 'evm') {
          console.log(`  ⚠ Skipping ${token.chainKey}: non-EVM chain (${chain.chainType})`)
          continue
        }

        config.chains[token.chainKey] = {
          chainKey: token.chainKey,
          chainType: chain.chainType,
          name: chain.name,
          chainId: chain.chainId,
          symbol: token.symbol as 'PYUSD' | 'PYUSD0',
          tokenAddress: token.address.toLowerCase(),
          decimals: token.decimals,
          nativeCurrency: {
            symbol: chain.nativeCurrency.symbol,
            decimals: chain.nativeCurrency.decimals,
          },
        }

        if (token.symbol === 'PYUSD') {
          pyusdChains.push(token.chainKey)
        } else {
          pyusd0Chains.push(token.chainKey)
        }
      }

      // Display results
      console.log('PYUSD chains:')
      for (const chainKey of pyusdChains) {
        const c = config.chains[chainKey]
        console.log(`  • ${chainKey} → ${c.tokenAddress}`)
      }

      console.log('')
      console.log('PYUSD0 chains:')
      for (const chainKey of pyusd0Chains) {
        const c = config.chains[chainKey]
        console.log(`  • ${chainKey} → ${c.tokenAddress}`)
      }

      // Write config file
      writeFileSync(outputPath, JSON.stringify(config, null, 2) + '\n')

      const stats = statSync(outputPath)
      const sizeKB = (stats.size / 1024).toFixed(1)

      console.log('')
      console.log(`✓ Wrote config with ${pyusdChains.length} PYUSD + ${pyusd0Chains.length} PYUSD0 chains`)
      console.log(`✓ Saved to: ${outputPath}`)
      console.log(`✓ File size: ${sizeKB} KB`)
      console.log('')
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to fetch data: ${error.message}`)
      }
      process.exit(1)
    }
  })
