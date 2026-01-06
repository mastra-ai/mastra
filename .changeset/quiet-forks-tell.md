---
'@mastra/ai-sdk': patch
'@mastra/core': patch
---

Refactor the MessageList class from ~4000 LOC monolith to ~850 LOC with focused, single-responsibility modules. This improves maintainability, testability, and makes the codebase easier to understand.

- Extract message format adapters (AIV4Adapter, AIV5Adapter) for SDK conversions
- Extract TypeDetector for centralized message format identification
- Extract MessageStateManager for tracking message sources and persistence
- Extract MessageMerger for streaming message merge logic
- Extract StepContentExtractor for step content extraction
- Extract CacheKeyGenerator for message deduplication
- Consolidate provider compatibility utilities (Gemini, Anthropic, OpenAI)

```
message-list/
├── message-list.ts        # Main class (~850 LOC, down from ~4000)
├── adapters/              # SDK format conversions
│   ├── AIV4Adapter.ts     # MastraDBMessage <-> AI SDK V4
│   └── AIV5Adapter.ts     # MastraDBMessage <-> AI SDK V5
├── cache/
│   └── CacheKeyGenerator.ts  # Deduplication keys
├── conversion/
│   ├── input-converter.ts    # Any format -> MastraDBMessage
│   ├── output-converter.ts   # MastraDBMessage -> SDK formats
│   ├── step-content.ts       # Step content extraction
│   └── to-prompt.ts          # LLM prompt formatting
├── detection/
│   └── TypeDetector.ts       # Format identification
├── merge/
│   └── MessageMerger.ts      # Streaming merge logic
├── state/
│   └── MessageStateManager.ts # Source & persistence tracking
└── utils/
    └── provider-compat.ts    # Provider-specific fixes
```
