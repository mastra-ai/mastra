import { useState } from 'react';
import {
  useMetricNames,
  useEntityTypes,
  useEntityNames,
  useEnvironments,
  useServiceNames,
  useMetricAggregate,
  useMetricBreakdown,
  useMetricTimeSeries,
  useObsLogs,
  useObsScores,
  useObsFeedback,
} from '../hooks/use-metrics';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border1 rounded-md bg-surface2">
      <div className="px-4 py-3 border-b border-border1">
        <h3 className="text-sm font-medium text-icon6">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'loading' | 'error' | 'empty' | 'ok'; message?: string }) {
  if (status === 'loading') return <span className="text-xs text-icon3">Loading...</span>;
  if (status === 'error') return <span className="text-xs text-red-400">Error fetching data</span>;
  if (status === 'empty') return <span className="text-xs text-icon3">No data</span>;
  return null;
}

function DataTable({ headers, rows }: { headers: string[]; rows: (string | number | null | undefined)[][] }) {
  if (rows.length === 0) return <StatusBadge status="empty" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border1">
            {headers.map(h => (
              <th key={h} className="text-left px-3 py-2 text-icon3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border1 last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-icon6">
                  {cell ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiscoveryPanel() {
  const metricNames = useMetricNames();
  const entityTypes = useEntityTypes();
  const entityNames = useEntityNames();
  const environments = useEnvironments();
  const serviceNames = useServiceNames();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Section title="Metric Names">
        {metricNames.isLoading ? (
          <StatusBadge status="loading" />
        ) : metricNames.isError ? (
          <StatusBadge status="error" />
        ) : (
          <DataTable headers={['Name']} rows={(metricNames.data?.names ?? []).map(n => [n])} />
        )}
      </Section>

      <Section title="Entity Types">
        {entityTypes.isLoading ? (
          <StatusBadge status="loading" />
        ) : entityTypes.isError ? (
          <StatusBadge status="error" />
        ) : (
          <DataTable headers={['Type']} rows={(entityTypes.data?.entityTypes ?? []).map(t => [t])} />
        )}
      </Section>

      <Section title="Entity Names">
        {entityNames.isLoading ? (
          <StatusBadge status="loading" />
        ) : entityNames.isError ? (
          <StatusBadge status="error" />
        ) : (
          <DataTable headers={['Name']} rows={(entityNames.data?.names ?? []).map(n => [n])} />
        )}
      </Section>

      <Section title="Environments">
        {environments.isLoading ? (
          <StatusBadge status="loading" />
        ) : environments.isError ? (
          <StatusBadge status="error" />
        ) : (
          <DataTable headers={['Environment']} rows={(environments.data?.environments ?? []).map(e => [e])} />
        )}
      </Section>

      <Section title="Service Names">
        {serviceNames.isLoading ? (
          <StatusBadge status="loading" />
        ) : serviceNames.isError ? (
          <StatusBadge status="error" />
        ) : (
          <DataTable headers={['Service']} rows={(serviceNames.data?.serviceNames ?? []).map(s => [s])} />
        )}
      </Section>
    </div>
  );
}

function MetricAggregatePanel({ metricName }: { metricName: string }) {
  const aggregate = useMetricAggregate({
    name: metricName,
    aggregation: 'avg',
  });
  const countAgg = useMetricAggregate({
    name: metricName,
    aggregation: 'count',
  });

  return (
    <div className="flex gap-6">
      <div>
        <span className="text-xs text-icon3">Count</span>
        <p className="text-lg font-mono text-icon6">
          {countAgg.isLoading ? '...' : countAgg.isError ? 'err' : (countAgg.data?.value ?? '—')}
        </p>
      </div>
      <div>
        <span className="text-xs text-icon3">Avg</span>
        <p className="text-lg font-mono text-icon6">
          {aggregate.isLoading
            ? '...'
            : aggregate.isError
              ? 'err'
              : aggregate.data?.value != null
                ? aggregate.data.value.toFixed(2)
                : '—'}
        </p>
      </div>
    </div>
  );
}

function MetricBreakdownPanel({ metricName }: { metricName: string }) {
  const breakdown = useMetricBreakdown({
    name: metricName,
    groupBy: ['entityName'],
    aggregation: 'avg',
  });

  if (breakdown.isLoading) return <StatusBadge status="loading" />;
  if (breakdown.isError) return <StatusBadge status="error" />;

  const groups = breakdown.data?.groups ?? [];
  return (
    <DataTable
      headers={['Entity', 'Avg Value']}
      rows={groups.map(g => [Object.values(g.dimensions).join(', ') || '(none)', g.value.toFixed(2)])}
    />
  );
}

function MetricTimeSeriesPanel({ metricName }: { metricName: string }) {
  const timeSeries = useMetricTimeSeries({
    name: metricName,
    interval: '1h',
    aggregation: 'avg',
  });

  if (timeSeries.isLoading) return <StatusBadge status="loading" />;
  if (timeSeries.isError) return <StatusBadge status="error" />;

  const series = timeSeries.data?.series ?? [];
  if (series.length === 0) return <StatusBadge status="empty" />;

  return (
    <div className="space-y-3">
      {series.map(s => (
        <div key={s.name}>
          <p className="text-xs text-icon3 mb-1">{s.name}</p>
          <DataTable
            headers={['Time', 'Value']}
            rows={s.points.map(p => [
              new Date(p.timestamp).toLocaleString(),
              typeof p.value === 'number' ? p.value.toFixed(2) : String(p.value),
            ])}
          />
        </div>
      ))}
    </div>
  );
}

function SelectedMetricPanel({ metricName }: { metricName: string }) {
  return (
    <div className="space-y-4">
      <Section title={`${metricName} — Aggregate`}>
        <MetricAggregatePanel metricName={metricName} />
      </Section>
      <Section title={`${metricName} — Breakdown by Entity`}>
        <MetricBreakdownPanel metricName={metricName} />
      </Section>
      <Section title={`${metricName} — Time Series (1h buckets)`}>
        <MetricTimeSeriesPanel metricName={metricName} />
      </Section>
    </div>
  );
}

function LogsPanel() {
  const logs = useObsLogs({ pagination: { page: 0, perPage: 20 } });

  if (logs.isLoading) return <StatusBadge status="loading" />;
  if (logs.isError) return <StatusBadge status="error" />;

  const items = logs.data?.logs ?? [];
  return (
    <div>
      <p className="text-xs text-icon3 mb-2">
        Total: {logs.data?.pagination?.total ?? '?'} | Showing: {items.length}
      </p>
      <DataTable
        headers={['Time', 'Level', 'Message', 'Entity', 'TraceId']}
        rows={items.map(l => [
          new Date(l.timestamp).toLocaleString(),
          l.level,
          l.message.length > 80 ? l.message.slice(0, 80) + '...' : l.message,
          l.entityName ?? '',
          l.traceId ?? '',
        ])}
      />
    </div>
  );
}

function ScoresPanel() {
  const scores = useObsScores({ pagination: { page: 0, perPage: 20 } });

  if (scores.isLoading) return <StatusBadge status="loading" />;
  if (scores.isError) return <StatusBadge status="error" />;

  const items = scores.data?.scores ?? [];
  return (
    <div>
      <p className="text-xs text-icon3 mb-2">
        Total: {scores.data?.pagination?.total ?? '?'} | Showing: {items.length}
      </p>
      <DataTable
        headers={['Time', 'Scorer', 'Score', 'Reason', 'TraceId']}
        rows={items.map(s => [
          new Date(s.timestamp).toLocaleString(),
          s.scorerId,
          String(s.score),
          s.reason ? (s.reason.length > 60 ? s.reason.slice(0, 60) + '...' : s.reason) : '',
          s.traceId,
        ])}
      />
    </div>
  );
}

function FeedbackPanel() {
  const feedback = useObsFeedback({ pagination: { page: 0, perPage: 20 } });

  if (feedback.isLoading) return <StatusBadge status="loading" />;
  if (feedback.isError) return <StatusBadge status="error" />;

  const items = feedback.data?.feedback ?? [];
  return (
    <div>
      <p className="text-xs text-icon3 mb-2">
        Total: {feedback.data?.pagination?.total ?? '?'} | Showing: {items.length}
      </p>
      <DataTable
        headers={['Time', 'Type', 'Source', 'Value', 'Comment', 'TraceId']}
        rows={items.map(f => [
          new Date(f.timestamp).toLocaleString(),
          f.feedbackType,
          f.source,
          String(f.value),
          f.comment ?? '',
          f.traceId,
        ])}
      />
    </div>
  );
}

type Tab = 'discovery' | 'metrics' | 'logs' | 'scores' | 'feedback';

export function MetricsDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('discovery');
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const metricNames = useMetricNames();

  const tabs: { key: Tab; label: string }[] = [
    { key: 'discovery', label: 'Discovery' },
    { key: 'metrics', label: 'Metrics' },
    { key: 'logs', label: 'Logs' },
    { key: 'scores', label: 'Scores' },
    { key: 'feedback', label: 'Feedback' },
  ];

  return (
    <div className="space-y-4 p-4">
      <div className="flex gap-1 border-b border-border1 pb-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-white text-icon6 font-medium'
                : 'border-transparent text-icon3 hover:text-icon6'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'discovery' && <DiscoveryPanel />}

      {activeTab === 'metrics' && (
        <div className="space-y-4">
          <Section title="Select a Metric">
            {metricNames.isLoading ? (
              <StatusBadge status="loading" />
            ) : metricNames.isError ? (
              <StatusBadge status="error" />
            ) : (metricNames.data?.names ?? []).length === 0 ? (
              <p className="text-xs text-icon3">No metrics found. Run some agents/workflows to generate data.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(metricNames.data?.names ?? []).map(name => (
                  <button
                    key={name}
                    onClick={() => setSelectedMetric(name)}
                    className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                      selectedMetric === name
                        ? 'border-white bg-surface3 text-icon6'
                        : 'border-border1 text-icon3 hover:text-icon6 hover:border-icon3'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </Section>
          {selectedMetric && <SelectedMetricPanel metricName={selectedMetric} />}
        </div>
      )}

      {activeTab === 'logs' && (
        <Section title="Recent Logs">
          <LogsPanel />
        </Section>
      )}

      {activeTab === 'scores' && (
        <Section title="Recent Scores">
          <ScoresPanel />
        </Section>
      )}

      {activeTab === 'feedback' && (
        <Section title="Recent Feedback">
          <FeedbackPanel />
        </Section>
      )}
    </div>
  );
}
