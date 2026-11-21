# Real Inngest stream qualification

`qualification.ts` exercises public built package exports against a fresh, owned Inngest dev server. Unlike the shared Vitest setup, it registers agents only: no backing-workflow or cache-routing override is installed. AIMock replaces only model HTTP responses.

From the repository root:

```sh
pnpm turbo build --filter @mastra/inngest... --concurrency=1
pnpm exec tsc --noEmit -p workflows/inngest/tsconfig.qualification.json
cd workflows/inngest
STREAM_QUAL_INNGEST_EVIDENCE_DIR=/absolute/new/evidence-directory pnpm exec tsx test-fixtures/qualification.ts
```

The already-declared Inngest CLI must be installed explicitly with `pnpm --filter @mastra/inngest setup:inngest-cli`, or supplied by `INNGEST_CLI_PATH`. No download or service setup is implicit in this fixture.

Required scenarios:

- Completed replay preserves ordered wire frames and terminal state without a second model request.
- Mid-stream observer detach/reattach leaves execution running: one model request, no tool effects.
- Named approval waits for a suspended snapshot and matching resume label, then executes one tool effect with two model requests. Live and completed replay equal the suspension plus continuation; old suspension does not terminate the continuation.

`public.jsonl` retains frames incrementally, model request journals, effect records, both registered function identities, Mastra/Inngest run joins, provenance and cleanup results. Frame comparisons use JSON representations: absent properties and in-memory `undefined` are equivalent on the wire; no text, indexes, identifiers, terminal frames or ordering are removed. Nonzero exit means qualification failed or evidence is blocked; it is not an accepted product-defect pin.

This is single-process factory-owned transport/cache qualification with real Inngest orchestration. It does not establish cross-process cache sharing, crash recovery, HTTP `/observe` disconnect behavior, or Studio approval adoption. Scheduler, HTTP server, model fixture, workers and storage are owned and cleaned up by the fixture. No production behavior is changed.
