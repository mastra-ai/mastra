# Deploying Mastra on Kubernetes

This guide covers deploying Mastra in a high-availability (HA) Kubernetes environment. When scaling to multiple pods, you must ensure that state, message history, and human-in-the-loop (HITL) approvals are synchronized across the cluster.

## Architecture Overview

To run Mastra with multiple replicas, you need a shared infrastructure layer:

1.  **Storage**: Use a shared database (Postgres/LibSQL) for conversation history and workflow state.
2.  **PubSub**: Use Redis or a similar provider for real-time event distribution across pods (important for streaming and HITL).
3.  **Ingress**: Configure sticky sessions or reliable socket handling if using long-lived streams.

## Configuration for Multi-Pod Deployment

### 1. Persistent Storage

Do not use in-memory storage. Initialize Mastra with a persistent provider:

```typescript
import { Mastra } from '@mastra/core';
import { PostgresStorage } from '@mastra/storage-postgres';

export const mastra = new Mastra({
  storage: new PostgresStorage({
    connectionString: process.env.DATABASE_URL,
  }),
  // ... agents and workflows
});
```

### 2. Scaling Workflows and HITL

When a workflow is suspended for approval, the state is persisted. Any pod in the cluster can resume the workflow as long as they share the same storage backend.

### 3. Kubernetes Manifest Example

Below is a base deployment strategy for 3 replicas:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mastra-agent
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mastra-agent
  template:
    metadata:
      labels:
        app: mastra-agent
    spec:
      containers:
      - name: mastra
        image: your-repo/mastra-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: url
        - name: REDIS_URL
          value: "redis://redis:6379"
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
```

## Common Challenges

### Reconnections
When a pod restarts, clients (browsers) will attempt to reconnect. Ensure your frontend client handles exponential backoff and retrieves the latest thread state from the `/history` endpoint rather than relying on local UI state.

### Race Conditions
If multiple agents are processing the same thread ID, use Mastra's internal locking mechanisms or ensure your business logic handles concurrent state transitions gracefully.

### Observability
In a cluster, logs are fragmented. Use an OpenTelemetry collector to aggregate traces from your agents into a single dashboard (e.g., Honeycomb or Jeager).