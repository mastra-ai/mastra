---
"@mastra/evm": minor
---

feat: add EVM blockchain integration

New `@mastra/evm` package that gives Mastra agents the ability to interact with Ethereum and EVM-compatible blockchains via viem.

Tools included:
- `evm-get-balance` — query native token balance on any EVM chain
- `evm-get-token-balance` — query ERC-20 token balances with auto metadata
- `evm-read-contract` — call any view/pure function on a smart contract
- `evm-get-transaction` — fetch transaction details by hash
- `evm-resolve-ens` — resolve ENS names to addresses and reverse
- `evm-get-block` — get block information by number or latest

Supports 15 chains out of the box: Ethereum, Sepolia, Arbitrum, Optimism, Polygon, Base, Avalanche, BSC, Gnosis, Fantom, Celo, Zora, Scroll, Linea, Blast. Custom RPC URLs supported on all tools.
