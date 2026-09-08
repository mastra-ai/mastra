---
'@mastra/clickhouse': patch
---

Added observability feedback and score deletion. ClickHouse records deletion requests without an open-source retention period and immediately hides matching rows with lightweight deletes. Physical purge depends on configured signal retention, which open-source deployments don't enable by default. Rows in the short-lived delta tables aren't touched and expire within two days.

```typescript
await observability.deleteFeedback({ feedbackIds: ['feedback-1'] });
await observability.deleteScores({ scoreIds: ['score-1'], organizationId: 'org-1' });
```
