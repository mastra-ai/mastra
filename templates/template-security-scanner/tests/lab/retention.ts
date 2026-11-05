import { createClient } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import type { Finding, StoredProof } from '../../src/investigation/store.js';
import { discoveryCase, startDiscoveryLab } from './harness.js';
import { completedJob, investigation, modelWire } from './investigation.js';

/** Verify expired evidence removal, visible retention debt and successful bounded retry. */
export async function retentionExpiryAndDebt() {
  const wire = await modelWire({
    category: 'information_exposure',
    path: '/owned/exposure/vulnerable',
    interpretation: 'CONFIRMED',
  });
  const lab = await startDiscoveryLab({ investigationModels: wire.models });
  const selected = await discoveryCase(lab, { path: wire.scenario.path });
  const admitted = await selected.admit();
  expect(admitted.status).toBe(202);
  const scan = await lab.wait(String(admitted.data.id));
  expect(scan.state).toBe('COMPLETED');
  expect(
    (
      await lab.request(`/api/targets/${selected.target.id}/verification-resources`, 'POST', {
        category: 'information_exposure',
        path: wire.scenario.path,
        publicProfileId: selected.profile.id,
        marker: 'LAB_MARKER_EXPOSURERESOURCE01',
        expectedAccess: 'private',
      })
    ).status,
  ).toBe(201);
  const run = await investigation(lab, scan);
  expect((await lab.request(`/api/investigations/${run.id}/plan`, 'POST', {})).status).toBe(200);
  expect((await completedJob(lab, run.id)).result?.outcome).toBe('CONFIRMED');
  const proof = ((await lab.request(`/api/investigations/${run.id}/evaluations`)).data.items as StoredProof[])[0]!;
  const finding = ((await lab.request(`/api/investigations/${run.id}/findings`)).data.items as Finding[])[0]!;
  expect(proof.availability?.state).toBe('available');
  expect(proof.expiresAt).toMatch(/^\d{4}-/);
  const db = createClient({ url: lab.settings.databaseUrl });
  try {
    const evidence = await db.execute({
      sql: 'SELECT data FROM scanner_discovery_evidence WHERE scan_id=? LIMIT 1',
      args: [scan.id],
    });
    const example = JSON.parse(String(evidence.rows[0]!.data));
    // Only fixture expiry is advanced. Public admission, gateway evidence and
    // proof/finding publication above are real; no clock or store is mocked.
    for (let index = 0; index < 260; index++) {
      const id = randomUUID();
      await db.execute({
        sql: 'INSERT INTO scanner_discovery_evidence(id,scan_id,owner,expires_at,data) VALUES (?,?,?,?,?)',
        args: [
          id,
          scan.id,
          'local-operator',
          '2000-01-01T00:00:00.000Z',
          JSON.stringify({ ...example, id, expiresAt: '2000-01-01T00:00:00.000Z' }),
        ],
      });
    }
    await db.execute({
      sql: 'UPDATE scanner_discovery_evidence SET expires_at=? WHERE scan_id=?',
      args: ['2000-01-01T00:00:00.000Z', scan.id],
    });
    await db.execute(
      "CREATE TRIGGER deny_retention_fixture BEFORE DELETE ON scanner_discovery_evidence BEGIN SELECT RAISE(ABORT,'owned retention storage failure'); END",
    );
    expect((await lab.request('/api/retention/cleanup', 'POST', {})).status).toBe(503);
    expect((await lab.request('/api/retention')).data.state).toBe('DEBT');
    expect((await lab.request(`/api/scans/${scan.id}/evidence`)).status).toBe(503);
    const blocked = await selected.admit();
    expect(blocked.status).toBe(503);
    await db.execute('DROP TRIGGER deny_retention_fixture');
    const first = await lab.request('/api/retention/cleanup', 'POST', {});
    expect(first.status).toBe(200);
    expect(first.data.deletedEvidence).toBe(128);
    expect((first.data.status as { pending: boolean }).pending).toBe(true);
    expect((await lab.request(`/api/scans/${scan.id}/evidence`)).data.items).toEqual([]);
    const second = await lab.request('/api/retention/cleanup', 'POST', {});
    expect(second.status).toBe(200);
    expect(Number(second.data.deletedEvidence)).toBeGreaterThan(0);
    expect(Number(second.data.deletedEvidence)).toBeLessThanOrEqual(128);
    expect((await lab.request('/api/retention')).data.state).toBe('READY');
    expect((await lab.request(`/api/scans/${scan.id}/evidence`)).data.items).toEqual([]);
    expect((await lab.request(`/api/findings/${finding.id}`)).data).toMatchObject({
      availability: { state: 'expired' },
      evidenceIds: [],
    });
    expect((await lab.request(`/api/evaluations/${proof.id}`)).data).toMatchObject({
      availability: { state: 'expired' },
      completed: false,
      withheld: true,
      evidence: [],
    });
    const stored = await db.execute({
      sql: 'SELECT data FROM scanner_verification_proofs WHERE id=?',
      args: [proof.id],
    });
    expect(String(stored.rows[0]!.data)).not.toContain('LAB_MARKER_EXPOSURERESOURCE01');
    expect((await selected.admit()).status).toBe(202);
  } finally {
    db.close();
  }
  await lab.restart();
  expect((await lab.request(`/api/findings/${finding.id}`)).data.availability).toMatchObject({ state: 'expired' });
}

/** Verify lost encryption keys require credential re-registration without plaintext recovery. */
export async function keyLossRecovery() {
  const wire = await modelWire({ category: 'ssrf', path: '/owned/ssrf/vulnerable', interpretation: 'CONFIRMED' });
  const lab = await startDiscoveryLab({ investigationModels: wire.models });
  const selected = await discoveryCase(lab, { path: wire.scenario.path, authenticated: true });
  const first = await selected.admit();
  expect(first.status).toBe(202);
  const scan = await lab.wait(String(first.data.id));
  expect(scan.state).toBe('COMPLETED');
  const run = await investigation(lab, scan, 1);
  expect((await lab.request(`/api/investigations/${run.id}/plan`, 'POST', {})).status).toBe(200);
  const hypotheses = (await lab.request(`/api/investigations/${run.id}/hypotheses`)).data.items as { id: string }[];
  const approval = await lab.request(`/api/hypotheses/${hypotheses[0]!.id}/approval`, 'POST', {
    callback: `http://${lab.boundary.address}:18080/owned/callback`,
    expiresAt: new Date(Date.now() + 600000).toISOString(),
  });
  expect(approval.status).toBe(201);
  const before = await lab.stats();
  const profilePath = `/api/targets/${selected.target.id}/profiles/${selected.profile.id}`;
  let oldRevision = 0,
    oldCredentialRevision = 0;
  for (const key of [undefined, 'ab'.repeat(32)]) {
    await lab.restartWithKey(key);
    const profile = await lab.request(profilePath);
    expect(profile.status).toBe(200);
    expect(profile.data.identity).toMatchObject({
      status: 'CREDENTIAL_UNAVAILABLE',
      reason: 'CREDENTIAL_REREGISTRATION_REQUIRED',
    });
    oldRevision = Number(profile.data.revision);
    oldCredentialRevision = Number(profile.data.credentialRevision);
    const blocked = await selected.admit();
    expect(blocked.status).toBe(503);
    expect(blocked.data.code).toBe('CREDENTIAL_UNAVAILABLE');
    const after = await lab.stats();
    expect(after['identity-contacts'] ?? 0).toBe(before['identity-contacts'] ?? 0);
    expect(after['owned-callback-received'] ?? 0).toBe(before['owned-callback-received'] ?? 0);
  }
  const restored = await lab.request(
    profilePath,
    'PUT',
    {
      kind: 'header',
      role: 'viewer',
      name: 'Re-registered viewer',
      identityEndpoint: 'http://allowed.lab:18080/identity',
      expectedIdentity: 'viewer-account',
      credential: { name: 'x-api-key', value: lab.privateValues.viewer },
    },
    oldRevision,
  );
  expect(restored.status).toBe(200);
  expect(restored.data.revision).toBe(oldRevision + 1);
  expect(restored.data.credentialRevision).toBe(oldCredentialRevision + 1);
  expect(restored.data.identity).toMatchObject({ status: 'CHECK_REQUIRED' });
  const stale = await lab.request(
    `/api/approvals/${approval.data.id}/decision`,
    'POST',
    { decision: 'approved', revision: approval.data.revision },
    Number(approval.data.revision),
  );
  expect(stale.status).toBe(409);
  const resumed = await selected.admit();
  expect(resumed.status).toBe(202);
  const completed = await lab.wait(String(resumed.data.id));
  expect(completed.state).toBe('COMPLETED');
  expect(completed.roles[0]?.identity).toBe('READY');
  const persisted = await lab.query('SELECT envelope FROM scanner_credentials');
  expect(JSON.stringify(persisted)).not.toContain(lab.privateValues.viewer);
  for (const value of Object.values(lab.privateValues)) expect(lab.exported.join('\n')).not.toContain(value);
}

export async function nonLabRetentionAdmission() {
  const lab = await startDiscoveryLab();
  const selected = await discoveryCase(lab, { authenticated: true });
  const {
    id: _policyId,
    owner: _policyOwner,
    revision: _policyRevision,
    retention: _retention,
    ...policyBody
  } = selected.policy;
  const policy = await lab.request(`/api/policies/${selected.policy.id}`, 'PUT', policyBody, selected.policy.revision);
  expect(policy.status).toBe(200);
  const {
    id: _targetId,
    owner: _targetOwner,
    revision: _targetRevision,
    ...targetBody
  } = (await lab.request(`/api/targets/${selected.target.id}`)).data;
  const changed = await lab.request(
    `/api/targets/${selected.target.id}`,
    'PUT',
    { ...targetBody, environment: 'staging', policyRevision: policy.data.revision },
    Number(_targetRevision),
  );
  expect(changed.status).toBe(200);
  const currentProfile = (await lab.request(`/api/targets/${selected.target.id}/profiles/${selected.profile.id}`)).data;
  const before = await lab.stats();
  const rejected = await lab.request(`/api/targets/${selected.target.id}/scans`, 'POST', {
    targetRevision: changed.data.revision,
    policyRevision: policy.data.revision,
    mode: 'http',
    idempotencyKey: randomUUID(),
    profiles: [
      {
        targetRevision: changed.data.revision,
        policyRevision: policy.data.revision,
        profileId: selected.profile.id,
        profileRevision: currentProfile.revision,
        credentialRevision: currentProfile.credentialRevision,
      },
    ],
  });
  expect(rejected.status).toBe(403);
  expect(rejected.data.code).toBe('RETENTION_REQUIRED');
  expect(await lab.stats()).toEqual(before);
  expect((await lab.request('/api/scans')).data.items).toEqual([]);
  expect(await lab.query('SELECT id FROM scanner_discovery_jobs')).toEqual([]);
}
