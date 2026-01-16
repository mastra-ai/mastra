---
"@mastra/langfuse": minor
"@mastra/braintrust": minor
"@mastra/posthog": minor
"@mastra/arize": minor
"@mastra/otel-exporter": minor
---

feat(observability): add zero-config environment variable support for all exporters

All observability exporters now support zero-config setup via environment variables. Set the appropriate environment variables and instantiate exporters with no configuration:

- **Langfuse**: `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`
- **Braintrust**: `BRAINTRUST_API_KEY`, `BRAINTRUST_ENDPOINT`
- **PostHog**: `POSTHOG_API_KEY`, `POSTHOG_HOST`
- **Arize/Phoenix**: `ARIZE_SPACE_ID`, `ARIZE_API_KEY`, `ARIZE_PROJECT_NAME`, `PHOENIX_ENDPOINT`, `PHOENIX_API_KEY`, `PHOENIX_PROJECT_NAME`
- **OTEL Providers**:
  - Dash0: `DASH0_API_KEY`, `DASH0_ENDPOINT`, `DASH0_DATASET`
  - SigNoz: `SIGNOZ_API_KEY`, `SIGNOZ_REGION`, `SIGNOZ_ENDPOINT`
  - New Relic: `NEW_RELIC_LICENSE_KEY`, `NEW_RELIC_ENDPOINT`
  - Traceloop: `TRACELOOP_API_KEY`, `TRACELOOP_DESTINATION_ID`, `TRACELOOP_ENDPOINT`
  - Laminar: `LMNR_PROJECT_API_KEY`, `LAMINAR_ENDPOINT`, `LAMINAR_TEAM_ID`

Example usage:
```typescript
// Zero-config - reads from environment variables
new LangfuseExporter()
new BraintrustExporter()
new PosthogExporter()
new ArizeExporter()
new OtelExporter({ provider: { signoz: {} } })
```

Explicit configuration still works and takes precedence over environment variables.
