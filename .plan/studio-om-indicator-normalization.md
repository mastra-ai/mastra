# Normalize Studio OM indicators

## Context

Studio OM buffering/extraction indicators are currently fragile. The UI reconstructs state from raw `data-om-*` parts, synthetic buffering-end injection, buffer-status responses, post-stream refetches, and a local extraction cache.

Relevant files:

- `packages/playground/src/services/om-parts-converter.ts`
- `packages/playground/src/lib/ai-ui/chat/chat-provider.tsx`
- `packages/playground/src/lib/ai-ui/chat/use-chat-send-handler.ts`
- `packages/server/src/server/schemas/memory.ts`

Recent bugs followed this pattern:

- extraction data appears during streaming but disappears after stream end
- extraction data appears only after reload
- buffering state appears but extracted values are missing
- server schemas preserve top-level record data but strip chunk data

The root issue is that there is no single authoritative UI model for an OM cycle.

## Proposed direction

Introduce a normalized OM cycle view model that all UI paths feed into:

```ts
interface OmCycleViewModel {
  cycleId: string;
  recordId?: string;
  operationType?: 'observation' | 'reflection';
  status:
    | 'observing'
    | 'observed'
    | 'buffering'
    | 'buffering-complete'
    | 'activated'
    | 'failed'
    | 'disconnected';
  startedAt?: string;
  completedAt?: string;
  tokensBuffered?: number;
  tokensObserved?: number;
  observations?: string;
  extractedValues?: Record<string, unknown>;
  extractionFailures?: Array<{ slug: string; error: string }>;
}
```

Then:

- raw stream parts become cycle events
- buffer-status response becomes cycle events
- persisted thread-message parts become cycle events
- badge rendering consumes only `OmCycleViewModel`

## Why this should help

Instead of patching every lifecycle edge, we can test one reducer/normalizer:

```ts
reduceOmCycleEvent(previous, event) -> next
```

This makes precedence explicit:

- terminal data beats start data
- richer extraction data is retained if later snapshots are poorer
- failed beats loading
- disconnected only applies if there is no terminal state
- activation maps token fields consistently

## Implementation sketch

1. Add failing E2E tests for the live buffering/extraction journeys before refactoring.
2. Decide whether extraction results should remain embedded in buffering/observation terminal parts or move to separate extraction data parts.
3. Add `om-cycle-normalizer.ts` near `om-parts-converter.ts`.
4. Move cycle merge/cache rules out of React component code.
5. Convert raw message parts into normalized events.
6. Convert buffer-status record/chunks into normalized events.
7. Render badges from normalized cycles.
8. Keep existing raw part conversion as an adapter until all paths are migrated.

## Extraction data part split

We should explicitly evaluate splitting extraction results out of buffering lifecycle parts.

Current shape couples extraction data to terminal lifecycle markers like `data-om-buffering-end` and `data-om-observation-end`. That makes the UI sensitive to whichever lifecycle part arrives last or survives a refetch.

Possible alternative:

```ts
data-om-extraction-result
```

with:

```ts
{
  cycleId: string;
  recordId?: string;
  extractedValues?: Record<string, unknown>;
  extractionFailures?: Array<{ slug: string; error: string }>;
}
```

The normalizer could then merge lifecycle state and extraction state independently. That may make streaming/reload behavior less fragile.

## Testing strategy

Start by writing failing E2E coverage for the actual broken user journeys. The service-level tests are still valuable, but they should support the E2E failures rather than replace them.

E2E cases to write first:

- buffering marker appears during streaming
- extracted values appear during buffering completion
- extracted values remain visible after stream end/refetch
- extracted values remain visible after page reload
- extraction failures render consistently across stream end and reload

Then add focused service tests for the normalizer/reducer:

- stream start + stream end
- buffering start + buffer-status end
- extraction fields retained across poorer post-stream snapshot
- reload from persisted messages
- activation marker merging
- failed/disconnected precedence

Relevant existing service test:

```sh
pnpm --filter ./packages/playground exec vitest run \
  src/services/om-parts-converter.test.ts \
  --reporter=dot --bail 1
```

Because this touches Playground UI behavior, follow the repo's playground testing guidance: use MSW/Vitest for reducer/client behavior and Playwright E2E for the cross-page live streaming/reload journey.

## Non-goals

- Do not change OM persistence semantics in this workstream unless the normalizer exposes a real missing backend field.
- Do not change extractor behavior.
- Do not change working memory behavior.
