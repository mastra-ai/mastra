## PR 2.2: @mastra/observability Changes

**Package:** `observability/mastra`
**Scope:** LoggerContext implementation, ObservabilityBus wiring, exporter updates

### 2.2.1 LoggerContext Implementation

**File:** `observability/mastra/src/context/logger.ts` (new)

```typescript
import { LoggerContext, LogLevel, LogRecordInput, LogRecord } from '@mastra/core';
import { ObservabilityBus } from '../bus/observability';
import { generateId } from '../utils/id';

export interface LoggerContextConfig {
  // Correlation (auto-captured)
  traceId?: string;
  spanId?: string;
  runId?: string;
  sessionId?: string;
  threadId?: string;
  requestId?: string;

  // Entity context
  entityType?: string;
  entityName?: string;

  // Multi-tenancy
  userId?: string;
  organizationId?: string;
  resourceId?: string;

  // Environment
  environment?: string;
  serviceName?: string;
  source?: string;

  // Bus for emission
  observabilityBus: ObservabilityBus;

  // Minimum log level
  minLevel?: LogLevel;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

export class LoggerContextImpl implements LoggerContext {
  private config: LoggerContextConfig;

  constructor(config: LoggerContextConfig) {
    this.config = config;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const minLevel = this.config.minLevel ?? 'debug';
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[minLevel]) {
      return;
    }

    const record: LogRecord = {
      id: generateId(),
      timestamp: new Date(),
      level,
      message,
      data,

      // Correlation (from config)
      traceId: this.config.traceId,
      spanId: this.config.spanId,
      runId: this.config.runId,
      sessionId: this.config.sessionId,
      threadId: this.config.threadId,
      requestId: this.config.requestId,

      // Entity context
      entityType: this.config.entityType,
      entityName: this.config.entityName,

      // Multi-tenancy
      userId: this.config.userId,
      organizationId: this.config.organizationId,
      resourceId: this.config.resourceId,

      // Environment
      environment: this.config.environment,
      serviceName: this.config.serviceName,
      source: this.config.source,
    };

    this.config.observabilityBus.emit({ type: 'log', record });
  }
}
```

**Tasks:**
- [ ] Implement LoggerContextImpl class
- [ ] Auto-inject all correlation fields
- [ ] Support minimum log level filtering
- [ ] Emit LogEvent to ObservabilityBus

### 2.2.2 LoggerContext Factory

**File:** `observability/mastra/src/context/factory.ts` (modify or new)

```typescript
import { LoggerContextImpl, LoggerContextConfig } from './logger';
import { TracingContext } from '@mastra/core';

export function createLoggerContext(
  tracingContext: TracingContext,
  baseConfig: Omit<LoggerContextConfig, 'traceId' | 'spanId'>,
): LoggerContextImpl {
  const span = tracingContext.currentSpan;

  return new LoggerContextImpl({
    ...baseConfig,
    traceId: span?.traceId,
    spanId: span?.spanId,
  });
}
```

**Tasks:**
- [ ] Create factory that extracts trace correlation from TracingContext
- [ ] Ensure spanId updates when span changes

### 2.2.3 Log Event Emission via ObservabilityBus

**Note:** Logs are emitted through the unified `ObservabilityBus` created in Phase 1, not a separate LogsBus.

The LoggerContext emits LogEvents to the shared ObservabilityBus, which routes them to exporters that implement `onLogEvent()`.

**Tasks:**
- [ ] Ensure LoggerContextImpl emits to ObservabilityBus
- [ ] Verify ObservabilityBus routes LogEvents to `onLogEvent()` handlers

### 2.2.4 Update BaseObservabilityInstance

**File:** `observability/mastra/src/instances/base.ts` (modify)

```typescript
// In createLoggerContext method
createLoggerContext(
  tracingContext: TracingContext,
  entityContext?: { entityType?: string; entityName?: string }
): LoggerContext {
  if (!this.logsBus) {
    return noOpLoggerContext;
  }

  return new LoggerContextImpl({
    traceId: tracingContext.currentSpan?.traceId,
    spanId: tracingContext.currentSpan?.spanId,
    runId: this.config.runId,
    sessionId: this.config.sessionId,
    threadId: this.config.threadId,
    userId: this.config.userId,
    organizationId: this.config.organizationId,
    environment: this.config.environment,
    serviceName: this.config.serviceName,
    entityType: entityContext?.entityType,
    entityName: entityContext?.entityName,
    observabilityBus: this.observabilityBus,
    minLevel: this.config.logLevel,
  });
}
```

**Tasks:**
- [ ] Add createLoggerContext method
- [ ] Pass config values for correlation
- [ ] Ensure ObservabilityBus routes LogEvents to `onLogEvent()` handlers

### 2.2.5 Update DefaultExporter

**File:** `observability/mastra/src/exporters/default.ts` (modify)

```typescript
export class DefaultExporter extends BaseExporter {
  // Handler presence = signal support

  async onLogEvent(event: LogEvent): Promise<void> {
    if (!this.storage) return;

    await this.storage.batchCreateLogs({ logs: [event.record] });
  }
}
```

**Tasks:**
- [ ] Implement `onLogEvent()` handler to write to storage
- [ ] Consider batching multiple logs

### 2.2.6 Update JsonExporter

**File:** `observability/mastra/src/exporters/json.ts` (modify)

```typescript
export class JsonExporter extends BaseExporter {
  // Handler presence = signal support

  async onLogEvent(event: LogEvent): Promise<void> {
    this.output('log', event.record);
  }

  private output(type: string, data: unknown): void {
    console.log(JSON.stringify({
      type,
      timestamp: new Date().toISOString(),
      data,
    }, null, 2));
  }
}
```

**Tasks:**
- [ ] Implement `onLogEvent()` handler
- [ ] Format output for readability

### 2.2.7 Update CloudExporter

**File:** `observability/cloud/src/exporter.ts` (if exists, modify)

**Tasks:**
- [ ] Implement `onLogEvent()` handler to send to Mastra Cloud
- [ ] Include in Phase 2 or defer based on Cloud API readiness

### 2.2.8 Update GrafanaCloudExporter

**File:** `observability/grafana-cloud/src/exporter.ts` (from Phase 1.5)

**Tasks:**
- [ ] Implement `onLogEvent` for Loki push
- [ ] Use Loki push format from Phase 1.5 spec

### PR 2.2 Testing

**Tasks:**
- [ ] Test LoggerContextImpl emits to bus
- [ ] Test correlation fields are populated
- [ ] Test minimum log level filtering
- [ ] Test DefaultExporter writes logs
- [ ] Test JsonExporter outputs logs
- [ ] Integration test: tool logs appear with trace correlation

