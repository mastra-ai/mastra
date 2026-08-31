# Knowledge importer linked-workspace proofs

This consumer links the current workspace builds of `@mastra/core`, `@mastra/memory`, `@mastra/libsql`, and `@mastra/pg`.

Materialize it with `create-linked-workspace.ts` and install with `pnpm install --offline`.

## Calendar reconciliation

```bash
KNOWLEDGE_ADAPTER=libsql pnpm calendar -- --scenario all --out ../libsql
KNOWLEDGE_ADAPTER=pg pnpm calendar -- --scenario all --out ../pg
```

The calendar scenario proves crash-before-cursor replay, UUID stability, update reconciliation, omission safety, explicit owned removal, cron overlap skipping, webhook FIFO behavior, distinct-binding concurrency, and run-linked activity.

## Shipyard-shaped GitHub import

```bash
GITHUB_TOKEN="$GITHUB_TOKEN" OPENAI_API_KEY="$OPENAI_API_KEY" MODEL_ID=openai/gpt-5-mini \
  pnpm github -- --out ../github
```

The GitHub scenario reads a bounded real `mastra-ai/mastra` issue, merged pull request, and changed-source window; restarts before its static SHA checkpoint; replays to stable identities; then uses a real provider and resource-scoped observational memory to distill one provenance-linked feature decision. It writes sanitized `result.json` and `transcript.txt` artifacts and removes its local database during teardown.
