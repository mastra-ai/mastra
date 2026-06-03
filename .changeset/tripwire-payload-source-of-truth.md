---
'@mastra/core': minor
'@mastra/react': minor
---

Use core's `TripwirePayload` as the source of truth for React SDK tripwire metadata.

**@mastra/core**

Exported the `TripwirePayload` type from `@mastra/core/stream`. This is the canonical payload of the `tripwire` stream chunk (`reason`, `retry?`, `metadata?`, `processorId?`), so consumers can type tripwire UI against it instead of redeclaring it.

```ts
import type { TripwirePayload } from '@mastra/core/stream';
```

**@mastra/react**

`TripwireMetadata` is now an alias of core's `TripwirePayload`, and the message accumulator persists the canonical shape. Two behavioral changes to persisted `metadata.tripwire`:

- The tripwire `reason` is now persisted as `tripwire.reason` (previously it was only stored in the message text part).
- The processor metadata field was renamed from `tripwire.tripwirePayload` to `tripwire.metadata` to match the canonical type.

The `MessageFactory` `Tripwire` slot now receives `reason` through `props.tripwire`.
