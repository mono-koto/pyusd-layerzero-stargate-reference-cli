import { Command } from '@commander-js/extra-typings'

import { resolveChainConfigsForTransfer } from '../lib/chains'
import { createPublicClientForChain } from '../lib/client'
import { resolveAddress } from '../lib/input-validation'
import { quoteSend } from '../lib/oft'
import { DEFAULT_GAS_LIMIT } from '../lib/options'
import { prepareSendParam } from '../lib/send-preparation'
import { formatAmount, formatNativeFee } from '../utils/format'

export const quoteCommand = new Command('quote')
  .description('Get a fee quote for a PYUSD cross-chain transfer')
  .argument('<source>', 'Source chain (e.g., ethereum, arbitrum, polygon)')
  .argument('<destination>', 'Destination chain')
  .argument('<amount>', 'Amount of PYUSD to transfer')
  .option('--to <address>', 'Recipient address on destination chain (defaults to sender)')
  .option('--slippage <percent>', 'Slippage tolerance in percent', '0.5')
  .option('--gas <limit>', 'Gas limit for destination lzReceive', String(DEFAULT_GAS_LIMIT))
  .action(async (source, destination, amount, options) => {
    const { srcConfig, dstConfig } = resolveChainConfigsForTransfer(source, destination)

    // Resolve recipient address
    const recipientAddress = resolveAddress({ address: options.to })

    // Prepare SendParam with all parameters
    const { sendParam, minAmountLD } = prepareSendParam({
      amount,
      dstEid: dstConfig.eid,
      recipient: recipientAddress,
      slippage: options.slippage,
      gas: options.gas,
    })

    const client = createPublicClientForChain(srcConfig)

    console.log('')
    console.log('PYUSD Transfer Quote')
    console.log('─'.repeat(50))

    try {
      const quote = await quoteSend(client, srcConfig.oftAddress, sendParam)

      console.log(`Source:         ${srcConfig.name} (EID: ${srcConfig.eid})`)
      console.log(`Destination:    ${dstConfig.name} (EID: ${dstConfig.eid})`)
      console.log(`Recipient:      ${recipientAddress}`)
      console.log(`Amount:         ${amount} PYUSD`)
      console.log('')
      console.log('Fees')
      console.log('─'.repeat(50))
      console.log(`LayerZero Fee:  ${formatNativeFee(quote.messagingFee.nativeFee, srcConfig.nativeCurrency.symbol)}`)

      if (quote.feeDetails.length > 0) {
        for (const fee of quote.feeDetails) {
          console.log(`Protocol Fee:   ${formatAmount(fee.feeAmountLD)} PYUSD (${fee.description})`)
        }
      }

      console.log('')
      console.log('Amounts')
      console.log('─'.repeat(50))
      console.log(`Amount Sent:     ${formatAmount(quote.receipt.amountSentLD)} PYUSD`)
      console.log(`Amount Received: ${formatAmount(quote.receipt.amountReceivedLD)} PYUSD`)
      console.log(`Min Received:    ${formatAmount(minAmountLD)} PYUSD (${options.slippage}% slippage)`)

      console.log('')
      console.log('Limits')
      console.log('─'.repeat(50))
      console.log(`Min Transfer:   ${formatAmount(quote.limit.minAmountLD)} PYUSD`)
      console.log(`Max Transfer:   ${formatAmount(quote.limit.maxAmountLD)} PYUSD`)
      console.log('')
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to get quote: ${error.message}`)
      }
      process.exit(1)
    }
  })
