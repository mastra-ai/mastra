# @mastra/evm

EVM blockchain integration for [Mastra](https://mastra.ai) — give your AI agents the ability to interact with Ethereum and EVM-compatible blockchains.

## Tools

| Tool | Description |
|------|-------------|
| `evm-get-balance` | Get native token balance (ETH, MATIC, etc.) for any address |
| `evm-get-token-balance` | Get ERC-20 token balance with automatic metadata (symbol, decimals) |
| `evm-read-contract` | Call any view/pure function on a smart contract |
| `evm-get-transaction` | Fetch transaction details by hash |
| `evm-resolve-ens` | Resolve ENS names to addresses and reverse |
| `evm-get-block` | Get block information by number or latest |

## Supported Chains

Ethereum, Sepolia, Arbitrum, Optimism, Polygon, Base, Avalanche, BSC, Gnosis, Fantom, Celo, Zora, Scroll, Linea, Blast.

All chains use public RPCs by default. Pass a custom `rpcUrl` for better rate limits.

## Installation

```bash
npm install @mastra/evm
# or
pnpm add @mastra/evm
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { getBalance, getTokenBalance, readContract, resolveEns } from '@mastra/evm';

const agent = new Agent({
  name: 'web3-agent',
  instructions: 'You are a blockchain analyst that can query on-chain data.',
  model: openai('gpt-4o'),
  tools: { getBalance, getTokenBalance, readContract, resolveEns },
});

// The agent can now answer questions like:
// "What is vitalik.eth's ETH balance?"
// "How many USDC does 0x... hold on Arbitrum?"
// "What is the totalSupply of the USDT contract?"
```

## Custom RPC

Every tool accepts an optional `rpcUrl` parameter for using your own RPC endpoint:

```typescript
// Agent will use custom RPC when calling tools
const result = await getBalance.execute({
  address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  chainId: 1,
  rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY',
});
```

## License

Apache-2.0
