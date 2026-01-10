import { Command } from '@commander-js/extra-typings'

import { getPyusdChains, getPyusd0Chains, getSupportedChains } from '../lib/chains'
import type { ChainConfig } from '../types/index'

function printChainTable(title: string, chains: ChainConfig[]): void {
  console.log('')
  console.log(title)
  console.log('─'.repeat(95))
  console.log(
    `${'Chain'.padEnd(14)} ${'EID'.padEnd(8)} ${'Type'.padEnd(12)} ${'Operation'.padEnd(14)} ${'OFT Address'}`,
  )
  console.log('─'.repeat(95))

  for (const chain of chains) {
    const operation = chain.oftType === 'OFTAdapter' ? 'lock/unlock' : 'mint/burn'
    console.log(
      `${chain.name.padEnd(14)} ${chain.eid.toString().padEnd(8)} ${chain.oftType.padEnd(12)} ${operation.padEnd(14)} ${chain.oftAddress}`,
    )
  }
}

export const chainsCommand = new Command('chains')
  .description('List all chains where PYUSD/PYUSD0 is available via LayerZero')
  .option('-f, --format <format>', 'Output format (table or json)', 'table')
  .action((options) => {
    const pyusdChains = getPyusdChains()
    const pyusd0Chains = getPyusd0Chains()

    if (options.format === 'json') {
      console.log(JSON.stringify({ pyusd: pyusdChains, pyusd0: pyusd0Chains }, null, 2))
      return
    }

    // Table format
    printChainTable('PYUSD Chains', pyusdChains)
    printChainTable('PYUSD0 Chains', pyusd0Chains)

    console.log('')
    console.log(`Total: ${getSupportedChains().length} chains (${pyusdChains.length} PYUSD + ${pyusd0Chains.length} PYUSD0)`)
    console.log('')
  })
