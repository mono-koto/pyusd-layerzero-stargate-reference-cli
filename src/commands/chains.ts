import { Command } from '@commander-js/extra-typings'

import { getPyusdChains, getPyusd0Chains, getSupportedChains } from '../lib/chains'
import type { ChainConfig } from '../types/index'

function printChainTable(title: string, chains: ChainConfig[]): void {
  console.log('')
  console.log(title)
  console.log('─'.repeat(80))
  console.log(
    `${'Chain'.padEnd(16)} ${'Chain ID'.padEnd(10)} ${'Token Address'}`,
  )
  console.log('─'.repeat(80))

  for (const chain of chains) {
    console.log(
      `${chain.chainKey.padEnd(16)} ${chain.chainId.toString().padEnd(10)} ${chain.tokenAddress}`,
    )
  }
}

export const chainsCommand = new Command('chains')
  .description('List all chains where PYUSD/PYUSD0 is bridgeable via Stargate')
  .option('-f, --format <format>', 'Output format (table or json)', 'table')
  .action((options) => {
    const pyusdChains = getPyusdChains()
    const pyusd0Chains = getPyusd0Chains()

    if (options.format === 'json') {
      console.log(JSON.stringify({ pyusd: pyusdChains, pyusd0: pyusd0Chains }, null, 2))
      return
    }

    // Table format
    printChainTable('PYUSD Chains (Native PayPal USD)', pyusdChains)
    printChainTable('PYUSD0 Chains (Synthetic via Stargate Hydra)', pyusd0Chains)

    console.log('')
    console.log(`Total: ${getSupportedChains().length} chains (${pyusdChains.length} PYUSD + ${pyusd0Chains.length} PYUSD0)`)
    console.log('')
    console.log('To update chain data: npm run cli update-chains')
    console.log('')
  })
