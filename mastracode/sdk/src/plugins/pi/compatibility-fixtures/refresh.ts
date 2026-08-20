#!/usr/bin/env npx tsx

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PluginManager } from '../../manager.js';
import {
  getPiPackageCompatibilityStatus,
  PI_COMPATIBILITY_TARGET_VERSION,
  type PiCapabilitySupport,
  type PiPackageCompatibilityStatus,
} from '../compatibility.js';
import { characterizePiPackage, type PreparedPiPackageInspection } from '../package-intake.js';
import { inspectPiPackageManifest } from '../package-manifest.js';
import { resolvePiPackageSource } from '../package-resolver.js';
import { discoverPiPackageResources } from '../resource-discovery.js';

type ResourceManifest = Record<'extensions' | 'prompts' | 'skills' | 'themes', string[]>;

type ExpectedCharacterization =
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
  };
  characterization: ExpectedCharacterization;
}

interface NpmVersionMetadata {
  name?: string;
  version?: string;
  license?: string;
  gitHead?: string;
  repository?: string | { url?: string; directory?: string };
  dist?: { integrity?: string; tarball?: string; unpackedSize?: number; fileCount?: number };
}

interface EcosystemFixture {
  schemaVersion: number;
  targetApiVersion: string;
  refreshedAt: string;
  popularityWindow: { source: string; start: string; end: string };
  packages: EcosystemProfile[];
}

const arguments_ = process.argv.slice(2);
const characterize = arguments_.includes('--characterize');
const offline = arguments_.includes('--offline');
const packageFilter = arguments_.find(argument => argument.startsWith('--package='))?.slice('--package='.length);
const unknownArguments = arguments_.filter(
  argument =>
    argument !== '--verify' &&
    argument !== '--characterize' &&
    argument !== '--offline' &&
    !argument.startsWith('--package='),
);
if (!arguments_.includes('--verify'))
  throw new Error('Usage: refresh.ts --verify [--offline] [--characterize] [--package=name]');
if (unknownArguments.length > 0) throw new Error(`Unknown arguments: ${unknownArguments.join(', ')}`);
if (offline && characterize) throw new Error('--offline cannot execute package characterization.');
if (characterize && process.env.MC_PI_ECOSYSTEM_TRUST_CODE !== '1') {
  throw new Error('Set MC_PI_ECOSYSTEM_TRUST_CODE=1 to execute trusted package factories during characterization.');
}

const fixturePath = fileURLToPath(new URL('./manifest.json', import.meta.url));
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as EcosystemFixture;
const profiles = packageFilter
  ? fixture.packages.filter(profile => profile.name === packageFilter || profile.specifier === packageFilter)
  : fixture.packages;
if (profiles.length === 0) throw new Error(`No ecosystem fixture matches ${packageFilter}`);

assertEqual(fixture.schemaVersion, 1, 'fixture schema version');
assertEqual(fixture.targetApiVersion, PI_COMPATIBILITY_TARGET_VERSION, 'target Pi API version');
if (!/^\d{4}-\d{2}-\d{2}$/.test(fixture.refreshedAt)) throw new Error('Fixture must record its observation date');
if (!fixture.popularityWindow.source.includes('{package}')) throw new Error('Popularity source must contain {package}');
for (const profile of profiles) {
  if (offline) verifyOfflineProfile(profile);
  else await verifyProfile(profile);
  const mode = offline ? ' offline' : characterize ? ' with characterization' : '';
  process.stdout.write(`verified ${profile.specifier}${mode}\n`);
}

function verifyOfflineProfile(profile: EcosystemProfile): void {
  assertEqual(profile.specifier, `npm:${profile.name}@${profile.version}`, `${profile.name} specifier`);
  if (!/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(profile.provenance.integrity)) {
    throw new Error(`${profile.name} does not pin SHA-512 npm integrity`);
  }
  if (!Object.hasOwn(profile.provenance, 'sourceCommit')) {
    throw new Error(`${profile.name} does not record source commit evidence`);
  }
  if (profile.provenance.sourceCommit === null) {
    if (profile.provenance.sourceCommitEvidence !== 'npm metadata omits gitHead') {
      throw new Error(`${profile.name} must explain missing npm commit provenance`);
    }
  } else if (!/^[a-f0-9]{40}$/.test(profile.provenance.sourceCommit)) {
    throw new Error(`${profile.name} records an invalid source commit`);
  }
  if (!Number.isSafeInteger(profile.provenance.downloadsInWindow) || profile.provenance.downloadsInWindow < 0) {
    throw new Error(`${profile.name} does not record valid popularity evidence`);
  }
  if (profile.characterization.outcome === 'rejected') {
    if (!profile.characterization.errorMatch || !profile.characterization.diagnostic) {
      throw new Error(`${profile.name} rejected boundary lacks an attributed diagnostic`);
    }
    return;
  }
  const capabilities = Object.entries(profile.characterization.capabilities).map(([name, support]) => ({
    name,
    support,
    evidence: [],
    diagnostics: [],
  }));
  assertEqual(
    getPiPackageCompatibilityStatus(capabilities),
    profile.characterization.status,
    `${profile.name} compatibility status`,
  );
}

async function verifyProfile(profile: EcosystemProfile): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-ecosystem-refresh-'));
  let prepared: PreparedPiPackageInspection | undefined;
  let sourceRoot: string | undefined;
  try {
    const options = { projectRoot: path.join(root, 'project'), homeDir: path.join(root, 'home') };
    fs.mkdirSync(options.projectRoot, { recursive: true });
    const metadataUrl = `https://registry.npmjs.org/${encodeURIComponent(profile.name)}/${profile.version}`;
    const metadataResponse = await fetch(metadataUrl);
    if (!metadataResponse.ok) throw new Error(`${profile.name} npm metadata lookup failed: ${metadataResponse.status}`);
    const metadata = (await metadataResponse.json()) as NpmVersionMetadata;
    verifyNpmMetadata(profile, metadata);

    const resolved = await resolvePiPackageSource(profile.specifier, 'global', options);
    sourceRoot = resolved.resolution.sourceRoot;
    assertEqual(resolved.resolution.integrity, profile.provenance.integrity, `${profile.name} integrity`);
    const popularityUrl = fixture.popularityWindow.source.replace('{package}', encodeURIComponent(profile.name));
    const popularityResponse = await fetch(popularityUrl);
    if (!popularityResponse.ok)
      throw new Error(`${profile.name} popularity lookup failed: ${popularityResponse.status}`);
    const popularity = (await popularityResponse.json()) as { downloads?: number; start?: string; end?: string };
    assertEqual(popularity.start, fixture.popularityWindow.start, `${profile.name} popularity start`);
    assertEqual(popularity.end, fixture.popularityWindow.end, `${profile.name} popularity end`);
    assertEqual(popularity.downloads, profile.provenance.downloadsInWindow, `${profile.name} downloads`);

    const manifest = inspectPiPackageManifest(resolved.resolution.packageRoot);
    assertEqual(manifest.name, profile.name, `${profile.name} manifest name`);
    assertEqual(manifest.version, profile.version, `${profile.name} manifest version`);
    assertEqual(
      manifest.observedApiVersion ?? '*',
      profile.manifest.observedApiVersion,
      `${profile.name} Pi API range`,
    );
    assertEqual(manifest.packageManager, profile.manifest.packageManager, `${profile.name} package manager`);
    assertJsonEqual(manifest.lifecycleScripts, profile.manifest.lifecycleScripts, `${profile.name} lifecycle scripts`);

    let resources: ResourceManifest;
    try {
      resources = discoverPiPackageResources(manifest);
    } catch (error) {
      if (profile.characterization.outcome !== 'rejected' || profile.characterization.stage !== 'inspection')
        throw error;
      assertErrorMatch(error, profile.characterization.errorMatch, profile.name);
      return;
    }
    if (!profile.manifest.resources) throw new Error(`${profile.name} fixture must record discovered resources`);
    assertJsonEqual(resources, profile.manifest.resources, `${profile.name} resources`);
    prepared = { ...resolved, manifest, resources };

    if (!characterize) return;
    if (profile.characterization.outcome === 'rejected') {
      try {
        await characterizePiPackage(prepared, { trustCodeExecution: true, installScripts: 'deny' });
      } catch (error) {
        assertErrorMatch(error, profile.characterization.errorMatch, profile.name);
        return;
      }
      throw new Error(`${profile.name} unexpectedly characterized successfully`);
    }

    const characterized = await characterizePiPackage(prepared, {
      trustCodeExecution: true,
      installScripts: 'deny',
    });
    assertEqual(characterized.compatibility.status, profile.characterization.status, `${profile.name} status`);
    const capabilities = Object.fromEntries(
      characterized.compatibility.capabilities
        .map(capability => [capability.name, capability.support] as const)
        .sort(([a], [b]) => a.localeCompare(b)),
    );
    const expectedCapabilities = Object.fromEntries(
      Object.entries(profile.characterization.capabilities).sort(([a], [b]) => a.localeCompare(b)),
    );
    assertJsonEqual(capabilities, expectedCapabilities, `${profile.name} capabilities`);

    const manager = new PluginManager(options);
    try {
      await manager.installPiPackage(characterized, { confirmEnable: true });
      if (manager.getPiGenerations().length === 0) throw new Error(`${profile.name} published no Pi generation`);
      const toolNames = Object.keys(manager.getPluginTools());
      await manager.setEnabled(profile.name, 'global', false);
      assertJsonEqual(manager.getPiGenerations(), [], `${profile.name} retired generations`);
      assertJsonEqual(Object.keys(manager.getPluginTools()), [], `${profile.name} retired tools`);
      assertJsonEqual(manager.getPiCommands(), [], `${profile.name} retired commands`);
      assertJsonEqual(manager.getPluginSkillPaths(), [], `${profile.name} retired skills`);
      assertJsonEqual(manager.getPluginCommandPaths(), [], `${profile.name} retired command resources`);
      assertJsonEqual(manager.getPluginInstructions(), [], `${profile.name} retired instructions`);
      assertJsonEqual(manager.getPluginProcessors(), { input: [], output: [] }, `${profile.name} retired processors`);
      assertJsonEqual(manager.getPluginSignalProviders(), [], `${profile.name} retired signal providers`);
      for (const toolName of toolNames) {
        assertEqual(manager.getToolRenderConfig(toolName), undefined, `${profile.name} retired ${toolName} renderer`);
      }
      await manager.uninstall(profile.name, 'global');
      if (fs.existsSync(characterized.resolution.sourceRoot) || fs.existsSync(characterized.resolution.packageRoot)) {
        throw new Error(`${profile.name} retained owned package roots after uninstall`);
      }
    } finally {
      await manager.dispose();
    }
  } finally {
    if (sourceRoot) fs.rmSync(sourceRoot, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function verifyNpmMetadata(profile: EcosystemProfile, metadata: NpmVersionMetadata): void {
  assertEqual(metadata.name, profile.name, `${profile.name} npm name`);
  assertEqual(metadata.version, profile.version, `${profile.name} npm version`);
  assertEqual(metadata.dist?.integrity, profile.provenance.integrity, `${profile.name} npm integrity`);
  assertEqual(metadata.dist?.tarball, profile.provenance.tarball, `${profile.name} npm tarball`);
  assertEqual(metadata.dist?.unpackedSize, profile.provenance.unpackedSize, `${profile.name} unpacked size`);
  assertEqual(metadata.dist?.fileCount, profile.provenance.fileCount, `${profile.name} file count`);
  assertEqual(metadata.license, profile.provenance.license, `${profile.name} license`);
  assertEqual(normalizeRepository(metadata.repository), profile.provenance.repository, `${profile.name} repository`);
  assertEqual(metadata.gitHead ?? null, profile.provenance.sourceCommit, `${profile.name} source commit`);
}

function normalizeRepository(repository: NpmVersionMetadata['repository']): string | undefined {
  if (!repository) return undefined;
  const rawUrl = typeof repository === 'string' ? repository : repository.url;
  if (!rawUrl) return undefined;
  let url = rawUrl.replace(/^git\+/, '');
  url = url.replace(/^git:\/\/github\.com\//, 'https://github.com/');
  url = url.replace(/^ssh:\/\/git@github\.com\//, 'https://github.com/');
  url = url.replace(/^git@github\.com:/, 'https://github.com/');
  const directory = typeof repository === 'string' ? undefined : repository.directory;
  return directory ? `${url}#${directory}` : url;
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected)
    throw new Error(`${label} changed: expected ${String(expected)}, received ${String(actual)}`);
}

function assertJsonEqual(actual: unknown, expected: unknown, label: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson)
    throw new Error(`${label} changed: expected ${expectedJson}, received ${actualJson}`);
}

function assertErrorMatch(error: unknown, expected: string, label: string): void {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.includes(expected)) throw new Error(`${label} failed with an unexpected diagnostic: ${message}`);
}
