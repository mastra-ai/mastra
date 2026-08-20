import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  getPiCapabilitySupport,
  getPiPackageCompatibilityStatus,
  PI_COMPATIBILITY_TARGET_VERSION,
  type PiCapabilitySupport,
  type PiPackageCompatibilityStatus,
} from '../compatibility.js';

type ResourceManifest = Record<'extensions' | 'prompts' | 'skills' | 'themes', string[]>;

type EcosystemCharacterization =
  | {
      outcome: 'report';
      status: PiPackageCompatibilityStatus;
      capabilities: Record<string, PiCapabilitySupport>;
      diagnostics: string[];
    }
  | { outcome: 'rejected'; stage: 'factory' | 'inspection'; diagnostic: string; errorMatch: string };

interface EcosystemProfile {
  name: string;
  version: string;
  specifier: string;
  provenance: {
    integrity: string;
    tarball: string;
    repository: string;
    sourceCommit: string | null;
    sourceCommitEvidence?: string;
    license: string;
    unpackedSize: number;
    fileCount: number;
    downloadsInWindow: number;
  };
  manifest: {
    packageManager?: string;
    observedApiVersion: string;
    lifecycleScripts: Record<string, string>;
    resources?: ResourceManifest;
    declaredResources?: Partial<ResourceManifest>;
  };
  characterization: EcosystemCharacterization;
  coverage: string[];
  credential?: { envVar: string; provider: string; requiredFor: 'live-provider-proof' };
}

interface EcosystemFixture {
  schemaVersion: number;
  targetApiVersion: string;
  refreshedAt: string;
  popularityWindow: { source: string; start: string; end: string };
  packages: EcosystemProfile[];
}

const fixturePath = fileURLToPath(new URL('../compatibility-fixtures/manifest.json', import.meta.url));
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as EcosystemFixture;

describe('Pi ecosystem characterization fixtures', () => {
  it('pins the approved package matrix to immutable public provenance', () => {
    expect(fixture).toMatchObject({
      schemaVersion: 1,
      targetApiVersion: PI_COMPATIBILITY_TARGET_VERSION,
      refreshedAt: '2026-08-20',
      popularityWindow: { start: '2026-07-21', end: '2026-08-19' },
    });
    expect(fixture.packages).toHaveLength(13);
    expect(new Set(fixture.packages.map(profile => profile.name)).size).toBe(fixture.packages.length);

    for (const profile of fixture.packages) {
      expect(profile.specifier).toBe(`npm:${profile.name}@${profile.version}`);
      expect(profile.provenance.integrity).toMatch(/^sha512-[A-Za-z0-9+/]+={0,2}$/);
      expect(profile.provenance.tarball).toMatch(/^https:\/\/registry\.npmjs\.org\//);
      expect(profile.provenance.repository).toMatch(/^https:\/\/github\.com\//);
      expect(profile.provenance.unpackedSize).toBeGreaterThan(0);
      expect(profile.provenance.fileCount).toBeGreaterThan(0);
      expect(profile.provenance.downloadsInWindow).toBeGreaterThanOrEqual(0);
      if (profile.provenance.sourceCommit) expect(profile.provenance.sourceCommit).toMatch(/^[a-f0-9]{40}$/);
      else expect(profile.provenance.sourceCommitEvidence).toBe('npm metadata omits gitHead');
      if (profile.manifest.packageManager) expect(profile.manifest.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+/);
    }
  });

  it('keeps compatibility reports consistent with the owned support matrix', () => {
    const outcomes = { compatible: 0, incompatible: 0, partial: 0, rejected: 0 };

    for (const profile of fixture.packages) {
      const characterization = profile.characterization;
      if (characterization.outcome === 'rejected') {
        outcomes.rejected++;
        expect(characterization.diagnostic).not.toHaveLength(0);
        continue;
      }

      if (characterization.status === 'pi-compatible') outcomes.compatible++;
      else if (characterization.status === 'pi-partial') outcomes.partial++;
      else outcomes.incompatible++;

      const capabilities = Object.entries(characterization.capabilities).map(([name, support]) => ({
        name,
        support,
        evidence: [],
        diagnostics: [],
      }));
      expect(getPiPackageCompatibilityStatus(capabilities)).toBe(characterization.status);
      for (const [name, support] of Object.entries(characterization.capabilities)) {
        if (name !== 'pi-api-version') expect(getPiCapabilitySupport(name)).toBe(support);
      }
      if (characterization.status !== 'pi-compatible') expect(characterization.diagnostics.length).toBeGreaterThan(0);
    }

    expect(outcomes).toEqual({ compatible: 2, partial: 6, incompatible: 1, rejected: 4 });
  });

  it('covers portable runtime, resource, provider, UI, and rejected ecosystem surfaces', () => {
    const coverage = new Set(fixture.packages.flatMap(profile => profile.coverage));
    for (const expected of [
      'abort',
      'commands',
      'credentialed-provider',
      'declarative-provider',
      'external-dependencies',
      'flags',
      'lifecycle-cleanup',
      'lifecycle-scripts',
      'message-renderers',
      'permissions',
      'progress',
      'prompts',
      'shortcuts',
      'skills',
      'state',
      'tree-events',
      'tui',
      'typebox-tools',
      'widgets',
    ]) {
      expect(coverage).toContain(expected);
    }
  });

  it('records credential references without storing credential values', () => {
    expect(fixture.packages.filter(profile => profile.credential).map(profile => profile.credential)).toEqual([
      { envVar: 'DEEPSEEK_API_KEY', provider: 'deepseek', requiredFor: 'live-provider-proof' },
      { envVar: 'XIAOMI_MIMO_API_KEY', provider: 'xiaomi-mimo', requiredFor: 'live-provider-proof' },
    ]);
    const serialized = fs.readFileSync(fixturePath, 'utf8');
    expect(serialized).not.toMatch(/(?:sk-|api[_-]?key["']?\s*[:=]\s*["'][^"']{8})/i);
    expect(serialized).not.toContain('/private/var/');
    expect(serialized).not.toContain('/tmp/');
  });
});
