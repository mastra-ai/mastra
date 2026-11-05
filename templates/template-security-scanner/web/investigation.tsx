import { useState } from 'react';
import { send, type Approval, type Hypothesis, type Investigation, type Page } from './api';
import { Empty, Loading, Notice, Pager, Section, Status, errorCode, useData } from './ui';

const limit = 25;

/** Show the scan's investigations and admit supported bounded verification work. */
export function ScanInvestigations({ scanId }: { scanId: string }) {
  const [offset, setOffset] = useState(0);
  const [hypothesisOffset, setHypothesisOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const investigations = useData<Page<Investigation>>(`/api/investigations?limit=${limit}&offset=${offset}`);
  const current = investigations.data?.items.filter(item => item.lineage.scanId === scanId) ?? [];
  const investigation = current.find(item => item.id === selectedId) ?? current[0];
  const hypotheses = useData<Page<Hypothesis>>(
    investigation ? `/api/investigations/${investigation.id}/hypotheses?limit=${limit}&offset=${hypothesisOffset}` : '',
  );
  const approvals = useData<Page<Approval>>('/api/approvals?limit=100&offset=0');
  const settings = useData<{
    investigation: { requested: boolean; modelConfigured: boolean; approvalCallback: string | null };
  }>('/api/settings');
  const canPlan =
    !settings.error && settings.data?.investigation.requested && settings.data.investigation.modelConfigured;

  /** Request planning for the selected investigation only when the console's planning prerequisites hold. */
  async function plan(item: Investigation) {
    if (!canPlan) return;
    setSelectedId(item.id);
    setHypothesisOffset(0);
    setBusy(true);
    setError('');
    try {
      await send(`/api/investigations/${item.id}/plan`, 'POST', {});
      setMessage('Planning recorded. Review the generated hypotheses before requesting approval.');
      investigations.reload();
      hypotheses.reload();
    } catch (reason) {
      setError(errorCode(reason));
      investigations.reload();
    } finally {
      setBusy(false);
    }
  }

  /** Request bounded approval using the configured owned callback and selected hypothesis. */
  async function requestApproval(hypothesis: Hypothesis) {
    const callback = settings.data?.investigation.approvalCallback;
    if (!callback) return;
    setBusy(true);
    setError('');
    try {
      const approval = await send<Approval>(`/api/hypotheses/${hypothesis.id}/approval`, 'POST', {
        callback,
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      setMessage(`Approval request ${approval.id} recorded. Review its bound action in Approvals.`);
      approvals.reload();
    } catch (reason) {
      setError(errorCode(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Investigations" action={<button onClick={investigations.reload}>Refresh investigations</button>}>
      <Notice
        code={investigations.error || hypotheses.error || approvals.error || settings.error || error}
        stale={investigations.stale || hypotheses.stale || approvals.stale || settings.stale}
        onRetry={() => {
          investigations.reload();
          hypotheses.reload();
          approvals.reload();
          settings.reload();
        }}
      />
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      {investigations.loading ? (
        <Loading />
      ) : current.length ? (
        current.map(item => (
          <div className="record investigation-detail" key={item.id}>
            <div className="investigation-summary">
              <strong className="mono">{item.id}</strong>
              <Status value={item.state} />
              <span>
                {item.limits.maxRequests} requests · {item.limits.maxTokens} tokens · {item.limits.maxDurationSeconds}{' '}
                seconds maximum
              </span>
            </div>
            {item.state === 'QUEUED' && (
              <div>
                <p className="hint">
                  Planning makes an explicit configured model call within this investigation's budget.
                </p>
                <button disabled={busy || !canPlan} onClick={() => plan(item)}>
                  Plan investigation
                </button>
                {!canPlan && !settings.loading && (
                  <p className="hint">Enable investigation and configure the model before planning.</p>
                )}
              </div>
            )}
            {item.id !== investigation?.id && (
              <button
                onClick={() => {
                  setSelectedId(item.id);
                  setHypothesisOffset(0);
                }}
              >
                View hypotheses
              </button>
            )}
            {item.id === investigation?.id && (
              <>
                <h3>Hypotheses</h3>
                {hypotheses.loading ? (
                  <Loading />
                ) : hypotheses.data?.items.length ? (
                  hypotheses.data.items.map(hypothesis => {
                    const requested = approvals.data?.items.some(approval => approval.hypothesisId === hypothesis.id);
                    return (
                      <div className="record" key={hypothesis.id}>
                        <strong>
                          {hypothesis.category} · {hypothesis.toolId}
                        </strong>
                        <span>
                          {hypothesis.origin} · {hypothesis.risk} · <Status value={hypothesis.state} />
                        </span>
                        <span>{hypothesis.expectedBehavior}</span>
                        <span>
                          {hypothesis.maxRequests} requests · evidence {hypothesis.evidenceIds.join(', ')}
                        </span>
                        {hypothesis.risk === 'active' && hypothesis.state === 'AWAITING_APPROVAL' && (
                          <button
                            disabled={
                              busy ||
                              !!settings.error ||
                              !!approvals.error ||
                              approvals.loading ||
                              !settings.data?.investigation.approvalCallback ||
                              !!requested
                            }
                            onClick={() => requestApproval(hypothesis)}
                          >
                            {requested ? 'Approval requested' : 'Request exact approval'}
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : hypotheses.data && !hypotheses.error ? (
                  <Empty>No hypotheses recorded.</Empty>
                ) : null}
                {hypotheses.data && !hypotheses.error && (
                  <Pager
                    offset={hypothesisOffset}
                    count={hypotheses.data.items.length}
                    limit={limit}
                    onChange={setHypothesisOffset}
                  />
                )}
              </>
            )}
          </div>
        ))
      ) : investigations.data && !investigations.error ? (
        <Empty>No investigation for this scan on this page.</Empty>
      ) : null}
      {investigations.data && !investigations.error && (
        <Pager offset={offset} count={investigations.data.items.length} limit={limit} onChange={setOffset} />
      )}
    </Section>
  );
}
