# @mastra/trace-import

Resumable trace migration support used by the Mastra CLI.

The initial importer reads completed traces from the Langfuse Observations API v2, requests expanded source metadata, preserves source timestamps and metadata, validates complete trace trees, uploads deterministic Mastra spans through the existing Platform observability collector, and verifies a deterministic sample through the Platform query API. Langfuse virtual roots shaped like `t-<traceId>` can receive a derived end time from their latest complete child and are marked in span metadata.

Use the CLI rather than calling this package directly:

```bash
mastra traces import --provider langfuse --dry-run
```

See [Import traces from Langfuse](https://mastra.ai/docs/mastra-platform/import-langfuse-traces) for setup, credentials, retention behavior, and resume instructions.
