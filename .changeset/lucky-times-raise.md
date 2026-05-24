---
'@mastra/core': patch
---

**Added `HarnessEvidence`** — a canonical tagged union over the three durable proof rows a Harness v1 session accumulates: admission/result evidence, workspace journal entries, and inbox response receipts. The new shape gives downstream consumers a single `evidenceKind` discriminator to narrow on, instead of property-presence checks.

**Renamed storage type `OperationAdmissionEvidence` → `HarnessOperationAdmissionEvidence`** to make its admission-only scope explicit. The old name is kept as a deprecated alias, so existing imports continue to compile unchanged.

Type-only release — no storage schema changes, no writer-path changes.
