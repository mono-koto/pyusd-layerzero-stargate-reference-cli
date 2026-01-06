// Re-export library functions for programmatic use
export { getChainConfig, getSupportedChains, getViemChain, CHAIN_CONFIGS, isTestnet } from './lib/chains'
export { createPublicClientForChain, createWalletClientForChain, getAddressFromPrivateKey } from './lib/client'
export { getBalance, getTokenAddress, quoteSend, send, checkAndApprove } from './lib/oft'
export { buildLzReceiveOptions, DEFAULT_GAS_LIMIT } from './lib/options'
export { addressToBytes32, bytes32ToAddress } from './utils/address'
export { formatAmount, parseAmount, formatNativeFee, calculateMinAmount } from './utils/format'
export type { ChainConfig, SendParam, MessagingFee, QuoteResult } from './types/index'
