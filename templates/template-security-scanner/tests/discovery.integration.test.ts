import { ownerIdentity } from '../src/runtime/docker.js';
import { createClient } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import type { Policy, Profile, Target } from '../src/core/contracts.js';
import { ControlPlane } from '../src/core/control-plane.js';
import { CredentialVault } from '../src/core/credentials.js';
import { DomainStore } from '../src/core/store.js';
import { SecretGuard } from '../src/discovery/parser.js';
import { type Scan, type Evidence } from '../src/discovery/contracts.js';
import { SCAN_LABEL } from '../src/discovery/resources.js';
import { ScanService } from '../src/discovery/service.js';
import {
  startDiscoveryLab,
  closeDiscoveryLabs,
  discoveryCase,
  fixtureCommand,
  observeBrowserControls,
} from './lab/harness.js';
afterEach(closeDiscoveryLabs);
describe('Confined discovery through the protected API', () => {
  it('discovery_shutdown_cancels_an_admission_that_was_already_in_progress', async () => {
    const lab = await startDiscoveryLab();
    const selected = await discoveryCase(lab);
    const domain = new DomainStore(lab.settings.databaseUrl);
    const scans = new ScanService(
      lab.settings,
      new ControlPlane(domain, new CredentialVault(lab.settings.SCANNER_ENCRYPTION_KEY)),
      lab.boundary,
    );
    await scans.initialize();
    try {
      const first = await selected.admit();
      expect(first.status).toBe(202);
      expect((await lab.wait(String(first.data.id))).state).toBe('COMPLETED');
      const ordinary = await scans.admit(selected.target.owner, selected.target.id, {
        ...first.request,
        idempotencyKey: randomUUID(),
      });
      expect((await lab.wait(ordinary.id)).state).toBe('COMPLETED');

      let releaseAdmission!: () => void;
      const admissionHeld = new Promise<void>(resolve => (releaseAdmission = resolve));
      let admissionEntered!: () => void;
      const entered = new Promise<void>(resolve => (admissionEntered = resolve));
      const admit = scans.store.admit.bind(scans.store);
      // Pause after capability validation, then use the unchanged real store admission.
      scans.store.admit = async (...args) => {
        admissionEntered();
        await admissionHeld;
        return admit(...args);
      };
      const request = { ...first.request, idempotencyKey: randomUUID() };
      const pending = scans.admit(selected.target.owner, selected.target.id, request);
      await entered;
      const shutdown = scans.close();
      releaseAdmission();
      const admitted = await pending;
      await shutdown;
      const stopped = await lab.request(`/api/scans/${admitted.id}`);
      expect(stopped.status).toBe(200);
      expect(stopped.data).toMatchObject({ state: 'CANCELLED', reason: 'SERVER_STOPPED', cleanup: 'COMPLETE' });
      // Cancellation can precede resource creation; absence here does not prove resource teardown.
      const database = createClient({ url: lab.settings.databaseUrl });
      try {
        expect(
          (
            await database.execute({
              sql: 'SELECT COUNT(*) AS total FROM scanner_discovery_resources WHERE scan_id=?',
              args: [admitted.id],
            })
          ).rows[0]?.total,
        ).toBe(0);
      } finally {
        database.close();
      }
      await expect(
        scans.admit(selected.target.owner, selected.target.id, { ...request, idempotencyKey: randomUUID() }),
      ).rejects.toMatchObject({ code: 'DISCOVERY_UNAVAILABLE' });
    } finally {
      await scans.close();
      await domain.close();
    }
  }, 600000);
  it('discovery_bounds_output_isolates_secrets_and_cleans_cancellation', async () => {
    const lab = await startDiscoveryLab({ processMode: true });
    const completed = await discoveryCase(lab),
      first = await completed.admit();
    expect(first.status).toBe(202);
    const firstRun = await lab.wait(String(first.data.id));
    expect(firstRun.state).toBe('COMPLETED');
    const inventory = (await lab.request(`/api/scans/${firstRun.id}/evidence?limit=100`)).data.items as Evidence[];
    expect(inventory.length).toBeGreaterThan(0);
    // Advance only persisted test evidence's expiry, leaving scan/lifecycle state real.
    const database = createClient({ url: lab.settings.databaseUrl });
    try {
      await database.execute({
        sql: 'UPDATE scanner_discovery_evidence SET expires_at=? WHERE scan_id=?',
        args: ['2000-01-01T00:00:00.000Z', firstRun.id],
      });
    } finally {
      database.close();
    }
    expect((await lab.request(`/api/scans/${firstRun.id}/evidence?limit=100`)).data.items).toEqual([]);
    expect((await lab.request(`/api/scans/${firstRun.id}`)).data.evidenceRetention).toMatchObject({
      expiredCount: inventory.length,
    });
    await lab.restart();
    expect((await lab.request(`/api/scans/${firstRun.id}`)).data.evidenceRetention).toMatchObject({
      expiredCount: inventory.length,
    });
    const bounded = await discoveryCase(lab, { path: '/output-bound' }),
      oversized = await bounded.admit();
    expect(oversized.status).toBe(202);
    const output = await lab.wait(String(oversized.data.id));
    expect(output.reason).toBe('OUTPUT_BOUND');
    expect(output.partial).toBe(true);
    expect(output.roles.some(role => role.counters.boundStops > 0)).toBe(true);
    expect(output.cleanup).toBe('COMPLETE');
    /** Admit a streaming discovery scan and capture the gateway's pre-admission counters. */
    const startStreaming = async () => {
      const selected = await discoveryCase(lab, { path: '/stream' }),
        before = await lab.stats(),
        admitted = await selected.admit();
      expect(admitted.status).toBe(202);
      for (let attempt = 0; attempt < 200; attempt++) {
        if (((await lab.stats())['stream-contacts'] ?? 0) > (before['stream-contacts'] ?? 0))
          return { selected, id: String(admitted.data.id) };
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw new Error('OWNED_STREAM_NOT_OBSERVED');
    };
    const cancelled = await startStreaming();
    const cancellation = await lab.request(`/api/scans/${cancelled.id}/cancel`, 'POST', {});
    expect(cancellation.status).toBe(200);
    expect(cancellation.data).toMatchObject({
      state: 'CANCELLED',
      reason: 'CANCELLED_BY_OPERATOR',
      cleanup: 'COMPLETE',
      partial: true,
    });
    expect((await lab.request(`/api/scans/${cancelled.id}/cancel`, 'POST', {})).data.state).toBe('CANCELLED');
    const changing = await startStreaming();
    const { id: targetId, owner, revision, ...body } = changing.selected.target;
    const changed = await lab.request(
      `/api/targets/${targetId}`,
      'PUT',
      { ...body, name: 'Updated authorized scope' },
      revision,
    );
    expect(changed.status).toBe(200);
    expect((await lab.request(`/api/scans/${changing.id}`)).data).toMatchObject({
      state: 'CANCELLED',
      reason: 'SCOPE_CHANGED',
      cleanup: 'COMPLETE',
    });
    for (const kind of ['crawler', 'gateway'] as const) {
      const crashing = await startStreaming();
      const containers = await lab.client.listContainers({ filters: { label: [`${SCAN_LABEL}=${crashing.id}`] } });
      let killed = false;
      for (const entry of containers) {
        const container = lab.client.getContainer(entry.Id),
          observed = await container.inspect();
        if (
          kind === 'crawler'
            ? observed.Config.Labels?.['mastra.sandbox'] === 'true'
            : observed.Config.Cmd?.[0] === 'mitmdump'
        ) {
          await container.kill({ signal: 'SIGKILL' });
          killed = true;
          break;
        }
      }
      expect(killed).toBe(true);
      const crashed = await lab.wait(crashing.id);
      expect(crashed.partial).toBe(true);
      expect(crashed.cleanup).toBe('COMPLETE');
      if (kind === 'gateway') {
        expect(crashed.state).toBe('FAILED');
        expect(crashed.budget.reason).toBe('unknown');
      } else expect(crashed.state).toBe('COMPLETED_WITH_ERRORS');
    }
    const interrupted = await startStreaming();
    await lab.crashRestart();
    const recovered = (await lab.request(`/api/scans/${interrupted.id}`)).data as unknown as Scan;
    expect(recovered).toMatchObject({
      state: 'FAILED',
      reason: 'PROCESS_INTERRUPTED',
      cleanup: 'COMPLETE',
      partial: true,
      budget: { exhausted: true, reason: 'unknown' },
    });
    const before = await lab.stats();
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(await lab.stats()).toEqual(before);
    const authenticated = await discoveryCase(lab, { path: '/start', authenticated: true });
    await fixtureCommand(lab, '/expire?role=viewer');
    const beforeAuth = await lab.stats(),
      admitted = await authenticated.admit();
    expect(admitted.status).toBe(202);
    const expired = await lab.wait(String(admitted.data.id));
    expect(expired.state).toBe('AUTH_REQUIRED');
    expect(expired.roles[0]?.identity).toBe('AUTH_REQUIRED');
    expect((await lab.stats())['start-contacts'] ?? 0).toBe(beforeAuth['start-contacts'] ?? 0);
    const refused = await authenticated.admit();
    expect(refused.status).toBe(403);
    expect(refused.data.code).toBe('AUTH_REQUIRED');
    const guard = new SecretGuard(Object.values(lab.privateValues));
    expect(lab.exported.every(value => !guard.unsafe(value))).toBe(true);
    guard.clear();
    const raw = createClient({ url: lab.settings.databaseUrl });
    try {
      const resources = (await raw.execute('SELECT data FROM scanner_discovery_resources')).rows;
      // A live lab fixture is a real shared-image consumer. Its deletion
      // receipts must remain until the final consumer is removed.
      for (const row of resources) {
        const resource = JSON.parse(String(row.data)) as { id: string; imageId?: string; kind: string };
        expect(resource.kind).toBe('image');
        const image = await lab.client.getImage(resource.imageId ?? resource.id).inspect();
        expect(
          (await lab.client.listContainers({ all: true, filters: { ancestor: [image.Id] } })).length,
        ).toBeGreaterThan(0);
      }
      expect(
        await lab.client.listContainers({
          all: true,
          filters: {
            label: [
              'dev.mastra.security-scanner.scan',
              `dev.mastra.security-scanner.owner=${ownerIdentity(lab.settings)}`,
            ],
          },
        }),
      ).toEqual([]);
      expect(
        await lab.client.listNetworks({
          filters: {
            label: [
              'dev.mastra.security-scanner.scan',
              `dev.mastra.security-scanner.owner=${ownerIdentity(lab.settings)}`,
            ],
          },
        }),
      ).toEqual([]);
    } finally {
      raw.close();
    }
  }, 600000);
  it('discovery_blocks_redirect_dns_path_method_and_transport_escape', async () => {
    const lab = await startDiscoveryLab();
    const inventoryCase = await discoveryCase(lab);
    const clean = await inventoryCase.admit();
    expect(clean.status).toBe(202);
    expect((await lab.wait(String(clean.data.id))).state).toBe('COMPLETED');
    for (const path of ['/redirect-denied', '/redirect-second', '/redirect-path']) {
      const selected = await discoveryCase(lab, { path });
      const before = await lab.stats();
      const admitted = await selected.admit();
      expect(admitted.status).toBe(202);
      const run = await lab.wait(String(admitted.data.id));
      expect(run.partial).toBe(true);
      expect(run.cleanup).toBe('COMPLETE');
      const after = await lab.stats();
      for (const name of [
        'tcp-18081',
        'http-18081',
        'excluded-contacts',
        'cross-origin-credential-contacts',
        'write-contacts',
      ])
        expect(after[name] ?? 0).toBe(before[name] ?? 0);
      expect(run.networkCounters['denied-origin'] ?? run.networkCounters['denied-path'] ?? 0).toBeGreaterThan(0);
      expect(run.roles.reduce((total, role) => total + role.counters.policyDenied, 0)).toBeGreaterThan(0);
      const inventory = (await lab.request(`/api/scans/${run.id}/inventory?limit=100`)).data.items as Evidence[];
      expect(
        inventory.every(
          item =>
            item.observation.origin === 'http://allowed.lab:18080' &&
            !item.observation.path.startsWith('/excluded') &&
            item.observation.status !== 403,
        ),
      ).toBe(true);
    }
    for (const mode of ['mixed', 'denied', 'mapped', 'many', 'malformed', 'timeout'] as const) {
      await fixtureCommand(lab, `/dns?mode=${mode}`);
      const before = await lab.stats();
      const admitted = await inventoryCase.admit();
      expect(admitted.status).toBe(202);
      const run = await lab.wait(String(admitted.data.id));
      expect(run.partial).toBe(true);
      expect(run.cleanup).toBe('COMPLETE');
      expect(run.networkCounters['numeric-pins'] ?? 0).toBe(0);
      const after = await lab.stats();
      expect(after['tcp-18080'] ?? 0).toBe(before['tcp-18080'] ?? 0);
      expect(after['http-18080'] ?? 0).toBe(before['http-18080'] ?? 0);
      await fixtureCommand(lab, '/dns?mode=allow');
      const neighbor = await inventoryCase.admit();
      expect(neighbor.status).toBe(202);
      expect((await lab.wait(String(neighbor.data.id))).state).toBe('COMPLETED');
    }
    await fixtureCommand(lab, '/dns?mode=rebind');
    const rebound = await discoveryCase(lab, { path: '/start' }),
      beforeRebind = await lab.stats();
    const admittedRebind = await rebound.admit();
    expect(admittedRebind.status).toBe(202);
    const rebinding = await lab.wait(String(admittedRebind.data.id));
    expect(rebinding.partial).toBe(true);
    expect(rebinding.networkCounters['numeric-pins']).toBe(1);
    expect((await lab.stats())['tcp-18080']! - (beforeRebind['tcp-18080'] ?? 0)).toBe(1);
    await fixtureCommand(lab, '/dns?mode=allow');
    for (const limit of ['requests', 'bytes', 'time'] as const) {
      const limits = {
        maxRequests: limit === 'requests' ? 1 : 40,
        maxDurationSeconds: limit === 'time' ? 1 : 60,
        maxResponseBytes: limit === 'bytes' ? 1024 : 262144,
        maxConcurrency: 2,
      };
      const selected = await discoveryCase(lab, { path: limit === 'bytes' ? '/large' : '/start', limits });
      const before = await lab.stats();
      const admitted = await selected.admit();
      expect(admitted.status).toBe(202);
      const run = await lab.wait(String(admitted.data.id));
      expect(run.reason).toBe('BUDGET_EXHAUSTED');
      expect(run.budget.exhausted).toBe(true);
      expect(run.budget.reason).toBe(limit);
      expect(run.cleanup).toBe('COMPLETE');
      expect(run.partial).toBe(true);
      if (limit === 'requests')
        expect((await lab.stats())['http-18080']! - (before['http-18080'] ?? 0)).toBeLessThanOrEqual(1);
      const stopped = await lab.stats();
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(await lab.stats()).toEqual(stopped);
    }
  }, 600000);
  it('headless_preserves_actual_browser_boundary', async () => {
    const api = await startDiscoveryLab();
    const limits = { maxRequests: 20, maxDurationSeconds: 45, maxResponseBytes: 262144, maxConcurrency: 2 };
    const policy = (
      await api.request('/api/policies', 'POST', {
        name: 'Browser inventory',
        permittedMethods: ['GET', 'HEAD'],
        scanLimits: limits,
        retention: { evidenceDays: 1, approvedBy: 'lab-operator' },
      })
    ).data as unknown as Policy;
    const target = (
      await api.request('/api/targets', 'POST', {
        name: 'Browser catalog',
        entryUrl: 'http://allowed.lab:18080/start',
        approvedOrigins: ['http://allowed.lab:18080'],
        allowedPaths: ['/'],
        excludedPaths: ['/excluded'],
        permittedMethods: ['GET', 'HEAD'],
        environment: 'lab',
        authorizationEvidenceRef: 'approval:owned-browser-lab',
        authorizationConfirmed: true,
        policyId: policy.id,
        policyRevision: policy.revision,
        schedule: { enabled: false, timezone: 'UTC' },
        scanLimits: limits,
        authProfileIds: [],
      })
    ).data as unknown as Target;
    const profile = (
      await api.request(
        `/api/targets/${target.id}/profiles`,
        'POST',
        { kind: 'public', role: 'public', name: 'Browser public' },
        target.revision,
      )
    ).data as unknown as Profile;
    const current = (await api.request(`/api/targets/${target.id}`)).data as unknown as Target;
    const admitted = await api.request(`/api/targets/${target.id}/scans`, 'POST', {
      targetRevision: current.revision,
      policyRevision: policy.revision,
      mode: 'headless',
      idempotencyKey: randomUUID(),
      profiles: [
        {
          targetRevision: current.revision,
          policyRevision: policy.revision,
          profileId: profile.id,
          profileRevision: profile.revision,
          credentialRevision: profile.credentialRevision,
        },
      ],
    });
    expect(admitted.status).toBe(202);
    const run = await api.wait(String(admitted.data.id));
    if (!['COMPLETED', 'COMPLETED_WITH_ERRORS'].includes(run.state))
      throw new Error(`SCAN_PHASE_HEADLESS_STAGE_${run.diagnostic ?? 'NONE'}_REASON_${run.reason}`);
    expect(run.cleanup).toBe('COMPLETE');
    const inventory = (await api.request(`/api/scans/${run.id}/inventory?limit=100`)).data.items as Evidence[];
    expect(inventory.some(item => item.observation.kind === 'xhr' && item.observation.path === '/api/clean')).toBe(
      true,
    );
    expect((await api.stats())['clean-xhr-public'] ?? 0).toBeGreaterThan(0);
    expect((await api.stats())['write-contacts'] ?? 0).toBe(0);
  }, 120000);
  it('discovery_persists_public_role_and_headless_inventory', async () => {
    const api = await startDiscoveryLab();
    const limits = { maxRequests: 80, maxDurationSeconds: 120, maxResponseBytes: 262144, maxConcurrency: 2 };
    const policyResponse = await api.request('/api/policies', 'POST', {
      name: 'Read only lab',
      permittedMethods: ['GET', 'HEAD'],
      scanLimits: limits,
      retention: { evidenceDays: 1, approvedBy: 'lab-operator' },
    });
    expect(policyResponse.status).toBe(201);
    const policy = policyResponse.data as unknown as Policy;
    const targetResponse = await api.request('/api/targets', 'POST', {
      name: 'Catalog lab',
      entryUrl: 'http://allowed.lab:18080/start',
      approvedOrigins: ['http://allowed.lab:18080'],
      allowedPaths: ['/'],
      excludedPaths: ['/excluded'],
      permittedMethods: ['GET', 'HEAD'],
      environment: 'lab',
      authorizationEvidenceRef: 'approval:owned-catalog-lab',
      authorizationConfirmed: true,
      policyId: policy.id,
      policyRevision: policy.revision,
      schedule: { enabled: false, timezone: 'UTC' },
      scanLimits: limits,
      authProfileIds: [],
    });
    expect(targetResponse.status).toBe(201);
    let target = targetResponse.data as unknown as Target;
    const publicResponse = await api.request(
      `/api/targets/${target.id}/profiles`,
      'POST',
      { kind: 'public', name: 'Public catalog', role: 'public' },
      target.revision,
    );
    expect(publicResponse.status).toBe(201);
    const profile = publicResponse.data as unknown as Profile;
    target = (await api.request(`/api/targets/${target.id}`)).data as unknown as Target;
    const request = {
      targetRevision: target.revision,
      policyRevision: policy.revision,
      mode: 'http',
      idempotencyKey: randomUUID(),
      profiles: [
        {
          targetRevision: target.revision,
          policyRevision: policy.revision,
          profileId: profile.id,
          profileRevision: profile.revision,
          credentialRevision: profile.credentialRevision,
        },
      ],
    };
    const admitted = await api.request(`/api/targets/${target.id}/scans`, 'POST', request);
    expect(admitted.status).toBe(202);
    const scan = admitted.data as unknown as Scan;
    const database = createClient({ url: api.settings.databaseUrl });
    try {
      const committed = await database.execute({
        sql: 'SELECT s.id,j.id AS job FROM scanner_discovery_scans s JOIN scanner_discovery_jobs j ON j.scan_id=s.id WHERE s.id=?',
        args: [scan.id],
      });
      expect(committed.rows[0]?.id).toBe(scan.id);
      expect(committed.rows[0]?.job).toBe(scan.jobId);
    } finally {
      database.close();
    }
    const complete = await api.wait(scan.id);
    if (complete.state !== 'COMPLETED')
      throw new Error(`SCAN_PHASE_HTTP_STAGE_${complete.diagnostic ?? 'NONE'}_REASON_${complete.reason}`);
    expect(complete.state).toBe('COMPLETED');
    expect(complete.cleanup).toBe('COMPLETE');
    const inventory = await api.request(`/api/scans/${scan.id}/inventory?limit=100`);
    const evidence = inventory.data.items as Evidence[];
    if (!evidence.some(item => item.observation.path === '/catalog'))
      console.error(
        JSON.stringify({
          diagnostic: complete.diagnostic,
          budget: complete.budget,
          counters: complete.networkCounters,
          roles: complete.roles.map(role => ({ identity: role.identity, counters: role.counters })),
          receiver: await api.stats(),
        }),
      );
    expect(
      evidence.some(
        item =>
          item.observation.path === '/catalog' &&
          item.observation.role === 'public' &&
          item.observation.source === 'katana-http',
      ),
    ).toBe(true);
    expect(
      evidence.some(
        item =>
          item.observation.kind === 'form' &&
          item.observation.path === '/search' &&
          item.observation.parameterNames.includes('q'),
      ),
    ).toBe(true);
    expect(evidence.every(item => item.confirmationEligible === false && item.expiresAt !== null)).toBe(true);
    const receiver = await api.stats();
    expect(receiver['write-contacts'] ?? 0).toBe(0);
    expect(receiver['credential-url-contacts'] ?? 0).toBe(0);
    const duplicate = await api.request(`/api/targets/${target.id}/scans`, 'POST', request);
    expect(duplicate.status).toBe(202);
    expect(duplicate.data.id).toBe(scan.id);
    const conflict = await api.request(`/api/targets/${target.id}/scans`, 'POST', { ...request, mode: 'headless' });
    expect(conflict.status).toBe(409);
    const profileIds = [profile.id];
    for (const [role, kind, name, value] of [
      ['viewer', 'header', 'x-api-key', api.privateValues.viewer],
      ['admin', 'bearer', 'authorization', api.privateValues.admin],
      ['member', 'header', 'cookie', `session=${api.privateValues.member}`],
    ] as const) {
      const created = await api.request(
        `/api/targets/${target.id}/profiles`,
        'POST',
        {
          kind,
          name: `${role} session`,
          role,
          identityEndpoint: 'http://allowed.lab:18080/identity',
          expectedIdentity: `${role}-account`,
          credential: kind === 'bearer' ? { value } : { name, value },
        },
        target.revision,
      );
      expect(created.status).toBe(201);
      profileIds.push(String(created.data.id));
      target = (await api.request(`/api/targets/${target.id}`)).data as unknown as Target;
    }
    /** Read current profile and credential revisions from the persisted target bindings. */
    const bindings = async () => {
      const profiles = [];
      for (const id of profileIds) {
        const response = await api.request(`/api/targets/${target.id}/profiles/${id}`);
        expect(response.status).toBe(200);
        profiles.push(response.data as unknown as Profile);
      }
      return profiles.map(profile => ({
        targetRevision: target.revision,
        policyRevision: policy.revision,
        profileId: profile.id,
        profileRevision: profile.revision,
        credentialRevision: profile.credentialRevision,
      }));
    };
    const beforeIdentity = await api.stats();
    const checkBinding = (await bindings())[1]!;
    const checked = await api.request(
      `/api/targets/${target.id}/profiles/${checkBinding.profileId}/check`,
      'POST',
      checkBinding,
    );
    expect(checked.status).toBe(200);
    expect((checked.data.identity as { status: string }).status).toBe('READY');
    const afterIdentity = await api.stats();
    expect((afterIdentity['identity-contacts'] ?? 0) - (beforeIdentity['identity-contacts'] ?? 0)).toBe(1);
    expect(afterIdentity['start-contacts']).toBe(beforeIdentity['start-contacts']);
    for (const mode of ['http', 'headless'] as const) {
      const before = await api.stats();
      const selected = await bindings();
      const admitted = await api.request(`/api/targets/${target.id}/scans`, 'POST', {
        targetRevision: target.revision,
        policyRevision: policy.revision,
        mode,
        idempotencyKey: randomUUID(),
        profiles: [...selected.slice(1), selected[0]],
      });
      expect(admitted.status).toBe(202);
      const controlMonitor = new AbortController();
      const controls =
        mode === 'headless'
          ? observeBrowserControls(api, String(admitted.data.id), controlMonitor.signal)
          : Promise.resolve(new Map<string, number>());
      const [run, actualControls] = await Promise.all([
        api.wait(String(admitted.data.id)).finally(() => controlMonitor.abort()),
        controls,
      ]);
      if (mode === 'headless') {
        expect(actualControls.size).toBe(4);
        expect(run.networkCounters['denied-control-cdp'] ?? 0).toBeGreaterThanOrEqual(4);
        expect(run.networkCounters['denied-control-bootstrap'] ?? 0).toBeGreaterThanOrEqual(4);
      }
      if (run.state !== 'COMPLETED_WITH_ERRORS')
        throw new Error(`SCAN_PHASE_${mode.toUpperCase()}_STAGE_${run.diagnostic ?? 'NONE'}_REASON_${run.reason}`);
      expect(run.state).toBe('COMPLETED_WITH_ERRORS');
      expect(run.cleanup).toBe('COMPLETE');
      expect(run.roles).toHaveLength(4);
      expect(run.roles.every(role => role.identity === 'READY')).toBe(true);
      expect(run.roles.some(role => role.counters.withheld > 0)).toBe(true);
      const inventory = (await api.request(`/api/scans/${run.id}/inventory?limit=100`)).data.items as Evidence[];
      for (const role of ['public', 'viewer', 'admin', 'member']) {
        expect(
          inventory.some(
            item =>
              item.observation.role === role &&
              item.observation.kind === 'endpoint' &&
              item.observation.path === '/catalog',
          ),
        ).toBe(true);
        expect(
          inventory.some(
            item =>
              item.observation.role === role &&
              item.observation.kind === 'form' &&
              item.observation.path === '/search' &&
              item.observation.parameterNames.includes('q'),
          ),
        ).toBe(true);
        if (mode === 'headless') {
          expect(
            inventory.some(
              item =>
                item.observation.role === role &&
                item.observation.kind === 'xhr' &&
                item.observation.path === '/api/clean' &&
                item.observation.source === 'katana-headless',
            ),
          ).toBe(true);
          expect((await api.stats())[`clean-xhr-${role}`] ?? 0).toBeGreaterThan(before[`clean-xhr-${role}`] ?? 0);
        }
      }
      if (mode === 'http') {
        expect(run.roles.find(role => role.role === 'viewer')?.counters.policyDenied ?? 0).toBeGreaterThan(0);
        expect(
          inventory.some(
            item =>
              item.observation.role === 'viewer' &&
              item.observation.path === '/admin' &&
              item.observation.status === 403 &&
              item.observation.provenance === 'upstream-response',
          ),
        ).toBe(true);
        expect(
          inventory
            .filter(item => item.observation.status === 403)
            .every(item => item.observation.path === '/admin' && item.observation.provenance === 'upstream-response'),
        ).toBe(true);
      } else
        expect(
          inventory.every(
            item => item.observation.provenance === 'advertised' && item.observation.status === undefined,
          ),
        ).toBe(true);
      expect(
        inventory
          .filter(item => item.observation.kind === 'form' || item.observation.kind === 'xhr')
          .every(item => item.observation.provenance === 'advertised' && item.observation.status === undefined),
      ).toBe(true);
      expect(inventory.every(item => item.confirmationEligible === false)).toBe(true);
      const after = await api.stats();
      for (const forbidden of [
        'write-contacts',
        'credential-url-contacts',
        'excluded-contacts',
        'cross-origin-credential-contacts',
      ])
        expect(after[forbidden] ?? 0).toBe(before[forbidden] ?? 0);
    }
    const secretGuard = new SecretGuard(Object.values(api.privateValues));
    expect(api.exported.every(value => !secretGuard.unsafe(value))).toBe(true);
    const rawDatabase = createClient({ url: api.settings.databaseUrl });
    try {
      for (const table of [
        'scanner_records',
        'scanner_record_revisions',
        'scanner_credentials',
        'scanner_discovery_scans',
        'scanner_discovery_jobs',
        'scanner_discovery_evidence',
      ]) {
        const actual = await rawDatabase.execute(`SELECT * FROM ${table}`);
        expect(secretGuard.unsafe(JSON.stringify(actual.rows))).toBe(false);
      }
    } finally {
      rawDatabase.close();
      secretGuard.clear();
    }
    const beforeCookieScans = ((await api.request('/api/scans?limit=100')).data.items as Scan[]).length;
    const beforeCookieRejection = await api.stats();
    const ambiguous = await api.request(
      `/api/targets/${target.id}/profiles`,
      'POST',
      {
        kind: 'header',
        name: 'Session with preferences',
        role: 'preferences',
        identityEndpoint: 'http://allowed.lab:18080/identity',
        expectedIdentity: 'preferences-account',
        credential: { name: 'cookie', value: `session=${api.privateValues.member}; locale=en` },
      },
      target.revision,
    );
    expect(ambiguous.status).toBe(201);
    const ambiguousProfile = ambiguous.data as unknown as Profile;
    target = (await api.request(`/api/targets/${target.id}`)).data as unknown as Target;
    const rejected = await api.request(`/api/targets/${target.id}/scans`, 'POST', {
      ...request,
      targetRevision: target.revision,
      idempotencyKey: randomUUID(),
      profiles: [
        {
          targetRevision: target.revision,
          policyRevision: policy.revision,
          profileId: ambiguousProfile.id,
          profileRevision: ambiguousProfile.revision,
          credentialRevision: ambiguousProfile.credentialRevision,
        },
      ],
    });
    expect(rejected.status).toBe(403);
    expect(rejected.data.code).toBe('CREDENTIAL_METADATA_CONFLICT');
    expect((await api.stats())['http-18080']).toBe(beforeCookieRejection['http-18080']);
    expect(((await api.request('/api/scans?limit=100')).data.items as Scan[]).length).toBe(beforeCookieScans);
    await api.restart();
    expect((await api.request(`/api/scans/${scan.id}`)).data.state).toBe('COMPLETED');
    const persisted = (await api.request(`/api/scans/${scan.id}/evidence?limit=100`)).data.items as Evidence[];
    expect(persisted.map(item => item.sha256)).toEqual(evidence.map(item => item.sha256));
  }, 600000);
});
