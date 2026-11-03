# Research sources

The default `openai-web` provider searches approved domains, retrieves page text, extracts facts, and verifies each proposal independently. URLs discover sources; accepted facts also require exact quotations and semantic support. Deterministic policy applies qualification after verification.

## Change the evidence policy

Edit `sources` in `src/mastra/config/qualification.ts`:

- `additionalDomains`: permit research beyond the submitted company domain.
- `trustedReferences`: allow exact API/CRM source references returned by your adapter.
- `maxEvidenceAgeDays`: limit explicitly dated firmographic claims. Expired or future-dated proposals stay in research history; current proposals determine the fact. If no current proposal remains, the fact is stale. Undated claims keep `asOf: null`; retrieval time isn't a fact date.
- `providerIds`: select registered evidence providers in order.

Page retrieval accepts public HTTPS addresses and HTML/plain text. Every redirect repeats URL/DNS checks and consumes the shared request budget. Documents such as PDFs and pages requiring JavaScript need a separate extraction adapter.

Business model and employee estimates may use supported inference, with a rationale and up to four exact source passages. Estimates remain labeled inferred. Headquarters and buying intent require explicit facts. Missing evidence, contradictory claims, or unsupported citations stay visible for review. A submitted company domain anchors identity; email and CRM references alone don't resolve it.

## Add a source

Implement the documented `EvidenceProvider` contract from `src/mastra/providers/evidence.ts` and supply it through `createApplicationRuntime({ evidence: [provider] })`. Add its ID to `sources.providerIds`. The default registry is in `src/mastra/config/evidence-providers.ts`; the concrete OpenAI adapter lives in `src/mastra/providers/open-ai-evidence/provider.ts`.

| Method                                          | Return                                              |
| ----------------------------------------------- | --------------------------------------------------- |
| `search(branch, context)`                       | Approved source URLs or normalized evidence records |
| `extract(branch, evidence, context)`            | Identity ambiguity and sourced candidate facts      |
| `verify(branch, candidates, evidence, context)` | IDs of candidates supported by their cited material |

A database-backed provider can return evidence directly, without page retrieval or a model. Preserve the source reference, provider ID, collection time, excerpt, and SHA256 digest. Each candidate names its evidence and quotes a contiguous passage. Only authorize trusted references that your integration can substantiate.

Use `context.store.reserve` before external work and settle measured usage afterward. Search calls, page requests, bytes, tokens, retries, and deadlines share one persistent budget. Retain the reservation when usage is unknown. Don't add hidden retries or return unbounded material.

Adapt extraction and verification prompts together, preserving the distinction between observed facts and inferred estimates. Use the [configuration guide](configuration.md) to change categories and qualification criteria.
