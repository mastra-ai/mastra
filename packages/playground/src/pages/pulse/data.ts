/** ClickHouse access + pulse graph shaping for the viewer.
 *
 * Truth rule: every $ and status shown comes from the SAME rules the
 * ClickHouse reader uses (status SQL mirrored from
 * stores/clickhouse/src/storage/domains/pulse/index.ts; cost from the
 * verbatim pricing copy in ./pricing.ts). No display-only approximations.
 */
import { deriveCostUsd, latestPrices, priceFor, type ModelPriceRow } from './pricing';

/**
 * PROTOTYPE data path: the page queries ClickHouse DIRECTLY from the
 * browser (CH's built-in `add_http_cors_header` switch) so the server
 * needs zero pulse routes. The blessed long-term path is a graph read
 * API — this is demo plumbing, stated openly.
 */
export const chSettings = {
  url: 'http://localhost:8124',
  user: 'pulse',
  password: 'pulse', // local dev container pair, non-secret
  database: 'pulse_studio',
};

const STALE_THRESHOLD_S = 30; // mirrors the reader

async function q<T>(sql: string): Promise<T[]> {
  const p = new URLSearchParams({
    user: chSettings.user,
    password: chSettings.password,
    database: chSettings.database,
    add_http_cors_header: '1',
    query: sql + ' FORMAT JSONEachRow',
  });
  const res = await fetch(`${chSettings.url}/?${p.toString()}`);
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l));
}

export interface PulseRow {
  id: string;
  timestamp: string;
  seq: number;
  type: string;
  surface: string;
  action: string;
  text: string;
  data: string;
  attributes: string;
  trace_id: string;
  span_id: string;
  parent_span_id: string;
  run_id: string;
  source: string;
}

export interface RelRow {
  id: string;
  type: string;
  from_kind: string;
  from_id: string;
  to_kind: string;
  to_id: string;
  attributes: string;
  trace_id: string;
}

export interface FlowRow {
  flow_id: string;
  started_at: string;
  status: string;
  pulse_count: number;
  cost_usd: number | null; // reader-derived (usage × latest prices)
  thread_id: string;
  entity_name: string;
  root_name: string;
}

/**
 * Derived flow list — the reader's law, mirrored:
 * exact-runId session aborts > root _aborted > root _failed > root
 * _completed > stale (quiet > threshold) > running.
 */
export async function listFlows(): Promise<FlowRow[]> {
  const terminal = `endsWith(action, '_completed') OR endsWith(action, '_failed') OR endsWith(action, '_aborted')`;
  const rootTerm = `argMaxIf(action, (timestamp, seq), parent_span_id = '' AND (${terminal}))`;
  const flows = await q<FlowRow>(`
    WITH exact_aborts AS (
      SELECT DISTINCT run_id FROM (SELECT * FROM pulses LIMIT 1 BY id)
      WHERE source = 'session' AND surface = 'run_control' AND action = 'abort_completed' AND run_id != ''
    )
    SELECT trace_id AS flow_id,
           min(timestamp) AS started_at,
           multiIf(
             hasAny(groupUniqArrayIf(run_id, run_id != ''), (SELECT groupUniqArray(run_id) FROM exact_aborts)), 'aborted',
             endsWith(${rootTerm}, '_aborted'), 'aborted',
             endsWith(${rootTerm}, '_failed'), 'failed',
             endsWith(${rootTerm}, '_completed'), 'completed',
             dateDiff('second', max(timestamp), now64(3)) > ${STALE_THRESHOLD_S}, 'stale',
             'running') AS status,
           count() AS pulse_count,
           anyIf(thread_id, thread_id != '') AS thread_id,
           anyIf(JSONExtractString(metadata, 'entityName'), JSONExtractString(metadata, 'entityName') != '') AS entity_name,
           anyIf(text, text != '' AND parent_span_id = '') AS root_name
    FROM (SELECT * FROM pulses LIMIT 1 BY id)
    WHERE source IN ('span','native') AND trace_id != ''
    GROUP BY trace_id
    ORDER BY started_at DESC
    LIMIT 50`);
  // Reader-derived cost: usage on model end facts × latest prices — the
  // exact loop the ClickHouse reader runs (#derivedCosts).
  const prices = await loadPrices();
  const latest = latestPrices(prices);
  const costRows = await q<{ trace_id: string; data: string; attributes: string }>(`
    SELECT trace_id, data, attributes FROM (SELECT * FROM pulses LIMIT 1 BY id)
    WHERE trace_id != '' AND source IN ('span','native') AND data != '{}' AND data != ''`);
  const costs = new Map<string, number>();
  for (const r of costRows) {
    try {
      const data = JSON.parse(r.data || '{}');
      const attrs = JSON.parse(r.attributes || '{}');
      const price = priceFor(latest, attrs.provider, attrs.model);
      const c = price ? deriveCostUsd(data, price) : undefined;
      const v = c ?? (typeof data.cost_usd === 'number' ? data.cost_usd : undefined);
      if (typeof v === 'number') costs.set(r.trace_id, (costs.get(r.trace_id) ?? 0) + v);
    } catch {
      /* unparseable row: contributes nothing */
    }
  }
  return flows.map(f => ({ ...f, cost_usd: costs.get(f.flow_id) ?? null }));
}

export async function loadPrices(): Promise<ModelPriceRow[]> {
  try {
    const rows = await q<{
      provider: string;
      model: string;
      currency: string;
      version: number;
      valid_from: string;
      tiers: string;
    }>(`SELECT provider, model, currency, version, valid_from, tiers FROM model_prices FINAL`);
    return rows.map(r => ({
      provider: r.provider,
      model: r.model,
      currency: r.currency,
      version: Number(r.version),
      validFrom: new Date(r.valid_from),
      tiers: JSON.parse(r.tiers),
    }));
  } catch {
    return []; // table absent in older DBs
  }
}

export async function loadFlow(flowId: string): Promise<{ pulses: PulseRow[]; rels: RelRow[] }> {
  const esc = flowId.replace(/'/g, "\\'");
  const pulses = await q<PulseRow>(`
    SELECT * FROM (SELECT * FROM pulses LIMIT 1 BY id)
    WHERE trace_id = '${esc}'
       OR (trace_id = '' AND run_id != '' AND run_id IN (
             SELECT DISTINCT run_id FROM (SELECT * FROM pulses LIMIT 1 BY id)
             WHERE trace_id = '${esc}' AND run_id != ''))
    ORDER BY timestamp, seq`);
  const rels = await q<RelRow>(`
    SELECT * FROM (SELECT * FROM relationships LIMIT 1 BY id)
    WHERE trace_id = '${esc}' OR trace_id = ''
    ORDER BY seq`);
  return { pulses, rels };
}

export const SURFACE_COLORS: Record<string, string> = {
  agent: '#4f8ff7',
  model: '#9a6ef5',
  tool: '#f59e42',
  memory: '#3fbf8f',
  processor: '#8a9aa8',
  signal: '#ef5da8',
  signal_queue: '#ef5da8',
  content: '#e8c547',
  model_input: '#c05df0',
  tool_approval: '#f97316',
  execution: '#6b7280',
};

/** Plain-word meaning per surface.action — shown in the detail panel. */
export const FACT_MEANING: Record<string, string> = {
  'agent.run_started': 'The agent began working on a request.',
  'agent.run_completed': 'The agent finished this run successfully.',
  'agent.run_failed': 'The run ended with an error.',
  'agent.run_aborted': 'The run was cancelled while working.',
  'agent.run_suspended': 'The run paused (e.g. waiting for a human approval). Not finished.',
  'model.generate_started': 'The agent asked the language model to work.',
  'model.generate_completed': 'The model finished; token usage recorded here first-hand.',
  'model.step_started': 'One round of model work began (a run can have several).',
  'model.step_completed': 'This round finished, with its own token usage.',
  'model_input.finalized': 'MOMENT: the exact request text for the model was frozen here.',
  'model_input.executed': 'MOMENT: the model really received that request (first response byte).',
  'signal.delivery_decided': 'MOMENT: a signal arrived mid-run; the routing decision was made.',
  'signal_queue.drained': 'MOMENT: the agent picked queued signals up from the queue.',
  'content.introduced': 'MOMENT: new content entered the conversation context.',
  'content.removed': 'MOMENT: content was removed from the conversation context.',
  'tool.call_started': 'The agent started running a tool.',
  'tool.call_completed': 'The tool finished and returned a result.',
  'tool.call_failed': 'The tool threw an error.',
  'tool_approval.decided': 'MOMENT: a human approved or declined a tool call.',
  'memory.operation_started': 'A memory read/write began.',
  'memory.operation_completed': 'The memory operation finished.',
  'processor.run_started': 'A processor (code that edits messages) began.',
  'processor.run_completed': 'The processor finished.',
};

/** Moment facts: single-instant events — rendered as chips, never "open". */
export function isMomentFact(p: { surface: string; action: string }): boolean {
  if (['signal', 'signal_queue', 'content', 'model_input', 'tool_approval'].includes(p.surface)) return true;
  return !/(_started|_completed|_failed|_aborted|_suspended)$/.test(p.action);
}

/** Edge types worth drawing (flow_contains is pure bookkeeping noise). */
export const EDGE_STYLE: Record<string, { color: string; animated?: boolean; hidden?: boolean }> = {
  flow_contains: { color: '', hidden: true },
  parent_of: { color: '#94a3b8' },
  origin_of: { color: '', hidden: true },
  queued_signal: { color: '#ef5da8', animated: true },
  drained_signal: { color: '#ef5da8', animated: true },
  introduced_content: { color: '#e8c547', animated: true },
  included_in_model_input: { color: '#c05df0', animated: true },
  executes_request: { color: '#c05df0' },
  uses_model_settings: { color: '#64748b' },
  uses_tool_definition: { color: '#64748b' },
  resume_of: { color: '#f97316' },
};
