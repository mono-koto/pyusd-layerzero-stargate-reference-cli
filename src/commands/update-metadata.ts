import { statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from '@commander-js/extra-typings'
import type { ConfigFileChain } from '../lib/chains'

const __dirname = dirname(fileURLToPath(import.meta.url))
const configDir = join(__dirname, '../../config')
const defaultConfigPath = join(configDir, 'chains.json')

const METADATA_URL = 'https://metadata.layerzero-api.com/v1/metadata'

// Output config structure
interface PyusdConfig {
  pyusd: Record<string, ConfigFileChain> // Chains with real PYUSD + OFT Adapter
  pyusd0: Record<string, ConfigFileChain> // Chains with PYUSD0 OFT
}

export const updateMetadataCommand = new Command('update-metadata')
  .description('Fetch LayerZero metadata and generate PYUSD/PYUSD0 chain config')
  .option('--output <file>', `Output file path (default: config/chains.json)`)
  .action(async (options) => {
    const outputPath = options.output || defaultConfigPath

    console.log('Fetching LayerZero metadata...')
    console.log(`Source: ${METADATA_URL}`)
    console.log('')

    try {
      const response = await fetch(METADATA_URL)
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.statusText}`)
      }

      const metadata = (await response.json()) as Record<string, MetadataChainEntry>
      console.log(`✓ Fetched metadata for ${Object.keys(metadata).length} chains`)
      console.log('')

      // Extract PYUSD and PYUSD0 configs
      const config = extractPyusdConfig(metadata)

      const pyusdCount = Object.keys(config.pyusd).length
      const pyusd0Count = Object.keys(config.pyusd0).length

      console.log('PYUSD chains:')
      for (const [chainKey, chainConfig] of Object.entries(config.pyusd)) {
        const typeDesc = chainConfig.oftType === 'OFTAdapter' ? 'lock/unlock' :
                         chainConfig.oftType === 'NativeOFT' ? 'single contract' : 'mint/burn'
        console.log(`  • ${chainKey} (${chainConfig.oftType} - ${typeDesc})`)
        console.log(`      Token: ${chainConfig.tokenAddress}`)
        console.log(`      OFT:   ${chainConfig.oftAddress}`)
      }

      console.log('')
      console.log('PYUSD0 chains:')
      for (const [chainKey, chainConfig] of Object.entries(config.pyusd0)) {
        console.log(`  • ${chainKey} (${chainConfig.oftType} - mint/burn)`)
        console.log(`      Token: ${chainConfig.tokenAddress}`)
        console.log(`      OFT:   ${chainConfig.oftAddress}`)
      }

      // Write config file
      writeFileSync(outputPath, JSON.stringify(config, null, 2) + '\n')

      const stats = statSync(outputPath)
      const sizeKB = (stats.size / 1024).toFixed(1)

      console.log('')
      console.log(`✓ Wrote config with ${pyusdCount} PYUSD + ${pyusd0Count} PYUSD0 chains`)
      console.log(`✓ Saved to: ${outputPath}`)
      console.log(`✓ File size: ${sizeKB} KB`)
      console.log('')
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to fetch metadata: ${error.message}`)
      }
      process.exit(1)
    }
  })

// Types for LayerZero metadata structure
interface MetadataTokenEntry {
  symbol: string
  decimals: number
  type: 'ERC20' | 'ProxyOFT' | 'NativeOFT'
  erc20TokenAddress?: string
  mintAndBurn?: boolean
  canonicalAsset?: boolean
}

interface MetadataDeploymentEntry {
  eid: string
  version: number
  stage: string
}

interface MetadataChainEntry {
  chainKey: string
  chainName: string
  chainDetails: {
    nativeChainId: number
    chainType: string
    nativeCurrency?: { name: string; symbol: string; decimals: number }
  }
  deployments: MetadataDeploymentEntry[]
  tokens: Record<string, MetadataTokenEntry>
  blockExplorers?: Array<{ url: string }>
  rpcs?: Array<{ url: string }>
}

function extractPyusdConfig(metadata: Record<string, MetadataChainEntry>): PyusdConfig {
  const config: PyusdConfig = { pyusd: {}, pyusd0: {} }

  for (const [chainKey, chainData] of Object.entries(metadata)) {
    if (!chainData.tokens) continue
    if (chainData.chainDetails?.chainType !== 'evm') continue

    // Get V2 mainnet endpoint ID
    const deployment = chainData.deployments?.find((d) => d.version === 2 && d.stage === 'mainnet')
    if (!deployment) continue
    const eid = parseInt(deployment.eid, 10)

    // Look for PYUSD OFT (ProxyOFT with canonicalAsset or NativeOFT)
    for (const [address, token] of Object.entries(chainData.tokens)) {
      if (token.symbol === 'PYUSD' && (token.type === 'ProxyOFT' || token.type === 'NativeOFT')) {
        if (token.canonicalAsset || token.type === 'NativeOFT' || token.mintAndBurn) {
          config.pyusd[chainKey] = buildChainConfig(chainKey, chainData, eid, address, token)
          break // Only one PYUSD per chain
        }
      }
    }

    // Look for PYUSD0 OFT (ProxyOFT with mintAndBurn)
    for (const [address, token] of Object.entries(chainData.tokens)) {
      if (token.symbol === 'PYUSD0' && token.type === 'ProxyOFT' && token.mintAndBurn) {
        config.pyusd0[chainKey] = buildChainConfig(chainKey, chainData, eid, address, token)
        break // Only one PYUSD0 per chain
      }
    }
  }

  return config
}

function buildChainConfig(
  chainKey: string,
  chainData: MetadataChainEntry,
  eid: number,
  oftAddress: string,
  token: MetadataTokenEntry
): ConfigFileChain {
  const tokenAddress =
    token.type === 'NativeOFT' ? oftAddress : (token.erc20TokenAddress ?? oftAddress)

  // Determine OFT type:
  // - NativeOFT: token IS the OFT (single contract)
  // - OFTAdapter: ProxyOFT with canonicalAsset=true (wraps real PYUSD, lock/unlock)
  // - ProxyOFT: ProxyOFT without canonicalAsset (mint/burn)
  let oftType: 'OFTAdapter' | 'NativeOFT' | 'ProxyOFT'
  if (token.type === 'NativeOFT') {
    oftType = 'NativeOFT'
  } else if (token.canonicalAsset) {
    oftType = 'OFTAdapter'
  } else {
    oftType = 'ProxyOFT'
  }

  return {
    name: chainData.chainName || chainKey,
    chainId: chainData.chainDetails.nativeChainId,
    eid,
    tokenAddress: tokenAddress.toLowerCase(),
    oftAddress: oftAddress.toLowerCase(),
    oftType,
    decimals: token.decimals || 6,
    blockExplorer: chainData.blockExplorers?.[0]?.url || `https://${chainKey}.scan.io`,
    rpcUrl: chainData.rpcs?.[0]?.url || `https://${chainKey}.rpc.com`,
    nativeCurrency: chainData.chainDetails.nativeCurrency || {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  }
}

