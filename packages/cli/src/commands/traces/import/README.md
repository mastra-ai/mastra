# Trace import architecture

Trace import is internal to the Mastra CLI. This directory defines the boundary
between source providers and the shared import pipeline.

## Provider responsibility

A provider reads its own API and yields `TraceImportRecord` values through the
`TraceImportProvider` contract. It owns:

- authentication and source project discovery;
- pagination and source rate-limit handling;
- reconstructing complete source trace trees;
- source-specific validation and skip reasons;
- mapping source fields into `TraceImportTrace`;
- creating stable destination trace and span IDs.

Provider-specific types and behavior stay inside that provider's directory.

## Shared importer responsibility

The shared importer receives only complete Mastra traces or explicit skip
records. It owns common validation, local preparation, whole-trace batching,
upload retries, resume, verification, reporting, and cleanup.

The shared importer must not import provider-specific types. Adding another
provider should require a new adapter, not another upload pipeline.

## Local preparation and resume

Preparation is an upload-free pass over the provider output. It writes two
private files under `~/.mastra/imports/<target-project>/<import-id>/`:

- `manifest.json` stores source identity, the fixed import window, counts, and
  acknowledged progress.
- `traces.jsonl` stores one complete normalized trace per line.

Upload batches are created in memory from whole JSONL records, so a trace is
never split across requests. After Platform acknowledges a batch, the manifest
advances by that batch's trace count. Resume skips those acknowledged records
and starts at the first pending trace. A batch whose response was lost may be
sent again; provider adapters therefore generate stable destination IDs.

Partial preparation is discarded and downloaded again. The implementation does
not keep source pages, shards, batch files, checksums, or fsync bookkeeping.
Prepared trace data is removed only when the later orchestration layer marks the
overall import successful.

Platform upload, read-back verification, reports, and the customer-facing
command are implemented by later tickets.
