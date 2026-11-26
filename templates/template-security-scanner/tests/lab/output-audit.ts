import { auditImageArchive, compressedLayerCanary, secretScanner } from './image-audit.js';
import { createClient } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { expect, vi } from 'vitest';
import { SecretGuard } from '../../src/discovery/parser.js';
import {
  ownerIdentity,
  buildLocalImage,
  releaseImage,
  ownedImageChain,
  releaseOwnedImageIds,
} from '../../src/runtime/docker.js';
import { sandboxOptions } from '../../src/runtime/sandbox.js';
import { privateNativeSandbox } from '../../src/discovery/native.js';
import { control, stageFiles } from '../../src/discovery/io.js';
import { startDiscoveryLab, discoveryCase, type DiscoveryLab } from './harness.js';
import { modelWire } from './investigation.js';
import { categoryMatrix, runMatrixVariant } from './operations-matrix.js';

function auditSecrets(lab: DiscoveryLab) {
  return [
    ...Object.values(lab.privateValues),
    lab.bootstrapSecret,
    lab.settings.SCANNER_ENCRYPTION_KEY!,
    'synthetic-operations-provider-key',
  ];
}

/** Inspect the owned lab images for credential leakage and return measured audit results. */
async function imageAudit(lab: DiscoveryLab, images: string[]) {
  const measurements = [];
  for (const id of images) {
    const image = lab.client.getImage(id),
      inspected = await image.inspect();
    secretScanner(auditSecrets(lab))(
      Buffer.from(JSON.stringify({ inspection: inspected, history: await image.history() })),
    );
    const archive = await auditImageArchive((await image.get()) as Readable, auditSecrets(lab));
    measurements.push({ imageId: id, imageSizeBytes: inspected.Size, ...archive });
  }
  return measurements;
}
/** Inspect application persistence for forbidden credential representations. */
async function persistenceAudit(lab: DiscoveryLab, guard: SecretGuard) {
  const inspected = [];
  for (const url of [lab.settings.databaseUrl, `file:${lab.settings.mastraDatabasePath}`]) {
    const database = createClient({ url });
    try {
      const tables = await database.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT GLOB 'sqlite_*'",
      );
      expect(tables.rows.length).toBeGreaterThan(0);
      for (const table of tables.rows) {
        const name = String(table.name);
        if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error('TABLE_NAME_UNSAFE');
        const rows = await database.execute(`SELECT * FROM "${name}" LIMIT 1001`);
        expect(rows.rows.length).toBeLessThanOrEqual(1000);
        const serialized = JSON.stringify(rows.rows);
        expect(Buffer.byteLength(serialized)).toBeLessThan(8388608);
        expect(guard.unsafe(serialized)).toBe(false);
        inspected.push({ native: url.includes('-mastra.db'), table: name, rows: rows.rows.length });
      }
    } finally {
      database.close();
    }
  }
  return inspected;
}
async function nativeRetentionAudit(lab: DiscoveryLab, guard: SecretGuard) {
  const receipt = await buildLocalImage(lab.settings);
  const sandbox = await privateNativeSandbox(
    lab.client,
    sandboxOptions(lab.settings, receipt, `security-scanner-audit-${randomUUID()}`),
  );
  let privateBytes = 0;
  try {
    await stageFiles(sandbox.container, { 'audit-private': { bytes: Buffer.from(lab.privateValues.viewer) } });
    const result = await sandbox.executeCommand('cat', ['/workspace/audit-private'], {
      maxRetainedBytes: 0,
      timeout: 5000,
      onStdout: chunk => {
        privateBytes += Buffer.byteLength(chunk);
      },
    });
    expect(result.success).toBe(true);
    expect(privateBytes).toBe(Buffer.byteLength(lab.privateValues.viewer));
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
    expect(guard.unsafe(JSON.stringify(result))).toBe(false);
    expect((await sandbox.container.inspect()).HostConfig.LogConfig?.Type).toBe('none');
    return { privateBytes, retainedBytes: 0 };
  } finally {
    await sandbox.destroy();
    await releaseImage(lab.settings, receipt);
  }
}

/** Exercise model, telemetry, persistence and image output boundaries in the owned lab. */
async function outputAndTelemetryAuditRun() {
  const wire = await modelWire({
    category: 'information_exposure',
    path: '/owned/exposure/vulnerable',
    interpretation: 'CONFIRMED',
  });
  const lab = await startDiscoveryLab({ investigationModels: wire.models });
  const guard = new SecretGuard(auditSecrets(lab));
  const logs: string[] = [];
  const spies = ['log', 'warn', 'error', 'debug', 'info'].map(method =>
    vi.spyOn(console, method as 'log').mockImplementation((...args) => {
      const value = args.map(item => (typeof item === 'string' ? item : JSON.stringify(item))).join(' ');
      if (logs.join('').length + value.length > 8388608) throw new Error('ORDINARY_LOG_BOUND');
      logs.push(value);
    }),
  );
  const holds = new Map<string, ReturnType<typeof lab.client.getContainer>>();
  /** Keep one real container consumer alive for each selected image during the audit. */
  const holdImage = async (id: string) => {
    if (holds.has(id)) return;
    const holder = await lab.client.createContainer({
      name: `image-audit-${randomUUID()}`,
      Image: id,
      Entrypoint: [],
      Cmd: ['sleep', 'infinity'],
      User: '10001:10001',
      Labels: { 'scanner-test-image-audit': 'true', 'dev.mastra.security-scanner.owner': ownerIdentity(lab.settings) },
      HostConfig: {
        NetworkMode: 'none',
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges:true'],
        Memory: 67108864,
        MemorySwap: 67108864,
        PidsLimit: 32,
        LogConfig: { Type: 'none', Config: {} },
      },
    });
    holds.set(id, holder);
    await holder.start();
  };
  await holdImage(lab.images.gateway);
  await holdImage(lab.images.firewall);
  const observed = new Set<string>();
  const processClasses = new Set<string>();
  const peaks = new Map<string, number | null>();
  let stopped = false;
  const watch = (async () => {
    while (!stopped) {
      const containers = await lab.client.listContainers({
        filters: { label: [`dev.mastra.security-scanner.owner=${ownerIdentity(lab.settings)}`] },
      });
      for (const row of containers) {
        const container = lab.client.getContainer(row.Id);
        try {
          const inspected = await container.inspect();
          if (!inspected.Config.Labels?.['dev.mastra.security-scanner.scan']) continue;
          await holdImage(inspected.Image);
          expect(guard.unsafe(JSON.stringify({ argv: inspected.Args, config: inspected.Config }))).toBe(false);
          expect(inspected.HostConfig.LogConfig?.Type).toBe('none');
          observed.add(row.Id);
          const kind =
            inspected.Config.Labels?.['mastra.sandbox'] === 'true'
              ? 'native'
              : inspected.Config.Cmd?.[0] === 'mitmdump'
                ? 'gateway'
                : 'other';
          processClasses.add(kind);
          const processes = await container.top({ ps_args: '-eo pid,args' });
          expect(guard.unsafe(JSON.stringify(processes))).toBe(false);
          const peak = await control(container, ['cat', '/sys/fs/cgroup/memory.peak'], 2000);
          const value = peak.success && /^\d+\s*$/.test(peak.stdout) ? Number(peak.stdout) : null;
          peaks.set(row.Id, value === null ? (peaks.get(row.Id) ?? null) : Math.max(value, peaks.get(row.Id) ?? 0));
        } catch (error) {
          if (
            (error as { statusCode?: number }).statusCode !== 404 &&
            (error as { statusCode?: number }).statusCode !== 409
          )
            throw error;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  })();
  // Attach a rejection handler immediately; failures remain fatal when awaited.
  void watch.catch(() => {});
  try {
    const selected = await discoveryCase(lab, { authenticated: true, path: '/start' });
    const admitted = await selected.admit();
    expect(admitted.status).toBe(202);
    const scan = await lab.wait(String(admitted.data.id));
    expect(scan.state).toBe('COMPLETED_WITH_ERRORS');
    expect(scan.roles.some(role => role.counters.withheld > 0)).toBe(true);
    expect(scan.roles.reduce((total, role) => total + role.counters.rawCredentialOccurrences, 0)).toBeGreaterThan(0);
    const inventory = (await lab.request(`/api/scans/${scan.id}/inventory?limit=100`)).data.items as unknown[];
    expect(inventory.length).toBeGreaterThan(0);
    expect(scan.roles.every(role => role.counters.bytes <= 262144 && role.counters.stderrBytes <= 262144)).toBe(true);
    const record = await runMatrixVariant(
      lab,
      wire,
      categoryMatrix.find(item => item.category === 'information_exposure')!,
      'vulnerable',
      1,
    );
    expect(record.outcome).toBe('CONFIRMED');
    for (const path of [
      '/api/findings',
      '/api/evaluations',
      '/api/agents',
      '/api/settings',
      '/api/runtime',
      '/api/operations',
      '/native/agents',
      '/native/workflows',
      '/native/openapi.json',
    ]) {
      expect((await lab.request(path)).status).toBe(200);
    }
    expect((await lab.request('/native/agents/nemo/generate', 'POST', { messages: [] })).status).toBe(403);
    expect(
      guard.unsafe(
        JSON.stringify({
          exported: lab.exported,
          modelWire: wire.received,
          jsonl: inventory.map(item => JSON.stringify(item)).join('\n'),
        }),
      ),
    ).toBe(false);
    const tables = await persistenceAudit(lab, guard);
    const privateChannel = await nativeRetentionAudit(lab, guard);
    stopped = true;
    await watch;
    expect(observed.size).toBeGreaterThan(0);
    expect(processClasses.has('native')).toBe(true);
    expect(processClasses.has('gateway')).toBe(true);
    await compressedLayerCanary();
    await lab.stop();
    const images = await imageAudit(lab, [...holds.keys()]);
    expect(guard.unsafe(logs.join('\n'))).toBe(false);
    return {
      provenance: 'deterministic-local-wire-fixture',
      containersInspected: observed.size,
      memoryPeak: [...observed].map(containerId => ({
        containerId,
        observedPeakBytes: peaks.get(containerId) ?? null,
        source: (peaks.get(containerId) ?? null) === null ? 'unavailable' : 'cgroup-v2-memory.peak',
      })),
      images,
      privateChannel,
      tables,
      liveQuality: null,
      liveCostUsd: null,
    };
  } finally {
    stopped = true;
    try {
      await watch;
    } finally {
      for (const holder of holds.values()) await holder.remove({ force: true, v: true });
      for (const id of holds.keys()) {
        const image = await lab.client.getImage(id).inspect();
        expect(image.Config.Labels?.['dev.mastra.security-scanner.owner']).toBe(ownerIdentity(lab.settings));
        if (!(await lab.client.listContainers({ all: true, filters: { ancestor: [id] } })).length)
          await releaseOwnedImageIds(
            lab.settings,
            await ownedImageChain(lab.settings, id, image.Config.Labels!['dev.mastra.security-scanner.input']!),
            image.Config.Labels!['dev.mastra.security-scanner.input']!,
          );
      }
      for (const spy of spies) spy.mockRestore();
      guard.clear();
    }
  }
}

export async function outputAndTelemetryAudit() {
  vi.stubEnv('MORPH_API_KEY', 'synthetic-operations-provider-key');
  try {
    return await outputAndTelemetryAuditRun();
  } finally {
    vi.unstubAllEnvs();
  }
}
