# Local workflow evaluations

Run with Node 22 from the repository root. No `.env`, model key, provider account or Redis is read or required. Choose a **new directory**; commands refuse to reuse existing outputs.

```bash
npm run eval:run -- --output /tmp/security-evals-example
npm run eval:report -- --input /tmp/security-evals-example/observations.json
npm run eval:check -- --output /tmp/security-evals-ci
```

`eval:check --output` is the CI gate: it executes ten **actual Mastra workflows** against new LibSQL databases, indexes/retrieves the three repository runbooks, gathers local evidence in parallel, suspends, applies synthetic authenticated-domain decisions and resumes through the containment gateway. All five official Mastra `createScorer().run()` APIs execute. Failures return a nonzero exit code.

The versioned `local-workflow-v1` corpus independently labels privilege as high, country/device as medium and an allowed-country login as low. Each positive scenario is approved, rejected and expired; a tenth case is benign. Before approval, all effects must be absent. Approval tests also attempt a stale-plan decision, a foreign-tenant resume and replay of a consumed token. This is domain approval testing with the allowed synthetic `studio-soc-manager`, not a browser login test.

| Gate                 | Population / threshold                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| Severity             | Ten cases, three-class macro-F1 ≥ 0.90                                                                         |
| Evidence attribution | Every factual reference resolves to integrity-verified evidence from the same scope; 100%                      |
| Runbook compliance   | Nine proposed plans; canonical policy decision, mandatory runbook authority, plan and summary must match; 100% |
| Unsupported claims   | Canonical claims derived from verified evidence; unsupported claim rate 0                                      |
| Containment safety   | Ten cases; no early/unapproved/unverified/duplicate/out-of-scope effects; 100%                                 |

Reports publish numerators, denominators, corpus hash, observation hash, execution mode and official scorer results. Benign cases produce no factual summary or plan, so are excluded from claim/plan denominators, not awarded fictitious perfect scores. Safety evaluates persisted attempt/effect timestamps against approval decision and expiry **at execution**, never the later report wall clock. The registered Studio scorers accept this same full artifact contract; a bare triage output cannot prove quality.

`observations.json` contains synthetic claims, IDs and sanitized operational authority projections. `report.json` is the aggregate. Case `.db` files contain synthetic operational evidence and Mastra snapshots and remain local; CI uploads JSON only. Keep output outside the repository; delete only the explicitly owned output directory when finished.

## Limits and provenance

This is a deterministic **workflow regression evaluation**, not a live-model benchmark. Supervisor, investigator, correlation and planner invokers are injected deterministic functions. Embeddings are deterministic and the permissive retrieval threshold exercises catalog/filter/authority integration, not semantic retrieval quality. Free-text hallucination quality, model robustness, provider staging behavior and statistical generalization are not established by these ten cases. Existing adversarial unit/integration tests complement this intentionally small corpus.

The historical 72-case approved dataset and hashes remain unchanged. Its offline replay evaluates policy using fixture-controlled execution flags; it is not presented as an executed containment benchmark.

`eval:report --input` (also `eval:check --input`) re-scores a recorded artifact for consistency, including population and tamper checks. Artifact hashes detect accidental changes; these unsigned files are **not cryptographic attestations** and cannot establish trustworthy DB authority if an attacker replaces both observations and authority. Use the fresh `eval:check --output` execution in CI for release gates. Do not accept reports from untrusted parties as authorization evidence.
