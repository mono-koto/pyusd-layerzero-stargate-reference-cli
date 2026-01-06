import { Command } from '@commander-js/extra-typings'

import { getChainConfig } from '../lib/chains'
import { createPublicClientForChain, getAddressFromPrivateKey } from '../lib/client'
import { getBalance, getTokenAddress } from '../lib/oft'
import { formatAmount } from '../utils/format'

export const balanceCommand = new Command('balance')
  .description('Check PYUSD balance on a chain')
  .argument('<chain>', 'Chain to check balance on (e.g., ethereum, arbitrum, polygon)')
  .option('-a, --address <address>', 'Address to check (defaults to address derived from PRIVATE_KEY)')
  .action(async (chain, options) => {
    const chainConfig = getChainConfig(chain)

    let address: `0x${string}`
    if (options.address) {
      address = options.address as `0x${string}`
    } else {
      const privateKey = process.env.PRIVATE_KEY
      if (!privateKey) {
        console.error('Error: Either --address flag or PRIVATE_KEY environment variable is required')
        process.exit(1)
      }
      address = getAddressFromPrivateKey(privateKey as `0x${string}`)
    }

    const client = createPublicClientForChain(chain)

    console.log('')
    console.log(`Checking PYUSD balance on ${chainConfig.name}...`)
    console.log('')

    try {
      const tokenAddress = await getTokenAddress(client, chainConfig.pyusdAddress)
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
