# PR 3.1: Logging Implementation

**Package:** `observability/mastra`
**Scope:** LoggerContext implementation, log event emission, mastra.logger direct API

---

## 3.1.1 LoggerContext Implementation

**File:** `observability/mastra/src/context/logger.ts` (new)

```typescript
import type { LogLevel, ExportedLog, LogEvent, AnySpan } from '@mastra/core';
import { ObservabilityBus } from '../bus/observability';

export interface LoggerContextConfig {
  // Current span (provides traceId, spanId, and metadata)
  currentSpan?: AnySpan;

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

    const span = this.config.currentSpan;

    const exportedLog: ExportedLog = {
      timestamp: new Date(),
      level,
      message,
      data,
      // Correlation from span
      traceId: span?.traceId,
      spanId: span?.id,
      // Context already captured in span's metadata
      metadata: span?.metadata,
    };

    const event: LogEvent = { type: 'log', log: exportedLog };
    this.config.observabilityBus.emit(event);
  }
}
```

**Notes:**
- The span's `metadata` already contains all context (runId, sessionId, userId, environment, etc.)
- No need to manually rebuild context - just pass the span's metadata through

**Tasks:**
- [ ] Implement LoggerContextImpl class
- [ ] Use span's metadata directly (already has context)
- [ ] Support minimum log level filtering
- [ ] Emit LogEvent to ObservabilityBus

---

## 3.1.2 LoggerContext Factory

**File:** `observability/mastra/src/context/factory.ts` (modify or new)

```typescript
import { LoggerContextImpl } from './logger';
import type { TracingContext, LogLevel } from '@mastra/core';
import { ObservabilityBus } from '../bus/observability';

export interface LoggerContextOptions {
  observabilityBus: ObservabilityBus;
  minLevel?: LogLevel;
}

export function createLoggerContext(
  tracingContext: TracingContext,
  options: LoggerContextOptions,
): LoggerContextImpl {
  return new LoggerContextImpl({
    currentSpan: tracingContext.currentSpan,
    observabilityBus: options.observabilityBus,
    minLevel: options.minLevel,
  });
}
```

**Tasks:**
- [ ] Create factory that passes current span from TracingContext
- [ ] Span already has traceId, spanId, and metadata

---

## 3.1.3 Update BaseObservabilityInstance

**File:** `observability/mastra/src/instances/base.ts` (modify)

```typescript
createLoggerContext(tracingContext: TracingContext): LoggerContext {
  if (!this.observabilityBus) {
    return noOpLoggerContext;
  }

  return new LoggerContextImpl({
    currentSpan: tracingContext.currentSpan,
    observabilityBus: this.observabilityBus,
    minLevel: this.config.logLevel,
  });
}
```

**Tasks:**
- [ ] Add createLoggerContext method
- [ ] Pass current span (already has all context in metadata)

---

## 3.1.3b Direct Logger API (mastra.logger)

**File:** `observability/mastra/src/instances/base.ts` (modify)

Add `mastra.logger` direct API for use outside trace context:

```typescript
// In BaseObservabilityInstance or DefaultObservabilityInstance
createDirectLoggerContext(): LoggerContext {
  if (!this.observabilityBus) {
    return noOpLoggerContext;
  }

  // No currentSpan - direct API without trace correlation
  return new LoggerContextImpl({
    currentSpan: undefined,
    observabilityBus: this.observabilityBus,
    minLevel: this.config.logLevel,
  });
}
```

**Usage:**

```typescript
// Startup logs (no trace context)
mastra.logger.info("Application started", { version: "1.0.0" });
mastra.logger.warn("Config missing, using defaults");
mastra.logger.error("Background job failed", { jobId: "123" });
```

**Tasks:**
- [ ] Add createDirectLoggerContext() method
- [ ] Wire to mastra.logger property

---

## 3.1.4 Update DefaultExporter

**File:** `observability/mastra/src/exporters/default.ts` (modify)

```typescript
import { generateId } from '../utils/id';
import type { LogEvent, LogRecord } from '@mastra/core';

export class DefaultExporter extends BaseExporter {
  async onLogEvent(event: LogEvent): Promise<void> {
    if (!this.storage) return;

    const record: LogRecord = {
      id: generateId(),
      timestamp: event.log.timestamp,
      level: event.log.level,
      message: event.log.message,
      data: event.log.data,
      traceId: event.log.traceId,
      spanId: event.log.spanId,
      tags: event.log.tags,
      metadata: event.log.metadata,
    };

    await this.storage.batchCreateLogs({ logs: [record] });
  }
}
```

**Tasks:**
- [ ] Implement `onLogEvent()` handler
- [ ] Convert ExportedLog → LogRecord
- [ ] Consider batching multiple logs

---

## 3.1.5 Update JsonExporter

**File:** `observability/mastra/src/exporters/json.ts` (modify)

```typescript
export class JsonExporter extends BaseExporter {
  async onLogEvent(event: LogEvent): Promise<void> {
    this.output('log', event.log);
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

---

## 3.1.6 Update CloudExporter

**File:** `observability/cloud/src/exporter.ts` (if exists)

**Tasks:**
- [ ] Implement `onLogEvent()` handler to send to Mastra Cloud

---

## 3.1.7 Update GrafanaCloudExporter

**File:** `observability/grafana-cloud/src/exporter.ts` (from Phase 1.5)

**Tasks:**
- [ ] Implement `onLogEvent` for Loki push

---

## PR 3.1 Testing

**Tasks:**
- [ ] Test LoggerContextImpl emits to bus
- [ ] Test traceId and spanId are extracted from current span
- [ ] Test span's metadata is passed through to log
- [ ] Test minimum log level filtering
- [ ] Test mastra.logger direct API works without trace context
- [ ] Test mastra.logger logs have no traceId/spanId
- [ ] Test DefaultExporter writes logs
- [ ] Test JsonExporter outputs logs
- [ ] Integration test: logs within a span inherit the span's metadata
