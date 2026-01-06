# @mastra/prometheus

Prometheus metrics collector for Mastra agentic applications. Exports agentic metrics in Prometheus format for scraping.

## Installation

```bash
npm install @mastra/prometheus
# or
pnpm add @mastra/prometheus
```

## Usage

### Automatic Metrics Endpoint

When you use `@mastra/prometheus` with a Mastra server, the `/metrics` endpoint is **automatically exposed** - no additional configuration needed:

```typescript
import { Mastra } from '@mastra/core';
import { MastraServer } from '@mastra/hono';
import { PrometheusMetricsCollector } from '@mastra/prometheus';
import { Hono } from 'hono';

// Create the metrics collector
const metrics = new PrometheusMetricsCollector({
  prefix: 'myapp_',
});

// Configure Mastra with the collector
const mastra = new Mastra({
  metrics,
  agents: {
    /* ... */
  },
});

// Create and start the server - /metrics is automatically available
const app = new Hono();
const server = new MastraServer({ app, mastra });
await server.start();

// GET /metrics is now ready for Prometheus to scrape!
```

The `/metrics` endpoint:

- Automatically registered when `registerRoutes()` is called
- Returns metrics in Prometheus text exposition format
- Sets the correct `Content-Type` header
- Returns 404 if no exposable metrics collector is configured

### Manual Endpoint (Standalone Usage)

If you're not using the Mastra server, you can manually expose metrics:

```typescript
import { Hono } from 'hono';

const app = new Hono();

app.get('/metrics', async c => {
  return c.text(await metrics.getMetrics(), 200, {
    'Content-Type': metrics.getContentType(),
  });
});
```

## Configuration

```typescript
const metrics = new PrometheusMetricsCollector({
  // Custom metric prefix (default: 'mastra_')
  prefix: 'myapp_',

  // Collect Node.js metrics (memory, CPU, etc.) - default: true
  collectDefaultMetrics: true,

  // Custom histogram buckets for duration metrics (ms)
  durationBuckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],

  // Custom histogram buckets for token counts
  tokenBuckets: [100, 500, 1000, 2000, 4000, 8000],

  // Use an existing Prometheus registry
  registry: existingRegistry,
});
```

## Metrics Exposed

### Agent Metrics

| Metric                            | Type      | Description           |
| --------------------------------- | --------- | --------------------- |
| `mastra_agent_runs_total`         | Counter   | Total agent runs      |
| `mastra_agent_runs_success_total` | Counter   | Successful agent runs |
| `mastra_agent_runs_error_total`   | Counter   | Failed agent runs     |
| `mastra_agent_run_duration_ms`    | Histogram | Agent run duration    |
| `mastra_agent_tool_calls_total`   | Counter   | Tool calls by agents  |

### Agentic Metrics

| Metric                             | Type    | Description                     |
| ---------------------------------- | ------- | ------------------------------- |
| `mastra_guardrail_triggers_total`  | Counter | Guardrail trigger events        |
| `mastra_human_interventions_total` | Counter | Human intervention events       |
| `mastra_goal_completions_total`    | Counter | Goal completion events by state |
| `mastra_thinking_steps_total`      | Counter | Reasoning/thinking steps        |
| `mastra_action_steps_total`        | Counter | Action steps with tool calls    |
| `mastra_backtrack_count_total`     | Counter | Backtrack events                |

### Token Metrics

| Metric                          | Type    | Description             |
| ------------------------------- | ------- | ----------------------- |
| `mastra_tokens_input_total`     | Counter | Input tokens consumed   |
| `mastra_tokens_output_total`    | Counter | Output tokens generated |
| `mastra_tokens_cached_total`    | Counter | Cached tokens used      |
| `mastra_tokens_reasoning_total` | Counter | Reasoning tokens        |

### Cost Metrics

| Metric                  | Type    | Description       |
| ----------------------- | ------- | ----------------- |
| `mastra_cost_usd_total` | Counter | Total cost in USD |

### Tool Metrics

| Metric                                 | Type      | Description           |
| -------------------------------------- | --------- | --------------------- |
| `mastra_tool_executions_total`         | Counter   | Total tool executions |
| `mastra_tool_executions_success_total` | Counter   | Successful executions |
| `mastra_tool_executions_error_total`   | Counter   | Failed executions     |
| `mastra_tool_execution_duration_ms`    | Histogram | Execution duration    |

### HTTP Metrics

| Metric                               | Type      | Description         |
| ------------------------------------ | --------- | ------------------- |
| `mastra_http_requests_total`         | Counter   | Total HTTP requests |
| `mastra_http_requests_success_total` | Counter   | Successful requests |
| `mastra_http_requests_error_total`   | Counter   | Failed requests     |
| `mastra_http_request_duration_ms`    | Histogram | Request duration    |

## Prometheus Configuration

Add this to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'mastra'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

## Grafana Dashboard

Example queries for a Grafana dashboard:

```promql
# Agent success rate
sum(rate(mastra_agent_runs_success_total[5m])) / sum(rate(mastra_agent_runs_total[5m]))

# Average agent run duration
histogram_quantile(0.95, sum(rate(mastra_agent_run_duration_ms_bucket[5m])) by (le, agentId))

# Token consumption rate
sum(rate(mastra_tokens_input_total[5m])) + sum(rate(mastra_tokens_output_total[5m]))

# Guardrail trigger rate
sum(rate(mastra_guardrail_triggers_total[5m])) by (agentId, action)

# Human intervention rate
sum(rate(mastra_human_interventions_total[5m])) by (type)

# Goal completion rate by state
sum(rate(mastra_goal_completions_total[5m])) by (state)
```

## License

Apache-2.0
