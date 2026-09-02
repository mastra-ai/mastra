# Knowledge v2 Wave 4 completion proof

This index records rerunnable proof for each Wave 4 segment. Generated databases, screenshots, traces, videos, and provider payloads remain ignored/private.

## Curator runtime

```bash
pnpm --filter ./packages/core exec tsx src/knowledge/curation/__tests__/proof/curator-proof.ts
```

Expected: `PROOF: GREEN`; adversarial intake remains data, grants do not change during the run, retain leaves an item unintegrated, promotion preserves provenance and record restamps, and hidden scopes remain absent.

## Curation UI

```bash
export KNOWLEDGE_PROOF_OUTPUT="$PWD/.mastracode/plans/knowledge-v2-wave-4-completion.proof/playwright/curation-ui"
rm -rf "$KNOWLEDGE_PROOF_OUTPUT"
pnpm --filter ./mastracode/factory-ui exec playwright test --config e2e/playwright.config.ts e2e/knowledge/curation.spec.ts --reporter=line
```

Expected: 2/2 tests pass through real Factory routes backed by LibSQL. The owner journey independently refines, merges, retains, discards, and promotes provisional items. The suggest-only journey creates a pending promotion proposal and opens its authorized Approvals detail. Fresh proof output includes `results.json`, `curation-owner.png`, `curation-suggest.png`, and one trace/video pair per journey under `artifacts/`.

Latest verified output (2026-09-02):

- `results.json`: `ee82eed3fb0c318e74001a4aa72ab56df7077fefc1ac99d001737f6f53579de9`
- `curation-owner.png`: `3cea090a3f6cd7ae0ab03580a721339852027ae976f52a9456a14d814ea8a6d2`
- `curation-suggest.png`: `d71f2b224e9da3752cab6473538c79e781f537b2f8cc8db94190404571ee20b0`
