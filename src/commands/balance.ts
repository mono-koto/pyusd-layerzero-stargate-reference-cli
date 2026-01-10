import { Command } from '@commander-js/extra-typings'

import { getChainConfig } from '../lib/chains'
import { createPublicClientForChain } from '../lib/client'
import { resolveAddress } from '../lib/input-validation'
import { getBalance, getTokenAddress } from '../lib/oft'
import { formatAmount } from '../utils/format'

export const balanceCommand = new Command('balance')
  .description('Check PYUSD balance on a chain')
  .argument('<chain>', 'Chain to check balance on (e.g., ethereum, arbitrum, polygon)')
  .option('-a, --address <address>', 'Address to check (defaults to address derived from PRIVATE_KEY)')
  .action(async (chain, options) => {
    const chainConfig = getChainConfig(chain)

    // Resolve address from flag or private key
    const address = resolveAddress({ address: options.address })

    const client = createPublicClientForChain(chain)

    console.log('')
    console.log(`Checking PYUSD balance on ${chainConfig.name}...`)
    console.log('')

    try {
      const tokenAddress = await getTokenAddress(client, chainConfig.oftAddress)
      const balance = await getBalance(client, tokenAddress, address)
      const formattedBalance = formatAmount(balance)

      console.log(`Address:  ${address}`)
      console.log(`Chain:    ${chainConfig.name} (EID: ${chainConfig.eid})`)
      console.log(`Balance:  ${formattedBalance} PYUSD`)
      console.log('')
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to fetch balance: ${error.message}`)
      }
      process.exit(1)
    }
  })
