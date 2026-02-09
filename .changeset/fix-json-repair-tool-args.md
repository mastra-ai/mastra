---
'@mastra/core': patch
---

Tool calls with malformed JSON arguments from certain LLM providers (e.g., Kimi/K2) are now automatically repaired instead of silently setting `args` to `undefined`. (#11078)

The following malformation patterns are handled:

- **Missing opening quote on property names**: `{"a":"b",c":"d"}` → `{"a":"b","c":"d"}`
- **Fully unquoted property names**: `{command:"ls"}` → `{"command":"ls"}`
- **Single quotes instead of double quotes**: `{'key':'val'}` → `{"key":"val"}`
- **Trailing commas**: `{"a":1,}` → `{"a":1}`

Repair is applied automatically in the V5 stream transform when `JSON.parse()` fails on tool call input. If repair also fails, the existing fallback (`args: undefined`) is preserved. A `tryRepairJson` utility is exported from `@mastra/core` for advanced use cases:

```ts
import { tryRepairJson } from '@mastra/core/stream/aisdk/v5/transform';

const result = tryRepairJson('{command:"git status",verbose:true,}');
// => { command: "git status", verbose: true }
```

