import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from '@xyflow/react';
import { useCallback, useEffect, useState } from 'react';
import '@xyflow/react/dist/style.css';
import {
  FACT_MEANING,
  SURFACE_COLORS,
  chSettings,
  listFlows,
  loadFlow,
  loadPrices,
  type FlowRow,
  type PulseRow,
} from './data';
import { buildGraph } from './graph';
import type { ModelPriceRow } from './pricing';

const fmtTime = (ts: string) => {
  const d = new Date(ts.replace(' ', 'T') + 'Z');
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};
const timeAgo = (ts: string) => {
  const s = Math.max(0, (Date.now() - Date.parse(ts.replace(' ', 'T') + 'Z')) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const chip = (status: string) =>
  ({ completed: '#3fbf8f', failed: '#ef4444', aborted: '#f97316', running: '#4f8ff7', stale: '#8a9aa8' })[status] ??
  '#8a9aa8';

/**
 * Experimental Pulse page (event-first observability, hard-split from the
 * span system). PROTOTYPE: reads ClickHouse directly from the browser —
 * the blessed path is a future graph read API. Uncommitted demo UI.
 */
export default function Pulse() {
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [live, setLive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prices, setPrices] = useState<ModelPriceRow[]>([]);
  const [db, setDb] = useState(chSettings.database);
  const [inspect, setInspect] = useState<{ fact: PulseRow; terminal?: PulseRow | null } | null>(null);
  const [showLegend, setShowLegend] = useState(false);

  useEffect(() => {
    void loadPrices().then(setPrices);
  }, []);

  const refreshFlows = useCallback(async () => {
    try {
      setFlows(await listFlows());
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const refreshGraph = useCallback(
    async (flowId: string) => {
      try {
        const { pulses, rels } = await loadFlow(flowId);
        const g = buildGraph(pulses, rels, prices);
        setNodes(g.nodes);
        setEdges(g.edges);
        setError(null);
      } catch (e) {
        setError(String(e));
      }
    },
    [prices],
  );

  useEffect(() => {
    void refreshFlows();
  }, [refreshFlows]);

  // Auto-select the newest flow on first load.
  useEffect(() => {
    if (!selected && flows.length) {
      const first = flows[0]!.flow_id;
      setSelected(first);
      void refreshGraph(first);
    }
  }, [flows, selected, refreshGraph]);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => {
      void refreshFlows();
      if (selected) void refreshGraph(selected);
    }, 2000);
    return () => clearInterval(t);
  }, [live, selected, refreshFlows, refreshGraph]);

  const onNodeClick = useCallback((_e: unknown, node: Node) => {
    const raw = (node.data as any)?.raw;
    if (raw?.fact) setInspect(raw);
  }, []);

  const meaningOf = (p: PulseRow) => FACT_MEANING[`${p.surface}.${p.action}`] ?? '';

  return (
    <div
      style={{ display: 'flex', height: '100%', minHeight: 0, fontFamily: 'inherit', background: 'var(--surface1)' }}
    >
      <aside
        style={{
          width: 320,
          borderRight: '1px solid var(--border1)',
          overflow: 'auto',
          color: 'var(--neutral6)',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <strong style={{ flex: 1 }}>Pulse flows</strong>
          <button
            style={{
              background: 'var(--surface4)',
              color: 'var(--neutral6)',
              border: '1px solid var(--border1)',
              borderRadius: 6,
              padding: '2px 8px',
              fontSize: 10,
              cursor: 'pointer',
            }}
            onClick={() => void refreshFlows()}
          >
            ↻
          </button>
          <label style={{ fontSize: 11 }}>
            <input type="checkbox" checked={live} onChange={e => setLive(e.target.checked)} /> live
          </label>
        </div>
        <div
          style={{
            padding: '0 12px 8px',
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            fontSize: 10,
            color: 'var(--neutral3)',
          }}
        >
          db
          <input
            value={db}
            onChange={e => setDb(e.target.value)}
            onBlur={() => {
              chSettings.database = db;
              setSelected(null);
              void refreshFlows();
              void loadPrices().then(setPrices);
            }}
            style={{
              flex: 1,
              background: 'var(--surface3)',
              color: 'var(--neutral6)',
              border: '1px solid var(--border1)',
              borderRadius: 4,
              padding: '2px 6px',
              fontSize: 10,
            }}
          />
        </div>
        {error && <div style={{ color: 'var(--red-500, #ef4444)', padding: 12, fontSize: 11 }}>{error}</div>}
        {flows.map(f => (
          <div
            key={f.flow_id}
            onClick={() => {
              setSelected(f.flow_id);
              setInspect(null);
              void refreshGraph(f.flow_id);
            }}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              background: selected === f.flow_id ? 'var(--surface5)' : 'transparent',
              borderBottom: '1px solid var(--border1)',
              fontSize: 12,
            }}
          >
            <div
              style={{ display: 'flex', gap: 6, alignItems: 'center' }}
              title={`flow ${f.flow_id}\nthread ${f.thread_id}`}
            >
              <span style={{ width: 8, height: 8, borderRadius: 4, background: chip(f.status), flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>{fmtTime(f.started_at)}</span>
              <span
                style={{ color: 'var(--neutral4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {f.entity_name || f.root_name || f.flow_id.slice(0, 8)}
              </span>
              <span style={{ marginLeft: 'auto', color: 'var(--neutral4)', flexShrink: 0 }}>{f.status}</span>
            </div>
            <div style={{ color: 'var(--neutral3)', fontSize: 10, marginTop: 2 }}>
              {timeAgo(f.started_at)} · {f.pulse_count} pulses{f.cost_usd ? ` · $${Number(f.cost_usd).toFixed(6)}` : ''}
            </div>
          </div>
        ))}
        <div style={{ padding: 12, fontSize: 10, color: 'var(--neutral3)' }}>
          <button
            style={{
              marginBottom: 8,
              background: 'var(--surface4)',
              color: 'var(--neutral6)',
              border: '1px solid var(--border1)',
              borderRadius: 6,
              padding: '2px 8px',
              fontSize: 10,
              cursor: 'pointer',
            }}
            onClick={() => setShowLegend(s => !s)}
          >
            {showLegend ? 'hide legend' : 'what am I looking at?'}
          </button>
          {showLegend && (
            <div style={{ lineHeight: 1.7 }}>
              <div>
                <b style={{ color: 'var(--neutral5)' }}>Boxes</b> = work with a start and an end (run, model call, tool,
                memory, processor). "✓ + time" = finished. "… open" = still running right now.
              </div>
              <div>
                <b style={{ color: 'var(--neutral5)' }}>◆ dashed chips</b> = single moments (a request frozen, a signal
                decision, an approval). Moments have no duration.
              </div>
              <div>
                <b style={{ color: 'var(--neutral5)' }}>Grey lines</b> = "contains".{' '}
                <b style={{ color: '#ef5da8' }}>Pink dashed</b> = the life of a signal.{' '}
                <b style={{ color: '#c05df0' }}>Purple</b> = exact request membership + "the model really got it".
              </div>
              <div>
                Every $ comes from the reader's own rule (tokens × versioned price) — nothing is estimated here.
              </div>
              <div style={{ marginTop: 6 }}>
                {Object.entries(SURFACE_COLORS)
                  .slice(0, 9)
                  .map(([s, c]) => (
                    <span key={s} style={{ marginRight: 8 }}>
                      <span style={{ color: c }}>■</span> {s}
                    </span>
                  ))}
              </div>
              <div style={{ marginTop: 6, color: 'var(--neutral3)' }}>
                Prototype data path: this page reads ClickHouse directly; the product path is a future graph read API.
              </div>
            </div>
          )}
        </div>
      </aside>
      <main style={{ flex: 1, position: 'relative', minWidth: 0, background: 'var(--surface1)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          proOptions={{ hideAttribution: true }}
          colorMode="system"
          onNodeClick={onNodeClick}
          onPaneClick={() => setInspect(null)}
        >
          <Background color="#1e293b" />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
        {inspect && (
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 380,
              maxHeight: '85%',
              overflow: 'auto',
              background: 'var(--surface3)',
              border: '1px solid var(--border1)',
              borderRadius: 8,
              color: 'var(--neutral6)',
              padding: 12,
              fontSize: 11,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ flex: 1 }}>
                {inspect.fact.surface}.{inspect.fact.action}
              </strong>
              <button
                style={{
                  background: 'var(--surface4)',
                  color: 'var(--neutral6)',
                  border: '1px solid var(--border1)',
                  borderRadius: 6,
                  padding: '2px 8px',
                  fontSize: 10,
                  cursor: 'pointer',
                }}
                onClick={() => setInspect(null)}
              >
                ✕
              </button>
            </div>
            {meaningOf(inspect.fact) && (
              <div style={{ color: 'var(--neutral4)', marginBottom: 8 }}>{meaningOf(inspect.fact)}</div>
            )}
            <div style={{ color: 'var(--neutral3)', marginBottom: 4 }}>the raw fact (exactly as stored):</div>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                background: 'var(--surface2)',
                padding: 8,
                borderRadius: 6,
              }}
            >
              {JSON.stringify(inspect.fact, null, 2)}
            </pre>
            {inspect.terminal && (
              <>
                <div style={{ color: 'var(--neutral3)', margin: '8px 0 4px' }}>its end fact:</div>
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    background: 'var(--surface2)',
                    padding: 8,
                    borderRadius: 6,
                  }}
                >
                  {JSON.stringify(inspect.terminal, null, 2)}
                </pre>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
