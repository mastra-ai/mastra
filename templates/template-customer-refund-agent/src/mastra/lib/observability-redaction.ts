import type {
  LoggerAdapterContext,
  LoggerTransport,
} from "@mastra/core/logger";
import { MastraLogger } from "@mastra/core/logger";
import type { AnySpan, SpanOutputProcessor } from "@mastra/core/observability";
import { PinoLogger, type PinoLoggerOptions } from "@mastra/loggers";

/** Values in this module cross an observability boundary.  Keep identifiers,
 * status, and timing useful, but never export customer prose or credentials. */
const REDACTED = "[REDACTED]";
const REDACTED_CONTENT = "[REDACTED:CONTENT]";
const sensitiveKeys = new Set([
  "apikey",
  "authorization",
  "cookie",
  "email",
  "password",
  "secret",
  "session",
  "token",
]);
const contentKeys = new Set([
  "body",
  "cause",
  "content",
  "details",
  "error",
  "errorinfo",
  "input",
  "message",
  "metadata",
  "note",
  "output",
  "payload",
  "prompt",
  "rawpayload",
  "reason",
  "stack",
  "text",
]);
const operationalEventCodes = new Map([
  ["Mastra storage initialization failed.", "storage.initialization.failed"],
  ["Local runtime shutdown failed.", "runtime.shutdown.failed"],
  ["Native approval recovery failed.", "approval.recovery.failed"],
  ["Stripe refund reconciliation failed.", "refund.reconciliation.failed"],
  [
    "Stripe cancellation reconciliation failed.",
    "cancellation.reconciliation.failed",
  ],
  ["Completed bounded DEC-015 retention sweep.", "retention.sweep.completed"],
  ["Local runtime recovery sweep failed.", "runtime.recovery.sweep.failed"],
  [
    "Failed to forward case feedback to observability storage",
    "feedback.forward.failed",
  ],
  [
    "Local outbox delivery failed; recovery will retry it.",
    "outbox.delivery.failed",
  ],
  ["resolve-support-case run failed", "workflow.resolve.failed"],
  ["Failed to persist workflow recovery.", "workflow.recovery.persist.failed"],
]);
const safeErrorCategories = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "AggregateError",
  "AbortError",
  "LibsqlError",
]);
const safeErrorCodes = new Set([
  "SQLITE_BUSY",
  "SQLITE_LOCKED",
  "SQLITE_CANTOPEN",
  "SQLITE_CONSTRAINT",
  "ECONNREFUSED",
  "ETIMEDOUT",
]);

function normalizedKey(key: string) {
  return key.replaceAll(/[^a-z0-9]/gi, "").toLowerCase();
}

function isSensitiveKey(key: string) {
  const normalized = normalizedKey(key);
  return (
    sensitiveKeys.has(normalized) ||
    normalized.endsWith("token") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("password") ||
    normalized.endsWith("email") ||
    normalized.endsWith("key")
  );
}

function isContentKey(key: string) {
  const normalized = normalizedKey(key);
  return (
    contentKeys.has(normalized) ||
    normalized.endsWith("message") ||
    normalized.endsWith("content") ||
    normalized.endsWith("payload") ||
    normalized.endsWith("reason") ||
    normalized.endsWith("note")
  );
}

function containsSensitiveText(value: string) {
  return (
    /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value) ||
    /\b(?:api[_ -]?key|authorization|bearer|password|secret|token)\b/i.test(
      value,
    )
  );
}

/** Redact recursively before data reaches a Pino sink or Mastra exporter. */
export function redactObservabilityValue(
  value: unknown,
  key?: string,
  seen = new WeakSet<object>(),
): unknown {
  if (key && isSensitiveKey(key)) return REDACTED;
  if (key === "error" && value instanceof Error) {
    const code = (value as Error & { code?: unknown }).code;
    return {
      category: safeErrorCategories.has(value.name) ? value.name : "Error",
      ...(typeof code === "string" && safeErrorCodes.has(code) ? { code } : {}),
      message: REDACTED_CONTENT,
    };
  }
  if (key && isContentKey(key)) return REDACTED_CONTENT;
  if (typeof value === "string")
    return containsSensitiveText(value) ? REDACTED : value;
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (value instanceof Error)
    return { name: value.name, message: REDACTED_CONTENT };
  if (seen.has(value)) return REDACTED;
  seen.add(value);
  if (Array.isArray(value))
    return value.map((entry) =>
      redactObservabilityValue(entry, undefined, seen),
    );
  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      redactObservabilityValue(entryValue, entryKey, seen),
    ]),
  );
}

export function redactObservabilityMessage(message: string) {
  return operationalEventCodes.get(message) ?? REDACTED_CONTENT;
}

/** This runs after Mastra creates a span but before every configured exporter. */
export class ApplicationSpanRedactor implements SpanOutputProcessor {
  readonly name = "support-application-redactor";

  process(span?: AnySpan) {
    if (!span) return span;
    const mutable = span as unknown as Record<string, unknown>;
    for (const key of ["attributes", "metadata", "requestContext"])
      if (Object.hasOwn(mutable, key))
        mutable[key] = redactObservabilityValue(mutable[key]);
    for (const key of ["input", "output", "error", "errorInfo"])
      if (
        Object.hasOwn(mutable, key) &&
        mutable[key] !== undefined &&
        mutable[key] !== null
      )
        mutable[key] = REDACTED_CONTENT;
    return span;
  }

  async shutdown() {}
}

/**
 * Pino's formatter protects its emitted record, but Mastra exports logger
 * arguments independently. This wrapper redacts before both paths and keeps
 * the same wrapper for child loggers.
 */
export class RedactingPinoLogger extends MastraLogger {
  private readonly inner: PinoLogger;

  constructor(options: PinoLoggerOptions = {}, inner?: PinoLogger) {
    super(options);
    this.inner = inner ?? new PinoLogger(options);
  }

  override getTransports(): Map<string, LoggerTransport> {
    return this.inner.getTransports();
  }

  override async listLogs(
    transportId?: string,
    params?: Parameters<PinoLogger["listLogs"]>[1],
  ) {
    return transportId
      ? this.inner.listLogs(transportId, params)
      : super.listLogs("", params);
  }

  override async listLogsByRunId(
    args: Parameters<PinoLogger["listLogsByRunId"]>[0],
  ) {
    return this.inner.listLogsByRunId(args);
  }

  child(bindings: Record<string, unknown>) {
    return new RedactingPinoLogger(
      { name: this.name, level: this.level },
      this.inner.child(
        redactObservabilityValue(bindings) as Record<string, unknown>,
      ),
    );
  }

  __attachObservability(context: LoggerAdapterContext) {
    this.inner.__attachObservability(context);
  }

  __observabilityAttachmentKey() {
    return this.inner.__observabilityAttachmentKey();
  }

  debug(message: string, args: Record<string, unknown> = {}) {
    this.inner.debug(
      redactObservabilityMessage(message),
      redactObservabilityValue(args) as Record<string, unknown>,
    );
  }

  info(message: string, args: Record<string, unknown> = {}) {
    this.inner.info(
      redactObservabilityMessage(message),
      redactObservabilityValue(args) as Record<string, unknown>,
    );
  }

  warn(message: string, args: Record<string, unknown> = {}) {
    this.inner.warn(
      redactObservabilityMessage(message),
      redactObservabilityValue(args) as Record<string, unknown>,
    );
  }

  error(message: string, args: Record<string, unknown> = {}) {
    this.inner.error(
      redactObservabilityMessage(message),
      redactObservabilityValue(args) as Record<string, unknown>,
    );
  }

  trackException(error: Error, metadata?: Record<string, unknown>) {
    const redacted = new Error(REDACTED_CONTENT);
    redacted.name = error.name;
    this.inner.trackException(
      redacted,
      redactObservabilityValue(metadata) as Record<string, unknown>,
    );
  }
}
