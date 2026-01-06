import { Command } from '@commander-js/extra-typings'

import type { SendParam } from '../types/index'

import { getChainConfig } from '../lib/chains'
import { createPublicClientForChain, createWalletClientForChain, getAddressFromPrivateKey } from '../lib/client'
import { checkAndApprove, getBalance, getTokenAddress, quoteSend, send } from '../lib/oft'
import { buildLzReceiveOptions, DEFAULT_GAS_LIMIT } from '../lib/options'
import { addressToBytes32 } from '../utils/address'
import { calculateMinAmount, formatAmount, formatNativeFee, parseAmount, truncateAddress } from '../utils/format'

export const sendCommand = new Command('send')
  .description('Execute a PYUSD cross-chain transfer')
  .argument('<source>', 'Source chain (e.g., ethereum, arbitrum, polygon)')
  .argument('<destination>', 'Destination chain')
  .argument('<amount>', 'Amount of PYUSD to transfer')
  .option('--to <address>', 'Recipient address on destination chain (defaults to sender)')
  .option('--slippage <percent>', 'Slippage tolerance in percent', '0.5')
  .option('--gas <limit>', 'Gas limit for destination lzReceive', String(DEFAULT_GAS_LIMIT))
  .option('--dry-run', 'Simulate transaction without sending', false)
  .action(async (source, destination, amount, options) => {
    const privateKey = process.env.PRIVATE_KEY
    if (!privateKey) {
      console.error('Error: PRIVATE_KEY environment variable is required for sending')
      process.exit(1)
    }

    const srcConfig = getChainConfig(source)
    const dstConfig = getChainConfig(destination)

    const senderAddress = getAddressFromPrivateKey(privateKey as `0x${string}`)
    const recipientAddress = (options.to || senderAddress) as `0x${string}`

    const amountLD = parseAmount(amount)
    const slippagePercent = Number.parseFloat(options.slippage)
    const minAmountLD = calculateMinAmount(amountLD, slippagePercent)

    const sendParam: SendParam = {
      amountLD,
      composeMsg: '0x',
      dstEid: dstConfig.eid,
      extraOptions: buildLzReceiveOptions(BigInt(options.gas)),
      minAmountLD,
      oftCmd: '0x',
      to: addressToBytes32(recipientAddress),
    }

    const publicClient = createPublicClientForChain(source)
    const walletClient = createWalletClientForChain(source, privateKey as `0x${string}`)

    console.log('')
    console.log('PYUSD Cross-Chain Transfer')
    console.log('─'.repeat(50))
    console.log(`From:       ${srcConfig.name} → ${dstConfig.name}`)
    console.log(`Sender:     ${truncateAddress(senderAddress)}`)
    console.log(`Recipient:  ${truncateAddress(recipientAddress)}`)
    console.log(`Amount:     ${amount} PYUSD`)
    console.log('')

    try {
      // Step 1: Check balance
      console.log('Step 1/4: Checking balance...')
      const tokenAddress = await getTokenAddress(publicClient, srcConfig.pyusdAddress)
      const balance = await getBalance(publicClient, tokenAddress, senderAddress)

      if (balance < amountLD) {
        console.error(`Insufficient balance: have ${formatAmount(balance)} PYUSD, need ${amount} PYUSD`)
        process.exit(1)
      }

      console.log(`  ✓ Balance: ${formatAmount(balance)} PYUSD`)
      console.log('')

      // Step 2: Check/set approval
      console.log('Step 2/4: Checking approval...')
      const approvalResult = await checkAndApprove(walletClient, publicClient, srcConfig.pyusdAddress, amountLD)

      if (approvalResult.approved) {
        console.log(`  ✓ Approved (tx: ${truncateAddress(approvalResult.txHash!)})`)
      } else {
        console.log('  ✓ Sufficient allowance (no approval needed)')
      }

      console.log('')

      // Step 3: Get quote
      console.log('Step 3/4: Getting quote...')
      const quote = await quoteSend(publicClient, srcConfig.pyusdAddress, sendParam)
      console.log(`  ✓ Fee: ${formatNativeFee(quote.messagingFee.nativeFee, srcConfig.nativeCurrency.symbol)}`)
      console.log(`  ✓ Will receive: ${formatAmount(quote.receipt.amountReceivedLD)} PYUSD`)
      console.log('')

      // Step 4: Send (or dry run)
      if (options.dryRun) {
        console.log('Step 4/4: Dry run (skipping actual send)')
        console.log('  ✓ Transaction simulation successful')
        console.log('')
        console.log('─'.repeat(50))
        console.log('Dry run complete. Remove --dry-run flag to execute.')
        console.log('')
        return
      }

      console.log('Step 4/4: Sending transaction...')
      const { guid, txHash } = await send(
        walletClient,
        publicClient,
        srcConfig.pyusdAddress,
        sendParam,
        quote.messagingFee,
        senderAddress,
      )

      console.log(`  ✓ Transaction sent!`)
      console.log('')

      // Display results
      console.log('Results')
      console.log('─'.repeat(50))
      console.log(`TX Hash:      ${txHash}`)
      console.log(`Explorer:     ${srcConfig.blockExplorer}/tx/${txHash}`)
      if (guid !== '0x') {
        console.log(`LayerZero:    https://layerzeroscan.com/tx/${txHash}`)
      }

      console.log('')
      console.log('Status: Pending (check LayerZero scan for cross-chain delivery)')
      console.log('')
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Transaction failed: ${error.message}`)
      }
      process.exit(1)
    }
  })
