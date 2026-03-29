---
"@mastra/evm": minor
---

Added `@mastra/evm` for Mastra agents to read data from Ethereum and EVM-compatible chains.

**What you can do**
- `evm-get-balance` — query native token balance on any EVM chain
- `evm-get-token-balance` — query ERC-20 token balances with auto metadata
- `evm-read-contract` — call any view/pure function on a smart contract
- `evm-get-transaction` — fetch transaction details by hash
- `evm-resolve-ens` — resolve ENS names to addresses and reverse
- `evm-get-block` — get block information by number or latest

Supports 15 chains out of the box, including Ethereum, Arbitrum, Optimism, Polygon, Base, and Avalanche. Custom RPC URLs are supported across all tools.

**Example**
```ts
import { getBalance, readContract } from '@mastra/evm';
```
