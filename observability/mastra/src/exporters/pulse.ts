import { randomUUID } from 'node:crypto';
import { TracingEventType } from '@mastra/core/observability';
import type { TracingEvent } from '@mastra/core/observability';
import { BaseExporter } from './base';
import type { BaseExporterConfig } from './base';

/**
 * PulseExporter — HIDDEN research prototype (esp/pulse). Off unless MASTRA_PULSE=1.
 *
 * Subscribes to the same span stream every exporter sees and translates each
 * span lifecycle event into Pulse + Relationship ROWS, inserted into a local
 * ClickHouse over HTTP (no new npm dependency; Node global fetch). Flow and
 * duration are NOT stored — they are derived at read time by SQL.
 *
 * Connection via env (defaults target the dedicated pulse-clickhouse container):
 *   PULSE_CH_URL (http://localhost:8124), PULSE_CH_USER (pulse),
 *   PULSE_CH_PASSWORD (pulse), PULSE_CH_DB (pulse), PULSE_SCENARIO (label).
 */

let SEQ = 0;

interface PulseRow {
  id: string;
  ts: string;
  seq: number;
  kind: 'observation' | 'change';
  type: string;
  surface: string;
  action: string;
  trace_id: string;
  span_id: string;
  parent_span_id: string;
  run_id: string;
  thread_id: string;
  resource_id: string;
  source: string;
  scenario: string;
  text: string;
  data: string;
  attributes: string;
  metadata: string;
}

interface RelRow {
  id: string;
  ts: string;
  seq: number;
  type: string;
  from_kind: string;
  from_id: string;
  to_kind: string;
  to_id: string;
  trace_id: string;
  scenario: string;
}

// ClickHouse DateTime64(3): 'YYYY-MM-DD HH:MM:SS.mmm' (UTC)
function chTime(d: Date | undefined): string {
  const t = d ?? new Date();
  return t.toISOString().replace('T', ' ').replace('Z', '');
}

function meta(span: any, key: string): string {
  const v = span?.metadata?.[key];
  return v == null ? '' : String(v);
}

function surfaceAction(spanType: string): { surface: string; base: string } {
  switch (spanType) {
    case 'agent_run':
      return { surface: 'agent', base: 'run' };
    case 'model_generation':
      return { surface: 'model', base: 'generate' };
    case 'model_inference':
      return { surface: 'model', base: 'infer' };
    case 'model_step':
      return { surface: 'model', base: 'step' };
    case 'tool_call':
    case 'mcp_tool_call':
    case 'client_tool_call':
    case 'provider_tool_call':
      return { surface: 'tool', base: 'call' };
    case 'workflow_run':
      return { surface: 'workflow', base: 'run' };
    case 'workflow_step':
      return { surface: 'workflow', base: 'step' };
    case 'memory_operation':
      return { surface: 'memory', base: 'operation' };
    case 'scorer_run':
      return { surface: 'eval', base: 'score' };
    case 'processor_run':
      return { surface: 'processor', base: 'run' };
    default:
      return { surface: spanType || 'generic', base: 'event' };
  }
}

export class PulseExporter extends BaseExporter {
  name = 'pulse-exporter';
  #url: string;
  #user: string;
  #password: string;
  #db: string;
  #scenario: string;

  constructor(config: BaseExporterConfig = {}) {
    super(config);
    this.#url = process.env.PULSE_CH_URL ?? 'http://localhost:8124';
    this.#user = process.env.PULSE_CH_USER ?? 'pulse';
    this.#password = process.env.PULSE_CH_PASSWORD ?? 'pulse';
    this.#db = process.env.PULSE_CH_DB ?? 'pulse';
    this.#scenario = process.env.PULSE_SCENARIO ?? 'default';
    if (process.env.MASTRA_PULSE !== '1') {
      this.setDisabled('MASTRA_PULSE not set', 'debug');
    }
  }

  async #insert(table: string, rows: object[]): Promise<void> {
    if (!rows.length) return;
    const body = rows.map(r => JSON.stringify(r)).join('\n');
    const q = encodeURIComponent(`INSERT INTO ${this.#db}.${table} FORMAT JSONEachRow`);
    const url = `${this.#url}/?user=${this.#user}&password=${this.#password}&database=${this.#db}&query=${q}`;
    try {
      const res = await fetch(url, { method: 'POST', body });
      if (!res.ok) {
        this.logger.debug(`pulse-exporter insert ${table} failed: ${res.status} ${await res.text()}`);
      }
    } catch (err) {
      this.logger.debug(`pulse-exporter insert ${table} error: ${(err as Error).message}`);
    }
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    const span: any = event.exportedSpan;
    if (!span) return;

    const { surface, base } = surfaceAction(span.type);
    const traceId = span.traceId ?? '';
    const spanId = span.id ?? '';
    const isStart = event.type === TracingEventType.SPAN_STARTED;
    const isEnd = event.type === TracingEventType.SPAN_ENDED;
    if (!isStart && !isEnd) return; // ignore UPDATED for the prototype

    const hasError = Boolean(span.errorInfo);
    const action = isStart ? `${base}_started` : hasError ? `${base}_failed` : `${base}_completed`;
    const ts = chTime(isEnd ? span.endTime : span.startTime);

    const pulse: PulseRow = {
      id: randomUUID(),
      ts,
      seq: ++SEQ,
      kind: 'observation',
      type: hasError ? 'error' : 'state',
      surface,
      action,
      trace_id: traceId,
      span_id: spanId,
      parent_span_id: span.parentSpanId ?? '',
      run_id: meta(span, 'runId'),
      thread_id: meta(span, 'threadId'),
      resource_id: meta(span, 'resourceId'),
      source: 'span',
      scenario: this.#scenario,
      text: span.name ?? '',
      data: JSON.stringify(span.attributes?.usage ?? {}),
      attributes: JSON.stringify(span.attributes ?? {}),
      metadata: JSON.stringify({
        userId: meta(span, 'userId'),
        organizationId: meta(span, 'organizationId'),
        environment: meta(span, 'environment'),
        entityType: span.entityType ?? '',
        entityId: span.entityId ?? '',
        entityName: span.entityName ?? '',
        input: isStart ? span.input : undefined,
        output: isEnd ? span.output : undefined,
        error: hasError ? span.errorInfo : undefined,
      }),
    };
    await this.#insert('pulses', [pulse]);

    // Relationships: emit structural + definition edges once, at end (full data).
    if (isEnd) {
      const rels: RelRow[] = [];
      const rel = (type: string, fromKind: string, fromId: string, toKind: string, toId: string): RelRow => ({
        id: randomUUID(),
        ts,
        seq: ++SEQ,
        type,
        from_kind: fromKind,
        from_id: fromId,
        to_kind: toKind,
        to_id: toId,
        trace_id: traceId,
        scenario: this.#scenario,
      });
      if (span.isRootSpan) rels.push(rel('origin_of', 'span', spanId, 'flow', traceId));
      if (span.parentSpanId) rels.push(rel('parent_of', 'span', span.parentSpanId, 'span', spanId));
      if (span.type === 'model_generation' || span.type === 'model_inference') {
        const model = span.attributes?.model;
        const provider = span.attributes?.provider;
        if (model)
          rels.push(rel('uses_model_settings', 'span', spanId, 'definition', `model:${provider ?? ''}/${model}`));
        const tools = span.attributes?.tools;
        if (Array.isArray(tools)) {
          for (const t of tools) {
            const tn = typeof t === 'string' ? t : t?.name;
            if (tn) rels.push(rel('uses_tool_definition', 'span', spanId, 'definition', `tool:${tn}`));
          }
        }
      }
      await this.#insert('relationships', rels);
    }
  }
}
