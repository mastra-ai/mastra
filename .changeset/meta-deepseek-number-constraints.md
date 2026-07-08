---
'@mastra/schema-compat': patch
---

Fixed Meta (Llama) and DeepSeek schemas leaking raw number bounds to the model. A field like `z.number().int()` was sent to the model with bogus `minimum: -9007199254740991` / `maximum: 9007199254740991` values, and `z.number().min(1).max(50)` leaked `minimum`/`maximum` keywords, even though OpenAI, Google, and Anthropic already strip these. Numeric constraints are now moved into the field description for Meta and DeepSeek too, matching the other providers.

**Before** (Meta/DeepSeek, `z.object({ age: z.number().min(0).max(120) })`):

```json
{ "age": { "type": "number", "minimum": 0, "maximum": 120 } }
```

**After**:

```json
{ "age": { "type": "number", "description": "constraints: greater than or equal to 0, lower than or equal to 120" } }
```

Closes #19072.
