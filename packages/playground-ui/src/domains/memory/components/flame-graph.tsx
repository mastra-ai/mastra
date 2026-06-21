import { RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button } from '../../../ds/components/Button';
import type { ExtractedOmMarker } from '../lib/extract-markers';
import type { TDomain } from '../lib/timeline';
import { formatTimeDisplay, toT, tToTimestamp } from '../lib/timeline';
import type { MemoryMessage, OMHistoryRecord } from '../types';

interface FlameGraphProps {
  omRecords: OMHistoryRecord[];
  markers: ExtractedOmMarker[];
  messages: MemoryMessage[];
  tDomain: TDomain;
  observationThreshold?: number;
  reflectionThreshold?: number;
}

const MSG_COLOR = 'var(--color-green-500, #22c55e)';
const OBS_COLOR = '#f59e0b';
const REFLECT_COLOR = '#ec4899';

function getObservationTimestamp(record: OMHistoryRecord): string {
  const d = record.lastObservedAt ?? record.updatedAt;
  return typeof d === 'string' ? d : new Date(d).toISOString();
}

function toContextData(records: OMHistoryRecord[], markers: ExtractedOmMarker[], domain: TDomain) {
  const fromRecords = records.map((r) => ({
    ts: String(getObservationTimestamp(r)),
    pendingMessageTokens: r.pendingMessageTokens,
  }));
  const fromMarkers = markers
    .filter((m) => m.pendingTokens != null)
    .map((m) => ({
      ts: m.timestamp,
      pendingMessageTokens: m.pendingTokens!,
    }));
  return [...fromRecords, ...fromMarkers]
    .sort((a, b) => a.ts.localeCompare(b.ts))
    .map((d) => ({ t: toT(d.ts, domain), pendingMessageTokens: d.pendingMessageTokens }));
}

function toActiveObservationData(
  records: OMHistoryRecord[],
  markers: ExtractedOmMarker[],
  domain: TDomain,
) {
  const points = [
    ...records.map((record) => ({
      ts: String(getObservationTimestamp(record)),
      observationTokenCount: record.observationTokenCount,
    })),
    ...markers
      .filter((marker) => marker.type === 'status' && marker.observationTokens != null)
      .map((marker) => ({
        ts: marker.timestamp,
        observationTokenCount: marker.observationTokens!,
      })),
  ].sort((a, b) => a.ts.localeCompare(b.ts));

  let runningTotal = 0;
  return points.map((point) => {
    runningTotal = Math.max(runningTotal, point.observationTokenCount);
    return { t: toT(point.ts, domain), observationTokenCount: runningTotal };
  });
}

function toBufferedObservationData(markers: ExtractedOmMarker[], domain: TDomain) {
  const points = markers
    .filter(
      (marker) =>
        marker.observationTokens != null &&
        (marker.type === 'buffering-end' || marker.type === 'activation'),
    )
    .map((marker) => ({
      ts: marker.timestamp,
      bufferedObservationTokenCount:
        marker.type === 'activation' ? -marker.observationTokens! : marker.observationTokens!,
    }))
    .sort((a, b) => a.ts.localeCompare(b.ts));

  let runningTotal = 0;
  return points.map((point) => {
    runningTotal = Math.max(0, runningTotal + point.bufferedObservationTokenCount);
    return { t: toT(point.ts, domain), bufferedObservationTokenCount: runningTotal };
  });
}

function toEventData(records: OMHistoryRecord[], domain: TDomain) {
  return [...records]
    .sort((a, b) =>
      String(getObservationTimestamp(a)).localeCompare(String(getObservationTimestamp(b))),
    )
    .map((r) => ({ t: toT(String(getObservationTimestamp(r)), domain), event: 1 }));
}

function toMessageData(messages: MemoryMessage[], domain: TDomain) {
  return [...messages]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((m) => ({
      t: toT(new Date(m.createdAt).toISOString(), domain),
      event: 1,
      role: m.role,
    }));
}

function TimeAxis({ domain }: { domain: TDomain }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div className="grid grid-cols-[6rem_1fr] items-center">
      <p className="flex items-center self-stretch border-r border-[var(--mastra-border-1)]/50 pl-3 text-[10px] font-medium text-icon3">
        Time
      </p>
      <div className="flex justify-between px-1 py-1.5 font-mono text-[9px] text-icon3">
        {ticks.map((t) => (
          <span key={t}>{formatTimeDisplay(tToTimestamp(t, domain))}</span>
        ))}
      </div>
    </div>
  );
}

function FlameTooltip({
  active,
  payload,
  domain,
  showValue,
}: {
  active?: boolean;
  payload?: Array<{ value: unknown; name: string; payload?: { t?: number } }>;
  domain?: TDomain;
  showValue?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const t = payload[0]?.payload?.t;
  const time = domain != null && t != null ? formatTimeDisplay(tToTimestamp(t, domain)) : null;
  const visibleEntries = payload.filter(
    (entry) => entry.name !== 't' && entry.name !== 'time' && entry.value != null,
  );

  if (showValue) {
    return (
      <div className="flex flex-col gap-0.5 rounded border border-[var(--mastra-border-1)] bg-[var(--mastra-bg-3)] px-2 py-1.5 font-mono text-[9px] shadow">
        {time && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-icon3">time</span>
            <span className="text-[var(--mastra-el-6)]">{time}</span>
          </div>
        )}
        {visibleEntries.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-3">
            <span className="text-icon3">{entry.name}</span>
            <span className="text-[var(--mastra-el-6)]">
              {typeof entry.value === 'number'
                ? Math.round(entry.value).toLocaleString()
                : String(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded border border-[var(--mastra-border-1)] bg-[var(--mastra-bg-3)] px-2 py-1 font-mono text-[9px] shadow">
      {time && <span className="text-[var(--mastra-el-6)]">{time}</span>}
    </div>
  );
}

interface AreaRowProps {
  label: string;
  data: Array<{ t: number; [k: string]: unknown }>;
  dataKey: string;
  color: string;
  gradientId: string;
  domain: TDomain;
  zoomDomain: [number, number];
  threshold?: number;
}

function AreaRow({
  label,
  data,
  dataKey,
  color,
  gradientId,
  domain,
  zoomDomain,
  threshold,
}: AreaRowProps) {
  const maxValue = Math.max(0, ...data.map((d) => Number(d[dataKey]) || 0));
  const yMax = threshold != null ? Math.max(maxValue, threshold) : undefined;

  return (
    <div className="relative grid grid-cols-[6rem_1fr] items-center border-b border-[var(--mastra-border-1)]/50 hover:z-10">
      <p className="flex items-center self-stretch border-r border-[var(--mastra-border-1)]/50 pl-3 text-[10px] font-medium text-icon3">
        {label}
      </p>
      <div>
        <ResponsiveContainer width="100%" height={32}>
          <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" type="number" domain={zoomDomain} allowDataOverflow hide />
            <YAxis type="number" domain={yMax != null ? [0, yMax] : undefined} hide />
            <Tooltip
              content={<FlameTooltip domain={domain} showValue />}
              cursor={{ stroke: 'rgba(255,255,255,0.08)' }}
            />
            <Area
              type="linear"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={1}
              strokeOpacity={0.6}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
            />
            {threshold != null && (
              <ReferenceLine y={threshold} stroke={color} strokeDasharray="4 3" strokeOpacity={0.4} />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface EventRowProps {
  label: string;
  data: Array<{ t: number; event: number; [k: string]: unknown }>;
  color: string;
  height?: number;
  domain: TDomain;
  zoomDomain: [number, number];
}

function EventRow({ label, data, color, height = 32, domain, zoomDomain }: EventRowProps) {
  return (
    <div className="relative grid grid-cols-[6rem_1fr] items-center border-b border-[var(--mastra-border-1)]/50 hover:z-10">
      <p className="flex items-center self-stretch border-r border-[var(--mastra-border-1)]/50 pl-3 text-[10px] font-medium text-icon3">
        {label}
      </p>
      <div>
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey="t" type="number" domain={zoomDomain} allowDataOverflow hide />
            <YAxis dataKey="event" type="number" domain={[0, 2]} hide />
            <Tooltip content={<FlameTooltip domain={domain} />} cursor={false} />
            <Scatter
              data={data}
              fill={color}
              isAnimationActive={false}
              shape={(props: Record<string, unknown>) => {
                const cx = props.cx as number;
                return (
                  <g>
                    <rect x={cx - 6} y={0} width={12} height={height} fill="transparent" />
                    <rect x={cx - 1.5} y={0} width={3} height={height} fill={color} />
                  </g>
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface CombinedRowProps {
  label: string;
  areaData: Array<Record<string, number>>;
  areaDataKey: string;
  eventData: Array<{ t: number; event: number; [k: string]: unknown }>;
  color: string;
  gradientId: string;
  domain: TDomain;
  zoomDomain: [number, number];
  threshold?: number;
  height?: number;
}

function CombinedRow({
  label,
  areaData,
  areaDataKey,
  eventData,
  color,
  gradientId,
  domain,
  zoomDomain,
  threshold,
  height = 44,
}: CombinedRowProps) {
  const areaValueByTime = new Map(areaData.map((point) => [point.t, Number(point[areaDataKey] ?? 0)]));
  const eventsByTime = eventData.reduce<Map<number, Array<(typeof eventData)[number]>>>(
    (acc, event) => {
      const bucket = acc.get(event.t);
      if (bucket) {
        bucket.push(event);
      } else {
        acc.set(event.t, [event]);
      }
      return acc;
    },
    new Map(),
  );
  const allTimes = Array.from(new Set([...areaValueByTime.keys(), ...eventsByTime.keys()])).sort(
    (a, b) => a - b,
  );

  let lastAreaValue = 0;
  const combinedData: Array<Record<string, unknown> & { t: number }> = [];
  for (const time of allTimes) {
    const nextAreaValue = areaValueByTime.get(time);
    if (nextAreaValue != null) {
      lastAreaValue = nextAreaValue;
    }

    const bucket = eventsByTime.get(time);
    if (bucket && bucket.length > 0) {
      for (const event of bucket) {
        combinedData.push({ ...event, t: time, [areaDataKey]: lastAreaValue });
      }
    } else {
      combinedData.push({ t: time, [areaDataKey]: lastAreaValue });
    }
  }

  return (
    <div className="relative grid grid-cols-[6rem_1fr] items-center border-b border-[var(--mastra-border-1)]/50 hover:z-10">
      <p className="flex items-center self-stretch border-r border-[var(--mastra-border-1)]/50 pl-3 text-[10px] font-medium text-icon3">
        {label}
      </p>
      <div>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.06} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" type="number" domain={zoomDomain} allowDataOverflow hide />
            <YAxis yAxisId="area" dataKey={areaDataKey} type="number" hide domain={[0, 'dataMax']} />
            <Tooltip content={<FlameTooltip domain={domain} showValue />} cursor={false} />
            <Area
              yAxisId="area"
              data={combinedData}
              type="linear"
              dataKey={areaDataKey}
              stroke={color}
              strokeWidth={1}
              strokeOpacity={0.6}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              activeDot={{ r: 5, stroke: color, strokeWidth: 2, fill: '#0a0a0a' }}
              dot={(props: Record<string, unknown>) => {
                const dotPayload = props.payload as { event?: number } | undefined;
                if (!dotPayload?.event) return <></>;
                return (
                  <circle cx={props.cx as number} cy={props.cy as number} r={4} fill={color} />
                );
              }}
            />
            {threshold != null && (
              <ReferenceLine
                yAxisId="area"
                y={threshold}
                stroke={color}
                strokeDasharray="4 3"
                strokeOpacity={0.4}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ZoomTrack({
  tDomain,
  zoomLeft,
  zoomRight,
  onZoomLeftChange,
  onZoomRightChange,
  onReset,
}: {
  tDomain: TDomain;
  zoomLeft: number;
  zoomRight: number;
  onZoomLeftChange: (ts: number) => void;
  onZoomRightChange: (ts: number) => void;
  onReset: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'left' | 'right' | null>(null);

  const range = tDomain.tMax - tDomain.tMin;
  const leftPercent = range > 0 ? ((zoomLeft - tDomain.tMin) / range) * 100 : 0;
  const rightPercent = range > 0 ? ((zoomRight - tDomain.tMin) / range) * 100 : 100;

  const toTimestamp = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return null;
      const rect = track.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return tDomain.tMin + frac * (tDomain.tMax - tDomain.tMin);
    },
    [tDomain.tMin, tDomain.tMax],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const ts = toTimestamp(e.clientX);
      if (ts == null) return;
      if (dragging.current === 'left') {
        onZoomLeftChange(Math.min(ts, zoomRight));
      } else {
        onZoomRightChange(Math.max(ts, zoomLeft));
      }
    };
    const onMouseUp = () => {
      dragging.current = null;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [toTimestamp, zoomLeft, zoomRight, onZoomLeftChange, onZoomRightChange]);

  return (
    <div className="grid grid-cols-[6rem_1fr] items-center border-b border-[var(--mastra-border-1)]/50">
      <div className="flex items-center gap-1 self-stretch border-r border-[var(--mastra-border-1)]/50 pl-3">
        <p className="text-[10px] font-medium text-icon3">Zoom</p>
        <Button variant="ghost" size="icon-sm" aria-label="Reset zoom" onClick={onReset}>
          <RotateCcw className="size-3" />
        </Button>
      </div>
      <div
        ref={trackRef}
        className="relative h-6 cursor-pointer select-none"
        onMouseDown={(e) => {
          const ts = toTimestamp(e.clientX);
          if (ts == null) return;
          e.preventDefault();
          const distLeft = Math.abs(ts - zoomLeft);
          const distRight = Math.abs(ts - zoomRight);
          if (distLeft <= distRight) {
            onZoomLeftChange(Math.min(ts, zoomRight));
            dragging.current = 'left';
          } else {
            onZoomRightChange(Math.max(ts, zoomLeft));
            dragging.current = 'right';
          }
        }}
      >
        <div className="absolute inset-y-0 left-0 bg-[var(--mastra-bg-2)]/60" style={{ width: `${leftPercent}%` }} />
        <div
          className="absolute inset-y-0 border-y border-[var(--mastra-border-1)]/30 bg-[var(--mastra-el-6)]/5"
          style={{ left: `${leftPercent}%`, right: `${100 - rightPercent}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-[var(--mastra-bg-2)]/60"
          style={{ width: `${100 - rightPercent}%` }}
        />
        <div
          className="absolute inset-y-0 w-1 cursor-col-resize bg-[var(--mastra-el-6)]/50 hover:bg-[var(--mastra-el-6)]"
          style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dragging.current = 'left';
          }}
        />
        <div
          className="absolute inset-y-0 w-1 cursor-col-resize bg-[var(--mastra-el-6)]/50 hover:bg-[var(--mastra-el-6)]"
          style={{ left: `${rightPercent}%`, transform: 'translateX(-50%)' }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dragging.current = 'right';
          }}
        />
      </div>
    </div>
  );
}

const FALLBACK_DOMAIN: TDomain = { tMin: 0, tMax: 1 };

export function FlameGraph({
  omRecords,
  markers,
  messages,
  tDomain: tDomainProp,
  observationThreshold,
  reflectionThreshold,
}: FlameGraphProps) {
  const domain = tDomainProp ?? FALLBACK_DOMAIN;

  const [zoomLeft, setZoomLeft] = useState<number>(domain.tMin);
  const [zoomRight, setZoomRight] = useState<number>(domain.tMax);

  useEffect(() => {
    setZoomLeft(domain.tMin);
    setZoomRight(domain.tMax);
  }, [domain.tMin, domain.tMax]);

  const resetZoom = useCallback(() => {
    setZoomLeft(domain.tMin);
    setZoomRight(domain.tMax);
  }, [domain.tMin, domain.tMax]);

  const range = domain.tMax - domain.tMin;
  const zoomTLeft = range > 0 ? (zoomLeft - domain.tMin) / range : 0;
  const zoomTRight = range > 0 ? (zoomRight - domain.tMin) / range : 1;
  const zoomDomain: [number, number] = [zoomTLeft, zoomTRight];

  const messageData = useMemo(() => toMessageData(messages, domain), [messages, domain]);
  const contextData = useMemo(
    () => toContextData(omRecords, markers, domain),
    [omRecords, markers, domain],
  );
  const activeObservationData = useMemo(
    () => toActiveObservationData(omRecords, markers, domain),
    [omRecords, markers, domain],
  );
  const bufferedObservationData = useMemo(
    () => toBufferedObservationData(markers, domain),
    [markers, domain],
  );
  const eventData = useMemo(() => toEventData(omRecords, domain), [omRecords, domain]);

  const hasData =
    messageData.length > 0 || contextData.length > 0 || activeObservationData.length > 0 || eventData.length > 0;

  if (!hasData) return null;

  return (
    <div className="flex flex-col pb-2 pr-2 [&_.recharts-surface]:outline-none">
      <CombinedRow
        label="Messages"
        areaData={contextData}
        areaDataKey="pendingMessageTokens"
        eventData={messageData}
        color={MSG_COLOR}
        gradientId="grad-messages"
        domain={domain}
        zoomDomain={zoomDomain}
        threshold={observationThreshold}
      />

      <CombinedRow
        label="Observations"
        areaData={activeObservationData}
        areaDataKey="observationTokenCount"
        eventData={eventData}
        color={OBS_COLOR}
        gradientId="grad-observations"
        domain={domain}
        zoomDomain={zoomDomain}
        threshold={reflectionThreshold}
      />

      {bufferedObservationData.length > 0 && (
        <AreaRow
          label="Buffered obs"
          data={bufferedObservationData}
          dataKey="bufferedObservationTokenCount"
          color={REFLECT_COLOR}
          gradientId="grad-buffered-obs"
          domain={domain}
          zoomDomain={zoomDomain}
          threshold={reflectionThreshold}
        />
      )}

      {eventData.length > 0 && (
        <EventRow label="Events" data={eventData} color={REFLECT_COLOR} domain={domain} zoomDomain={zoomDomain} />
      )}

      <TimeAxis domain={domain} />

      <ZoomTrack
        tDomain={domain}
        zoomLeft={zoomLeft}
        zoomRight={zoomRight}
        onZoomLeftChange={setZoomLeft}
        onZoomRightChange={setZoomRight}
        onReset={resetZoom}
      />
    </div>
  );
}
