import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createClient } from '@libsql/client';
import { z } from 'zod';
import { ControlPlaneError } from '../core/contracts.js';

const source = z.enum(['WSTG', 'ASVS', 'CWE', 'CAPEC']);
const path = z
  .string()
  .regex(/^[a-z0-9][a-z0-9._/-]*$/i)
  .refine(value => !value.split('/').includes('..'));
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const reference = z
  .object({
    /** Stable local reference identifier. */
    id: z.string().min(3).max(80),
    /** Offline source collection: WSTG, ASVS, CWE, or CAPEC. */
    source,
    /** Human-readable reference title. */
    title: z.string().min(1).max(240),
    /** Relative bundled reference path verified against the integrity manifest. */
    file: path,
    /** Optional bounded excerpt used instead of the complete source file. */
    text: z.string().max(10000).optional(),
  })
  .strict();
const manifestSchema = z
  .object({
    indexVersion: z.literal(1),
    sources: z.record(
      source,
      z
        .object({
          revision: z.string().min(1),
          license: z.string().min(1),
          notice: path,
          sourceUrl: z.url(),
          commit: z.string().optional(),
          sourceArtifactSha256: digest.optional(),
        })
        .strict(),
    ),
    files: z.array(z.object({ path, sha256: digest, source, referenceIds: z.array(z.string()) }).strict()).min(4),
    references: z.array(reference).min(8),
  })
  .strict();
/** Pinned offline catalog entry with a local source file and optional excerpt. */
export type Reference = z.infer<typeof reference>;
type Manifest = z.infer<typeof manifestSchema>;

const checksum = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const MANIFEST_SHA256 = 'a9c22ba3537c56fb444b69a4b8f2d72d7f4f31f8531cc3172c45f1698fafe89b';
const catalogError = () => new ControlPlaneError('CATALOG_INTEGRITY_FAILED', 503);

export class ReferenceCatalog {
  private readonly client;
  private readonly root: string;

  constructor(databaseUrl: string, root = resolve(process.cwd(), 'references')) {
    this.client = createClient({ url: databaseUrl });
    this.root = root;
  }

  /** Resolve a reference path within the bundled catalogue boundary. */
  private filePath(relative: string) {
    const absolute = resolve(this.root, relative);
    if (!absolute.startsWith(this.root + sep)) throw catalogError();
    return absolute;
  }

  /** Verify bundled reference bytes against the pinned manifest before use. */
  async verify(): Promise<Manifest> {
    let manifest: Manifest;
    try {
      const bytes = await readFile(this.filePath('manifest.json'));
      if (checksum(bytes) !== MANIFEST_SHA256) throw catalogError();
      manifest = manifestSchema.parse(JSON.parse(bytes.toString('utf8')));
      const paths = new Set<string>();
      const refs = new Set<string>();
      for (const item of manifest.files) {
        if (paths.has(item.path)) throw catalogError();
        paths.add(item.path);
        if (checksum(await readFile(this.filePath(item.path))) !== item.sha256) throw catalogError();
      }
      for (const [name, meta] of Object.entries(manifest.sources)) {
        if (
          !meta ||
          !paths.has(meta.notice) ||
          !manifest.files.some(file => file.path === meta.notice && file.source === name)
        )
          throw catalogError();
      }
      for (const item of manifest.references) {
        if (
          refs.has(item.id) ||
          !paths.has(item.file) ||
          !manifest.files.some(
            file => file.path === item.file && file.source === item.source && file.referenceIds.includes(item.id),
          )
        )
          throw catalogError();
        refs.add(item.id);
      }
      if (Object.keys(manifest.sources).length !== 4) throw catalogError();
    } catch {
      throw catalogError();
    }
    return manifest;
  }

  async contentDigest(): Promise<string> {
    await this.verify();
    return MANIFEST_SHA256;
  }

  /** Load and verify the offline reference catalogue and its license bindings. */
  async initialize() {
    const manifest = await this.verify();
    await this.client.execute(
      'CREATE VIRTUAL TABLE IF NOT EXISTS scanner_reference_fts USING fts5(id UNINDEXED, title, body)',
    );
    const tx = await this.client.transaction('write');
    try {
      await tx.execute('DELETE FROM scanner_reference_fts');
      for (const item of manifest.references) {
        const body = item.text ?? (await readFile(this.filePath(item.file), 'utf8'));
        await tx.execute({
          sql: 'INSERT INTO scanner_reference_fts(id,title,body) VALUES (?,?,?)',
          args: [item.id, item.title, body],
        });
      }
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      tx.close();
    }
  }

  /** Resolve a verified reference entry by its supported catalogue identifier. */
  async resolve(id: string) {
    const manifest = await this.verify();
    const item = manifest.references.find(reference => reference.id === id);
    if (!item) throw new ControlPlaneError('REFERENCE_NOT_FOUND', 404);
    return {
      ...item,
      body: item.text ?? (await readFile(this.filePath(item.file), 'utf8')),
      revision: manifest.sources[item.source].revision,
    };
  }

  /** Search the verified offline catalogue with bounded terms and result count. */
  async search(input: string, limit = 10) {
    const query = z.string().trim().min(1).max(120).parse(input);
    const count = z.number().int().min(1).max(25).parse(limit);
    const manifest = await this.verify();
    const tokens = query.match(/[\p{L}\p{N}]+/gu)?.slice(0, 8);
    if (!tokens?.length) return [];
    const expression = tokens.map(token => `"${token}"`).join(' AND ');
    const rows = await this.client.execute({
      sql: 'SELECT id FROM scanner_reference_fts WHERE scanner_reference_fts MATCH ? ORDER BY rank LIMIT ?',
      args: [expression, count],
    });
    const ids = new Set(rows.rows.map(row => String(row.id)));
    return manifest.references.filter(item => ids.has(item.id)).slice(0, count);
  }

  close() {
    this.client.close();
  }
}
