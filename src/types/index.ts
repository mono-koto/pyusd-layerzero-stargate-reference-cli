import type { Address, Hex } from 'viem'

// Chain configuration
export interface ChainConfig {
  blockExplorer: string
  chainId: number
  chainKey: string
  eid: number // LayerZero endpoint ID
  name: string
  nativeCurrency: {
    decimals: number
    name?: string
    symbol: string
  }
  tokenAddress: Address // The ERC20 token users hold (PYUSD or PYUSD0)
  oftAddress: Address // The OFT/ProxyOFT contract for bridging
  oftType: 'OFTAdapter' | 'NativeOFT' | 'ProxyOFT' // Adapter=lock/unlock, NativeOFT=single contract, ProxyOFT=mint/burn
  decimals: number
  network: 'pyusd' | 'pyusd0' // Which bridge network this chain belongs to
  rpcUrl: string
}

// LayerZero SendParam struct
export interface SendParam {
  amountLD: bigint
  composeMsg: Hex
  dstEid: number
  extraOptions: Hex
  minAmountLD: bigint
  oftCmd: Hex
  to: Hex // bytes32 padded address
}

// LayerZero MessagingFee struct
export interface MessagingFee {
  lzTokenFee: bigint
  nativeFee: bigint
}

// OFT limit info
export interface OFTLimit {
  maxAmountLD: bigint
  minAmountLD: bigint
}

// OFT fee detail
export interface OFTFeeDetail {
  description: string
  feeAmountLD: bigint
}

// OFT receipt
export interface OFTReceipt {
  amountReceivedLD: bigint
  amountSentLD: bigint
}

// Quote result combining all OFT responses
export interface QuoteResult {
  feeDetails: OFTFeeDetail[]
  limit: OFTLimit
  messagingFee: MessagingFee
  receipt: OFTReceipt
}
