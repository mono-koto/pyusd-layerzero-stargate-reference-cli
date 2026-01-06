import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from '@commander-js/extra-typings'

const __dirname = dirname(fileURLToPath(import.meta.url))
const configDir = join(__dirname, '../../config')

interface OFTMetadata {
  symbol: string
  address: string
  chainKey: string
  eid: number
  localDecimals: number
  type: string
  endpointVersion: string
  innerToken?: string
}

interface OFTListResponse {
  data: Record<string, OFTMetadata[]>
}

interface ChainMetadata {
  chainName: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  blockExplorers?: {
    default?: {
      url: string
    }
  }
  rpcUrls?: {
    default?: {
      http?: string[]
    }
  }
}

interface EndpointMetadata {
  version: number
  eid: number
  chainKey: string
  stage: string
  chainType: string
  nativeChain: ChainMetadata
}

export const fetchChainsCommand = new Command('fetch-chains')
  .description('Fetch PYUSD chain configurations from LayerZero metadata API')
  .option('--output <file>', 'Output file path (default: config/mainnet.json)')
  .action(async (options) => {
    console.log('Fetching PYUSD chain configurations from LayerZero...')
    console.log('')

    try {
      // Fetch OFT metadata
      const oftResponse = await fetch('https://metadata.layerzero-api.com/v1/metadata/experiment/ofts/list')
      if (!oftResponse.ok) {
        throw new Error(`Failed to fetch OFT metadata: ${oftResponse.statusText}`)
      }
      const oftData = (await oftResponse.json()) as OFTListResponse

      // Fetch endpoint metadata for chain info
      const endpointResponse = await fetch('https://metadata.layerzero-api.com/v1/metadata/endpoints')
      if (!endpointResponse.ok) {
        throw new Error(`Failed to fetch endpoint metadata: ${endpointResponse.statusText}`)
      }
      const endpointData = (await endpointResponse.json()) as Record<string, EndpointMetadata>

      // Find all PYUSD deployments
      const pyusdEntries = oftData.data['PYUSD'] || []
      if (pyusdEntries.length === 0) {
        console.log('No PYUSD deployments found in metadata')
        return
      }

      console.log(`Found ${pyusdEntries.length} PYUSD deployment(s):`)
      console.log('')

      // Build config for each chain
      const config: Record<string, {
        name: string
        chainId: number
        eid: number
        pyusdAddress: string
        blockExplorer: string
        rpcUrl: string
        nativeCurrency: { name: string; symbol: string; decimals: number }
      }> = {}

      for (const entry of pyusdEntries) {
        // Skip non-EVM chains (like Solana)
        if (!entry.address.startsWith('0x')) {
          console.log(`  - ${entry.chainKey}: Skipping non-EVM chain`)
          continue
        }

        // Find endpoint metadata for this chain
        const endpoint = Object.values(endpointData).find(
          (e) => e.eid === entry.eid && e.version === 2 && e.stage === 'mainnet'
        )

        if (!endpoint) {
          console.log(`  - ${entry.chainKey}: No endpoint metadata found`)
          continue
        }

        const chainMeta = endpoint.nativeChain
        const chainKey = entry.chainKey.toLowerCase()

        config[chainKey] = {
          name: chainMeta.chainName || entry.chainKey,
          chainId: getChainId(chainKey),
          eid: entry.eid,
          pyusdAddress: entry.address.toLowerCase(),
          blockExplorer: chainMeta.blockExplorers?.default?.url || `https://${chainKey}.etherscan.io`,
          rpcUrl: chainMeta.rpcUrls?.default?.http?.[0] || `https://${chainKey}.rpc.com`,
          nativeCurrency: chainMeta.nativeCurrency || { name: 'Ether', symbol: 'ETH', decimals: 18 },
        }

        console.log(`  - ${chainKey}: ${entry.address}`)
      }

      // Write config file
      const outputPath = options.output || join(configDir, 'mainnet.json')
      writeFileSync(outputPath, JSON.stringify(config, null, 2) + '\n')
      console.log('')
      console.log(`Config written to: ${outputPath}`)
      console.log('')
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to fetch chains: ${error.message}`)
      }
      process.exit(1)
    }
  })

// Helper to get chain IDs (these are static for EVM chains)
function getChainId(chainKey: string): number {
  const chainIds: Record<string, number> = {
    ethereum: 1,
    arbitrum: 42161,
    polygon: 137,
    optimism: 10,
    base: 8453,
    avalanche: 43114,
    bsc: 56,
    sepolia: 11155111,
    'arbitrum-sepolia': 421614,
  }
  return chainIds[chainKey] || 0
}
