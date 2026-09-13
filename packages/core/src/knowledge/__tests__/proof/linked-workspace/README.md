# Final Knowledge linked-consumer proof

From the monorepo root, build Core, LibSQL and Memory first. Then use fresh output directories:

```sh
export KNOWLEDGE_W4_WORKSPACE="$PWD/.mastracode/plans/knowledge-v2-wave-4-completion.proof/workspace"
pnpm --filter ./packages/core exec tsx src/knowledge/__tests__/proof/create-wave-4-linked-workspace.ts --out "$KNOWLEDGE_W4_WORKSPACE"
pnpm --dir "$KNOWLEDGE_W4_WORKSPACE" install --offline --ignore-workspace
pnpm --dir "$KNOWLEDGE_W4_WORKSPACE" check
# OPENAI_API_KEY must be supplied through the environment, never written to artifacts.
pnpm --dir "$KNOWLEDGE_W4_WORKSPACE" wave4 -- --out ../run
pnpm --dir "$KNOWLEDGE_W4_WORKSPACE" teardown
```

The default journey requires a real provider and fails before creating output if credentials are missing. `--deterministic` explicitly runs only the non-provider scenarios; its verdict and JSON cannot be mistaken for provider evidence.

The consumer links built package exports, rather than importing package source. The existing checked-in Shipyard fixture helpers are copied into the disposable consumer, just as in the W4.8 proof. This is the approved linked-workspace boundary, not packed-artifact or published-distribution verification.

The script runs durable seed and restart in separate processes, verifies replay and private evidence, then exercises source verification, stale-evidence rejection, checkpoint-finalization failure and recovery on file-backed and private-memory LibSQL. The default also compiles the full Shipyard instance description through a host-supplied real-provider compiler, recovers an injected pre-apply failure, then reopens the database in a fresh process and verifies identical scope IDs and zero recompilation. Public-readonly, teammate-suggest-only and importer-write capabilities, plus private node/record reads, are checked in both processes. Scope labels can remain visible through membership in a public parent; this is not a scope-label hiding proof. This proves initial concrete structure, not automatic enforcement of the description's provenance, capture, promotion, or future-template policies; those have separate runtime proofs. Finally it runs a native maintenance goal with a real provider. Expect one `PASS` line per scenario followed by `PROOF: GREEN — final linked-consumer real-provider journey`.

`result.json` and `transcript.txt` contain sanitized verdicts, IDs and counters, not raw provider payloads. Disposable databases are removed in `finally`; the linked workspace and summary artifacts remain for review. Existing workspace/output directories are rejected, not deleted. `teardown` is a no-op because each journey cleans its own databases and launches no persistent service.

The GitHub source responses in this journey are deterministic fixtures. Live GitHub imports, curation/canvas Playwright, TUI, compiler scope-template/non-retrofit scenarios, four-adapter parity and skill install/update remain separate required proof-index entries. This journey does not publish, edit Shipyard, deploy, or claim whole-program completion.
