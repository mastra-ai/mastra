---
name: mastra-knowledge
description: Build and operate Mastra Knowledge v2 with scoped authorization, capture, curation, importers, and the Knowledge UI.
metadata:
  version: '1.0.0'
---

# Mastra Knowledge

Use this skill when adding or changing a Mastra Knowledge integration. It describes the canonical Knowledge v2 API shipped with this package.

## Start here

1. Create one application-wide `Knowledge` instance with a stable `id` and durable storage.
2. Register it in `new Mastra({ knowledge: { ... } })`.
3. Model access with live scope nodes and grants. The host, not model-generated content, vouches for the caller's scope IDs.
4. Pass authorized scope IDs on every operation. Authorization happens before ranking, counts, pagination, cursor creation, and response shaping.
5. Use importers or resource-boundary capture to ingest facts. Captured facts enter uncurated companion scopes.
6. Register a host-bound curator profile before creating an autonomous curator.
7. Use the Knowledge UI to inspect scopes, bounded graph lenses, curation work, proposals, imports, and activity.

## Read the relevant reference

| Task                                                              | Reference                                      |
| ----------------------------------------------------------------- | ---------------------------------------------- |
| Configure instances, structure, descriptions, and scope templates | [Configuration](./references/configuration.md) |
| Model host-vouched scope access and roles                         | [Access and scopes](./references/access.md)    |
| Create, read, update, search, and delete nodes and records        | [Nodes and records](./references/records.md)   |
| Build resumable, idempotent importers                             | [Importers](./references/imports.md)           |
| Capture knowledge from sessions                                   | [Capture](./references/capture.md)             |
| Register profiles and run curation                                | [Curation](./references/curation.md)           |
| Navigate and operate the Knowledge UI                             | [Knowledge UI](./references/ui.md)             |

## Non-negotiable invariants

- Treat scope IDs as opaque UUIDs. Names and addresses don't imply containment.
- Use `nodeId -> scopeNodeId` memberships for nodes and `record_scopes` for records.
- Never derive authority from user identity, captured content, wikilinks, or target content scopes.
- Hidden resources behave as absent resources. Don't reveal their existence through errors or metadata.
- Use numeric versions for compare-and-swap mutations and retry from fresh authorized state after conflicts.
- Description-compiled reconciliation is additive and idempotent. It doesn't retrofit pre-existing scopes or recreate explicitly deleted scopes.
- A mirror or uncurated companion is an ordinary node with a special role, not a privileged bypass.
- Keep import state in the importer's durable key-value state. Don't use knowledge records as checkpoints.
- Keep requests bounded and follow returned cursors. Never scan an entire Knowledge instance to render one view.

## Verify against installed types

The API evolves with the installed package. Before writing code, inspect exports from `@mastra/core/knowledge` and the storage adapter version in the project. Prefer the package's TypeScript types over copied snippets.
