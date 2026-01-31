import { Command } from '@commander-js/extra-typings'

interface LayerZeroMessage {
  pathway: {
    srcEid: number
    dstEid: number
    sender: { address: string; name?: string; chain?: string }
    receiver: { address: string; name?: string; chain?: string }
  }
  source: {
    status: string
    tx: {
      txHash: string
      blockTimestamp: number
      from: string
    }
  }
  destination?: {
    status: string
    tx?: {
      txHash: string
      blockTimestamp: number
    }
  }
  status: {
    name: string
    message: string
  }
  guid: string
  created: string
  updated: string
}

interface LayerZeroResponse {
  data: LayerZeroMessage[]
}

export const statusCommand = new Command('status')
  .description('Check the status of a cross-chain transfer')
  .argument('<txHash>', 'Source chain transaction hash')
  .action(async (txHash) => {
    console.log('')
    console.log('Checking LayerZero message status...')
    console.log('')

    try {
      const response = await fetch(`https://scan.layerzero-api.com/v1/messages/tx/${txHash}`)

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`)
      }

      const data = (await response.json()) as LayerZeroResponse

      if (!data.data || data.data.length === 0) {
        console.log('No LayerZero message found for this transaction.')
        console.log('It may not be a cross-chain transfer or is still being indexed.')
        console.log('')
        return
      }

      const message = data.data[0]

      console.log('Cross-Chain Transfer Status')
      console.log('─'.repeat(60))
      console.log(`Status:       ${formatStatus(message.status.name)}`)
      console.log(`Message:      ${message.status.message}`)
      console.log(`GUID:         ${message.guid}`)
      console.log('')
      console.log('Source')
      console.log('─'.repeat(60))
      console.log(`Chain:        ${message.pathway.sender.chain || `EID ${message.pathway.srcEid}`}`)
      console.log(`From:         ${message.source.tx.from}`)
      console.log(`TX Hash:      ${message.source.tx.txHash}`)
      console.log(`Timestamp:    ${formatTimestamp(message.source.tx.blockTimestamp)}`)
      console.log('')
      console.log('Destination')
      console.log('─'.repeat(60))
      console.log(`Chain:        ${message.pathway.receiver.chain || `EID ${message.pathway.dstEid}`}`)

      if (message.destination?.tx) {
        console.log(`TX Hash:      ${message.destination.tx.txHash}`)
        console.log(`Timestamp:    ${formatTimestamp(message.destination.tx.blockTimestamp)}`)
      } else {
        console.log(`TX Hash:      (pending)`)
      }

      console.log('')
      console.log('Links')
      console.log('─'.repeat(60))
      console.log(`LayerZero:    https://layerzeroscan.com/tx/${txHash}`)
      console.log('')
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to get status: ${error.message}`)
      }
      process.exit(1)
    }
  })

function formatStatus(status: string): string {
  const statusIndicators: Record<string, string> = {
    DELIVERED: '✓ DELIVERED',
    INFLIGHT: '⏳ INFLIGHT',
    CONFIRMING: '⏳ CONFIRMING',
    FAILED: '✗ FAILED',
    BLOCKED: '⚠ BLOCKED',
    PAYLOAD_STORED: '📦 PAYLOAD_STORED',
  }
  return statusIndicators[status] || status
}

function formatTimestamp(unixTimestamp: number | undefined): string {
  if (!unixTimestamp) {
    return '(pending)'
  }
  const date = new Date(unixTimestamp * 1000)
  if (isNaN(date.getTime())) {
    return '(pending)'
  }
  return date.toLocaleString()
}
