import { useState, type FormEvent } from 'react';
import {
  send,
  type Binding,
  type Evidence,
  type Investigation,
  type Page,
  type Policy,
  type Profile,
  type Scan,
  type Target,
} from './api';
import { Dialog, Empty, Loading, Notice, Pager, Section, Status, Time, errorCode, useData } from './ui';
import { ScanInvestigations } from './investigation';

const limit = 25;
const value = (form: FormData, name: string) => String(form.get(name) ?? '').trim();
const number = (form: FormData, name: string) => Number(value(form, name));
const lines = (text: string) =>
  text
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(Boolean);

export function PolicyForm({
  policy,
  onClose,
  onSaved,
}: {
  policy?: Policy;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const retentionDays = value(data, 'retentionDays');
    const input = {
      name: value(data, 'name'),
      permittedMethods: lines(value(data, 'methods').toUpperCase()),
      scanLimits: {
        maxRequests: number(data, 'requests'),
        maxDurationSeconds: number(data, 'duration'),
        maxResponseBytes: number(data, 'bytes'),
        maxConcurrency: number(data, 'concurrency'),
      },
      ...(retentionDays
        ? { retention: { evidenceDays: Number(retentionDays), approvedBy: value(data, 'approvedBy') } }
        : {}),
    };
    setBusy(true);
    try {
      await send(
        policy ? `/api/policies/${policy.id}` : '/api/policies',
        policy ? 'PUT' : 'POST',
        input,
        policy?.revision,
      );
      onSaved();
      onClose();
    } catch (reason) {
      setError(errorCode(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={policy ? 'Edit policy' : 'New policy'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Name
          <input name="name" defaultValue={policy?.name} required maxLength={120} />
        </label>
        <label>
          Permitted methods
          <input name="methods" defaultValue={policy?.permittedMethods.join(', ') ?? 'GET, HEAD'} required />
        </label>
        <div className="form-grid">
          <label>
            Maximum requests
            <input
              name="requests"
              type="number"
              min="1"
              max="10000"
              defaultValue={policy?.scanLimits.maxRequests ?? 100}
              required
            />
          </label>
          <label>
            Duration, seconds
            <input
              name="duration"
              type="number"
              min="1"
              max="3600"
              defaultValue={policy?.scanLimits.maxDurationSeconds ?? 300}
              required
            />
          </label>
          <label>
            Response bytes
            <input
              name="bytes"
              type="number"
              min="1024"
              max="10485760"
              defaultValue={policy?.scanLimits.maxResponseBytes ?? 1048576}
              required
            />
          </label>
          <label>
            Concurrency
            <input
              name="concurrency"
              type="number"
              min="1"
              max="8"
              defaultValue={policy?.scanLimits.maxConcurrency ?? 1}
              required
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Evidence retention, days
            <input
              name="retentionDays"
              type="number"
              min="1"
              max="365"
              defaultValue={policy?.retention?.evidenceDays}
            />
          </label>
          <label>
            Approved by
            <input name="approvedBy" defaultValue={policy?.retention?.approvedBy} />
          </label>
        </div>
        <Notice
          code={error}
          onRetry={() => {
            onSaved();
            onClose();
          }}
        />
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save policy'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function PoliciesView() {
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Policy | 'new'>();
  const [selected, setSelected] = useState<string>();
  const records = useData<Page<Policy>>(`/api/policies?limit=${limit}&offset=${offset}`);
  const revisions = useData<Page<Policy>>(selected ? `/api/policies/${selected}/revisions?limit=25&offset=0` : '');
  return (
    <>
      <Section
        title="Policies"
        action={
          <button className="primary" onClick={() => setEditing('new')}>
            New policy
          </button>
        }
      >
        <Notice code={records.error} stale={records.stale} onRetry={records.reload} />
        {records.loading ? (
          <Loading />
        ) : records.data?.items.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Methods</th>
                  <th>Request limit</th>
                  <th>Retention</th>
                  <th>Revision</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.data.items.map(policy => (
                  <tr key={policy.id}>
                    <td>
                      <button className="link" onClick={() => setSelected(policy.id)}>
                        {policy.name}
                      </button>
                    </td>
                    <td>{policy.permittedMethods.join(', ')}</td>
                    <td>{policy.scanLimits.maxRequests}</td>
                    <td>{policy.retention ? `${policy.retention.evidenceDays} days` : 'Lab only'}</td>
                    <td>{policy.revision}</td>
                    <td>
                      <button onClick={() => setEditing(policy)}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : records.data && !records.error ? (
          <Empty>Create a policy before registering a target.</Empty>
        ) : null}
        {records.data && !records.error && (
          <Pager offset={offset} count={records.data.items.length} limit={limit} onChange={setOffset} />
        )}
      </Section>
      {selected && (
        <Section title="Revision history" action={<button onClick={() => setSelected(undefined)}>Close</button>}>
          <Notice code={revisions.error} stale={revisions.stale} onRetry={revisions.reload} />
          {revisions.loading ? (
            <Loading />
          ) : revisions.data?.items.length ? (
            <div className="stack">
              {revisions.data.items.map(item => (
                <div className="record" key={`${item.id}-${item.revision}`}>
                  <strong>Revision {item.revision}</strong>
                  <span>
                    {item.name} · {item.permittedMethods.join(', ')} · {item.scanLimits.maxRequests} requests
                  </span>
                </div>
              ))}
            </div>
          ) : revisions.data && !revisions.error ? (
            <Empty>No revisions recorded.</Empty>
          ) : null}
        </Section>
      )}
      {editing && (
        <PolicyForm
          policy={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
          onSaved={records.reload}
        />
      )}
    </>
  );
}

function TargetForm({
  target,
  policies,
  policyError,
  policyLoading,
  policyOffset,
  onPolicyPage,
  onPolicyReload,
  onClose,
  onSaved,
}: {
  target?: Target;
  policies: Policy[];
  policyError: string;
  policyLoading: boolean;
  policyOffset: number;
  onPolicyPage: (offset: number) => void;
  onPolicyReload: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const authorizationConfirmed = data.has('authorizationConfirmed');
    if (!authorizationConfirmed) {
      event.currentTarget.reportValidity();
      return;
    }
    const policy = target ? undefined : selectedPolicy;
    if (!target && !policy) {
      setError('POLICY_REQUIRED');
      return;
    }
    const entryUrl = value(data, 'entryUrl');
    let entry: URL;
    try {
      entry = new URL(entryUrl);
    } catch {
      setError('INVALID_INPUT');
      return;
    }
    const input = {
      name: value(data, 'name'),
      entryUrl,
      approvedOrigins: lines(value(data, 'origins') || entry.origin),
      allowedPaths: lines(value(data, 'paths') || '/'),
      excludedPaths: lines(value(data, 'excluded')),
      permittedMethods: lines(value(data, 'methods').toUpperCase()),
      environment: value(data, 'environment'),
      authorizationEvidenceRef: value(data, 'evidence'),
      authorizationConfirmed,
      policyId: target?.policyId ?? policy!.id,
      policyRevision: target?.policyRevision ?? policy!.revision,
      schedule: { enabled: false, timezone: 'UTC' },
      scanLimits: target?.scanLimits ?? policy!.scanLimits,
      authProfileIds: target?.authProfileIds ?? [],
    };
    setBusy(true);
    try {
      await send(
        target ? `/api/targets/${target.id}` : '/api/targets',
        target ? 'PUT' : 'POST',
        input,
        target?.revision,
      );
      onSaved();
      onClose();
    } catch (reason) {
      setError(errorCode(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={target ? 'Edit target' : 'New target'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Name
          <input name="name" defaultValue={target?.name} required maxLength={120} />
        </label>
        <label>
          Entry URL
          <input
            name="entryUrl"
            type="url"
            defaultValue={target?.entryUrl}
            placeholder="http://owned-lab.local/"
            required
          />
        </label>
        <div className="form-grid">
          <label>
            Environment
            <select name="environment" defaultValue={target?.environment ?? 'lab'}>
              <option value="lab">Lab</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </label>
          {target ? (
            <div>
              <span className="eyebrow">Policy binding (read only)</span>
              <p className="mono">
                {target.policyId} · r{target.policyRevision}
              </p>
              <p className="hint">
                This edit keeps the bound policy and limits: {target.scanLimits.maxRequests} requests,{' '}
                {target.scanLimits.maxDurationSeconds} seconds, {target.scanLimits.maxResponseBytes} response bytes,{' '}
                {target.scanLimits.maxConcurrency} concurrent requests.
              </p>
            </div>
          ) : (
            <div>
              <label>
                Policy
                <select
                  name="policy"
                  value={selectedPolicy?.id ?? ''}
                  onChange={event => setSelectedPolicy(policies.find(item => item.id === event.target.value))}
                  required
                >
                  <option value="">Select a policy</option>
                  {selectedPolicy && !policies.some(item => item.id === selectedPolicy.id) && (
                    <option value={selectedPolicy.id}>
                      {selectedPolicy.name} · r{selectedPolicy.revision} (selected)
                    </option>
                  )}
                  {policies.map(item => (
                    <option value={item.id} key={item.id}>
                      {item.name} · r{item.revision}
                    </option>
                  ))}
                </select>
              </label>
              {policyLoading && <Loading />}
              <Notice code={policyError} onRetry={onPolicyReload} />
              <Pager offset={policyOffset} count={policies.length} limit={100} onChange={onPolicyPage} />
            </div>
          )}
        </div>
        <label>
          Approved origins, one per line
          <textarea
            name="origins"
            rows={2}
            defaultValue={target?.approvedOrigins.join('\n')}
            placeholder="Defaults to entry origin"
          />
        </label>
        <label>
          Allowed paths, one per line
          <textarea name="paths" rows={2} defaultValue={target?.allowedPaths.join('\n') ?? '/'} />
        </label>
        <label>
          Excluded paths
          <textarea name="excluded" rows={2} defaultValue={target?.excludedPaths.join('\n')} />
        </label>
        <label>
          Permitted methods
          <input name="methods" defaultValue={target?.permittedMethods.join(', ') ?? 'GET, HEAD'} required />
        </label>
        <label>
          Authorization evidence reference
          <input name="evidence" defaultValue={target?.authorizationEvidenceRef} required maxLength={200} />
        </label>
        <label className="confirmation">
          <input name="authorizationConfirmed" type="checkbox" required />
          I confirm authorization to scan this target.
        </label>
        <p className="hint">The server checks ownership, policy revision, scope and retention before admitting work.</p>
        <Notice
          code={error}
          onRetry={() => {
            onSaved();
            onClose();
          }}
        />
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save target'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function ProfileForm({
  target,
  profile,
  onClose,
  onSaved,
}: {
  target: Target;
  profile?: Profile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState(profile?.kind ?? 'public');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const expiresAt = value(data, 'expiresAt');
    const base = { name: value(data, 'name'), role: value(data, 'role'), ...(expiresAt ? { expiresAt } : {}) };
    const input =
      kind === 'public'
        ? { ...base, kind: 'public' }
        : {
            ...base,
            kind,
            identityEndpoint: value(data, 'endpoint'),
            expectedIdentity: value(data, 'expected'),
            credential:
              kind === 'bearer'
                ? { value: String(data.get('credential') ?? '') }
                : { name: value(data, 'header'), value: String(data.get('credential') ?? '') },
          };
    const credentialField = form.querySelector<HTMLInputElement>('input[name="credential"]');
    if (credentialField) credentialField.value = '';
    setBusy(true);
    try {
      await send(
        profile ? `/api/targets/${target.id}/profiles/${profile.id}` : `/api/targets/${target.id}/profiles`,
        profile ? 'PUT' : 'POST',
        input,
        profile?.revision ?? target.revision,
      );
      onSaved();
      onClose();
    } catch (reason) {
      setError(errorCode(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={profile ? 'Replace profile' : 'Add profile'} onClose={onClose}>
      <form className="form" onSubmit={submit} autoComplete="off">
        <label>
          Name
          <input name="name" defaultValue={profile?.name} required />
        </label>
        <label>
          Role
          <input name="role" defaultValue={profile?.role} required />
        </label>
        <label>
          Expires at, ISO UTC (optional)
          <input name="expiresAt" defaultValue={profile?.expiresAt} placeholder="2027-01-01T00:00:00.000Z" />
        </label>
        <label>
          Identity type
          <select name="kind" value={kind} onChange={event => setKind(event.currentTarget.value)}>
            <option value="public">Public</option>
            <option value="bearer">Bearer token</option>
            <option value="header">Header</option>
          </select>
        </label>
        {kind !== 'public' && (
          <>
            <label>
              Identity endpoint
              <input
                name="endpoint"
                type="url"
                defaultValue={profile && 'identityEndpoint' in profile ? String(profile.identityEndpoint) : ''}
                required
              />
            </label>
            <label>
              Expected identity
              <input
                name="expected"
                defaultValue={profile && 'expectedIdentity' in profile ? String(profile.expectedIdentity) : ''}
                required
              />
            </label>
            {kind === 'header' && (
              <>
                <label>
                  Header name
                  <select name="header" defaultValue="" required>
                    <option value="" disabled>
                      Select the header for this credential
                    </option>
                    <option value="x-test-identity">x-test-identity</option>
                    <option value="x-api-key">x-api-key</option>
                    <option value="authorization">authorization</option>
                    <option value="cookie">cookie</option>
                  </select>
                </label>
                {profile && <p className="hint">Choose the original header name when replacing this credential.</p>}
              </>
            )}
            <label>
              Credential
              <input name="credential" type="password" required autoComplete="new-password" />
            </label>
          </>
        )}
        <p className="hint">
          Replacing an authenticated profile requires a new credential. The value is cleared after submission.
        </p>
        <Notice
          code={error}
          onRetry={() => {
            onSaved();
            onClose();
          }}
        />
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function TargetDetail({ target, onChanged }: { target: Target; onChanged: () => void }) {
  const [editing, setEditing] = useState<Profile | 'new'>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const profiles = useData<Page<Profile>>(`/api/targets/${target.id}/profiles?limit=100&offset=0`);
  const recurrence = useData<{
    schedule: { cron: string; timezone: string; enabled: boolean; revision: number; nextAt: string } | null;
  }>(`/api/targets/${target.id}/recurrence`);
  const current = profiles.data?.items ?? [];
  const binding = (profile: Profile): Binding => ({
    targetRevision: target.revision,
    policyRevision: target.policyRevision,
    profileId: profile.id,
    profileRevision: profile.revision,
    credentialRevision: profile.credentialRevision,
  });
  async function check(profile: Profile) {
    setBusy(true);
    setError('');
    try {
      await send(`/api/targets/${target.id}/profiles/${profile.id}/check`, 'POST', binding(profile));
      profiles.reload();
      setMessage('Identity check recorded.');
    } catch (reason) {
      setError(errorCode(reason));
    } finally {
      setBusy(false);
    }
  }
  async function scan() {
    const ready = current.filter(profile => profile.identity.status === 'READY');
    if (!ready.length) {
      setError('READY_PROFILE_REQUIRED');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await send<Scan>(`/api/targets/${target.id}/scans`, 'POST', {
        targetRevision: target.revision,
        policyRevision: target.policyRevision,
        profiles: ready.map(binding),
        mode: 'http',
        operation: 'discovery',
        idempotencyKey: crypto.randomUUID().replaceAll('-', ''),
      });
      setMessage(`Scan admitted: ${result.id}`);
    } catch (reason) {
      setError(errorCode(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="detail">
      <div className="detail-grid">
        <div>
          <span className="eyebrow">Entry</span>
          <p>{target.entryUrl}</p>
        </div>
        <div>
          <span className="eyebrow">Environment</span>
          <p>{target.environment}</p>
        </div>
        <div>
          <span className="eyebrow">Owner</span>
          <p>{target.owner}</p>
        </div>
        <div>
          <span className="eyebrow">Authorization</span>
          <p>{target.authorizationEvidenceRef}</p>
        </div>
        <div>
          <span className="eyebrow">Policy binding</span>
          <p>Revision {target.policyRevision}</p>
        </div>
        <div>
          <span className="eyebrow">Approved origins</span>
          <p>{target.approvedOrigins.join(', ')}</p>
        </div>
        <div>
          <span className="eyebrow">Path scope</span>
          <p>
            {target.allowedPaths.join(', ')} · excludes {target.excludedPaths.join(', ') || 'none'}
          </p>
        </div>
        <div>
          <span className="eyebrow">Permitted methods</span>
          <p>{target.permittedMethods.join(', ')}</p>
        </div>
        <div>
          <span className="eyebrow">Scan limits</span>
          <p>
            {target.scanLimits.maxRequests} requests · {target.scanLimits.maxDurationSeconds}s ·{' '}
            {target.scanLimits.maxResponseBytes} bytes · {target.scanLimits.maxConcurrency} concurrent
          </p>
        </div>
      </div>
      <Section title="Identities" action={<button onClick={() => setEditing('new')}>Add profile</button>}>
        <Notice code={profiles.error} stale={profiles.stale} onRetry={profiles.reload} />
        {profiles.loading ? (
          <Loading />
        ) : current.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Profile</th>
                  <th>Role</th>
                  <th>Type</th>
                  <th>Identity</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {current.map(profile => (
                  <tr key={profile.id}>
                    <td>{profile.name}</td>
                    <td>{profile.role}</td>
                    <td>{profile.kind}</td>
                    <td>
                      <Status value={profile.identity.status} />
                    </td>
                    <td className="row-actions">
                      <button disabled={busy} onClick={() => check(profile)}>
                        Check identity
                      </button>
                      <button onClick={() => setEditing(profile)}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : profiles.data && !profiles.error ? (
          <Empty>Add a profile, then check its identity before starting a scan.</Empty>
        ) : null}
      </Section>
      <Section title="Recurrence">
        <Notice code={recurrence.error} stale={recurrence.stale} onRetry={recurrence.reload} />
        {recurrence.loading ? (
          <Loading />
        ) : recurrence.data?.schedule ? (
          <p>
            {recurrence.data.schedule.enabled ? 'Enabled' : 'Disabled'} · {recurrence.data.schedule.cron} ·{' '}
            {recurrence.data.schedule.timezone} · next {<Time value={recurrence.data.schedule.nextAt} />}
          </p>
        ) : recurrence.data && !recurrence.error ? (
          <Empty>No recurrence configured.</Empty>
        ) : null}
      </Section>
      <Notice
        code={error}
        onRetry={() => {
          profiles.reload();
          onChanged();
        }}
      />
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      <div className="form-actions">
        <button
          className="primary"
          disabled={busy || !current.some(profile => profile.identity.status === 'READY')}
          onClick={scan}
        >
          New scan
        </button>
      </div>
      {editing && (
        <ProfileForm
          target={target}
          profile={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            profiles.reload();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

export function TargetsView() {
  const [offset, setOffset] = useState(0);
  const [policyOffset, setPolicyOffset] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [editing, setEditing] = useState<Target | 'new'>();
  const records = useData<Page<Target>>(`/api/targets?limit=${limit}&offset=${offset}`);
  const policies = useData<Page<Policy>>(`/api/policies?limit=100&offset=${policyOffset}`);
  const target = records.data?.items.find(item => item.id === selected);
  return (
    <>
      <Section
        title="Targets"
        action={
          <button
            className="primary"
            disabled={!policies.data || (policyOffset === 0 && !policies.data.items.length)}
            onClick={() => setEditing('new')}
          >
            New target
          </button>
        }
      >
        <Notice
          code={records.error || policies.error}
          stale={records.stale || policies.stale}
          onRetry={() => {
            records.reload();
            policies.reload();
          }}
        />
        {records.loading ? (
          <Loading />
        ) : records.data?.items.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Entry</th>
                  <th>Environment</th>
                  <th>Identities</th>
                  <th>Revision</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.data.items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <button className="link" onClick={() => setSelected(item.id)}>
                        {item.name}
                      </button>
                    </td>
                    <td>{item.entryUrl}</td>
                    <td>{item.environment}</td>
                    <td>{item.authProfileIds.length}</td>
                    <td>{item.revision}</td>
                    <td>
                      <button onClick={() => setEditing(item)}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : records.data && !records.error ? (
          <Empty>
            {policies.data?.items.length || !policies.data
              ? 'No targets registered.'
              : 'Create a policy to register a target.'}
          </Empty>
        ) : null}
        {records.data && !records.error && (
          <Pager offset={offset} count={records.data.items.length} limit={limit} onChange={setOffset} />
        )}
      </Section>
      {target && (
        <Section title={target.name} action={<button onClick={() => setSelected(undefined)}>Close</button>}>
          <TargetDetail key={`${target.id}-${target.revision}`} target={target} onChanged={records.reload} />
        </Section>
      )}
      {editing && (
        <TargetForm
          target={editing === 'new' ? undefined : editing}
          policies={policies.data?.items ?? []}
          policyError={policies.error}
          policyLoading={policies.loading}
          policyOffset={policyOffset}
          onPolicyPage={setPolicyOffset}
          onPolicyReload={policies.reload}
          onClose={() => setEditing(undefined)}
          onSaved={records.reload}
        />
      )}
    </>
  );
}

export function ScansView() {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [evidenceOffset, setEvidenceOffset] = useState(0);
  const [investigationVersion, setInvestigationVersion] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const records = useData<Page<Scan>>(`/api/scans?limit=${limit}&offset=${offset}`);
  const evidence = useData<Page<Evidence>>(
    selected ? `/api/scans/${selected}/evidence?limit=${limit}&offset=${evidenceOffset}` : '',
  );
  const scan = records.data?.items.find(item => item.id === selected);
  async function cancel(scan: Scan) {
    setBusy(true);
    setError('');
    try {
      const result = await send<Scan>(`/api/scans/${scan.id}/cancel`, 'POST', {});
      setMessage(`Scan ${result.state.toLowerCase().replaceAll('_', ' ')}.`);
      records.reload();
    } catch (reason) {
      setError(errorCode(reason));
    } finally {
      setBusy(false);
    }
  }
  async function investigate(scan: Scan) {
    setBusy(true);
    setError('');
    try {
      const result = await send<Investigation>(`/api/investigations`, 'POST', {
        scanId: scan.id,
        idempotencyKey: crypto.randomUUID().replaceAll('-', ''),
        maxRequests: 20,
        maxTokens: 16384,
        maxDurationSeconds: 600,
      });
      setMessage(`Investigation admitted: ${result.id}`);
      setEvidenceOffset(0);
      setSelected(scan.id);
      setInvestigationVersion(version => version + 1);
    } catch (reason) {
      setError(errorCode(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Section title="Scans" action={<button onClick={records.reload}>Refresh</button>}>
        <Notice code={records.error || error} stale={records.stale} onRetry={records.reload} />
        {message && (
          <p className="success" role="status">
            {message}
          </p>
        )}
        {records.loading ? (
          <Loading />
        ) : records.data?.items.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Scan</th>
                  <th>State</th>
                  <th>Target</th>
                  <th>Budget</th>
                  <th>Cleanup</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.data.items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <Time value={item.createdAt} />
                    </td>
                    <td>
                      <button
                        className="link mono"
                        onClick={() => {
                          setEvidenceOffset(0);
                          setSelected(item.id);
                        }}
                      >
                        {item.id.slice(0, 8)}
                      </button>
                    </td>
                    <td>
                      <Status value={item.state} />
                    </td>
                    <td className="mono">{item.targetId.slice(0, 8)}</td>
                    <td>
                      {item.budget.remainingRequests ?? 'unknown'} requests · {item.budget.remainingBytes ?? 'unknown'}{' '}
                      bytes
                    </td>
                    <td>
                      <Status value={item.cleanup} />
                    </td>
                    <td className="row-actions">
                      {!['CANCELLED', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'AUTH_REQUIRED'].includes(
                        item.state,
                      ) && (
                        <button disabled={busy} onClick={() => cancel(item)}>
                          Cancel scan
                        </button>
                      )}
                      {['COMPLETED', 'COMPLETED_WITH_ERRORS'].includes(item.state) && (
                        <button disabled={busy} onClick={() => investigate(item)}>
                          Investigate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : records.data && !records.error ? (
          <Empty>No scans recorded. Register a target and check a profile identity to start one.</Empty>
        ) : null}
        {records.data && !records.error && (
          <Pager offset={offset} count={records.data.items.length} limit={limit} onChange={setOffset} />
        )}
      </Section>
      {scan && (
        <Section
          title={`Scan ${scan.id.slice(0, 8)}`}
          action={<button onClick={() => setSelected(undefined)}>Close</button>}
        >
          <div className="detail-grid">
            <div>
              <span className="eyebrow">Outcome</span>
              <p>
                <Status value={scan.state} /> · {scan.reason}
              </p>
            </div>
            <div>
              <span className="eyebrow">Updated</span>
              <p>
                <Time value={scan.updatedAt} />
              </p>
            </div>
            <div>
              <span className="eyebrow">Partial</span>
              <p>{scan.partial ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <span className="eyebrow">Mode</span>
              <p>{scan.request.mode}</p>
            </div>
            <div>
              <span className="eyebrow">Request budget</span>
              <p>
                {scan.budgetInitial && scan.budget.remainingRequests !== null
                  ? `${scan.budgetInitial.requests - scan.budget.remainingRequests} consumed · ${scan.budget.remainingRequests} remaining`
                  : 'Consumption unknown'}
              </p>
            </div>
            <div>
              <span className="eyebrow">Response byte budget</span>
              <p>
                {scan.budgetInitial && scan.budget.remainingBytes !== null
                  ? `${scan.budgetInitial.bytes - scan.budget.remainingBytes} consumed · ${scan.budget.remainingBytes} remaining`
                  : 'Consumption unknown'}
              </p>
            </div>
          </div>
          <h3>Role results</h3>
          {scan.roles.length ? (
            <div className="stack">
              {scan.roles.map(role => (
                <div className="record" key={role.profileId}>
                  <strong>{role.role}</strong>
                  <Status value={role.identity} />
                  <span>
                    {role.counters.parsed} parsed · {role.counters.withheld} withheld ·{' '}
                    {role.partial ? 'partial' : 'complete'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty>No role results recorded yet.</Empty>
          )}
          <h3>Sanitized evidence</h3>
          <Notice code={evidence.error} stale={evidence.stale} onRetry={evidence.reload} />
          {evidence.loading ? (
            <Loading />
          ) : evidence.data?.items.length ? (
            <div className="stack">
              {evidence.data.items.map(item => (
                <div className="record" key={item.id}>
                  <span className="mono">Evidence {item.id}</span>
                  <strong>
                    {item.observation.method} {item.observation.origin}
                    {item.observation.path}
                  </strong>
                  <span>
                    {item.observation.role} · {item.observation.status ?? 'advertised'}
                  </span>
                </div>
              ))}
            </div>
          ) : evidence.data && !evidence.error ? (
            <Empty>No evidence retained for this scan.</Empty>
          ) : null}
          {evidence.data && !evidence.error && (
            <Pager
              offset={evidenceOffset}
              count={evidence.data.items.length}
              limit={limit}
              onChange={setEvidenceOffset}
            />
          )}
          <ScanInvestigations key={`${scan.id}-${investigationVersion}`} scanId={scan.id} />
        </Section>
      )}
    </>
  );
}
