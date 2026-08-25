import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';
import { EDGE_STYLE, SURFACE_COLORS, isMomentFact, type PulseRow, type RelRow } from './data';
import { deriveCostUsd, latestPrices, priceFor, type ModelPriceRow } from './pricing';

/**
 * Pulses → nodes, relationships (+ parent-key columns) → edges, dagre
 * left-to-right layout so time reads like a story.
 *
 * Two node kinds, honestly distinct:
 *  - LIFECYCLE nodes (started/ended pairs collapse onto the started fact):
 *    boxes; "… open" appears ONLY when a start truly has no end yet.
 *  - MOMENT facts (finalized/executed/decided/drained/introduced/…):
 *    small chips — they are single instants, nothing about them is open.
 * Every $ shown = deriveCostUsd (the verbatim reader rule), nothing else.
 */
export function buildGraph(
  pulses: PulseRow[],
  rels: RelRow[],
  prices: ModelPriceRow[] = [],
): { nodes: Node[]; edges: Edge[] } {
  const byId = new Map(pulses.map(p => [p.id, p]));
  const latest = latestPrices(prices);

  // Collapse span lifecycle pairs onto the started node.
  const started = new Map<string, PulseRow>(); // spanId -> started pulse
  for (const p of pulses) {
    if (p.span_id && p.action.endsWith('_started')) started.set(p.span_id, p);
  }
  const nodeFor = new Map<string, string>(); // pulseId -> nodeId (started pulse id)
  const terminal = new Map<string, PulseRow>(); // nodeId -> terminal pulse
  for (const p of pulses) {
    const start = !isMomentFact(p) && p.span_id ? started.get(p.span_id) : undefined;
    if (start) {
      nodeFor.set(p.id, start.id);
      if (p.id !== start.id) terminal.set(start.id, p);
    } else {
      nodeFor.set(p.id, p.id);
    }
  }

  const nodes: Node[] = [];
  const seen = new Set<string>();
  const nodeByKey = new Map<string, string>(); // span_id/node key -> nodeId
  for (const p of pulses) {
    const nid = nodeFor.get(p.id)!;
    if (seen.has(nid)) continue;
    seen.add(nid);
    const base = byId.get(nid) ?? p;
    if (base.span_id) nodeByKey.set(base.span_id, nid);
    const end = terminal.get(nid);
    const moment = isMomentFact(base);
    const data = safeJson(end?.data ?? base.data);
    const attrs = safeJson(base.attributes);
    const endAttrs = end ? safeJson(end.attributes) : {};
    const endState = (end ?? base).action.match(/_(completed|failed|aborted|suspended)$/)?.[1];
    const durationMs =
      end && base.timestamp !== end.timestamp
        ? Date.parse(end.timestamp + 'Z') - Date.parse(base.timestamp + 'Z')
        : null;
    const label = base.text || `${base.surface}.${base.action.replace(/_started$/, '')}`;
    // Read-time cost, THE reader rule only (model nodes carrying usage).
    let derived: number | undefined;
    if (base.surface === 'model') {
      const model = (endAttrs.model ?? attrs.model) as string | undefined;
      const provider = (endAttrs.provider ?? attrs.provider) as string | undefined;
      const price = priceFor(latest, provider, model);
      if (price) derived = deriveCostUsd(data, price);
    }

    if (moment) {
      const sub = [
        attrs.routing ? `routing: ${attrs.routing}` : '',
        attrs.approved === false ? `declined: ${String(attrs.reason ?? '').slice(0, 40)}` : '',
        attrs.approved === true ? 'approved' : '',
        attrs.signalId ? `sig ${String(attrs.signalId).slice(0, 8)}` : '',
        attrs.step != null ? `step ${attrs.step}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      nodes.push({
        id: nid,
        position: { x: 0, y: 0 },
        data: {
          label: `◆ ${label}${sub ? `\n${sub}` : ''}`,
          surface: base.surface,
          seq: base.seq,
          raw: { fact: base },
          moment: true,
        },
        style: {
          background: 'var(--surface2)',
          color: 'var(--neutral5)',
          border: `1px dashed ${SURFACE_COLORS[base.surface] ?? '#64748b'}`,
          borderRadius: 14,
          padding: 5,
          fontSize: 10,
          whiteSpace: 'pre-wrap',
          width: 170,
        },
      });
      continue;
    }

    const statusLine = endState
      ? endState === 'completed'
        ? '✓ completed'
        : endState === 'failed'
          ? '✗ failed'
          : endState === 'aborted'
            ? '✗ aborted'
            : '⏸ suspended (not finished)'
      : '… open';
    const sub = [
      statusLine,
      durationMs != null ? `${durationMs}ms` : '',
      derived != null ? `$${derived.toFixed(6)}` : '',
      data.total_input_tokens != null ? `${data.total_input_tokens}→${data.total_output_tokens ?? 0} tok` : '',
      endAttrs.success === false ? 'success: false' : '',
    ]
      .filter(Boolean)
      .join(' · ');
    nodes.push({
      id: nid,
      position: { x: 0, y: 0 },
      data: {
        label: `${label}\n${sub}`,
        surface: base.surface,
        seq: base.seq,
        raw: { fact: base, terminal: end ?? null },
        moment: false,
      },
      style: {
        background: 'var(--surface3)',
        color: 'var(--neutral6)',
        border: `2px solid ${endState === 'failed' || endState === 'aborted' ? '#ef4444' : (SURFACE_COLORS[base.surface] ?? '#64748b')}`,
        borderRadius: 8,
        padding: 8,
        fontSize: 11,
        whiteSpace: 'pre-wrap',
        width: 210,
      },
    });
  }

  // Content endpoints (signal:<id>) become small pill nodes on demand.
  const contentNodes = new Set<string>();
  const edges: Edge[] = [];
  const edgePairs = new Set<string>();
  for (const r of rels) {
    const style = EDGE_STYLE[r.type];
    if (!style || style.hidden) continue;
    const from = r.from_kind === 'pulse' ? (nodeFor.get(r.from_id) ?? r.from_id) : r.from_id;
    let to = r.to_kind === 'pulse' ? (nodeFor.get(r.to_id) ?? r.to_id) : r.to_id;
    // Membership first: an edge whose FROM fact is not in this flow is a
    // foreign row (trace_id='' edges are shared) — never materialize its pill.
    if (r.from_kind === 'pulse' && !seen.has(from)) continue;
    if (r.to_kind === 'content' || r.to_kind === 'definition') {
      contentNodes.add(to);
    } else if (r.to_kind === 'pulse' && !seen.has(to)) continue;
    const attrs = safeJson(r.attributes);
    edgePairs.add(`${from}->${to}`);
    edges.push({
      id: r.id,
      source: from,
      target: to,
      animated: style.animated,
      label: r.type + (attrs.position != null ? ` @${attrs.position}` : ''),
      labelStyle: { fontSize: 9, fill: 'var(--neutral5)' },
      labelBgStyle: { fill: 'var(--surface4)', fillOpacity: 0.95 },
      style: { stroke: style.color, strokeWidth: 1.5 },
    });
  }

  // Column-based parentage: a fact whose parent_span_id names a known node
  // key gets a tree edge even when no relationship row exists (older data).
  for (const n of nodes) {
    const base = byId.get(n.id);
    if (!base?.parent_span_id) continue;
    const parentNode = nodeByKey.get(base.parent_span_id);
    if (!parentNode || parentNode === n.id) continue;
    if (edgePairs.has(`${parentNode}->${n.id}`)) continue;
    edgePairs.add(`${parentNode}->${n.id}`);
    edges.push({
      id: `col-${n.id}`,
      source: parentNode,
      target: n.id,
      label: undefined,
      style: { stroke: '#475569', strokeWidth: 1.2 },
    });
  }

  for (const id of contentNodes) {
    nodes.push({
      id,
      position: { x: 0, y: 0 },
      data: { label: id.startsWith('signal:') ? `✉ signal ${id.slice(7, 15)}` : id, seq: 0 },
      style: {
        background: 'var(--surface2)',
        color: '#fde68a',
        border: '1px dashed #e8c547',
        borderRadius: 16,
        padding: 6,
        fontSize: 10,
      },
    });
  }

  // dagre LEFT-TO-RIGHT: time reads like a story; seq is the rank tiebreak.
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 28, ranksep: 70 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes.sort((a, b) => Number(a.data.seq ?? 0) - Number(b.data.seq ?? 0))) {
    g.setNode(n.id, { width: (n.data as any).moment ? 180 : 220, height: (n.data as any).moment ? 44 : 64 });
  }
  for (const e of edges) if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
  dagre.layout(g);
  for (const n of nodes) {
    const pos = g.node(n.id);
    if (pos) n.position = { x: pos.x - 110, y: pos.y - 32 };
  }
  return { nodes, edges: edges.filter(e => g.hasNode(e.source) && g.hasNode(e.target)) };
}

function safeJson(s: string | undefined): Record<string, any> {
  try {
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}
