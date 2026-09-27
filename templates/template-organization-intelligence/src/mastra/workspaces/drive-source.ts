import { extname } from 'node:path';
import { GoogleAuth } from 'google-auth-library';
import { z } from 'zod';

import type { ExtractedRecord, LocatedChunk } from './extractors.js';
import {
  ExtractionError,
  extractRecord,
  MAX_NATIVE_EXPORT_BYTES,
  MAX_RECORD_BYTES,
  normalizedRecord,
} from './extractors.js';

export const DRIVE_READONLY = 'https://www.googleapis.com/auth/drive.readonly';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';
const DOC = 'application/vnd.google-apps.document';
const SHEET = 'application/vnd.google-apps.spreadsheet';
const fileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string(),
  size: z.string().optional(),
  modifiedTime: z.string().optional(),
  version: z.string().optional(),
});
const listingSchema = z.object({
  files: z.array(fileSchema),
  nextPageToken: z.string().optional(),
  incompleteSearch: z.boolean().optional(),
});
export type DriveFile = z.infer<typeof fileSchema> & { path: string; url: string };
export type DriveListing = { files: DriveFile[]; complete: boolean; errors: string[] };
export type DriveAccessToken = () => Promise<string>;
export const DRIVE_EXTRACTION_VERSION = 'drive-extraction-v1';
export type DriveValidator = {
  version?: string;
  modifiedTime?: string;
  size?: string;
  mimeType: string;
  extension: string;
};

export function driveValidator(file: z.infer<typeof fileSchema>): DriveValidator | undefined {
  const version = file.version && /^\d+$/.test(file.version) ? file.version : undefined;
  const modifiedTime =
    file.modifiedTime && Number.isFinite(Date.parse(file.modifiedTime)) ? file.modifiedTime : undefined;
  if (!version && !modifiedTime) return undefined;
  return {
    version,
    modifiedTime,
    size: file.size,
    mimeType: file.mimeType,
    extension: extname(file.name).toLowerCase(),
  };
}

/** IDs are accepted only when this reader discovered their exact record in its configured tree. */
export class ScopedDriveReader {
  #files = new WeakSet<DriveFile>();
  constructor(
    private readonly rootId: string,
    private readonly token: DriveAccessToken,
    private readonly request: typeof fetch = fetch,
  ) {}

  static serviceAccount(credentials: { clientEmail: string; privateKey: string }): DriveAccessToken {
    const auth = new GoogleAuth({
      credentials: { client_email: credentials.clientEmail, private_key: credentials.privateKey },
      scopes: [DRIVE_READONLY],
    });
    return async () => {
      const token = await auth.getAccessToken();
      if (!token) throw new Error('Drive authentication failed.');
      return token;
    };
  }

  async list(): Promise<DriveListing> {
    this.#files = new WeakSet();
    const result: DriveListing = { files: [], complete: true, errors: [] };
    const queue = [{ id: this.rootId, path: '', depth: 0 }];
    const visited = new Set<string>();
    let discovered = 0;
    try {
      while (queue.length) {
        const folder = queue.shift()!;
        if (visited.has(folder.id) || folder.depth > 32 || visited.size >= 1_000)
          throw new Error('Folder traversal limit.');
        visited.add(folder.id);
        const names = new Map<string, DriveFile[]>();
        let pageToken: string | undefined;
        const pages = new Set<string>();
        do {
          const escapedId = folder.id.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
          const parameters = new URLSearchParams({
            q: "'" + escapedId + "' in parents and trashed = false",
            fields: 'files(id,name,mimeType,size,modifiedTime,version),nextPageToken,incompleteSearch',
            pageSize: '100',
            supportsAllDrives: 'true',
            includeItemsFromAllDrives: 'true',
          });
          if (pageToken) parameters.set('pageToken', pageToken);
          const body = listingSchema.parse(
            JSON.parse((await this.#get(DRIVE_API + '/files?' + parameters, 2 * 1024 * 1024)).toString('utf8')),
          );
          if (body.incompleteSearch) throw new Error('Incomplete Drive listing.');
          for (const file of body.files) {
            if (++discovered > 1_000) throw new Error('Source exceeds 1,000 entries.');
            if (file.name === '.' || file.name === '..' || /[/\\\0]/.test(file.name)) {
              result.complete = false;
              result.errors.push('Unsafe Drive filename was skipped.');
              continue;
            }
            const path = folder.path + file.name;
            const record = Object.freeze({
              ...file,
              path,
              url: 'https://drive.google.com/file/d/' + encodeURIComponent(file.id) + '/view',
            });
            names.set(file.name, [...(names.get(file.name) ?? []), record]);
          }
          pageToken = body.nextPageToken;
          if (pageToken && pages.has(pageToken)) throw new Error('Repeated page token.');
          if (pageToken) pages.add(pageToken);
        } while (pageToken);
        for (const records of names.values()) {
          if (records.length !== 1) {
            result.complete = false;
            result.errors.push('Ambiguous sibling names were skipped. Rename them and retry.');
            continue;
          }
          const record = records[0]!;
          if (record.mimeType === FOLDER) {
            queue.push({ id: record.id, path: record.path + '/', depth: folder.depth + 1 });
            continue;
          }
          if (record.mimeType === 'application/vnd.google-apps.shortcut') {
            result.complete = false;
            result.errors.push('Drive shortcuts are not followed.');
            continue;
          }
          this.#files.add(record);
          result.files.push(record);
        }
      }
    } catch {
      result.complete = false;
      result.errors.push(
        'Drive scan is incomplete. Check folder access, API availability and source limits; cached records were retained.',
      );
    }
    return result;
  }

  async extract(file: DriveFile): Promise<ExtractedRecord> {
    if (!this.#files.has(file))
      throw new ExtractionError('Record was not discovered within this configured Drive tree.');
    const expected = driveValidator(file);
    const extracted = await this.#extractContent(file);
    if (expected) {
      const parameters = new URLSearchParams({
        fields: 'id,name,mimeType,size,modifiedTime,version',
        supportsAllDrives: 'true',
      });
      const current = fileSchema.parse(
        JSON.parse(
          (await this.#get(DRIVE_API + '/files/' + encodeURIComponent(file.id) + '?' + parameters, 64 * 1024)).toString(
            'utf8',
          ),
        ),
      );
      if (current.id !== file.id || JSON.stringify(driveValidator(current)) !== JSON.stringify(expected))
        throw new ExtractionError('Drive file changed during synchronization; retry on the next refresh.');
    }
    return extracted;
  }

  async #extractContent(file: DriveFile): Promise<ExtractedRecord> {
    if (file.mimeType === DOC || file.mimeType === SHEET) {
      const mime =
        file.mimeType === DOC
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const bytes = await this.#get(
        DRIVE_API + '/files/' + encodeURIComponent(file.id) + '/export?mimeType=' + encodeURIComponent(mime),
        MAX_NATIVE_EXPORT_BYTES,
      );
      const exported = await extractRecord(file.name + (file.mimeType === DOC ? '.docx' : '.xlsx'), bytes);
      if (file.mimeType === SHEET) return exported;
      // DOCX export lacks actual tab IDs. The approved read supplement preserves nested tabs and locators.
      const document = JSON.parse(
        (
          await this.#get(
            'https://docs.googleapis.com/v1/documents/' + encodeURIComponent(file.id) + '?includeTabsContent=true',
            MAX_NATIVE_EXPORT_BYTES,
          )
        ).toString('utf8'),
      ) as DocsDocument;
      return extractDocsTabs(document);
    }
    if (file.size && (!Number.isFinite(Number(file.size)) || Number(file.size) > MAX_RECORD_BYTES))
      throw new ExtractionError('Binary input exceeds 20 MiB.');
    return extractRecord(
      file.path,
      await this.#get(DRIVE_API + '/files/' + encodeURIComponent(file.id) + '?alt=media', MAX_RECORD_BYTES),
    );
  }

  async #get(url: string, limit: number): Promise<Buffer> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.request(url, {
          headers: { authorization: 'Bearer ' + (await this.token()) },
          signal: AbortSignal.timeout(15_000),
          redirect: 'error',
        });
        if ((response.status === 429 || response.status >= 500) && attempt < 2) {
          await response.body?.cancel();
          continue;
        }
        if (!response.ok) {
          await response.body?.cancel();
          throw new ExtractionError(
            'Drive read/export failed. Check read-only access, enabled APIs and export limits.',
          );
        }
        if (Number(response.headers.get('content-length') ?? 0) > limit) {
          await response.body?.cancel();
          throw new ExtractionError('Drive response exceeds its byte limit.');
        }
        const reader = response.body?.getReader();
        if (!reader) throw new ExtractionError('Drive returned no content.');
        const chunks: Buffer[] = [];
        let length = 0;
        try {
          while (true) {
            const value = await reader.read();
            if (value.done) break;
            length += value.value.byteLength;
            if (length > limit) throw new ExtractionError('Drive response exceeds its byte limit.');
            chunks.push(Buffer.from(value.value));
          }
        } finally {
          await reader.cancel();
        }
        return Buffer.concat(chunks);
      } catch (error) {
        if (error instanceof ExtractionError || attempt === 2)
          throw new ExtractionError(
            error instanceof ExtractionError ? error.message : 'Drive request failed after bounded retries.',
          );
      }
    }
    throw new ExtractionError('Drive request failed.');
  }
}

type DocsElement = {
  paragraph?: { elements?: Array<{ textRun?: { content?: string } }> };
  table?: { tableRows?: Array<{ tableCells?: Array<{ content?: DocsElement[] }> }> };
  tableOfContents?: { content?: DocsElement[] };
};
type DocsTab = {
  tabProperties?: { tabId?: string; title?: string };
  documentTab?: { body?: { content?: DocsElement[] } };
  childTabs?: DocsTab[];
};
type DocsDocument = { tabs?: DocsTab[] };
function extractDocsTabs(document: DocsDocument): ExtractedRecord {
  if (!Array.isArray(document.tabs) || !document.tabs.length)
    throw new ExtractionError('Docs response does not establish complete tab content.');
  const parts: LocatedChunk[] = [];
  let blocks = 0;
  let tabs = 0;
  let bytes = 0;
  const contents = (elements: DocsElement[], depth: number): string => {
    if (depth > 32) throw new ExtractionError('Document exceeds nesting limit.');
    return elements
      .map(element => {
        if (++blocks > 100_000) throw new ExtractionError('Document exceeds block limit.');
        let text = '';
        if (element.paragraph)
          text = (element.paragraph.elements ?? []).map(item => item.textRun?.content ?? '').join('');
        if (element.table)
          text = (element.table.tableRows ?? [])
            .map(row => (row.tableCells ?? []).map(cell => contents(cell.content ?? [], depth + 1)).join(' | '))
            .join('\n');
        if (element.tableOfContents) text = contents(element.tableOfContents.content ?? [], depth + 1);
        bytes += element.paragraph ? Buffer.byteLength(text) : 0;
        if (bytes > 1024 * 1024) throw new ExtractionError('Normalized text exceeds 1 MiB.');
        return text;
      })
      .join('\n');
  };
  const visit = (tab: DocsTab, depth: number) => {
    if (++tabs > 100 || depth > 32 || !tab.tabProperties?.tabId || !tab.documentTab?.body?.content)
      throw new ExtractionError('Unsupported or incomplete Docs tab.');
    for (const [index, element] of tab.documentTab.body.content.entries())
      parts.push({
        locator: 'tab ' + tab.tabProperties.tabId + ' (' + (tab.tabProperties.title ?? '') + ') block ' + (index + 1),
        text: contents([element], 0),
      });
    for (const child of tab.childTabs ?? []) visit(child, depth + 1);
  };
  for (const tab of document.tabs) visit(tab, 0);
  return normalizedRecord(parts);
}
