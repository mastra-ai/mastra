import { describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { diagnostic, loadSettings, morphModelConfiguration } from '../src/config/settings.js';
import { parseBrowserSandboxStatus } from '../src/runtime/browser.js';
import {
  inspectAppliedPolicy,
  loadSandboxPolicy,
  policyDigest,
  SECCOMP_POLICY_SHA256,
} from '../src/runtime/seccomp.js';

describe('local runtime configuration', () => {
  it('uses finite native Docker settings and explicit Morph models without resolving credentials', () => {
    const settings = loadSettings({}, '/tmp/scanner-settings');
    expect(settings.SANDBOX_MEMORY_MIB).toBe(1024);
    expect(settings.SANDBOX_PIDS).toBe(256);
    expect(settings.COMMAND_TIMEOUT_MS).toBe(20000);
    expect(settings.OUTPUT_LIMIT_BYTES).toBe(8192);
    expect(settings.DOCKER_RETAIN_SHARED_BASE_IMAGE).toBe(false);
    expect(settings.databaseUrl).toBe('file:/tmp/scanner-settings/data/security-scanner.db');
    expect(morphModelConfiguration(settings)).toEqual({
      explorer: {
        providerId: 'morph',
        modelId: 'morph-dsv41flash-abliterated',
        url: 'https://api.morphllm.com/v1',
        api: 'chat',
      },
      judge: { providerId: 'morph', modelId: 'morph-glm53-744b', url: 'https://api.morphllm.com/v1', api: 'chat' },
    });
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
    ['DATABASE_URL', 'file:../../elsewhere.db'],
    ['DATABASE_URL', 'https://database.example'],
    ['DOCKER_DISCOVERY_IMAGE', 'arbitrary/image:latest'],
    ['EXPLORER_MODEL', 'other-model'],
    ['JUDGE_MODEL', 'morph/other-model'],
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
