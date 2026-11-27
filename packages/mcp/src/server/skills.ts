import {
  GetSkillRequestParamsSchema,
  ListSkillsRequestParamsSchema,
  ReadResourceDirectoryRequestParamsSchema,
} from '@modelcontextprotocol/core/ext/skills';
import type { Resource, Server, ServerContext } from '@modelcontextprotocol/server';
import { ProtocolError, ProtocolErrorCode } from '@modelcontextprotocol/server';
import type {
  Skill,
  SkillFileEntry,
  SkillFiles,
  SkillReadResult,
  SkillSource,
} from '@modelcontextprotocol/server/ext/skills';
import {
  DIRECTORY_MIME_TYPE,
  RESOURCES_DIRECTORY_READ_METHOD,
  SKILL_LIMITS,
  SKILLS_GET_METHOD,
  SKILLS_LIST_METHOD,
  skillEntry,
} from '@modelcontextprotocol/server/ext/skills';

export type { SkillFileEntry, SkillFiles, SkillReadResult, SkillSource };

/**
 * A filesystem skills can be read from: anything with `readdir` and `readFile`, such as a Mastra
 * workspace filesystem (`LocalFilesystem`, `workspace.filesystem`) or a workspace skill source.
 */
export interface SkillFilesystem {
  readdir(path: string): Promise<ReadonlyArray<{ name: string; type: 'file' | 'directory'; isSymlink?: boolean }>>;
  readFile(path: string): Promise<string | Uint8Array>;
}

interface SkillsCommon {
  /** How long clients may cache listings, entries and directory reads. Default `{ ttlMs: 0, cacheScope: 'private' }`. */
  cacheHint?: { ttlMs: number; cacheScope: 'public' | 'private' };
}

/** Skills read from files: every folder holding a `SKILL.md` is a skill named after the folder. */
export interface MCPServerSkillFiles extends SkillsCommon {
  /**
   * Where the skill files are:
   * - an object of contents keyed by `/`-separated path: `{ 'git-workflow/SKILL.md': '...' }`
   * - a filesystem with `readdir` and `readFile`, such as a Mastra `LocalFilesystem` or `workspace.filesystem`
   * - an MCP SDK `SkillFiles` adapter with `list` and `read`
   *
   * Files are hashed once to list them, then read again only when a client asks for them.
   */
  files: Record<string, string | Uint8Array> | SkillFilesystem | SkillFiles;
  /** Folder within `files` that holds the skills. Default: its root. */
  root?: string;
  /** Organizational prefix: `'acme'` serves `skill://acme/<skill>/...`. */
  prefix?: string;
  /** Entries per `skills/list` and `resources/directory/read` page. Default 100. */
  pageSize?: number;
}

/** Skills served by your own MCP SDK `SkillSource`: per user, generated, remote, or `"dynamic"`. */
export interface MCPServerSkillSource extends SkillsCommon {
  source: SkillSource;
}

/**
 * Agent Skills served over the MCP Skills extension (SEP-2640, `io.modelcontextprotocol/skills`).
 */
export type MCPServerSkills = MCPServerSkillFiles | MCPServerSkillSource;

interface ListedFile {
  path: string;
  size: number;
  digest: string;
  mimeType: string;
}

interface Catalog {
  /** Distinguishes rebuilt catalogs, so a cursor from an older one is refused. */
  generation: number;
  skills: Skill[];
  byUri: Map<string, Skill>;
  files: Map<string, ListedFile>;
  dirs: Map<string, Resource[]>;
  listed: Resource[];
}

const DEFAULT_PAGE_SIZE = 100;

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: 'text/plain',
  json: 'application/json',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  py: 'text/x-python',
  sh: 'application/x-sh',
  js: 'text/javascript',
  mjs: 'text/javascript',
  cjs: 'text/javascript',
  ts: 'text/typescript',
  html: 'text/html',
  css: 'text/css',
  csv: 'text/csv',
  xml: 'application/xml',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

const byUri = (a: { uri: string }, b: { uri: string }) => (a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : 0);

function mimeTypeFor(name: string): string {
  const dot = name.lastIndexOf('.');
  return (dot > 0 && MIME_BY_EXTENSION[name.slice(dot + 1).toLowerCase()]) || 'application/octet-stream';
}

// Encodes a URI path segment the way the SDK's entry builder does, so file URIs match the entry's.
function encodeSegment(segment: string): string {
  if (segment === '.' || segment === '..') return segment.replaceAll('.', '%2E');
  return segment.replace(/[^\w!$&'()*+,.:;=@[\]|~-]/gu, char => encodeURIComponent(char));
}

// Like the SDK, the first segment is the URI's authority and is encoded strictly.
function uriOf(segments: readonly string[]): string {
  const [authority, ...path] = segments;
  return `skill://${[encodeURIComponent(authority!), ...path.map(encodeSegment)].join('/')}`;
}

function splitPath(path: string): string[] | undefined {
  const segments = path.replace(/^\.?\/+/, '').split('/');
  if (segments.some(segment => segment === '' || segment === '.' || segment === '..' || segment.includes('\\'))) {
    return undefined;
  }
  return segments;
}

const encoder = new TextEncoder();
// Keeps a leading BOM, so the text the client re-encodes matches the listed size and digest.
const strictDecoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

function toBytes(content: string | Uint8Array): Uint8Array {
  return typeof content === 'string' ? encoder.encode(content) : content;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>));
  return `sha256:${Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

function isSkillFiles(files: MCPServerSkillFiles['files']): files is SkillFiles {
  return typeof (files as SkillFiles).list === 'function' && typeof (files as SkillFiles).read === 'function';
}

function isFilesystem(files: MCPServerSkillFiles['files']): files is SkillFilesystem {
  return (
    typeof (files as SkillFilesystem).readdir === 'function' &&
    typeof (files as SkillFilesystem).readFile === 'function'
  );
}

function memoryFiles(contents: Record<string, string | Uint8Array>, warn: (message: string) => void): SkillFiles {
  const files = new Map<string, Uint8Array>();
  const dirs = new Map<string, Map<string, SkillFileEntry['kind']>>([['', new Map()]]);
  for (const [path, content] of Object.entries(contents)) {
    const segments = splitPath(path);
    if (segments === undefined) {
      warn(`Skill file path ${JSON.stringify(path)} is not a relative '/'-separated path (skipped)`);
      continue;
    }
    files.set(segments.join('/'), toBytes(content));
    for (let depth = 0; depth < segments.length; depth++) {
      const dir = segments.slice(0, depth).join('/');
      if (!dirs.has(dir)) dirs.set(dir, new Map());
      dirs.get(dir)!.set(segments[depth]!, depth === segments.length - 1 ? 'file' : 'directory');
    }
  }
  return {
    list: async dir => [...(dirs.get(dir)?.entries() ?? [])].map(([name, kind]) => ({ name, kind })),
    read: async path => {
      const bytes = files.get(path);
      if (!bytes) throw new Error(`No skill file at ${path}`);
      return bytes;
    },
  };
}

function filesystemFiles(filesystem: SkillFilesystem): SkillFiles {
  return {
    list: async dir =>
      (await filesystem.readdir(dir === '' ? '.' : dir)).map(entry => ({
        name: entry.name,
        kind: entry.isSymlink ? 'unsupported' : entry.type,
      })),
    read: async path => toBytes(await filesystem.readFile(path)),
  };
}

/** The `SkillFiles` a `files` config reads through, rooted at its `root`. */
function skillFilesFor(config: MCPServerSkillFiles, warn: (message: string) => void): SkillFiles {
  const files = isSkillFiles(config.files)
    ? config.files
    : isFilesystem(config.files)
      ? filesystemFiles(config.files)
      : memoryFiles(config.files, warn);
  const root = config.root?.replace(/\/+$/, '') ?? '';
  if (root === '') return files;
  const at = (path: string) => (path === '' ? root : `${root}/${path}`);
  return { list: dir => files.list(at(dir)), read: path => files.read(at(path)) };
}

/** Every file and directory path under the root, skipping entries that can't be served. */
async function walk(files: SkillFiles, warn: (message: string) => void): Promise<{ paths: string[]; dirs: string[] }> {
  const paths: string[] = [];
  const dirs: string[] = [];
  const visit = async (dir: string): Promise<void> => {
    for (const entry of await files.list(dir)) {
      const path = dir === '' ? entry.name : `${dir}/${entry.name}`;
      if (splitPath(path)?.join('/') !== path) {
        warn(`Skill file name ${JSON.stringify(path)} cannot be served (skipped)`);
      } else if (entry.kind === 'directory') {
        dirs.push(path);
        await visit(path);
      } else if (entry.kind === 'file') {
        paths.push(path);
      } else {
        warn(`${path} is a symbolic link or special file (skipped)`);
      }
    }
  };
  await visit('');
  return { paths: paths.sort(), dirs };
}

/**
 * Builds the catalog: one entry per folder holding a `SKILL.md`, listing every file under it (a nested
 * skill's files included) with its SHA-256 digest and size. Only metadata is kept; one skill's files are
 * in memory at a time while it is hashed. Invalid skills are skipped with a warning.
 */
async function buildCatalog(
  config: MCPServerSkillFiles,
  files: SkillFiles,
  warn: (message: string) => void,
): Promise<Catalog> {
  const prefix = config.prefix === undefined ? [] : splitPath(config.prefix);
  if (prefix === undefined) throw new TypeError(`Invalid skills prefix: ${JSON.stringify(config.prefix)}`);

  const { paths, dirs: walkedDirs } = await walk(files, warn);
  if (paths.includes('SKILL.md')) warn('A SKILL.md at the skills root has no skill folder (skipped)');
  const skillDirs = paths.filter(path => path.endsWith('/SKILL.md')).map(path => path.slice(0, -'/SKILL.md'.length));

  const skills: Skill[] = [];
  const servedFiles = new Map<string, ListedFile>();
  const servedDirs = new Set<string>();

  for (const dir of skillDirs) {
    const inside = paths.filter(path => path.startsWith(`${dir}/`));
    const contents: Record<string, Uint8Array> = {};
    let skill: Skill;
    try {
      for (const path of inside) contents[path.slice(dir.length + 1)] = await files.read(path);
      skill = await skillEntry([...prefix, dir].join('/'), contents);
    } catch (error) {
      warn(`Skill ${dir} is invalid (skipped): ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const resources = new Map(
      (Array.isArray(skill.resources) ? skill.resources : []).map(resource => [resource.uri, resource]),
    );
    if (inside.some(path => !resources.has(uriOf([...prefix, ...path.split('/')])))) {
      warn(`Skill ${dir} has file names that cannot be served as skill:// URIs (skipped)`);
      continue;
    }
    const total = inside.reduce((sum, path) => sum + contents[path.slice(dir.length + 1)]!.byteLength, 0);
    if (inside.length > SKILL_LIMITS.files || total > SKILL_LIMITS.bytes) {
      warn(`Skill ${dir} has ${inside.length} files / ${total} bytes, over the limits some hosts enforce`);
    }
    skills.push(skill);
    const dirSegments = dir.split('/');
    // Empty folders are listed too, so reading one returns no entries rather than an error.
    for (const path of walkedDirs) {
      if (path === dir || path.startsWith(`${dir}/`)) servedDirs.add(path);
    }
    for (const path of inside) {
      const uri = uriOf([...prefix, ...path.split('/')]);
      const resource = resources.get(uri)!;
      servedFiles.set(uri, {
        path,
        size: resource.size,
        digest: resource.digest,
        mimeType: path.endsWith('/SKILL.md') ? 'text/markdown' : mimeTypeFor(path.slice(path.lastIndexOf('/') + 1)),
      });
      const segments = path.split('/');
      for (let depth = dirSegments.length; depth < segments.length; depth++) {
        servedDirs.add(segments.slice(0, depth).join('/'));
      }
    }
  }

  const servedPaths = [...servedFiles.values()].map(file => file.path);
  const dirs = new Map<string, Resource[]>();
  for (const dir of servedDirs) {
    const children = new Map<string, Resource>();
    for (const sub of servedDirs) {
      if (!sub.startsWith(`${dir}/`) || sub.slice(dir.length + 1).includes('/')) continue;
      const name = sub.slice(dir.length + 1);
      children.set(name, { uri: uriOf([...prefix, ...sub.split('/')]), name, mimeType: DIRECTORY_MIME_TYPE });
    }
    for (const path of servedPaths) {
      if (!path.startsWith(`${dir}/`)) continue;
      const [name, ...rest] = path.slice(dir.length + 1).split('/');
      const uri = uriOf([...prefix, ...dir.split('/'), name!]);
      if (rest.length > 0) {
        children.set(name!, { uri, name: name!, mimeType: DIRECTORY_MIME_TYPE });
      } else {
        const file = servedFiles.get(uri)!;
        children.set(name!, { uri, name: name!, mimeType: file.mimeType, size: file.size });
      }
    }
    dirs.set(uriOf([...prefix, ...dir.split('/')]), [...children.values()].sort(byUri));
  }

  skills.sort(byUri);
  return {
    generation: 0,
    skills,
    byUri: new Map(skills.map(skill => [skill.uri, skill])),
    files: servedFiles,
    dirs,
    listed: skills.map(skill => ({
      uri: skill.uri,
      name: String(skill.frontmatter.name),
      description: String(skill.frontmatter.description),
      mimeType: 'text/markdown',
      size: servedFiles.get(skill.uri)?.size,
    })),
  };
}

/** One page of `items`. A cursor names the catalog it came from; after a rebuild it is refused. */
function page<T>(
  items: readonly T[],
  cursor: string | undefined,
  size: number,
  generation: number,
): { items: T[]; nextCursor?: string } {
  let offset = 0;
  if (cursor !== undefined) {
    const match = /^(\d+)\.(\d+)$/.exec(cursor);
    offset = Number(match?.[2]);
    if (!match || !Number.isSafeInteger(offset) || offset > items.length) {
      throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Invalid cursor: ${cursor}`);
    }
    if (Number(match[1]) !== generation) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        'The skills changed since this cursor was issued; list again',
      );
    }
  }
  const next = offset + size;
  return next < items.length
    ? { items: items.slice(offset, next), nextCursor: `${generation}.${next}` }
    : { items: items.slice(offset) };
}

/**
 * Whether the file at `path` is confirmed gone: the nearest ancestor folder that can still be listed doesn't
 * hold the next segment with the expected kind (a file for the last segment, a folder before it). If nothing
 * can be listed, the failure may be transient, so it isn't confirmed.
 */
async function isMissing(files: SkillFiles, path: string): Promise<boolean> {
  const segments = path.split('/');
  const last = segments.length - 1;
  for (let depth = last; depth >= 0; depth--) {
    try {
      const entries = await files.list(segments.slice(0, depth).join('/'));
      const kind = depth === last ? 'file' : 'directory';
      return !entries.some(entry => entry.name === segments[depth] && entry.kind === kind);
    } catch {
      // This folder may be gone as well; check its parent.
    }
  }
  return false;
}

/**
 * The `SkillSource` for a `files` config. The catalog is built on first use. A file is read again when a
 * client asks for it and checked against its listed digest; if it changed, the read fails and the next
 * request lists the skills afresh.
 */
function catalogSource(config: MCPServerSkillFiles, warn: (message: string) => void): SkillSource {
  const pageSize = config.pageSize ?? DEFAULT_PAGE_SIZE;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new TypeError(`skills.pageSize must be a positive integer (got ${pageSize})`);
  }
  const files = skillFilesFor(config, warn);
  let built: Promise<Catalog> | undefined;
  let generation = 0;
  const catalog = (): Promise<Catalog> => {
    if (!built) {
      const current = ++generation;
      const building = buildCatalog(config, files, warn).then(result => ({ ...result, generation: current }));
      built = building;
      // A failed build is retried on the next request.
      building.catch(error => {
        warn(`Could not list skills: ${error instanceof Error ? error.message : String(error)}`);
        if (built === building) built = undefined;
      });
    }
    return built;
  };

  return {
    async list({ cursor }) {
      const { skills, generation } = await catalog();
      const { items, nextCursor } = page(skills, cursor, pageSize, generation);
      return { skills: items, ...(nextCursor === undefined ? {} : { nextCursor }) };
    },
    async get(uri) {
      return (await catalog()).byUri.get(uri);
    },
    async readDirectory(uri, { cursor }) {
      const { dirs, generation } = await catalog();
      const children = dirs.get(uri);
      if (!children) return undefined;
      const { items, nextCursor } = page(children, cursor, pageSize, generation);
      return { resources: items, ...(nextCursor === undefined ? {} : { nextCursor }) };
    },
    async listResources() {
      return (await catalog()).listed;
    },
    async read(uri) {
      const current = catalog();
      const { files: listed, dirs } = await current;
      const file = listed.get(uri);
      if (!file) {
        if (dirs.has(uri)) {
          throw new ProtocolError(
            ProtocolErrorCode.InvalidParams,
            `${uri} is a directory; use ${RESOURCES_DIRECTORY_READ_METHOD}`,
          );
        }
        return undefined;
      }
      let bytes: Uint8Array;
      try {
        bytes = await files.read(file.path);
      } catch (error) {
        // A deleted file drops out of the next listing; other failures may be transient and keep the catalog.
        // Check the catalog after the await too: a newer catalog may have replaced it in the meantime.
        if (built === current && (await isMissing(files, file.path)) && built === current) built = undefined;
        throw error;
      }
      if (bytes.byteLength !== file.size || (await sha256(bytes)) !== file.digest) {
        if (built === current) built = undefined;
        throw new ProtocolError(
          ProtocolErrorCode.InternalError,
          `${uri} changed since it was listed; list the skills again`,
        );
      }
      try {
        return { text: strictDecoder.decode(bytes), mimeType: file.mimeType };
      } catch {
        return { bytes, mimeType: file.mimeType };
      }
    },
  };
}

/** The `SkillSource` a `skills` config serves. */
export function skillSourceFor(config: MCPServerSkills, warn: (message: string) => void): SkillSource {
  return 'source' in config ? config.source : catalogSource(config, warn);
}

/** Whether the config's skills answer `resources/directory/read`. */
export function servesDirectories(config: MCPServerSkills): boolean {
  return !('source' in config) || typeof config.source.readDirectory === 'function';
}

/** A skill file as `resources/read` contents: `text` as is, bytes as a base64 `blob`. */
export function skillFileContents(
  uri: string,
  result: SkillReadResult,
): { uri: string; mimeType?: string } & ({ text: string } | { blob: string }) {
  const mimeType = result.mimeType === undefined ? {} : { mimeType: result.mimeType };
  if ('text' in result) return { uri, ...mimeType, text: result.text };
  let binary = '';
  for (const byte of result.bytes) binary += String.fromCharCode(byte);
  return { uri, ...mimeType, blob: btoa(binary) };
}

export interface SkillHandlerDeps {
  source: SkillSource;
  config: MCPServerSkills;
  /** Runs one request under the server's request span. */
  trace: <T>(
    server: Server,
    method: string,
    params: Record<string, unknown>,
    ctx: ServerContext,
    fn: () => Promise<T>,
  ) => Promise<T>;
}

/** Registers `skills/list`, `skills/get` and, when served, `resources/directory/read` on one protocol instance. */
export function registerSkillHandlers(server: Server, deps: SkillHandlerDeps): void {
  const { source } = deps;
  const cache = deps.config.cacheHint ?? { ttlMs: 0, cacheScope: 'private' as const };

  server.setRequestHandler(SKILLS_LIST_METHOD, { params: ListSkillsRequestParamsSchema }, (params, ctx) =>
    deps.trace(server, SKILLS_LIST_METHOD, params, ctx, async () => ({
      ...(await source.list({ cursor: params.cursor }, ctx)),
      ...cache,
    })),
  );

  server.setRequestHandler(SKILLS_GET_METHOD, { params: GetSkillRequestParamsSchema }, (params, ctx) =>
    deps.trace(server, SKILLS_GET_METHOD, params, ctx, async () => {
      const skill = await source.get(params.uri, ctx);
      if (!skill) throw new ProtocolError(ProtocolErrorCode.InvalidParams, `No skill is served at ${params.uri}`);
      return { skill, ...cache };
    }),
  );

  if (!source.readDirectory) return;
  const readDirectory = source.readDirectory.bind(source);
  server.setRequestHandler(
    RESOURCES_DIRECTORY_READ_METHOD,
    { params: ReadResourceDirectoryRequestParamsSchema },
    (params, ctx) =>
      deps.trace(server, RESOURCES_DIRECTORY_READ_METHOD, params, ctx, async () => {
        const result = await readDirectory(params.uri, { cursor: params.cursor }, ctx);
        if (!result) {
          throw new ProtocolError(ProtocolErrorCode.InvalidParams, `${params.uri} is not a directory resource`);
        }
        return { ...result, ...cache };
      }),
  );
}
