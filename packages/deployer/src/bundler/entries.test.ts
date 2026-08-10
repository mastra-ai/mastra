import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MastraError } from '@mastra/core/error';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveExtraEntries } from './entries';

let mastraDir: string;
let mastraEntryFile: string;
const tempDirs: string[] = [];

beforeEach(async () => {
  mastraDir = await mkdtemp(join(tmpdir(), 'mastra-extra-entries-'));
  tempDirs.push(mastraDir);
  mastraEntryFile = join(mastraDir, 'index.ts');
  await writeFile(mastraEntryFile, 'export const mastra = {}');
  await writeFile(join(mastraDir, 'voice-worker.ts'), 'export default {}');
});

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

describe('resolveExtraEntries', () => {
  it('returns an empty map when no entries are configured', () => {
    expect(resolveExtraEntries(undefined, mastraEntryFile)).toEqual({});
    expect(resolveExtraEntries({}, mastraEntryFile)).toEqual({});
  });

  it('resolves paths relative to the mastra directory, not the cwd', () => {
    const resolved = resolveExtraEntries({ 'voice-worker': './voice-worker.ts' }, mastraEntryFile);

    expect(resolved).toEqual({ 'voice-worker': join(mastraDir, 'voice-worker.ts').replaceAll('\\', '/') });
  });

  it('accepts an absolute source path', () => {
    const absolute = join(mastraDir, 'voice-worker.ts');
    const resolved = resolveExtraEntries({ 'voice-worker': absolute }, mastraEntryFile);

    expect(resolved).toEqual({ 'voice-worker': absolute.replaceAll('\\', '/') });
  });

  it('allows a nested output name', () => {
    const resolved = resolveExtraEntries({ 'workers/voice': './voice-worker.ts' }, mastraEntryFile);

    expect(Object.keys(resolved)).toEqual(['workers/voice']);
  });

  it('preserves "__proto__" as an entry name', () => {
    const resolved = resolveExtraEntries({ ['__proto__']: './voice-worker.ts' }, mastraEntryFile);

    expect(Object.hasOwn(resolved, '__proto__')).toBe(true);
    expect(resolved['__proto__']).toBe(join(mastraDir, 'voice-worker.ts').replaceAll('\\', '/'));
  });

  it('rejects the reserved "index" name so it cannot clobber the server bundle', () => {
    expect(() => resolveExtraEntries({ index: './voice-worker.ts' }, mastraEntryFile)).toThrow(
      /reserved for the Mastra server/,
    );
  });

  it('rejects names reserved for tool bundles', () => {
    expect(() => resolveExtraEntries({ 'tools/mine': './voice-worker.ts' }, mastraEntryFile)).toThrow(
      /reserved for tool bundles/,
    );
  });

  // `_bundle` writes the tool aggregator to `tools.mjs` with writeFile after rollup has
  // finished, so an entry named `tools` is silently overwritten and the configured
  // process never ships. Rollup's chunk-name deduplication does not cover that write.
  it('rejects the bare name "tools", which the tool aggregator would overwrite', () => {
    expect(() => resolveExtraEntries({ tools: './voice-worker.ts' }, mastraEntryFile)).toThrow(
      /reserved for tool bundles/,
    );
  });

  // Reserved-name checks run on the slash-normalized name, so a backslash form cannot
  // sneak past and then normalize into a name the tool aggregator collects by prefix.
  it('rejects a backslash-separated tools name that would normalize into the reserved prefix', () => {
    expect(() => resolveExtraEntries({ 'tools\\worker': './voice-worker.ts' }, mastraEntryFile)).toThrow(
      /reserved for tool bundles/,
    );
  });

  it('rejects names that would escape the output directory', () => {
    expect(() => resolveExtraEntries({ '../escape': './voice-worker.ts' }, mastraEntryFile)).toThrow(
      /without "\.\." segments/,
    );
    expect(() => resolveExtraEntries({ '/abs': './voice-worker.ts' }, mastraEntryFile)).toThrow(
      /must be a relative name/,
    );
  });

  it('throws a USER-category error naming the resolved path when the file is missing', () => {
    let caught: unknown;
    try {
      resolveExtraEntries({ 'voice-worker': './nope.ts' }, mastraEntryFile);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(MastraError);
    const error = caught as MastraError;
    expect(error.id).toBe('DEPLOYER_BUNDLER_INVALID_ENTRIES');
    expect(error.category).toBe('USER');
    expect(error.message).toContain(join(mastraDir, 'nope.ts'));
  });

  it('maps ENOTDIR entry validation failures to a USER-category error', () => {
    expect(() => resolveExtraEntries({ 'voice-worker': './voice-worker.ts/child' }, mastraEntryFile)).toThrow(
      /does not exist/,
    );
  });

  // Both keys collapse to the same output file, so silently keeping the last one would
  // drop a source the user asked for — and drop it from dependency analysis too.
  it('rejects two names that collapse to the same output name once normalized', () => {
    expect(() =>
      resolveExtraEntries(
        { 'workers\\voice': './voice-worker.ts', 'workers/voice': './voice-worker.ts' },
        mastraEntryFile,
      ),
    ).toThrow(/resolve to the output name "workers\/voice"/);
  });

  // A directory passes existsSync but fails much later inside rollup, where the error no
  // longer points at the config that caused it.
  it('rejects a path that exists but is a directory', () => {
    expect(() => resolveExtraEntries({ 'voice-worker': '.' }, mastraEntryFile)).toThrow(/is not a file/);
  });

  it('rejects empty names and empty paths', () => {
    expect(() => resolveExtraEntries({ '': './voice-worker.ts' }, mastraEntryFile)).toThrow(/empty or untrimmed/);
    expect(() => resolveExtraEntries({ 'voice-worker': '' }, mastraEntryFile)).toThrow(/empty path/);
  });
});
