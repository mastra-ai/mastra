---
'@mastra/core': patch
---

Fixed tool calls failing validation when the model's arguments needed more than one automatic fix. Tool calls that send lists or objects as text, send `null` for optional fields, or use `query`, `message`, or `input` instead of `prompt` now validate even when several of these happen in the same call. For example, `{ args: '["a.py"]', note: null }` is now accepted.
