import { Command } from '@commander-js/extra-typings'

import { getSupportedChains, isTestnet } from '../lib/chains'

export const chainsCommand = new Command('chains')
  .description('Commands for listing supported PYUSD chains')

chainsCommand
  .command('list')
  .description('List all chains where PYUSD is available via LayerZero')
  .option('-f, --format <format>', 'Output format (table or json)', 'table')
  .action((options) => {
    const chains = getSupportedChains()
    const mode = isTestnet ? 'TESTNET' : 'MAINNET'

    if (options.format === 'json') {
      console.log(JSON.stringify({ mode, chains }, null, 2))
      return
    }

    // Table format
    console.log('')
    console.log(`Supported PYUSD Chains (${mode})`)
    console.log('─'.repeat(80))
    console.log(
      `${'Chain'.padEnd(18)} ${'EID'.padEnd(8)} ${'Chain ID'.padEnd(10)} ${'PYUSD Address'.padEnd(44)}`,
    )
    console.log('─'.repeat(80))

    for (const chain of chains) {
      console.log(
        `${chain.name.padEnd(18)} ${chain.eid.toString().padEnd(8)} ${chain.chainId.toString().padEnd(10)} ${chain.pyusdAddress}`,
      )
    }

    console.log('')
    console.log(`Total: ${chains.length} chains`)
    if (isTestnet) {
      console.log('')
      console.log('Note: Running in testnet mode. Set TESTNET=false or unset to use mainnet.')
    }
    console.log('')
  })
