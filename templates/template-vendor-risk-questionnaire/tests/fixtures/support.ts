import { mkdtemp, readdir, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';
import { defaultLimits } from '../../src/mastra/contracts/limits.ts';
import { mappingSchema } from '../../src/mastra/contracts/mapping.ts';
import type { ConfirmedInputMapping } from '../../src/mastra/contracts/mapping.ts';
import type { InputLimits } from '../../src/mastra/contracts/limits.ts';
import type { InputSourceSnapshot, InputAdapterContext } from '../../src/mastra/intake/source.ts';
import { sha256 } from '../../src/mastra/intake/source.ts';

export const operator = {
  questionnaireId: 'test-questionnaire',
  organizationId: 'northstar',
  title: 'Fictional vendor review',
};
export function context(
  overrides: Partial<InputLimits> = {},
  signal = new AbortController().signal,
): InputAdapterContext {
  return { limits: { ...defaultLimits, ...overrides }, signal };
}
export function source(
  bytes: Uint8Array,
  originalName = 'input.xlsx',
  sourceId = 'questionnaire-source',
): InputSourceSnapshot {
  return { sourceId, originalName, sizeBytes: bytes.length, sha256: sha256(bytes), bytes };
}
export function tableMapping(
  s: InputSourceSnapshot,
  regions: ConfirmedInputMapping['regions'],
  exclusions: ConfirmedInputMapping['exclusions'] = [],
  profile = s.originalName.endsWith('.xlsx') ? 'xlsx.table.v1' : 'docx.table.v1',
): ConfirmedInputMapping {
  return mappingSchema.parse({
    contractVersion: 1,
    sourceSha256: s.sha256,
    adapterKey: s.originalName.endsWith('.xlsx') ? 'xlsx' : 'docx',
    adapterVersion: '1.0.0',
    profile,
    profileVersion: 1,
    regions,
    exclusions,
  });
}
export function alterZip(bytes: Uint8Array, part: string, transform: (xml: string) => string): Uint8Array {
  const files = unzipSync(bytes);
  files[part] = strToU8(transform(strFromU8(files[part]!)));
  return zipSync(files);
}
export function addZipMember(bytes: Uint8Array, name: string, text: string): Uint8Array {
  const files = unzipSync(bytes);
  files[name] = strToU8(text);
  return zipSync(files);
}
export function dishonestExpandedSizes(bytes: Uint8Array): Uint8Array {
  const result = bytes.slice(),
    view = new DataView(result.buffer);
  for (let i = 0; i < result.length - 46; i++)
    if (view.getUint32(i, true) === 0x02014b50) {
      view.setUint32(i + 24, 0, true);
      i += 45 + view.getUint16(i + 28, true) + view.getUint16(i + 30, true) + view.getUint16(i + 32, true);
    }
  return result;
}
export async function temporaryDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'vrq-tests-'));
}
export async function cleanupDirectory(path: string): Promise<void> {
  await chmod(path, 0o700).catch(() => {});
  for (const entry of await readdir(path, { withFileTypes: true }).catch(() => [])) {
    if (entry.isDirectory()) await cleanupDirectory(join(path, entry.name));
  }
  await rm(path, { recursive: true, force: true });
}
