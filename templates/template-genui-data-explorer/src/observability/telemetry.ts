import { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const identity = z.string().max(128);
const eventSchema = z.strictObject({
  type: z.enum([
    "analysis-start",
    "analysis-end",
    "query-attempt",
    "query-success",
    "query-failure",
    "plan-validated",
    "source-selected",
    "calculation-verified",
    "composition-committed",
    "interaction",
    "correction-accepted",
    "render-ack",
    "provider-usage",
    "guardrail",
  ]),
  at: z.number().nonnegative(),
  requestId: identity,
  workspaceId: identity,
  threadId: identity.optional(),
  traceId: identity.optional(),
  workflowId: identity.optional(),
  workflowRunId: identity.optional(),
  queryId: identity.optional(),
  resultId: identity.optional(),
  sourceId: identity.optional(),
  datasetVersion: identity.optional(),
  revision: z.number().int().nonnegative().optional(),
  elapsedMs: z.number().nonnegative().optional(),
  status: identity.optional(),
  metric: identity.optional(),
  component: identity.optional(),
  model: identity.optional(),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  estimatedCost: z.number().nonnegative().optional(),
  pricingVersion: identity.optional(),
  currency: z.literal("USD").optional(),
  operation: z.string().max(4000).optional(),
});
export type TelemetryEvent = z.infer<typeof eventSchema>;
export type EventInput = Omit<TelemetryEvent, "at">;
export interface TelemetrySink {
  record(event: EventInput): void;
}

export function redact(text: string): string {
  let safe = text;
  for (const [name, value] of Object.entries(process.env))
    if (value && value.length >= 6 && /key|secret|token|password|credential/i.test(name))
      safe = safe.replaceAll(value, "[REDACTED]");
  return safe.replace(
    /(?:sk-[\w-]+|Bearer\s+\S+|(?:api[_-]?key|secret|token|password|credential)\s*[=:]\s*[^\s,;]+)/gi,
    "[REDACTED]",
  );
}
/** An allowlisted durable event journal; never receives prompts, credentials or result rows. */
export class LocalTelemetry implements TelemetrySink {
  readonly #db: DatabaseSync;
  #unavailable = false;
  constructor(path: string) {
    this.#db = new DatabaseSync(path);
    this.#db.exec(
      "CREATE TABLE IF NOT EXISTS diagnostic_events (id INTEGER PRIMARY KEY, json TEXT NOT NULL); CREATE UNIQUE INDEX IF NOT EXISTS first_render_per_request ON diagnostic_events(json_extract(json, '$.workspaceId'), json_extract(json, '$.requestId')) WHERE json_extract(json, '$.type')='render-ack'",
    );
  }
  record(input: EventInput) {
    try {
      const event = eventSchema.parse({ ...input, at: Date.now() });
      const safe = JSON.stringify(event, (_key, value: unknown) =>
        typeof value === "string" ? redact(value) : value,
      );
      this.#db.prepare("INSERT OR IGNORE INTO diagnostic_events(json) VALUES (?)").run(safe);
    } catch {
      if (!this.#unavailable)
        process.emitWarning(
          "Local diagnostics storage is unavailable. Accepted workspace transactions remain saved; inspect diagnostics configuration before retrying.",
        );
      this.#unavailable = true;
    }
  }
  events(): TelemetryEvent[] {
    return this.#db
      .prepare("SELECT json FROM diagnostic_events ORDER BY id")
      .all()
      .map((row) => {
        if (typeof row.json !== "string") throw new Error("Invalid diagnostic journal.");
        return eventSchema.parse(JSON.parse(row.json));
      });
  }
  report() {
    return summarize(this.events());
  }
  close() {
    this.#db.close();
  }
}
export function summarize(events: readonly TelemetryEvent[]) {
  const counts = new Map<string, number>();
  const starts: TelemetryEvent[] = [];
  const ends: TelemetryEvent[] = [];
  const renders = new Map<string, TelemetryEvent>();
  const threads = new Set<string>();
  const followups = new Set<string>();
  const views = new Map<string, number>();
  const usage: TelemetryEvent[] = [];
  for (const event of events) {
    counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
    if (event.type === "analysis-start") {
      starts.push(event);
      threads.add(event.threadId ?? event.workspaceId);
      if (event.status === "follow-up") followups.add(event.threadId ?? event.workspaceId);
    }
    if (event.type === "analysis-end") ends.push(event);
    if (event.type === "render-ack") {
      const key = `${event.workspaceId}/${event.requestId}`;
      if (!renders.has(key)) renders.set(key, event);
    }
    if (event.type === "composition-committed" && event.component)
      views.set(event.component, (views.get(event.component) ?? 0) + 1);
    if (event.type === "provider-usage") usage.push(event);
  }
  const count = (type: string) => counts.get(type) ?? 0;
  const ratio = (numerator: number, denominator: number) => ({
    numerator,
    denominator,
    rate: denominator ? numerator / denominator : null,
  });
  return {
    querySuccess: ratio(count("query-success"), count("query-attempt")),
    validationRejects: events.filter(
      (event) => event.type === "guardrail" && event.status === "rejected",
    ).length,
    visualizationUsage: Object.fromEntries(views),
    followupRate: ratio(followups.size, threads.size),
    unsupported: ends.filter((event) => event.status === "unsupported").length,
    correctionRate: ratio(
      count("correction-accepted"),
      ends.filter((event) => event.status === "complete").length,
    ),
    timeToFirstInsight: starts.map((start) => {
      const rendered = renders.get(`${start.workspaceId}/${start.requestId}`);
      return { requestId: start.requestId, elapsedMs: rendered ? rendered.at - start.at : null };
    }),
    failures: ends
      .filter((event) => event.status !== "complete")
      .map(({ requestId, traceId, status, elapsedMs }) => ({
        requestId,
        traceId,
        status,
        elapsedMs,
      })),
    usage: usage.map(
      ({
        requestId,
        model,
        inputTokens,
        outputTokens,
        estimatedCost,
        pricingVersion,
        currency,
      }) => ({
        requestId,
        model,
        inputTokens: inputTokens ?? null,
        outputTokens: outputTokens ?? null,
        estimatedCost: estimatedCost ?? null,
        pricingVersion: pricingVersion ?? null,
        currency: currency ?? null,
      }),
    ),
  };
}
