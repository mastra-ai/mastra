import { useState, type FormEvent } from 'react';
import {
  send,
  get,
  type Binding,
  type BolaAssessment,
  type Evidence,
  type Investigation,
  type Page,
  type Policy,
  type Profile,
  type Scan,
  type Target,
  type RouteAccessRule,
} from './api';
import { Dialog, Empty, Loading, Notice, Pager, Section, Status, Time, errorCode, useData } from './ui';
import { ScanInvestigations } from './investigation';
import { AssessmentDetail } from './assessment';

const limit = 25;
/** Read and trim a named form field, using an empty string when absent. */
const value = (form: FormData, name: string) => String(form.get(name) ?? '').trim();
const number = (form: FormData, name: string) => Number(value(form, name));
const lines = (text: string) =>
  text
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(Boolean);
const unauthorizedStatuses = (text: string) =>
  text
    .split(',')
    .map(value => Number(value.trim()))
    .filter(value => Number.isInteger(value) && value >= 400 && value <= 499);

/** Create or update a policy with explicit limits, retention and optimistic concurrency. */
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
  /** Submit validated policy settings with the existing policy revision when editing. */
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

/** Browse persisted policies and open their create or edit forms. */
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
        <Dialog title="Revision history" onClose={() => setSelected(undefined)} variant="details">
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
        </Dialog>
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

/** Edit target scope and application settings while preserving revision-bound policy selection. */
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
  const [applicationKind, setApplicationKind] = useState<'legacy' | 'rest_api'>(target?.application?.kind ?? 'legacy');
  const [rules, setRules] = useState<
    Array<
      Pick<RouteAccessRule, 'pathTemplate' | 'audience' | 'objectPolicy' | 'expectedUnauthorizedStatus'> & {
        unauthorizedStatusText?: string;
      }
    >
  >(
    target?.routeAccessRules ?? [
      { pathTemplate: '/api/orders', audience: 'user', objectPolicy: 'owner', expectedUnauthorizedStatus: [401, 403] },
      {
        pathTemplate: '/api/orders/{id}',
        audience: 'user',
        objectPolicy: 'owner',
        expectedUnauthorizedStatus: [401, 403, 404],
      },
      {
        pathTemplate: '/api/orders/{id}/receipt',
        audience: 'user',
        objectPolicy: 'owner',
        expectedUnauthorizedStatus: [401, 403, 404],
      },
      { pathTemplate: '/api/products', audience: 'public', expectedUnauthorizedStatus: [] },
    ],
  );
  /** Submit target scope and application settings with the selected policy revision binding. */
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
      ...(applicationKind === 'rest_api'
        ? {
            application: {
              kind: 'rest_api',
              version: 1,
              discoveryModes: value(data, 'openApiUrl') ? ['openapi', 'observed_json'] : ['observed_json'],
              ...(value(data, 'openApiUrl') ? { openApiUrl: value(data, 'openApiUrl') } : {}),
            },
            ...(target?.authenticationDrivers ? { authenticationDrivers: target.authenticationDrivers } : {}),
            routeAccessRules: rules
              .filter(rule => rule.pathTemplate.trim())
              .map(rule => ({
                version: 1,
                method: 'GET',
                pathTemplate: rule.pathTemplate.trim(),
                source: 'operator',
                operatorRevision: (target?.revision ?? 0) + 1,
                audience: rule.audience,
                ...(rule.audience === 'user' ? { objectPolicy: rule.objectPolicy ?? 'owner' } : {}),
                expectedUnauthorizedStatus:
                  rule.audience === 'public'
                    ? []
                    : unauthorizedStatuses(rule.unauthorizedStatusText ?? rule.expectedUnauthorizedStatus.join(',')),
              })),
          }
        : {}),
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
        <label>
          Application
          <select
            value={applicationKind}
            onChange={event => setApplicationKind(event.currentTarget.value as 'legacy' | 'rest_api')}
          >
            <option value="legacy">Website or existing laboratory target</option>
            <option value="rest_api">REST API</option>
          </select>
        </label>
        {applicationKind === 'rest_api' && (
          <>
            <label>
              OpenAPI URL (optional)
              <input
                name="openApiUrl"
                type="url"
                defaultValue={target?.application?.openApiUrl}
                placeholder="http://example/openapi.json"
              />
            </label>
            <p className="hint">
              Confirm the intended access for observed GET routes. An owner rule means each user may read only their own
              objects.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>GET route</th>
                    <th>Audience</th>
                    <th>Object policy</th>
                    <th>Unauthorized status</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          aria-label={`Route ${index + 1}`}
                          value={rule.pathTemplate}
                          onChange={event =>
                            setRules(current =>
                              current.map((item, i) =>
                                i === index ? { ...item, pathTemplate: event.target.value } : item,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <select
                          aria-label={`Audience ${index + 1}`}
                          value={rule.audience}
                          onChange={event =>
                            setRules(current =>
                              current.map((item, i) =>
                                i === index
                                  ? { ...item, audience: event.target.value as RouteAccessRule['audience'] }
                                  : item,
                              ),
                            )
                          }
                        >
                          <option value="public">Public</option>
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td>
                        <select
                          aria-label={`Object policy ${index + 1}`}
                          disabled={rule.audience !== 'user'}
                          value={rule.objectPolicy ?? 'owner'}
                          onChange={event =>
                            setRules(current =>
                              current.map((item, i) =>
                                i === index
                                  ? { ...item, objectPolicy: event.target.value as 'owner' | 'shared' }
                                  : item,
                              ),
                            )
                          }
                        >
                          <option value="owner">Owner only</option>
                          <option value="shared">Shared</option>
                        </select>
                      </td>
                      <td>
                        <input
                          aria-label={`Unauthorized status ${index + 1}`}
                          disabled={rule.audience === 'public'}
                          value={rule.unauthorizedStatusText ?? rule.expectedUnauthorizedStatus.join(',')}
                          onChange={event => {
                            const text = event.currentTarget.value;
                            setRules(current =>
                              current.map((item, i) =>
                                i === index ? { ...item, unauthorizedStatusText: text } : item,
                              ),
                            );
                          }}
                          onBlur={event => {
                            const parsed = unauthorizedStatuses(event.currentTarget.value);
                            setRules(current =>
                              current.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      expectedUnauthorizedStatus: parsed,
                                      unauthorizedStatusText: parsed.join(','),
                                    }
                                  : item,
                              ),
                            );
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() =>
                setRules(current => [
                  ...current,
                  { pathTemplate: '', audience: 'user', objectPolicy: 'owner', expectedUnauthorizedStatus: [401, 403] },
                ])
              }
            >
              Add route rule
            </button>
          </>
        )}
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

/** Register a bounded identity profile and reconfirm only the target's operator route rules. */
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
  /** Save the identity profile and reconfirm current operator route rules when required. */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const expiresAt = value(data, 'expiresAt');
    const base = { name: value(data, 'name'), role: value(data, 'role'), ...(expiresAt ? { expiresAt } : {}) };
    const input =
      kind === 'public'
        ? { ...base, kind: 'public' }
        : kind === 'api_key_header'
          ? { ...base, kind: 'api_key_header', credential: { value: String(data.get('credential') ?? '') } }
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
      const saved = await send<Profile>(
        profile ? `/api/targets/${target.id}/profiles/${profile.id}` : `/api/targets/${target.id}/profiles`,
        profile ? 'PUT' : 'POST',
        input,
        profile?.revision ?? target.revision,
      );
      if (!profile && target.application?.kind === 'rest_api') {
        const current = await get<Target>(`/api/targets/${target.id}`);
        const origin = new URL(current.entryUrl).origin;
        const driver =
          kind === 'api_key_header'
            ? {
                kind: 'api_key_header' as const,
                version: 1 as const,
                profileId: saved.id,
                secretRef: saved.id,
                credentialOrigins: [origin],
                headerName: value(data, 'headerName'),
                accessCheckPath: value(data, 'accessCheckPath'),
                ...(value(data, 'principalJsonPointer')
                  ? { principalJsonPointer: value(data, 'principalJsonPointer') }
                  : {}),
                refresh: 'reregister' as const,
              }
            : undefined;
        await send(
          `/api/targets/${target.id}`,
          'PUT',
          {
            name: current.name,
            entryUrl: current.entryUrl,
            approvedOrigins: current.approvedOrigins,
            allowedPaths: current.allowedPaths,
            excludedPaths: current.excludedPaths,
            permittedMethods: current.permittedMethods,
            environment: current.environment,
            authorizationEvidenceRef: current.authorizationEvidenceRef,
            authorizationConfirmed: true,
            policyId: current.policyId,
            policyRevision: current.policyRevision,
            schedule: driver ? { enabled: false, timezone: 'UTC' } : current.schedule,
            scanLimits: current.scanLimits,
            authProfileIds: current.authProfileIds,
            application: current.application,
            authenticationDrivers: driver
              ? [...(current.authenticationDrivers ?? []), driver]
              : current.authenticationDrivers,
            routeAccessRules: current.routeAccessRules?.map(rule =>
              rule.source === 'operator' ? { ...rule, operatorRevision: current.revision + 1 } : rule,
            ),
          },
          current.revision,
        );
      }
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
            {target.application?.kind === 'rest_api' && <option value="api_key_header">API key header</option>}
          </select>
        </label>
        {kind === 'api_key_header' && (
          <>
            {!profile && (
              <>
                <label>
                  Header name
                  <input name="headerName" defaultValue="x-api-key" required maxLength={64} />
                </label>
                <label>
                  Existing own-resource access check path
                  <input name="accessCheckPath" defaultValue="/api/orders" required maxLength={512} />
                </label>
                <label>
                  Account identifier JSON pointer (optional)
                  <input name="principalJsonPointer" placeholder="/principal" maxLength={256} />
                </label>
                <p className="hint">
                  BOLA needs the same pointer and check path for both accounts. Select a stable account identifier
                  returned by that existing GET, such as /principal in the Orders API. Without distinct observed
                  accounts, the assessment is inconclusive.
                </p>
              </>
            )}
            <label>
              API key
              <input name="credential" type="password" required autoComplete="new-password" />
            </label>
            <p className="hint">The key is sealed on the server and is never displayed again.</p>
          </>
        )}
        {kind !== 'public' && kind !== 'api_key_header' && (
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

/** Display the selected target with its persisted profiles and supported execution controls. */
function TargetDetail({ target, onChanged }: { target: Target; onChanged: () => void }) {
  const [editing, setEditing] = useState<Profile | 'new'>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const profiles = useData<Page<Profile>>(`/api/targets/${target.id}/profiles?limit=100&offset=0`);
  const recurrence = useData<{
    schedule: { cron: string; timezone: string; enabled: boolean; revision: number; nextAt: string } | null;
  }>(`/api/targets/${target.id}/recurrence`);
  const assessments = useData<Page<BolaAssessment>>('/api/assessments?limit=100&offset=0');
  const current = profiles.data?.items ?? [];
  const binding = (profile: Profile): Binding => ({
    targetRevision: target.revision,
    policyRevision: target.policyRevision,
    profileId: profile.id,
    profileRevision: profile.revision,
    credentialRevision: profile.credentialRevision,
  });
  /** Run the selected profile's identity check and refresh its persisted result. */
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
  /** Admit discovery only with ready selected profiles and the current target revision. */
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
  /** Admit a BOLA assessment using ready API-key profiles and the selected route policy. */
  async function assess() {
    const ready = current.filter(profile => profile.kind === 'api_key_header' && profile.identity.status === 'READY');
    if (ready.length !== 2) {
      setError('TWO_READY_API_KEYS_REQUIRED');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await send<BolaAssessment>(`/api/targets/${target.id}/assessments`, 'POST', {
        targetRevision: target.revision,
        policyRevision: target.policyRevision,
        profiles: ready.map(binding),
        idempotencyKey: crypto.randomUUID().replaceAll('-', ''),
      });
      setMessage(`Assessment started: ${result.id.slice(0, 8)}. View its progress in Scans.`);
      assessments.reload();
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
      {target.application?.kind === 'rest_api' && (
        <Section title="REST access rules">
          <p className="hint">
            These operator-confirmed rules define expected access; they do not select an object ID or a test route.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Route</th>
                  <th>Audience</th>
                  <th>Object</th>
                </tr>
              </thead>
              <tbody>
                {(target.routeAccessRules ?? []).map(rule => (
                  <tr key={`${rule.method}:${rule.pathTemplate}`}>
                    <td>{rule.method}</td>
                    <td className="mono">{rule.pathTemplate}</td>
                    <td>{rule.audience}</td>
                    <td>{rule.objectPolicy ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
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
        {target.application?.kind === 'rest_api' && (
          <button
            className="primary"
            disabled={
              busy ||
              current.filter(profile => profile.kind === 'api_key_header' && profile.identity.status === 'READY')
                .length !== 2
            }
            onClick={assess}
          >
            Start REST assessment
          </button>
        )}
        <button
          className="primary"
          disabled={busy || !current.some(profile => profile.identity.status === 'READY')}
          onClick={scan}
        >
          New scan
        </button>
      </div>
      {target.application?.kind === 'rest_api' && (
        <Section title="Recent REST assessments" action={<button onClick={assessments.reload}>Refresh</button>}>
          <Notice code={assessments.error} stale={assessments.stale} onRetry={assessments.reload} />
          {(assessments.data?.items ?? [])
            .filter(item => item.targetId === target.id)
            .map(item => (
              <div className="record" key={item.id}>
                <span className="mono">{item.id.slice(0, 8)}</span>
                <Status value={item.outcome ?? item.state} />
                <span>{item.selected?.routeTemplate ?? item.reason ?? 'Discovering account-specific resources'}</span>
              </div>
            ))}
        </Section>
      )}
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

/** Browse persisted targets and manage their supported profiles and scan actions. */
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
        {records.loading && !records.data ? (
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
        <Dialog title={target.name} onClose={() => setSelected(undefined)} variant="details">
          <TargetDetail key={`${target.id}-${target.revision}`} target={target} onChanged={records.reload} />
        </Dialog>
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

/** Browse scan history and expose actions allowed by the stored scan lifecycle. */
export function ScansView() {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [evidenceOffset, setEvidenceOffset] = useState(0);
  const [investigationVersion, setInvestigationVersion] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const records = useData<Page<Scan>>(`/api/scans?limit=${limit}&offset=${offset}`);
  const assessments = useData<Page<BolaAssessment>>('/api/assessments?limit=25&offset=0');
  const [selectedAssessment, setSelectedAssessment] = useState<string>();
  const evidence = useData<Page<Evidence>>(
    selected ? `/api/scans/${selected}/evidence?limit=${limit}&offset=${evidenceOffset}` : '',
  );
  const scan = records.data?.items.find(item => item.id === selected);
  const assessment = assessments.data?.items.find(item => item.id === selectedAssessment);
  /** Cancel the selected scan and refresh its persisted terminal or draining state. */
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
  /** Cancel the selected BOLA assessment and refresh its persisted lifecycle state. */
  async function cancelAssessment(item: BolaAssessment) {
    setBusy(true);
    setError('');
    try {
      const result = await send<BolaAssessment>(`/api/assessments/${item.id}/cancel`, 'POST', {}, item.revision);
      setMessage(`Assessment ${result.state.toLowerCase().replaceAll('_', ' ')}.`);
      assessments.reload();
      records.reload();
    } catch (reason) {
      setError(errorCode(reason));
    } finally {
      setBusy(false);
    }
  }
  /** Admit investigation from the selected scan using the current bounded execution limits. */
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
      const code = errorCode(reason);
      setError(code === 'REVISION_CONFLICT' ? 'SCAN_BINDING_CHANGED' : code);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Section title="REST assessments" action={<button onClick={assessments.reload}>Refresh</button>}>
        <Notice code={assessments.error} stale={assessments.stale} onRetry={assessments.reload} />
        {assessments.loading ? (
          <Loading />
        ) : assessments.data?.items.length ? (
          <div className="stack">
            {assessments.data.items.map(item => (
              <div className="record" key={item.id}>
                <button className="link mono" onClick={() => setSelectedAssessment(item.id)}>
                  {item.id.slice(0, 8)}
                </button>
                <Status value={item.outcome ?? item.state} />
                <span>{item.selected?.routeTemplate ?? item.reason ?? 'Discovering'}</span>
                {['DISCOVERING', 'PLANNING', 'VERIFYING', 'CANCEL_REQUESTED'].includes(item.state) && (
                  <button disabled={busy || item.state === 'CANCEL_REQUESTED'} onClick={() => cancelAssessment(item)}>
                    Cancel assessment
                  </button>
                )}
                <Time value={item.updatedAt} />
              </div>
            ))}
          </div>
        ) : assessments.data && !assessments.error ? (
          <Empty>No REST assessments yet.</Empty>
        ) : null}
      </Section>
      {assessment && (
        <Dialog
          title={`Assessment ${assessment.id.slice(0, 8)}`}
          onClose={() => setSelectedAssessment(undefined)}
          variant="details"
        >
          <AssessmentDetail assessment={assessment} />
        </Dialog>
      )}
      <Section title="Scans" action={<button onClick={records.reload}>Refresh</button>}>
        <Notice
          code={records.error || error}
          stale={records.stale}
          onRetry={!records.error && error === 'SCAN_BINDING_CHANGED' ? undefined : records.reload}
        />
        {message && !scan && (
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
        <Dialog title={`Scan ${scan.id.slice(0, 8)}`} onClose={() => setSelected(undefined)} variant="details">
          {message && (
            <p className="success" role="status">
              {message}
            </p>
          )}
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
        </Dialog>
      )}
    </>
  );
}
