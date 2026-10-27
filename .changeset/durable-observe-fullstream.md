---
'@mastra/core': patch
---

Fixed `observe()` on durable and evented agents throwing `Cannot read private member #options` when reading `fullStream`. Destructured stream methods such as `const { consumeStream } = output` also work on durable and evented agents now.
