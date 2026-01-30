// Re-export library functions for programmatic use

// Chain configuration
export {
  getChainConfig,
  getSupportedChains,
  getViemChain,
  CHAIN_CONFIGS,
  getPyusdChains,
  getPyusd0Chains,
  resolveChainConfigsForTransfer,
} from './lib/chains'

// Client utilities
export {
  createPublicClientForChain,
  createWalletClientForChain,
  getAddressFromPrivateKey,
} from './lib/client'

// Stargate API
export {
  fetchStargateQuote,
  executeStargateTransfer,
  isRouteSupported,
  calculateMinAmount as calculateStargateMinAmount,
} from './lib/stargate'

// Formatting utilities
export {
  formatAmount,
  parseAmount,
  formatNativeFee,
  calculateMinAmount,
  truncateAddress,
  PYUSD_DECIMALS,
} from './utils/format'

// Types
export type { ChainConfig } from './types/index'
export type {
  StargateQuoteParams,
  StargateQuote,
  StargateQuoteResult,
  StargateTransferResult,
  StargateStep,
} from './lib/stargate'
