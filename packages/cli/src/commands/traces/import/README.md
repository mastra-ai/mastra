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

This first architecture ticket defines only this contract. Provider readers,
mapping, preparation, upload, verification, and the customer-facing command are
implemented by later tickets.
