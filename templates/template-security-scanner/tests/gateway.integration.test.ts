import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Policy, Target, Profile } from '../src/core/contracts.js';
import { ControlPlane } from '../src/core/control-plane.js';
import { DomainStore } from '../src/core/store.js';
import { CredentialVault } from '../src/core/credentials.js';
import { DiscoveryStore } from '../src/discovery/store.js';
import { ScanResources } from '../src/discovery/resources.js';
import { SecretGuard, DiscoveryParser } from '../src/discovery/parser.js';
import { openGateway, gatewayState } from '../src/discovery/gateway.js';
import { control, stageFiles } from '../src/discovery/io.js';
import {
  startDiscoveryLab,
  closeDiscoveryLabs,
  registerLabCleanup,
  discoveryCase,
  hostGatewayCanary,
} from './lab/harness.js';
import { SCAN_LABEL } from '../src/discovery/resources.js';
import { buildLocalImage, releaseImage } from '../src/runtime/docker.js';
import { sandboxOptions } from '../src/runtime/sandbox.js';
import { BROWSER_FLAGS } from '../src/runtime/browser.js';
import { privateNativeSandbox } from '../src/discovery/native.js';

afterEach(closeDiscoveryLabs);
const wireSchema = z
  .object({
    case: z.string(),
    status: z.number().int().nullable(),
    upstreamObserved: z.boolean(),
    policyDenied: z.boolean(),
    bytes: z.number().int().nonnegative(),
    record: z
      .object({
        request: z.object({ endpoint: z.string(), method: z.enum(['GET', 'POST']) }).strict(),
        response: z.object({ status_code: z.number().int(), headers: z.record(z.string(), z.string()) }).strict(),
      })
      .strict()
      .nullable(),
  })
  .strict();
describe('Gateway authorization before contact', () => {
  it('gateway_isolates_ca_and_blocks_alternate_egress', async () => {
    const lab = await startDiscoveryLab(),
      selected = await discoveryCase(lab, { origin: 'https://allowed.lab:18443', path: '/start' });
    const hostCanary = await hostGatewayCanary(lab);
    const admitted = await selected.admit('headless');
    expect(admitted.status).toBe(202);
    const scanId = String(admitted.data.id);
    let sandbox: ReturnType<typeof lab.client.getContainer> | undefined,
      gateway: ReturnType<typeof lab.client.getContainer> | undefined;
    for (let attempt = 0; attempt < 300; attempt++) {
      for (const entry of await lab.client.listContainers({ filters: { label: [`${SCAN_LABEL}=${scanId}`] } })) {
        const candidate = lab.client.getContainer(entry.Id),
          observed = await candidate.inspect();
        if (observed.Config.Labels?.['mastra.sandbox'] === 'true') sandbox = candidate;
        if (observed.Config.Cmd?.[0] === 'mitmdump') gateway = candidate;
      }
      if (sandbox && gateway && (await lab.stats())['http-18443']) break;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    expect(sandbox).toBeDefined();
    expect(gateway).toBeDefined();
    const inspected = await sandbox!.inspect(),
      gatewayInspection = await gateway!.inspect();
    expect(inspected.HostConfig.CapAdd ?? []).toEqual([]);
    expect(inspected.HostConfig.CapDrop).toEqual(['ALL']);
    expect(inspected.HostConfig.Binds ?? []).toEqual([]);
    expect(inspected.HostConfig.Privileged).toBe(false);
    expect(inspected.HostConfig.LogConfig?.Type).toBe('none');
    const networkMode = z.string().startsWith('container:').parse(inspected.HostConfig.NetworkMode);
    const anchor = await lab.client.getContainer(networkMode.replace('container:', '')).inspect();
    const address = z.ipv4().parse(Object.values(anchor.NetworkSettings.Networks)[0]?.IPAddress);
    const gatewayIp = z
      .ipv4()
      .parse(gatewayInspection.Config.Cmd![gatewayInspection.Config.Cmd!.indexOf('--listen-host') + 1]);
    const before = await lab.stats();
    const hostBefore = hostCanary.counts();
    const image = await buildLocalImage(lab.settings);
    const options = sandboxOptions(lab.settings, image, `security-scanner-probe-${randomUUID()}`);
    const untrusted = await privateNativeSandbox(lab.client, { ...options, network: networkMode });
    let untrustedRunning = true;
    /** Destroy the untrusted test sandbox once after its actual creation. */
    const destroyUntrusted = async () => {
      if (untrustedRunning) {
        await untrusted.destroy();
        untrustedRunning = false;
      }
    };
    registerLabCleanup(async () => {
      await destroyUntrusted();
      try {
        await lab.client.getImage(image.imageId).inspect();
        await releaseImage(lab.settings, image);
      } catch (error) {
        if ((error as { statusCode?: number }).statusCode !== 404) throw error;
      }
    });
    let noCaBytes = 0,
      authorityInvalid = false,
      noCaTail = '';
    const noCaController = new AbortController();
    /** Bound no-CA probe output and stop when its explicit negative TLS marker is observed. */
    const inspectNoCa = (chunk: string) => {
      noCaBytes += Buffer.byteLength(chunk);
      if (noCaBytes > 262144) {
        noCaController.abort();
        return;
      }
      const value = noCaTail + chunk;
      authorityInvalid ||= value.includes('ERR_CERT_AUTHORITY_INVALID');
      noCaTail = value.slice(-64);
    };
    const probe = (label: string, args: string[], timeout = 3000) =>
      control(sandbox!, args, timeout).catch(() => {
        throw new Error(label);
      });
    const [nss, help, direct, noCa] = await Promise.all([
      probe('EGRESS_NSS', ['/workspace/certutil', '-L', '-d', 'sql:/workspace/.pki/nssdb']),
      probe('EGRESS_HELP', ['/bin/sh', '-c', 'nc -h 2>&1 || true']),
      probe('EGRESS_DIRECT', [
        '/bin/sh',
        '-c',
        'for port in 53 18080 18081; do timeout 2 nc -w 1 "$1" "$port" </dev/null >/dev/null 2>&1 & done; for port in 53 443 3478; do (printf owned-egress-canary | timeout 2 nc -u -w 1 "$1" "$port" >/dev/null 2>&1) & done; timeout 2 nc -w 1 "::ffff:$1" 18080 </dev/null >/dev/null 2>&1 & timeout 2 nc -w 1 "$2" "$3" </dev/null >/dev/null 2>&1 & wait',
        'owned-egress',
        lab.boundary.address,
        hostCanary.address,
        String(hostCanary.port),
      ]),
      untrusted.executeCommand(
        'scanner-chromium',
        [
          ...BROWSER_FLAGS,
          `--proxy-server=http://${gatewayIp}:8080`,
          '--proxy-bypass-list=<-loopback>',
          '--dump-dom',
          'https://allowed.lab:18443/catalog',
        ],
        {
          timeout: 10000,
          maxRetainedBytes: 0,
          abortSignal: noCaController.signal,
          onStdout: inspectNoCa,
          onStderr: inspectNoCa,
        },
      ),
    ]);
    await destroyUntrusted();
    expect(nss.success).toBe(true);
    expect(nss.stdout).toContain('scanner-owned-interception');
    expect(help.stdout).toContain('-u');
    expect(direct.success).toBe(true);
    expect(noCa.success).toBe(true);
    expect(authorityInvalid).toBe(true);
    expect(noCaBytes).toBeLessThanOrEqual(262144);
    expect(noCa.stdout).toBe('');
    expect(noCa.stderr).toBe('');
    const after = await lab.stats();
    for (const name of [
      'tcp-53',
      'tcp-18080',
      'http-18080',
      'tcp-18081',
      'http-18081',
      'udp-443',
      'udp-3478',
      `dns-from-${address}`,
    ])
      expect(after[name] ?? 0).toBe(before[name] ?? 0);
    expect(hostCanary.counts()).toEqual(hostBefore);
    const completed = await lab.wait(scanId);
    if (!['COMPLETED', 'COMPLETED_WITH_ERRORS'].includes(completed.state))
      throw new Error(`SCAN_PHASE_HEADLESS_STAGE_${completed.diagnostic ?? 'NONE'}_REASON_${completed.reason}`);
    expect(completed.cleanup).toBe('COMPLETE');
    expect(completed.networkCounters['tls-client-failed'] ?? 0).toBeGreaterThan(0);
    expect((await lab.stats())['http-18443'] ?? 0).toBeGreaterThan(0);
    await expect(sandbox!.inspect()).rejects.toMatchObject({ statusCode: 404 });
    for (const port of [18444, 18445, 18446]) {
      const invalid = await discoveryCase(lab, { origin: `https://allowed.lab:${port}` }),
        beforeTls = await lab.stats(),
        bad = await invalid.admit();
      expect(bad.status).toBe(202);
      const run = await lab.wait(String(bad.data.id));
      expect(run.partial).toBe(true);
      expect(run.cleanup).toBe('COMPLETE');
      const afterTls = await lab.stats();
      expect(afterTls[`tls-attempt-${port}`] ?? 0).toBeGreaterThan(beforeTls[`tls-attempt-${port}`] ?? 0);
      expect(afterTls[`http-${port}`] ?? 0).toBe(0);
    }
  }, 300000);
  it('gateway_enforces_policy_before_upstream_contact', async () => {
    const lab = await startDiscoveryLab();
    const limits = { maxRequests: 200, maxDurationSeconds: 120, maxResponseBytes: 262144, maxConcurrency: 2 };
    const created = await lab.request('/api/policies', 'POST', {
      name: 'Gateway boundaries',
      permittedMethods: ['GET', 'HEAD'],
      scanLimits: limits,
      retention: { evidenceDays: 1, approvedBy: 'lab-operator' },
    });
    expect(created.status).toBe(201);
    const policy = created.data as unknown as Policy;
    const createdTarget = await lab.request('/api/targets', 'POST', {
      name: 'Gateway receiver',
      entryUrl: 'http://allowed.lab:18080/catalog',
      approvedOrigins: [
        'http://allowed.lab:18080',
        'http://allowed.lab:18082',
        'https://allowed.lab:18443',
        'https://allowed.lab:18444',
      ],
      allowedPaths: ['/'],
      excludedPaths: ['/excluded'],
      permittedMethods: ['GET', 'HEAD'],
      environment: 'lab',
      authorizationEvidenceRef: 'approval:owned-gateway-receiver',
      authorizationConfirmed: true,
      policyId: policy.id,
      policyRevision: policy.revision,
      schedule: { enabled: false, timezone: 'UTC' },
      scanLimits: limits,
      authProfileIds: [],
    });
    expect(createdTarget.status).toBe(201);
    let target = createdTarget.data as unknown as Target;
    const createdProfile = await lab.request(
      `/api/targets/${target.id}/profiles`,
      'POST',
      { kind: 'public', role: 'public', name: 'Public gateway' },
      target.revision,
    );
    expect(createdProfile.status).toBe(201);
    const profile = createdProfile.data as unknown as Profile;
    target = (await lab.request(`/api/targets/${target.id}`)).data as unknown as Target;
    const domain = new DomainStore(lab.settings.databaseUrl),
      store = new DiscoveryStore(lab.settings.databaseUrl);
    await store.initialize();
    registerLabCleanup(async () => {
      await store.close();
      domain.close();
    });
    const service = new ControlPlane(domain, new CredentialVault(lab.settings.SCANNER_ENCRYPTION_KEY));
    const request = {
      targetRevision: target.revision,
      policyRevision: policy.revision,
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
    const context = await domain.write(transaction =>
      service.scanContext('local-operator', target.id, request, transaction),
    );
    const resources = new ScanResources(lab.settings, store, randomUUID());
    registerLabCleanup(async () => {
      expect(await resources.cleanup()).toBe(true);
    });
    const guard = new SecretGuard([]);
    registerLabCleanup(async () => {
      guard.clear();
    });
    const session = await openGateway(
      resources,
      context,
      lab.images,
      lab.boundary,
      AbortSignal.timeout(120000),
      guard,
      () => {},
    );
    await stageFiles(session.container, {
      'wire.py': { bytes: await readFile(join(lab.settings.root, 'tests/lab/wire.py')) },
      'policy.py': { bytes: await readFile(join(lab.settings.root, 'docker/gateway/policy.py')) },
      'gateway_policy_test.py': { bytes: await readFile(join(lab.settings.root, 'tests/gateway_policy_test.py')) },
    });
    const units = await control(session.container, ['python', '/workspace/gateway_policy_test.py'], 10000);
    if (!units.success) {
      const locations = [
        ...units.stderr.matchAll(/File "\/workspace\/(policy\.py|gateway_policy_test\.py)", line (\d+)/g),
      ].map(match => `${match[1] === 'policy.py' ? 'POLICY' : 'TEST'}_${match[2]}`);
      throw new Error(`GATEWAY_UNIT_FAILED_${locations.join('_') || 'NO_SOURCE'}`);
    }

    const parser = new DiscoveryParser(context.target, profile, 'http', guard, () => {});
    /** Run the named wire scenario inside the owned gateway test container. */
    const wire = async (name: string) => {
      const result = await control(session.container, ['python', '/workspace/wire.py', session.ip, name], 6000);
      expect(result.success).toBe(true);
      const observed = wireSchema.parse(JSON.parse(result.stdout));
      if (observed.record) parser.feed('stdout', JSON.stringify(observed.record) + '\n');
      return observed;
    };
    const before = await lab.stats();
    const first = await wire('first-denied-origin');
    expect(first.status).toBe(403);
    expect(first.policyDenied).toBe(true);
    expect(first.upstreamObserved).toBe(false);
    const firstState = await gatewayState(session.container, guard);
    expect(firstState.counts['fresh-dns-lookups'] ?? 0).toBe(0);
    expect(firstState.counts['numeric-pins'] ?? 0).toBe(0);
    expect((await lab.stats())['tcp-18081'] ?? 0).toBe(before['tcp-18081'] ?? 0);
    expect((await lab.stats())['http-18081'] ?? 0).toBe(before['http-18081'] ?? 0);
    const tunnel = await wire('raw-connect');
    expect(tunnel.status).toBe(200);
    expect(tunnel.upstreamObserved).toBe(false);
    expect(tunnel.record).toBeNull();
    const afterTunnel = await lab.stats();
    expect(afterTunnel['tcp-18443'] ?? 0).toBe(before['tcp-18443'] ?? 0);
    expect(afterTunnel['tls-attempt-18443'] ?? 0).toBe(before['tls-attempt-18443'] ?? 0);
    expect((await gatewayState(session.container, guard)).counts['numeric-pins'] ?? 0).toBe(0);
    for (const name of [
      'double-slash',
      'triple-slash',
      'encoded-double-slash',
      'semicolon',
      'encoded-semicolon',
      'websocket',
      'write',
      'host-mismatch',
    ]) {
      const denied = await wire(name);
      expect(denied.status).toBe(403);
      expect(denied.policyDenied).toBe(true);
      expect(denied.upstreamObserved).toBe(false);
    }
    const denied = await lab.stats();
    expect(denied['tcp-18080'] ?? 0).toBe(before['tcp-18080'] ?? 0);
    expect(denied['http-18080'] ?? 0).toBe(before['http-18080'] ?? 0);
    expect(denied['excluded-contacts'] ?? 0).toBe(0);
    expect(denied['write-contacts'] ?? 0).toBe(0);
    for (const name of ['clean', 'clean-json']) {
      const accepted = await wire(name);
      expect(accepted.status).toBe(200);
      expect(accepted.policyDenied).toBe(false);
      expect(accepted.upstreamObserved).toBe(true);
    }
    const upstream403 = await wire('upstream-forbidden');
    expect(upstream403.status).toBe(403);
    expect(upstream403.upstreamObserved).toBe(true);
    expect(upstream403.policyDenied).toBe(false);
    const invalid = await wire('tls-invalid');
    expect(invalid.upstreamObserved).toBe(false);
    const invalidReceiver = await lab.stats();
    expect(invalidReceiver['tls-attempt-18444'] ?? 0).toBeGreaterThan(0);
    expect(invalidReceiver['http-18444'] ?? 0).toBe(0);
    const valid = await wire('tls-valid');
    expect(valid.status).toBe(200);
    expect(valid.upstreamObserved).toBe(true);
    expect((await lab.stats())['http-18443'] ?? 0).toBeGreaterThan(0);
    const exported = parser.finish();
    expect(exported.partial).toBe(true);
    expect(exported.counters.policyDenied).toBe(9);
    expect(exported.counters.upstreamUnverified).toBe(1);
    expect(exported.observations.some(item => item.status === 502 || item.path.includes('excluded'))).toBe(false);
    expect(exported.observations.find(item => item.path === '/admin')).toMatchObject({
      status: 403,
      provenance: 'upstream-response',
    });
    expect(exported.observations.find(item => item.origin === 'https://allowed.lab:18444')?.status).toBeUndefined();
    const disconnects = await control(
      session.container,
      ['python', '/workspace/wire.py', session.ip, 'disconnect-neighbors'],
      30000,
    );
    if (!disconnects.success) {
      const line =
        disconnects.stderr
          .match(/File "\/workspace\/wire.py", line (\d+)/g)
          ?.at(-1)
          ?.match(/line (\d+)/)?.[1] ?? 'UNKNOWN';
      throw new Error(`GATEWAY_DISCONNECT_LINE_${line}`);
    }
    expect(JSON.parse(disconnects.stdout)).toEqual({
      repetitions: 20,
      remainingRequestDelta: 60,
      active: 0,
      exhausted: false,
      openingCancellationObserved: true,
    });
  }, 240000);
});
