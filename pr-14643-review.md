# Review: PR #14643 — feat(observability): add @mastra/arthur exporter and extract @mastra/openinference

## What this PR does

1. **New `@mastra/arthur` package** — An `OtelExporter` subclass that sends Mastra traces to Arthur AI using OpenInference semantic conventions. Supports zero-config via environment variables (`ARTHUR_API_KEY`, `ARTHUR_BASE_URL`, `ARTHUR_TASK_ID`).

2. **New `@mastra/openinference` package** — Extracts the `OpenInferenceOTLPTraceExporter` class (previously internal to `@mastra/arize`) into a shared package so both Arize and Arthur can reuse it.

3. **Refactors `@mastra/arize`** — Swaps the internal `OpenInferenceOTLPTraceExporter` for an import from `@mastra/openinference`. Removes now-unnecessary direct dependencies on `@arizeai/openinference-genai` and `@opentelemetry/exporter-trace-otlp-proto`.

## What looks good

- **Arthur exporter implementation is clean.** It follows the same patterns as the Arize exporter — env var fallback, `setDisabled()` on missing credentials, consistent config types. Easy to review and understand.

- **Good test coverage.** 13 unit tests for Arthur covering config precedence, disabled states, header merging, resource attributes, and taskId warnings. The OpenInference exporter also gets a standalone 340-line test suite covering span kind mapping, token count conversion, metadata handling, and input/output extraction.

- **README is solid.** Shows both zero-config and explicit setup, optional configuration, and custom metadata usage.

- **JSDoc additions are helpful.** The class and constructor are well-documented with `@example` blocks.

## Concerns

### 1. Premature extraction of `@mastra/openinference`

The PR extracts `OpenInferenceOTLPTraceExporter` into a shared package, but there are only two consumers today: `@mastra/arize` and `@mastra/arthur`. Both happen to use OpenInference conventions because Arthur accepts them — but that's an implementation detail, not a signal that this needs to be a shared abstraction yet.

Creating a shared package has costs: it's a new thing to version, document, and maintain. If a third OpenInference consumer appears later, extraction is straightforward at that point. Right now it's solving a problem that doesn't quite exist yet.

A simpler alternative: Arthur could depend on the `@arizeai/openinference-*` packages directly (like Arize originally did) and have its own copy of the exporter. The duplication is small and contained.

### 2. Protocol lock-in via `@opentelemetry/exporter-trace-otlp-proto`

`@mastra/openinference` has a hard dependency on `@opentelemetry/exporter-trace-otlp-proto` because `OpenInferenceOTLPTraceExporter` extends `OTLPTraceExporter` from that package. This locks the "shared" package to the protobuf transport.

If the package is meant to enable reuse across multiple telemetry sinks, different backends may need different transports (HTTP/JSON, gRPC). As-is, any consumer pulls in the protobuf exporter whether they want it or not.

The actual value of the class is the `export()` method that transforms Mastra span attributes into OpenInference semantic conventions. That logic is entirely transport-independent — it just maps `ReadableSpan` objects. A cleaner design would separate the span transformation from the transport, letting consumers compose it with whatever OTLP exporter they need.

### 3. Vendor ownership of OpenInference

All `@arizeai/openinference-*` npm packages are owned and maintained by Arize AI. There is no vendor-neutral `@openinference/*` scope on npm (unlike Python's PyPI where the packages are published without a vendor prefix). The spec itself lives under the `Arize-ai` GitHub organization.

This means `@mastra/openinference` is built entirely on Arize-owned dependencies. That's fine for `@mastra/arize` itself, but elevating it to a shared Mastra package implicitly positions an Arize-owned convention as core infrastructure. Worth being deliberate about that choice.

### 4. Diff noise from merge commits

The PR branch has been merged with main multiple times, pulling in unrelated changes (scorer tracing in `@mastra/core`, SearchFieldBlock UI fixes in `@mastra/playground-ui`, Sentry span mappings, etc.). This makes the diff harder to review — the actual arthur/openinference work is roughly 15 files, but the diff shows 48 files changed. A rebase would clean this up significantly.

### 5. Missing docs

Per repo guidelines: "If you add a new package, you also MUST add new documentation for that package in `@docs/`." I don't see documentation additions under `docs/` for either `@mastra/arthur` or `@mastra/openinference`.

## Minor notes

- The extracted `openInferenceOTLPExporter.ts` has one small change from the original: `Number(inputTokens) + Number(outputTokens)` (line 89) vs the original `inputTokens + outputTokens`. Reasonable safety improvement, but worth noting since the extraction is otherwise meant to be identical.

- The changeset `warm-keys-take.md` bundles `@mastra/arthur` (minor), `@mastra/openinference` (minor), and `@mastra/arize` (patch) together. Given the arize change is a refactor and arthur is a new package, these could be separate changesets for cleaner changelogs.

## Suggestion

If the goal is to ship Arthur support quickly, the simplest path would be:

1. Ship `@mastra/arthur` as a standalone package that depends on `@arizeai/openinference-*` directly and contains its own copy of the OTLP exporter (like Arize did before this PR).
2. Skip the `@mastra/openinference` extraction for now.
3. Leave `@mastra/arize` unchanged.

If OpenInference reuse becomes a real need (a third consumer, or transport flexibility requirements), extract at that point with a transport-agnostic design.
