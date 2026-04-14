---
'@mastra/server': minor
---

Added HTTP endpoints for managing agent rollouts and experiments, plus rollout-aware version resolution in generate/stream endpoints.

### New endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/agents/:agentId/rollout` | Get the active rollout (with live score summaries) |
| `POST` | `/agents/:agentId/rollout` | Start a canary rollout or A/B experiment |
| `PATCH` | `/agents/:agentId/rollout` | Update candidate weight (canary only) |
| `POST` | `/agents/:agentId/rollout/promote` | Promote candidate to active (or pick A/B winner) |
| `POST` | `/agents/:agentId/rollout/rollback` | Roll back to the stable version |
| `DELETE` | `/agents/:agentId/rollout` | Cancel an active rollout |
| `GET` | `/agents/:agentId/rollout/results` | Query per-version score breakdowns (avg, stddev, min, max) |
| `GET` | `/agents/:agentId/rollouts` | List rollout history (paginated) |

### Starting a canary rollout

```json
POST /agents/:agentId/rollout
{
  "type": "canary",
  "candidateVersionId": "version-abc123",
  "candidateWeight": 10,
  "routingKey": "resourceId",
  "rules": [
    {
      "scorerId": "quality-scorer",
      "threshold": 0.7,
      "windowSize": 100,
      "action": "rollback"
    }
  ]
}
```

This starts routing 10% of traffic to the candidate version. If the quality scorer's average drops below 0.7 over the last 100 scores, the rollout auto-rolls back.

### Starting an A/B experiment

```json
POST /agents/:agentId/rollout
{
  "type": "ab_test",
  "allocations": [
    { "versionId": "version-A", "weight": 50, "label": "control" },
    { "versionId": "version-B", "weight": 50, "label": "variant" }
  ]
}
```

### Ramping up a canary

```json
PATCH /agents/:agentId/rollout
{ "candidateWeight": 50 }
```

### Rollout-aware version resolution

When an active rollout exists and no explicit `agentVersionId` is in the request, the generate and stream endpoints automatically resolve the version from the rollout's traffic split. This is transparent to callers — the agent just works with the right version.

Affected routes: `GENERATE_AGENT_ROUTE`, `STREAM_GENERATE_ROUTE`, `GENERATE_LEGACY_ROUTE`, `STREAM_GENERATE_LEGACY_ROUTE`, `NETWORK_ROUTE`.
