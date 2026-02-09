# Phase 7: Server & Client APIs

**Status:** Planning
**Prerequisites:** Phase 6 (Stores & DefaultExporter)
**Estimated Scope:** HTTP APIs for accessing stored observability data, client SDK

---

## Overview

Phase 7 exposes stored observability data through APIs:
- Server routes for traces, logs, metrics, scores, feedback
- client-js SDK updates for accessing observability data
- CloudExporter for sending data to Mastra Cloud

---

## Package Change Strategy

| PR | Package | Scope |
|----|---------|-------|
| PR 7.1 | `@mastra/server` | API routes for observability data |
| PR 7.2 | `@mastra/client-js` | Client SDK for observability APIs |
| PR 7.3 | `@mastra/observability` | CloudExporter implementation |

---

## API Routes

### Traces
- `GET /api/traces` - List traces with filtering
- `GET /api/traces/:traceId` - Get trace with all spans
- `GET /api/traces/:traceId/spans/:spanId` - Get specific span

### Logs
- `GET /api/logs` - List logs with filtering
- `GET /api/logs/search` - Full-text search logs

### Metrics
- `GET /api/metrics` - List metrics
- `GET /api/metrics/query` - Query metrics with aggregation
- `GET /api/metrics/series` - Get time series data

### Scores
- `GET /api/scores` - List scores with filtering
- `POST /api/scores` - Create score (post-hoc)

### Feedback
- `GET /api/feedback` - List feedback with filtering
- `POST /api/feedback` - Create feedback (post-hoc)

---

## CloudExporter

The CloudExporter sends observability data to Mastra Cloud:

```typescript
export class CloudExporter implements ObservabilityExporter {
  constructor(private config: CloudExporterConfig) {}

  // Implements all signal handlers
  // Batches and sends to Mastra Cloud API
}
```

---

## Definition of Done

- [ ] All API routes implemented and documented
- [ ] client-js SDK provides typed access to all endpoints
- [ ] CloudExporter sends all signal types to Mastra Cloud
- [ ] Authentication and authorization for API routes
- [ ] Rate limiting and pagination
- [ ] All tests pass
