/**
 * Hand-rolled in-memory OTLP/JSON collector for client-side tool
 * observability.
 *
 * The full OTEL JS stack (`@opentelemetry/sdk-trace-base` +
 * `@opentelemetry/sdk-logs` + `@opentelemetry/otlp-transformer`) would
 * add ~100KB gzipped to the bundle for what amounts to a tree of nested
 * span timers and a flat array of log records. Mastra users running
 * sophisticated browser OTEL setups can plug their own collector
 * implementation in via `ClientOptions.observability.collectorFactory`;
 * this is the simple default.
 *
 * Output is OTLP/JSON conforming to the public spec at
 * https://opentelemetry.io/docs/specs/otlp/. Only the fields the server
 * proxy in `@mastra/observability` actually reads are populated.
 */

import type { ClientObservabilityCarrier, ClientObservabilityPayload } from '@mastra/core/observability';

import type { ObservabilityCollector, ObservabilityCollectorFactory } from './types';

const TRACEPARENT_RE = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

interface BufferedSpan {
  spanId: string;
  parentSpanId: string;
  traceId: string;
  name: string;
  startTimeNs: bigint;
  endTimeNs: bigint;
  attributes: Record<string, unknown>;
  /** OTLP status: 0 unset, 1 ok, 2 error */
  statusCode: number;
  statusMessage?: string;
}

interface BufferedLog {
  spanId?: string;
  traceId: string;
  timestampNs: bigint;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  data?: Record<string, unknown>;
}

const LEVEL_TO_SEVERITY_NUMBER: Record<BufferedLog['level'], number> = {
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
  fatal: 21,
};

const LEVEL_TO_SEVERITY_TEXT: Record<BufferedLog['level'], string> = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
  fatal: 'FATAL',
};

function nowNs(): bigint {
  // performance.now() is monotonic but relative; combine with the
  // initial Date.now() so the absolute timestamp lines up with
  // server-side spans within roughly clock-skew bounds.
  return BigInt(Date.now()) * 1_000_000n;
}

function randomSpanIdHex(): string {
  // 16 hex chars = 8 bytes. Use crypto when available; fall back to
  // Math.random for environments without (older RN, some sandboxes).
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    const bytes = new Uint8Array(8);
    globalThis.crypto.getRandomValues(bytes);
    let out = '';
    for (const b of bytes) out += b.toString(16).padStart(2, '0');
    return out;
  }
  let out = '';
  for (let i = 0; i < 16; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

function attributesToOtlp(attrs: Record<string, unknown>): Array<{ key: string; value: Record<string, unknown> }> {
  const out: Array<{ key: string; value: Record<string, unknown> }> = [];
  for (const [key, raw] of Object.entries(attrs)) {
    if (raw === undefined || raw === null) continue;
    if (typeof raw === 'string') {
      out.push({ key, value: { stringValue: raw } });
    } else if (typeof raw === 'boolean') {
      out.push({ key, value: { boolValue: raw } });
    } else if (typeof raw === 'number') {
      if (Number.isInteger(raw)) {
        out.push({ key, value: { intValue: raw } });
      } else {
        out.push({ key, value: { doubleValue: raw } });
      }
    } else {
      // Fall back to JSON-stringifying complex values; the server's
      // OTLP walker accepts string attributes uniformly.
      try {
        out.push({ key, value: { stringValue: JSON.stringify(raw) } });
      } catch {
        // skip non-serializable attributes
      }
    }
  }
  return out;
}

class ObservabilityCollectorImpl implements ObservabilityCollector {
  readonly parentContext: ClientObservabilityCarrier;
  readonly #traceId: string;
  readonly #rootSpanId: string;
  readonly #spans: BufferedSpan[] = [];
  readonly #logs: BufferedLog[] = [];
  /** Stack of currently-active span IDs (innermost last). */
  readonly #spanStack: string[] = [];
  /** Wall-clock execution timing, captured by withContext. */
  #executionStartMs: number | undefined;
  #executionEndMs: number | undefined;
  #flushed = false;

  constructor(parentContext: ClientObservabilityCarrier) {
    this.parentContext = parentContext;
    const parsed = TRACEPARENT_RE.exec(parentContext.traceparent);
    if (!parsed) {
      // No usable parent — degrade to a synthetic root so the
      // collector still functions, but warn that nothing will be
      // ingestable on the server (validation will reject mismatched
      // traceIds).
      this.#traceId = '00000000000000000000000000000000';
      this.#rootSpanId = '0000000000000000';
      return;
    }
    this.#traceId = parsed[2]!;
    this.#rootSpanId = parsed[3]!;
  }

  async withContext<T>(fn: () => Promise<T> | T): Promise<T> {
    // Three responsibilities:
    //  1. Push the carrier root onto the span stack so nested span()
    //     calls parent under it.
    //  2. Make this collector visible via
    //     `getCurrentObservabilityCollector()` so user
    //     execute functions can find it without needing the SDK to
    //     wire it through their tool's options object.
    //  3. Measure wall-clock execution time around the user-supplied
    //     function. The server has no way to recover this otherwise
    //     because the CLIENT_TOOL_CALL event span has no endTime; the
    //     measured value is shipped back via flush() and emitted as
    //     mastra_client_tool_duration_ms by the proxy.
    this.#spanStack.push(this.#rootSpanId);
    const previous = currentCollector;
    currentCollector = this;
    if (this.#executionStartMs === undefined) {
      this.#executionStartMs = Date.now();
    }
    try {
      return await fn();
    } finally {
      this.#executionEndMs = Date.now();
      currentCollector = previous;
      this.#spanStack.pop();
    }
  }

  async span<T>(name: string, fn: () => Promise<T> | T, attributes?: Record<string, unknown>): Promise<T> {
    const spanId = randomSpanIdHex();
    const parentSpanId = this.#spanStack[this.#spanStack.length - 1] ?? this.#rootSpanId;
    const startTimeNs = nowNs();
    this.#spanStack.push(spanId);
    let statusCode = 1;
    let statusMessage: string | undefined;
    try {
      return await fn();
    } catch (err) {
      statusCode = 2;
      statusMessage = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      this.#spanStack.pop();
      this.#spans.push({
        spanId,
        parentSpanId,
        traceId: this.#traceId,
        name,
        startTimeNs,
        endTimeNs: nowNs(),
        attributes: attributes ?? {},
        statusCode,
        statusMessage,
      });
    }
  }

  log(level: BufferedLog['level'], message: string, data?: Record<string, unknown>): void {
    const spanId = this.#spanStack[this.#spanStack.length - 1] ?? this.#rootSpanId;
    this.#logs.push({
      spanId,
      traceId: this.#traceId,
      timestampNs: nowNs(),
      level,
      message,
      data,
    });
  }

  flush(): ClientObservabilityPayload {
    if (this.#flushed) {
      return {};
    }
    this.#flushed = true;

    const payload: ClientObservabilityPayload = {};

    if (this.#executionStartMs !== undefined && this.#executionEndMs !== undefined) {
      payload.executionDurationMs = this.#executionEndMs - this.#executionStartMs;
    }

    if (this.#spans.length > 0) {
      payload.spans = {
        resourceSpans: [
          {
            scopeSpans: [
              {
                scope: { name: '@mastra/client-js/observability', version: '1' },
                spans: this.#spans.map(s => ({
                  traceId: s.traceId,
                  spanId: s.spanId,
                  parentSpanId: s.parentSpanId,
                  name: s.name,
                  // OTLP/JSON allows nanosecond timestamps as decimal
                  // strings to avoid JS number precision loss for
                  // uint64. Use string form.
                  startTimeUnixNano: s.startTimeNs.toString(),
                  endTimeUnixNano: s.endTimeNs.toString(),
                  attributes: attributesToOtlp(s.attributes),
                  status: { code: s.statusCode, ...(s.statusMessage ? { message: s.statusMessage } : {}) },
                  // OTLP requires `kind`; default to INTERNAL = 1.
                  kind: 1,
                })),
              },
            ],
          },
        ],
      };
    }

    if (this.#logs.length > 0) {
      payload.logs = {
        resourceLogs: [
          {
            scopeLogs: [
              {
                scope: { name: '@mastra/client-js/observability', version: '1' },
                logRecords: this.#logs.map(l => ({
                  timeUnixNano: l.timestampNs.toString(),
                  observedTimeUnixNano: l.timestampNs.toString(),
                  severityNumber: LEVEL_TO_SEVERITY_NUMBER[l.level],
                  severityText: LEVEL_TO_SEVERITY_TEXT[l.level],
                  body: { stringValue: l.message },
                  traceId: l.traceId,
                  spanId: l.spanId,
                  attributes: l.data ? attributesToOtlp(l.data) : [],
                })),
              },
            ],
          },
        ],
      };
    }

    return payload;
  }
}

/**
 * Default factory used when the user opts into the
 * `@mastra/client-js/observability` subpath.
 */
export const createObservabilityCollector: ObservabilityCollectorFactory = parentContext =>
  new ObservabilityCollectorImpl(parentContext);

// ============================================================================
// Current collector accessor
// ============================================================================
//
// JavaScript is single-threaded, so a synchronous module-level "current
// collector" works inside any execute() call as long as there is at most
// one client tool running at a time. Concurrent client tool executions
// would race on this global, but that scenario is degenerate today: the
// agent loop sees one tool call at a time per agent run, and the SDK
// processes them sequentially in `executeToolCallAndRespond`.
//
// AsyncLocalStorage would be the more correct primitive for Node, but
// is not available in browsers, and the @mastra/client-js bundle is
// browser-first. We accept the simpler global pattern as the price of
// universal portability.

let currentCollector: ObservabilityCollector | undefined;

/**
 * Returns the collector active inside the currently-running client
 * tool's `execute` function, or `undefined` when no collector is in
 * scope (e.g. when running outside a client tool, or when the user has
 * not opted into the `@mastra/client-js/observability` subpath).
 *
 * Mirrors the `trace.getActiveSpan()` pattern from `@opentelemetry/api`.
 *
 * ```ts
 * import { getCurrentObservabilityCollector } from '@mastra/client-js/observability';
 *
 * execute: async input => {
 *   const collector = getCurrentObservabilityCollector();
 *   collector?.log('info', 'starting work');
 *   const result = await collector?.span('http GET /users', () => fetch(...));
 * }
 * ```
 */
export function getCurrentObservabilityCollector(): ObservabilityCollector | undefined {
  return currentCollector;
}
