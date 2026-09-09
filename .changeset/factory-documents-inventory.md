---
'@mastra/factory': minor
---

Added a Documents inventory to the Factory: the essential business and technical documents of a project (product vision, personas, user stories, business rules, glossary, process flows, architecture, ADRs, data model, API spec, coding standards, testing strategy, runbook, security & compliance) live as markdown in the repository under `docs/factory/`, mapped by `docs/factory/manifest.yaml`, and the factory keeps a synced copy so the UI and the agents can read them without a checkout.

**What changed**

- Every session sandbox materialization re-syncs the project's documents from the remote default branch into the new `documents` storage domain (`factory_documents` table). Reads use `git show origin/<default>:<path>`, never the working tree, so untrusted PR checkouts cannot become default-branch truth.
- New routes: `GET /web/factory/projects/:id/documents` (catalog + per-kind status, no bodies), `GET /web/factory/projects/:id/documents/:kind` (one document with markdown body), and `POST /web/factory/projects/:id/documents/refresh` (re-sync from a live sandbox; `409 no_active_sandbox` when none holds the repository).
- Every skill-invocation kickoff now carries a `<factory-docs>` index block after the work-item feed, and bound sessions get a `factory_read_document` tool to read a document by kind or path. The transcript renders the index as a collapsed "Project documents" row.
- The bundled triage, plan, and review skills read the relevant documents and require code changes to update affected documents and the manifest in the same branch and PR. Documents are never a separate work item.
- Factory UI: a new **Documents** page under Audit log lists the catalog by group with present / missing / too-large status, renders the selected document, deep links via `?doc=<kind>`, and offers Refresh.

**Getting started**

Add a manifest and the documents you have to the repository:

```yaml
# docs/factory/manifest.yaml
version: 1
documents:
  architecture: docs/factory/architecture.md
  business-rules: docs/factory/business-rules.md
```

Start any run so the sandbox checks out the repository, then open Factory › Documents. Kinds the repository lacks show as missing with their expected path; agents create them alongside the code change that touches that area.
