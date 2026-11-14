import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { diagnostic, loadSettings, morphModelConfiguration, morphModelDescriptor } from '../src/config/settings.js';
import { scheduleSchema } from '../src/investigation/contracts.js';
import { nextOccurrence } from '../src/investigation/schedule.js';
import { parseBrowserSandboxStatus } from '../src/runtime/browser.js';
import {
  inspectAppliedPolicy,
  loadSandboxPolicy,
  policyDigest,
  SECCOMP_POLICY_SHA256,
} from '../src/runtime/seccomp.js';

describe('local runtime configuration', () => {
  it('uses finite native Docker settings and exposes only safe Morph model descriptors', () => {
    const settings = loadSettings({}, '/tmp/scanner-settings');
    expect(settings.SANDBOX_MEMORY_MIB).toBe(1024);
    expect(settings.SANDBOX_PIDS).toBe(256);
    expect(settings.COMMAND_TIMEOUT_MS).toBe(20000);
    expect(settings.OUTPUT_LIMIT_BYTES).toBe(8192);
    expect(settings.DOCKER_RETAIN_SHARED_BASE_IMAGE).toBe(false);
    expect(settings.databaseUrl).toBe('file:/tmp/scanner-settings/data/security-scanner.db');
    expect(settings.mastraDatabaseUrl).toBe('file:/tmp/scanner-settings/data/security-scanner-mastra.db');
    expect(morphModelDescriptor(settings)).toEqual({
      explorer: {
        providerId: 'morph',
        modelId: 'morph-dsv41flash-abliterated',
        url: 'https://api.morphllm.com/v1',
        api: 'chat',
      },
      judge: { providerId: 'morph', modelId: 'morph-glm53-744b', url: 'https://api.morphllm.com/v1', api: 'chat' },
    });
    expect(() => morphModelConfiguration(settings, {})).toThrowError(
      expect.objectContaining({ code: 'MORPH_API_KEY_REQUIRED' }),
    );
    const syntheticKey = 'synthetic-test-key-only';
    const configured = morphModelConfiguration(settings, { MORPH_API_KEY: syntheticKey });
    expect(configured.explorer.apiKey).toBe(syntheticKey);
    expect(configured.judge.apiKey).toBe(syntheticKey);
    expect(JSON.stringify(morphModelDescriptor(settings))).not.toContain(syntheticKey);
  });

  it.each(['', 'morph/'])('accepts configurable Morph aliases with the %s namespace', prefix => {
    const settings = loadSettings({
      EXPLORER_MODEL: `${prefix}exploration-model-v2`,
      JUDGE_MODEL: `${prefix}review-model-v2`,
    });
    expect(morphModelDescriptor(settings)).toEqual({
      explorer: {
        providerId: 'morph',
        modelId: 'exploration-model-v2',
        url: 'https://api.morphllm.com/v1',
        api: 'chat',
      },
      judge: { providerId: 'morph', modelId: 'review-model-v2', url: 'https://api.morphllm.com/v1', api: 'chat' },
    });
  });

  it.each(['EXPLORER_MODEL', 'JUDGE_MODEL'])('rejects malformed %s aliases without exporting their values', field => {
    for (const value of [
      '',
      'morph/',
      'other/model',
      'https://private-marker.invalid',
      'a b',
      'a\nb',
      '../model',
      'a'.repeat(129),
    ]) {
      expect(() => loadSettings({ [field]: value })).toThrowError(
        expect.objectContaining({ code: 'INVALID_CONFIGURATION', message: `Check supported values for: ${field}.` }),
      );
    }
  });

  it.each(['America/Port-au-Prince', 'Etc/GMT+5', 'Etc/GMT-3', 'UTC', 'America/Argentina/Buenos_Aires'])(
    'accepts supported IANA timezone %s for advisory and recurrence schedules',
    timezone => {
      expect(loadSettings({ SCANNER_ADVISORY_SYNC_TIMEZONE: timezone }).SCANNER_ADVISORY_SYNC_TIMEZONE).toBe(timezone);
      expect(
        scheduleSchema.parse({
          targetId: '00000000-0000-4000-8000-000000000001',
          cron: '0 0 * * *',
          timezone,
          enabled: true,
        }).timezone,
      ).toBe(timezone);
    },
  );

  it.each(['Unknown/Timezone', 'Etc/GMT+25', 'America/Port au Prince', '+05:00'])(
    'rejects unsupported advisory timezone %s',
    timezone => {
      expect(() => loadSettings({ SCANNER_ADVISORY_SYNC_TIMEZONE: timezone })).toThrow('Check supported values');
    },
  );

  it.each(['0 0 30 2 *', '0 0 31 4 *', '0 0 29 2 *'])(
    'rejects unreachable fixed calendar schedule %s before scheduler startup',
    cron => {
      expect(() => loadSettings({ SCANNER_ADVISORY_SYNC_CRON: cron })).toThrow('Check supported values');
    },
  );

  it.each(['0 0 30 2 *', '0 0 31 4 *', '0 0 29 2 *'])(
    'rejects unreachable recurrence schedule %s before persistence',
    cron => {
      expect(
        scheduleSchema.safeParse({
          targetId: '00000000-0000-4000-8000-000000000001',
          cron,
          timezone: 'UTC',
          enabled: true,
        }).success,
      ).toBe(false);
    },
  );

  it('preserves neighboring dates and day/weekday OR fallback within the search horizon', () => {
    for (const cron of ['0 0 28 2 *', '0 0 30 4 *', '0 0 31 3 *', '0 0 30 2 1', '0 0 29 2 1']) {
      expect(loadSettings({ SCANNER_ADVISORY_SYNC_CRON: cron }).SCANNER_ADVISORY_SYNC_CRON).toBe(cron);
      expect(
        scheduleSchema.safeParse({
          targetId: '00000000-0000-4000-8000-000000000001',
          cron,
          timezone: 'UTC',
          enabled: true,
        }).success,
      ).toBe(true);
    }
    expect(nextOccurrence('0 0 30 2 1', 'UTC', new Date('2026-02-01T00:00:00Z')).toISOString()).toBe(
      '2026-02-02T00:00:00.000Z',
    );
    expect(nextOccurrence('0 0 29 2 1', 'UTC', new Date('2026-02-01T00:00:00Z')).toISOString()).toBe(
      '2026-02-02T00:00:00.000Z',
    );
    expect(nextOccurrence('0 0 28 2 *', 'UTC', new Date('2026-02-27T23:59:00Z')).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
  });

  it('rejects_operational_fence_aliases_before_creating_files_and_keeps_adjacent_names_valid', () => {
    const root = mkdtempSync(join(tmpdir(), 'scanner-reserved-database-'));
    const before = readdirSync(root);
    try {
      for (const stem of ['discovery-instance', 'Discovery-Instance', 'DISCOVERY-INSTANCE', 'dIsCoVeRy-InStAnCe']) {
        const configure = () => loadSettings({ DATABASE_URL: `file:./data/${stem}.db` }, root);
        expect(configure).toThrowError(expect.objectContaining({ code: 'INVALID_CONFIGURATION' }));
        try {
          configure();
        } catch (error) {
          expect(diagnostic(error)).toEqual({
            code: 'INVALID_CONFIGURATION',
            message: 'Check supported values for: DATABASE_URL.',
          });
        }
        expect(readdirSync(root)).toEqual(before);
      }
      for (const stem of [
        'discovery-instance-history',
        'discovery_instance',
        'discovery-instance-mastra',
        'discovery-instance2',
        'DISCOVERY-INSTANCE-HISTORY',
      ]) {
        const settings = loadSettings({ DATABASE_URL: `file:./data/${stem}.db` }, root);
        expect(settings.databasePath).toBe(join(root, 'data', `${stem}.db`));
        expect(settings.mastraDatabasePath).toBe(join(root, 'data', `${stem}-mastra.db`));
        expect(readdirSync(root)).toEqual(before);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['SANDBOX_DRIVER', 'cloud'],
    ['DISCOVERY_DRIVER', 'other'],
    ['QUEUE_DRIVER', 'remote'],
    ['STORAGE_DRIVER', 'postgres'],
    ['SANDBOX_MEMORY_MIB', '0'],
    ['SANDBOX_MEMORY_MIB', '2049'],
    ['SANDBOX_PIDS', '0'],
    ['COMMAND_TIMEOUT_MS', 'Infinity'],
    ['OUTPUT_LIMIT_BYTES', '65537'],
    ['DOCKER_REMOVE_SCAN_IMAGES', 'false'],
    ['DOCKER_PLATFORM', 'linux/386'],
    ['DOCKER_PLATFORM', 'linux/amd64'],
    ['DATABASE_URL', 'file:../../elsewhere.db'],
    ['DATABASE_URL', 'https://database.example'],
    ['DOCKER_DISCOVERY_IMAGE', 'arbitrary/image:latest'],
    ['PORT', '0'],
  ])('rejects unsupported %s before any runtime operation', (field, value) => {
    expect(() => loadSettings({ [field]: value })).toThrow('Check supported values');
  });

  it('does not repeat invalid secret-bearing values in operator diagnostics', () => {
    const marker = 'private-credential-marker';
    try {
      loadSettings({ DATABASE_URL: `https://operator:${marker}@database.example`, MORPH_API_KEY: marker });
    } catch (error) {
      expect(diagnostic(error)).toEqual({
        code: 'INVALID_CONFIGURATION',
        message: 'Check supported values for: DATABASE_URL.',
      });
      expect(JSON.stringify(diagnostic(error))).not.toContain(marker);
      return;
    }
    throw new Error('Expected configuration rejection');
  });
});

describe('browser isolation contracts', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const status = readFileSync(new URL('./fixtures/chromium-sandbox-status.html', import.meta.url), 'utf8');

  it('accepts the browser-reported namespace and seccomp layers', () => {
    expect(parseBrowserSandboxStatus(status)).toEqual({
      layer1: 'namespace',
      pidNamespaces: true,
      networkNamespaces: true,
      seccompBpf: true,
      seccompTsync: true,
    });
  });

  it.each(['Layer 1 Sandbox', 'PID namespaces', 'Network namespaces', 'Seccomp-BPF sandbox'])(
    'rejects missing required status %s',
    label => {
      const missing = status.replace(new RegExp(`<tr>\\s*<td[^>]*>${label}<\\/td>[\\s\\S]*?<\\/tr>`, 'i'), '');
      expect(missing).not.toBe(status);
      expect(() => parseBrowserSandboxStatus(missing)).toThrow('Chromium must report');
    },
  );

  it.each(['PID namespaces', 'Network namespaces', 'Seccomp-BPF sandbox'])(
    'rejects a disabled required layer %s',
    label => {
      const disabled = status.replace(new RegExp(`(${label}<\\/td>\\s*<td[^>]*>)Yes`, 'i'), '$1No');
      expect(disabled).not.toBe(status);
      expect(() => parseBrowserSandboxStatus(disabled)).toThrow('Chromium must report');
    },
  );

  it('rejects unsupported, ambiguous and oversized browser status', () => {
    expect(() => parseBrowserSandboxStatus(status.replace('>Namespace<', '>Unknown<'))).toThrow('Chromium must report');
    expect(() =>
      parseBrowserSandboxStatus(status.replace('</table>', '<tr><td>PID namespaces</td><td>No</td></tr></table>')),
    ).toThrow('Chromium must report');
    expect(() => parseBrowserSandboxStatus('<html>ready</html>')).toThrow('Chromium must report');
    expect(() => parseBrowserSandboxStatus(`${' '.repeat(65537)}${status}`)).toThrow('Chromium must report');
  });

  it('preserves every pinned upstream rule and appends only the four namespace syscalls', () => {
    const policy = loadSandboxPolicy({ root });
    const provenance = JSON.parse(readFileSync(join(root, 'docker/discovery/seccomp.source.json'), 'utf8'));
    expect(policy.profile.syscalls.at(-1)).toEqual({
      names: ['clone', 'setns', 'unshare', 'chroot'],
      action: 'SCMP_ACT_ALLOW',
      args: [],
    });
    const upstream = { ...policy.profile, syscalls: policy.profile.syscalls.slice(0, -1) };
    expect(policyDigest(JSON.stringify(upstream))).toBe(provenance.upstreamJsonSha256);
    expect(policy.policySha256).toBe(provenance.distributedJsonSha256);
    const license = readFileSync(join(root, 'docker/discovery/LICENSE.moby-profiles'));
    expect(createHash('sha256').update(license).digest('hex')).toBe(provenance.licenseSha256);
    expect(inspectAppliedPolicy([`seccomp=${policy.serialized}`, 'no-new-privileges:true'])).toBe(
      SECCOMP_POLICY_SHA256,
    );
  });

  it.each([undefined, [], ['seccomp=unconfined'], ['seccomp={"defaultAction":"SCMP_ACT_ALLOW"}']])(
    'rejects an absent or different applied Docker policy',
    options => {
      expect(() => inspectAppliedPolicy(options)).toThrow('Docker did not apply');
    },
  );

  it('rejects modified bundled policy bytes before any sandbox is created', () => {
    const isolated = mkdtempSync(join(tmpdir(), 'scanner-policy-integrity-'));
    try {
      mkdirSync(join(isolated, 'docker/discovery'), { recursive: true });
      writeFileSync(join(isolated, 'docker/discovery/seccomp.json'), '{"defaultAction":"SCMP_ACT_ALLOW"}');
      expect(() => loadSandboxPolicy({ root: isolated })).toThrow('integrity check');
    } finally {
      rmSync(isolated, { recursive: true, force: true });
    }
  });
});
