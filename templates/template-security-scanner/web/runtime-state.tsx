import { Loading, Notice, Section, Status, useData } from './ui';

/** Load runtime readiness and distinguish pending, unavailable and actionable diagnostic states. */
export function RuntimeState() {
  const data = useData<{
    operation: { state: string; detail: string | null; at: string | null };
    retention: { state: string; batchLimit: number; pending: boolean };
    imageRecordsPending: number;
  }>('/api/operations');
  return (
    <Section title="Recovery and retention" action={<button onClick={data.reload}>Refresh recovery</button>}>
      <Notice code={data.error} stale={data.stale} onRetry={data.reload} />
      {data.loading ? (
        <Loading />
      ) : data.data ? (
        <div className="settings-list">
          <div>
            <span>Last offline operation</span>
            <Status value={data.data.operation.state} />
          </div>
          <div>
            <span>Operation detail</span>
            <strong>{data.data.operation.detail ?? 'No outstanding detail'}</strong>
          </div>
          <div>
            <span>Retention cleanup</span>
            <Status value={data.data.retention.state} />
          </div>
          <div>
            <span>Evidence pending expiry</span>
            <strong>{data.data.retention.pending ? 'Pending bounded cleanup' : 'No pending discovery expiry'}</strong>
          </div>
          <div>
            <span>Pending image records</span>
            <strong>{data.data.imageRecordsPending}</strong>
          </div>
        </div>
      ) : null}
      <p className="hint">
        Stop the server before offline drain, backup or restore. Pending image records preserve shared consumers until a
        later owned cleanup.
      </p>
    </Section>
  );
}
