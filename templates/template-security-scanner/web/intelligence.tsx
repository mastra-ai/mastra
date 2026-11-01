import { useState } from 'react';
import {
  get,
  send,
  type Advisory,
  type AgentData,
  type Approval,
  type Evaluation,
  type Evidence,
  type Finding,
  type Hypothesis,
  type Investigation,
  type Page,
  type Scan,
} from './api';
import { Dialog, Empty, Loading, Notice, Pager, Section, Status, Time, errorCode, useData } from './ui';

const limit = 25;
const availabilityOutcome = {
  available: 'CONFIRMED',
  expired: 'EVIDENCE_EXPIRED',
  unknown: 'EVIDENCE_UNKNOWN',
} as const;

function approvalLatency({ createdAt, decidedAt }: Approval): string {
  if (!decidedAt) return '—';
  const seconds = Math.floor((Date.parse(decidedAt) - Date.parse(createdAt)) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${remainder}s`;
  return `${remainder}s`;
}

export function OverviewView({ navigate }: { navigate: (view: string) => void }) {
  const scans = useData<Page<Scan>>('/api/scans?limit=5&offset=0');
  const investigations = useData<Page<Investigation>>('/api/investigations?limit=5&offset=0');
  const approvals = useData<Page<Approval>>('/api/approvals?limit=5&offset=0');
  const findings = useData<Page<Finding>>('/api/findings?limit=5&offset=0');
  const advisory = useData<{
    lastSuccessAt?: string | null;
    stale?: boolean;
    incomplete?: boolean;
    failureCode?: string | null;
  }>('/api/advisories/status');
  const pending = approvals.data?.items.filter(item => item.decision === 'pending').length ?? 0;
  const error = scans.error || investigations.error || approvals.error || findings.error || advisory.error;
  return (
    <>
      <Notice
        code={error}
        stale={scans.stale || investigations.stale || approvals.stale || findings.stale || advisory.stale}
        onRetry={() => {
          scans.reload();
          investigations.reload();
          approvals.reload();
          findings.reload();
          advisory.reload();
        }}
      />
      <div className="metrics">
        <button className="metric" onClick={() => navigate('scans')}>
          <span>Recent scans</span>
          <strong>{scans.loading ? '…' : (scans.data?.items.length ?? '—')}</strong>
          <small>Latest 5 records</small>
        </button>
        <button className="metric" onClick={() => navigate('findings')}>
          <span>Recent findings</span>
          <strong>{findings.loading ? '…' : (findings.data?.items.length ?? '—')}</strong>
          <small>Latest 5 records</small>
        </button>
        <button className="metric" onClick={() => navigate('approvals')}>
          <span>Pending approvals</span>
          <strong>{approvals.loading ? '…' : approvals.data ? pending : '—'}</strong>
          <small>Within latest 5 records</small>
        </button>
        <div className="metric">
          <span>Advisory sync</span>
          <strong className="metric-small">
            {advisory.loading
              ? 'Loading'
              : advisory.error || !advisory.data
                ? 'Unavailable'
                : advisory.data.stale
                  ? 'Stale'
                  : advisory.data.lastSuccessAt
                    ? 'Current'
                    : 'No sync'}
          </strong>
          <small>
            {advisory.loading ? (
              'Loading…'
            ) : !advisory.data ? (
              'Status unavailable'
            ) : advisory.data.lastSuccessAt ? (
              <Time value={advisory.data.lastSuccessAt} />
            ) : (
              'No successful sync recorded'
            )}
          </small>
        </div>
      </div>
      <div className="overview-grid">
        <Section title="Latest scans" action={<button onClick={() => navigate('scans')}>All scans</button>}>
          {scans.loading ? (
            <Loading />
          ) : scans.data?.items.length ? (
            <div className="stack">
              {scans.data.items.map(scan => (
                <div className="record" key={scan.id}>
                  <span className="mono">{scan.id.slice(0, 8)}</span>
                  <Status value={scan.state} />
                  <Time value={scan.updatedAt} />
                </div>
              ))}
            </div>
          ) : scans.data && !scans.error ? (
            <Empty>No scans recorded.</Empty>
          ) : null}
        </Section>
        <Section title="Investigations" action={<button onClick={() => navigate('evaluations')}>Evaluations</button>}>
          {investigations.loading ? (
            <Loading />
          ) : investigations.data?.items.length ? (
            <div className="stack">
              {investigations.data.items.map(item => (
                <div className="record" key={item.id}>
                  <span className="mono">{item.id.slice(0, 8)}</span>
                  <Status value={item.state} />
                  <Time value={item.updatedAt} />
                </div>
              ))}
            </div>
          ) : investigations.data && !investigations.error ? (
            <Empty>No investigations recorded.</Empty>
          ) : null}
        </Section>
      </div>
      <Section
        title="Approvals requiring review"
        action={<button onClick={() => navigate('approvals')}>Review approvals</button>}
      >
        {approvals.loading ? (
          <Loading />
        ) : pending ? (
          <div className="stack">
            {approvals.data?.items
              .filter(item => item.decision === 'pending')
              .map(item => (
                <div className="record" key={item.id}>
                  <strong>{item.toolId}</strong>
                  <span className="mono">{item.id.slice(0, 8)}</span>
                  <Time value={item.expiresAt} />
                </div>
              ))}
          </div>
        ) : approvals.data && !approvals.error ? (
          <Empty>No pending approvals in the latest records.</Empty>
        ) : null}
      </Section>
    </>
  );
}

export function AgentsView() {
  const [offset, setOffset] = useState(0);
  const data = useData<AgentData>(`/api/agents?limit=${limit}&offset=${offset}`);
  return (
    <>
      <Notice code={data.error} stale={data.stale} onRetry={data.reload} />
      {data.loading ? (
        <Loading />
      ) : data.data ? (
        <>
          <div className="agent-grid">
            {data.data.items.map(agent => (
              <article className="agent-card" key={agent.id}>
                <AgentSymbol id={agent.id} />
                <div>
                  <span className="eyebrow">{agent.task}</span>
                  <h2>{agent.name}</h2>
                </div>
                <Status value={agent.configured ? 'Configured' : 'Unavailable'} />
                <p>
                  Model: <span className="mono">{agent.modelId}</span>
                </p>
              </article>
            ))}
          </div>
          <Section title="Dated model runs">
            <p className="hint">
              Configuration does not indicate that an agent ran. Only recorded model events appear below.
            </p>
            {data.data.runs.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Agent</th>
                      <th>Model</th>
                      <th>Tokens</th>
                      <th>Investigation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.runs.map(run => (
                      <tr key={run.id}>
                        <td>
                          <Time value={run.occurredAt} />
                        </td>
                        <td>{run.role}</td>
                        <td className="mono">{run.modelId}</td>
                        <td>{run.usageTokens ?? 'Not reported'}</td>
                        <td className="mono">{run.investigationId.slice(0, 8)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !data.error ? (
              <Empty>No model runs recorded.</Empty>
            ) : null}
            {!data.error && <Pager offset={offset} count={data.data.runs.length} limit={limit} onChange={setOffset} />}
          </Section>
        </>
      ) : null}
    </>
  );
}

function AgentSymbol({ id }: { id: string }) {
  const mark =
    id === 'nemo' ? (
      <>
        <circle cx="12" cy="12" r="7" />
        <path d="M12 3v18M3 12h18" />
      </>
    ) : id === 'sherlock' ? (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 5 5M7 10h6" />
      </>
    ) : id === 'dupin' ? (
      <>
        <path d="M5 5h14v14H5zM5 12h14M12 5v14" />
        <circle cx="16" cy="9" r="1" />
      </>
    ) : (
      <>
        <path d="M4 12h3l3 4 4-8 3 4h3M5 19h14" />
      </>
    );
  return (
    <div className="agent-symbol" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        width="25"
        height="25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
      >
        {mark}
      </svg>
    </div>
  );
}

function FindingDetail({ finding }: { finding: Finding }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const [evidenceOffset, setEvidenceOffset] = useState(0);
  const hypothesis = useData<{
    origin: string;
    category: string;
    toolId: string;
    risk: string;
    evidenceIds: string[];
    referenceIds: string[];
    advisoryId?: string;
    ruleBinding?: { catalogDigest: string; playbookId: string; playbookVersion: number; playbookDigest: string };
    lineage: { targetId: string; targetRevision: number; policyId: string; policyRevision: number; scanId: string };
    state: string;
  }>(`/api/hypotheses/${finding.hypothesisId}`);
  const evaluation = useData<Evaluation>(`/api/evaluations/${finding.proofId}`);
  const job = useData<{ result: { outcome: string; reason: string; evidenceIds: string[] } | null }>(
    `/api/jobs/${finding.jobId}`,
  );
  const scanEvidence = useData<Page<Evidence>>(
    showEvidence && hypothesis.data
      ? `/api/scans/${hypothesis.data.lineage.scanId}/evidence?limit=100&offset=${evidenceOffset}`
      : '',
  );
  const error = hypothesis.error || evaluation.error || job.error;
  return (
    <>
      <Notice
        code={error}
        stale={hypothesis.stale || evaluation.stale || job.stale}
        onRetry={() => {
          hypothesis.reload();
          evaluation.reload();
          job.reload();
        }}
      />
      {hypothesis.loading || evaluation.loading || job.loading ? (
        <Loading />
      ) : hypothesis.data && evaluation.data && job.data ? (
        <div className="detail-grid">
          <div>
            <span className="eyebrow">
              {evaluation.data.availability?.state === 'available' ? 'Outcome' : 'Historical outcome'}
            </span>
            <p>
              <Status value={job.data?.result?.outcome ?? 'Unavailable'} /> · {job.data?.result?.reason}
            </p>
          </div>
          <div>
            <span className="eyebrow">Hypothesis</span>
            <p>
              {hypothesis.data?.category} · {hypothesis.data?.origin} · {hypothesis.data?.toolId}
            </p>
          </div>
          <div>
            <span className="eyebrow">Target / policy</span>
            <p className="mono">
              {hypothesis.data?.lineage.targetId.slice(0, 8)} r{hypothesis.data?.lineage.targetRevision} /{' '}
              {hypothesis.data?.lineage.policyId.slice(0, 8)} r{hypothesis.data?.lineage.policyRevision}
            </p>
          </div>
          <div>
            <span className="eyebrow">Scan</span>
            <p className="mono">{hypothesis.data?.lineage.scanId}</p>
          </div>
          <div>
            <span className="eyebrow">Reference bindings</span>
            <p>
              {hypothesis.data?.referenceIds.join(', ') || 'None'}
              {hypothesis.data?.advisoryId ? ` · ${hypothesis.data.advisoryId}` : ''}
            </p>
          </div>
          <div>
            <span className="eyebrow">Playbook / catalog provenance</span>
            <p className="mono">
              {hypothesis.data?.ruleBinding
                ? `${hypothesis.data.ruleBinding.playbookId} v${hypothesis.data.ruleBinding.playbookVersion} · ${hypothesis.data.ruleBinding.playbookDigest.slice(0, 12)} · catalog ${hypothesis.data.ruleBinding.catalogDigest.slice(0, 12)}`
                : 'No playbook binding recorded'}
            </p>
          </div>
          <div>
            <span className="eyebrow">Proof</span>
            <p>
              {evaluation.data?.source} · {evaluation.data?.requestCount} requests ·{' '}
              {evaluation.data?.withheld ? 'withheld evidence' : 'recorded evidence'}
            </p>
            <p className="hint">
              Evidence availability: {evaluation.data.availability?.state ?? 'unknown'}.
              {evaluation.data.availability?.state === 'expired'
                ? ' This historical outcome has no retained supporting proof.'
                : ''}
            </p>
          </div>
          <div>
            <span className="eyebrow">Verification proof evidence</span>
            {finding.evidenceIds.length ? (
              finding.evidenceIds.map(id => (
                <p className="mono" key={id}>
                  {evaluation.data?.evidence.find(item => item.id === id)?.kind ?? 'Kind unavailable'} · {id}
                </p>
              ))
            ) : (
              <p>None</p>
            )}
          </div>
          <div>
            <span className="eyebrow">Discovery scan evidence IDs</span>
            <p className="mono">{hypothesis.data.evidenceIds.join(', ') || 'None'}</p>
            {hypothesis.data.evidenceIds.length > 0 && (
              <button onClick={() => setShowEvidence(value => !value)}>
                {showEvidence ? 'Hide scan observations' : 'Inspect scan observations'}
              </button>
            )}
          </div>
        </div>
      ) : null}
      {showEvidence && (
        <Section title="Sanitized scan observations">
          <p className="hint">
            Discovery evidence from this hypothesis's scan. Matching hypothesis evidence IDs are marked below; use the
            pager to inspect later records.
          </p>
          <Notice code={scanEvidence.error} stale={scanEvidence.stale} onRetry={scanEvidence.reload} />
          {scanEvidence.loading ? (
            <Loading />
          ) : (
            scanEvidence.data?.items.map(item => (
              <div className="record" key={item.id}>
                <strong className="mono">
                  Evidence {item.id}
                  {hypothesis.data?.evidenceIds.includes(item.id) ? ' · matches hypothesis' : ''}
                </strong>
                <span>
                  {item.observation.method} {item.observation.origin}
                  {item.observation.path}
                </span>
                <span>
                  {item.observation.role} · {item.observation.status ?? 'advertised'}
                </span>
              </div>
            ))
          )}
          {scanEvidence.data && (
            <Pager
              offset={evidenceOffset}
              count={scanEvidence.data.items.length}
              limit={100}
              onChange={setEvidenceOffset}
            />
          )}
        </Section>
      )}
    </>
  );
}

export function FindingsView() {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string>();
  const data = useData<Page<Finding>>(`/api/findings?limit=${limit}&offset=${offset}`);
  const finding = data.data?.items.find(item => item.id === selected);
  return (
    <>
      <Section title="Findings" action={<button onClick={data.reload}>Refresh</button>}>
        <Notice code={data.error} stale={data.stale} onRetry={data.reload} />
        {data.loading ? (
          <Loading />
        ) : data.data?.items.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Recorded</th>
                  <th>Finding</th>
                  <th>Investigation</th>
                  <th>Outcome</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {data.data.items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <Time value={item.createdAt} />
                    </td>
                    <td>
                      <button className="link mono" onClick={() => setSelected(item.id)}>
                        {item.id.slice(0, 8)}
                      </button>
                    </td>
                    <td className="mono">{item.investigationId.slice(0, 8)}</td>
                    <td>
                      <Status value={availabilityOutcome[item.availability?.state ?? 'unknown']} />
                    </td>
                    <td>
                      {item.evidenceIds.length} IDs · {item.availability?.state ?? 'availability unknown'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : data.data && !data.error ? (
          <Empty>No confirmed findings recorded.</Empty>
        ) : null}
        {data.data && !data.error && (
          <Pager offset={offset} count={data.data.items.length} limit={limit} onChange={setOffset} />
        )}
      </Section>
      {finding && (
        <Section
          title={`Finding ${finding.id.slice(0, 8)}`}
          action={<button onClick={() => setSelected(undefined)}>Close</button>}
        >
          <FindingDetail key={`${finding.id}:${finding.availability?.state ?? 'unknown'}`} finding={finding} />
        </Section>
      )}
    </>
  );
}

export function EvaluationsView() {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string>();
  const data = useData<Page<Evaluation>>(`/api/evaluations?limit=${limit}&offset=${offset}`);
  const evaluation = data.data?.items.find(item => item.id === selected);
  const job = useData<{
    result: { outcome: string; reason: string; modelId: string | null; usageTokens: number | null } | null;
  }>(evaluation ? `/api/jobs/${evaluation.jobId}` : '');
  return (
    <>
      <Section title="Evaluations" action={<button onClick={data.reload}>Refresh</button>}>
        <p className="hint">These are dated verification proofs. No aggregate quality score is calculated here.</p>
        <Notice code={data.error} stale={data.stale} onRetry={data.reload} />
        {data.loading ? (
          <Loading />
        ) : data.data?.items.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Recorded</th>
                  <th>Category</th>
                  <th>Source</th>
                  <th>Requests</th>
                  <th>Evidence</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.data.items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <Time value={item.createdAt} />
                    </td>
                    <td>{item.category}</td>
                    <td>{item.source}</td>
                    <td>{item.requestCount}</td>
                    <td>
                      {item.evidence.length} IDs{item.withheld ? ' · withheld' : ''}
                      {' · '}
                      {item.availability?.state ?? 'availability unknown'}
                    </td>
                    <td>
                      <button onClick={() => setSelected(item.id)}>Inspect</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : data.data && !data.error ? (
          <Empty>No measured verification results recorded.</Empty>
        ) : null}
        {data.data && !data.error && (
          <Pager offset={offset} count={data.data.items.length} limit={limit} onChange={setOffset} />
        )}
      </Section>
      {evaluation && (
        <Section
          title={`Evaluation ${evaluation.id.slice(0, 8)}`}
          action={<button onClick={() => setSelected(undefined)}>Close</button>}
        >
          <Notice code={job.error} stale={job.stale} onRetry={job.reload} />
          <div className="detail-grid">
            <div>
              <span className="eyebrow">Outcome</span>
              <p>
                {job.loading ? (
                  'Loading…'
                ) : job.data?.result ? (
                  <Status value={job.data.result.outcome} />
                ) : (
                  'Unavailable'
                )}
              </p>
            </div>
            <div>
              <span className="eyebrow">Reason</span>
              <p>
                {job.loading ? 'Loading…' : job.error ? 'Unavailable' : (job.data?.result?.reason ?? 'Not recorded')}
              </p>
            </div>
            <div>
              <span className="eyebrow">Scope / identity</span>
              <p>
                {evaluation.scopeApproved ? 'Approved scope' : 'Scope denied'} ·{' '}
                {evaluation.identityValid ? 'Identity valid' : 'Identity unavailable'}
              </p>
            </div>
            <div>
              <span className="eyebrow">Proof</span>
              <p>
                {evaluation.completed ? 'Completed' : 'Partial'} ·{' '}
                {evaluation.withheld ? 'Evidence withheld' : `${evaluation.evidence.length} evidence IDs`}
                {' · '}
                {evaluation.availability?.state ?? 'availability unknown'}
              </p>
            </div>
            <div>
              <span className="eyebrow">Model</span>
              <p>
                {job.loading
                  ? 'Loading…'
                  : job.error
                    ? 'Unavailable'
                    : `${job.data?.result?.modelId ?? 'No model recorded'} · ${job.data?.result?.usageTokens ?? 'No'} tokens reported`}
              </p>
            </div>
          </div>
        </Section>
      )}
    </>
  );
}

export function VulnerabilitiesView() {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const data = useData<Page<Advisory>>(`/api/advisories?limit=${limit}&offset=${offset}`);
  const status = useData<{
    lastSuccessAt?: string | null;
    stale?: boolean;
    incomplete?: boolean;
    failureCode?: string | null;
  }>('/api/advisories/status');
  const events = useData<{ items: { event: string; occurredAt: string; revision: number }[] }>(
    selected ? `/api/advisories/${selected}/events` : '',
  );
  const item = data.data?.items.find(record => record.id === selected);
  async function sync() {
    setSyncing(true);
    setError('');
    setSyncMessage('');
    try {
      await send('/api/advisories/sync', 'POST', {});
      setSyncMessage('Advisory synchronization completed.');
    } catch (reason) {
      setError(errorCode(reason));
    } finally {
      data.reload();
      status.reload();
      setSyncing(false);
    }
  }
  async function triage(advisory: Advisory, state: string) {
    setBusy(true);
    setError('');
    try {
      await send(
        `/api/advisories/${encodeURIComponent(advisory.id)}/triage`,
        'PUT',
        { status: state },
        advisory.recordRevision,
      );
      data.reload();
    } catch (reason) {
      setError(errorCode(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Section
        title="Vulnerabilities"
        action={
          <div className="row-actions">
            <button disabled={syncing} onClick={sync}>
              {syncing ? 'Synchronizing…' : 'Synchronize advisories'}
            </button>
            <button
              onClick={() => {
                data.reload();
                status.reload();
              }}
            >
              Refresh
            </button>
          </div>
        }
      >
        <div className="inline-status">
          Inbox:{' '}
          {status.loading ? (
            <Status value="Loading" />
          ) : status.error || !status.data ? (
            <Status value="Unavailable" />
          ) : status.data.stale ? (
            <Status value="Stale" />
          ) : status.data?.lastSuccessAt ? (
            <Status value="Current" />
          ) : (
            <Status value="No sync" />
          )}{' '}
          · Last success{' '}
          {status.loading ? 'Loading…' : status.error ? 'Unavailable' : <Time value={status.data?.lastSuccessAt} />}
        </div>
        {syncMessage && (
          <p className="success" role="status">
            {syncMessage}
          </p>
        )}
        <Notice
          code={data.error || status.error || error}
          stale={data.stale || status.stale}
          onRetry={() => {
            data.reload();
            status.reload();
          }}
        />
        {data.loading ? (
          <Loading />
        ) : data.data?.items.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Advisory</th>
                  <th>Title</th>
                  <th>Revision</th>
                  <th>Updated</th>
                  <th>Applicability</th>
                  <th>Triage</th>
                </tr>
              </thead>
              <tbody>
                {data.data.items.map(record => (
                  <tr key={record.id}>
                    <td>
                      <button className="link mono" onClick={() => setSelected(record.id)}>
                        {record.id}
                      </button>
                    </td>
                    <td>{record.detail.title}</td>
                    <td>{record.revision}</td>
                    <td>
                      <Time value={record.providerModifiedAt} />
                    </td>
                    <td>Unknown</td>
                    <td>
                      <select
                        aria-label={`Triage ${record.id}`}
                        value={record.triageStatus}
                        disabled={busy}
                        onChange={event => triage(record, event.currentTarget.value)}
                      >
                        <option value="new">New</option>
                        <option value="triaged">Triaged</option>
                        <option value="investigating">Investigating</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : data.data && !data.error ? (
          <Empty>No advisory records. Inbox sync is operator initiated.</Empty>
        ) : null}
        {data.data && !data.error && (
          <Pager offset={offset} count={data.data.items.length} limit={limit} onChange={setOffset} />
        )}
      </Section>
      {item && (
        <Section title={item.id} action={<button onClick={() => setSelected(undefined)}>Close</button>}>
          <div className="detail-grid">
            <div>
              <span className="eyebrow">Source status</span>
              <p>
                <Status value={item.upstreamStatus} />
              </p>
            </div>
            <div>
              <span className="eyebrow">Provider revision</span>
              <p>
                {item.revision} · record {item.recordRevision}
              </p>
            </div>
            <div>
              <span className="eyebrow">Retrieved</span>
              <p>
                <Time value={item.retrievedAt} />
              </p>
            </div>
            <div>
              <span className="eyebrow">Applicability</span>
              <p>Unknown until bound to an investigation and target.</p>
            </div>
          </div>
          <p className="source-text">{item.detail.summary?.text ?? 'No summary recorded.'}</p>
          <h3>Event history</h3>
          <Notice code={events.error} stale={events.stale} onRetry={events.reload} />
          {events.loading ? (
            <Loading />
          ) : events.data?.items.length ? (
            <div className="stack">
              {events.data.items.map((event, index) => (
                <div className="record" key={event.revision ?? index}>
                  <span>{event.event}</span>
                  <span>r{event.revision}</span>
                  <Time value={event.occurredAt} />
                </div>
              ))}
            </div>
          ) : events.data && !events.error ? (
            <Empty>No events recorded.</Empty>
          ) : null}
        </Section>
      )}
    </>
  );
}

export function ApprovalsView() {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Approval>();
  const data = useData<Page<Approval>>(`/api/approvals?limit=${limit}&offset=${offset}`);
  return (
    <Section title="Approvals" action={<button onClick={data.reload}>Refresh</button>}>
      <Notice code={data.error} stale={data.stale} onRetry={data.reload} />
      {data.loading ? (
        <Loading />
      ) : data.data?.items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Requested</th>
                <th>Action</th>
                <th>Owned callback</th>
                <th>Target / policy revision</th>
                <th>Budget</th>
                <th>Expires</th>
                <th>Decision</th>
                <th>Decided</th>
                <th>Latency</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.data.items.map(item => (
                <tr key={item.id}>
                  <td>
                    <Time value={item.createdAt} />
                  </td>
                  <td>{item.toolId}</td>
                  <td className="mono break">{item.callback}</td>
                  <td className="mono">
                    {item.lineage.targetId.slice(0, 8)} r{item.lineage.targetRevision} / r{item.lineage.policyRevision}
                  </td>
                  <td>{item.maxRequests} requests</td>
                  <td>
                    <Time value={item.expiresAt} />
                  </td>
                  <td>
                    <Status value={item.decision} />
                  </td>
                  <td>
                    <Time value={item.decidedAt} />
                  </td>
                  <td>{approvalLatency(item)}</td>
                  <td className="row-actions">
                    <button onClick={() => setSelected(item)}>Review action</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : data.data && !data.error ? (
        <Empty>No approval requests recorded.</Empty>
      ) : null}
      {data.data && !data.error && (
        <Pager offset={offset} count={data.data.items.length} limit={limit} onChange={setOffset} />
      )}
      {selected && <ApprovalReview id={selected.id} onClose={() => setSelected(undefined)} onChanged={data.reload} />}
    </Section>
  );
}

function ApprovalReview({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const approval = useData<Approval>(`/api/approvals/${id}`);
  const hypothesis = useData<Hypothesis>(approval.data ? `/api/hypotheses/${approval.data.hypothesisId}` : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function decide(decision: 'approved' | 'denied') {
    const current = approval.data;
    if (!current) return;
    setBusy(true);
    setError('');
    try {
      await send(`/api/approvals/${id}/decision`, 'POST', { decision, revision: current.revision }, current.revision);
      onChanged();
      onClose();
    } catch (reason) {
      setError(errorCode(reason));
    } finally {
      setBusy(false);
    }
  }
  const current = approval.data;
  return (
    <Dialog title="Review approval action" onClose={onClose}>
      <Notice
        code={approval.error || hypothesis.error || error}
        stale={approval.stale || hypothesis.stale}
        onRetry={() => {
          approval.reload();
          hypothesis.reload();
          onChanged();
        }}
      />
      {approval.loading || hypothesis.loading ? (
        <Loading />
      ) : current && hypothesis.data ? (
        <>
          <div className="detail-grid">
            <div>
              <span className="eyebrow">Exact action</span>
              <p>
                {current.toolId} · {hypothesis.data.category} · {hypothesis.data.risk}
              </p>
            </div>
            <div>
              <span className="eyebrow">Expected behavior</span>
              <p>{hypothesis.data.expectedBehavior}</p>
            </div>
            <div>
              <span className="eyebrow">Owned callback</span>
              <p className="mono break">{current.callback}</p>
            </div>
            <div>
              <span className="eyebrow">Request limit / expiry</span>
              <p>
                {current.maxRequests} requests · <Time value={current.expiresAt} />
              </p>
            </div>
            <div>
              <span className="eyebrow">Target / policy / scan</span>
              <p className="mono break">
                {current.lineage.targetId} r{current.lineage.targetRevision} · {current.lineage.policyId} r
                {current.lineage.policyRevision} · {current.lineage.scanId}
              </p>
            </div>
            <div>
              <span className="eyebrow">Hypothesis / provenance</span>
              <p className="mono break">
                {current.hypothesisId} · {hypothesis.data.origin} · evidence {hypothesis.data.evidenceIds.join(', ')} ·
                references {hypothesis.data.referenceIds.join(', ')}
              </p>
            </div>
            <div>
              <span className="eyebrow">Bound identities</span>
              {current.lineage.profiles.length ? (
                current.lineage.profiles.map(profile => (
                  <p className="mono break" key={profile.profileId}>
                    {profile.profileId} · profile r{profile.profileRevision} · credential r{profile.credentialRevision}
                  </p>
                ))
              ) : (
                <p>None</p>
              )}
            </div>
            <div>
              <span className="eyebrow">Decision</span>
              <p>
                <Status value={current.decision} /> · revision {current.revision}
              </p>
            </div>
            <div>
              <span className="eyebrow">Decision time / latency</span>
              <p>
                <Time value={current.decidedAt} /> · {approvalLatency(current)}
              </p>
            </div>
          </div>
          <div className="form-actions">
            <button onClick={onClose}>Close</button>
            {current.decision === 'pending' && !approval.error && !hypothesis.error && (
              <>
                <button disabled={busy} onClick={() => decide('denied')}>
                  Deny
                </button>
                <button className="primary" disabled={busy} onClick={() => decide('approved')}>
                  Approve exact action
                </button>
              </>
            )}
          </div>
        </>
      ) : null}
    </Dialog>
  );
}
