import {
  GetSkillRequestParamsSchema,
  ListSkillsRequestParamsSchema,
  ReadResourceDirectoryRequestParamsSchema,
} from '@modelcontextprotocol/core/ext/skills';
import type { Resource, Server, ServerContext } from '@modelcontextprotocol/server';
import { ProtocolError, ProtocolErrorCode } from '@modelcontextprotocol/server';
import type { Skill } from '@modelcontextprotocol/server/ext/skills';
import {
  DIRECTORY_MIME_TYPE,
  RESOURCES_DIRECTORY_READ_METHOD,
  SKILL_LIMITS,
  SKILLS_GET_METHOD,
  SKILLS_LIST_METHOD,
  skillEntry,
} from '@modelcontextprotocol/server/ext/skills';

/**
 * Agent Skills served over the MCP Skills extension (SEP-2640, `io.modelcontextprotocol/skills`).
 */
export interface MCPServerSkills {
  /**
   * Skill files, keyed by `/`-separated path relative to the skills root. Every folder holding a
   * `SKILL.md` is a skill named after the folder: `{ 'git-workflow/SKILL.md': '...' }` is served as
   * `skill://git-workflow/SKILL.md`. Read a folder from disk with `readSkillFiles()`.
   */
  files: Record<string, string | Uint8Array>;
  /** Organizational prefix: `'acme'` serves `skill://acme/<skill>/...`. */
  prefix?: string;
  /** Entries per `skills/list` and `resources/directory/read` page. Default 100. */
  pageSize?: number;
  /** How long clients may cache listings, entries and directory reads. Default `{ ttlMs: 0, cacheScope: 'private' }`. */
  cacheHint?: { ttlMs: number; cacheScope: 'public' | 'private' };
}

interface SkillFile {
  bytes: Uint8Array;
  mimeType: string;
}

/** The skills of one `MCPServerSkills`, with their digests, built once. */
export interface SkillCatalog {
  skills: Skill[];
  byUri: Map<string, Skill>;
  files: Map<string, SkillFile>;
  dirs: Map<string, Resource[]>;
  /** One resource per `SKILL.md`, for `resources/list`. */
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

function uriOf(segments: readonly string[]): string {
  return `skill://${segments.map(encodeSegment).join('/')}`;
}

function splitPath(path: string): string[] | undefined {
  const segments = path.replace(/^\.?\/+/, '').split('/');
  if (segments.some(segment => segment === '' || segment === '.' || segment === '..' || segment.includes('\\'))) {
    return undefined;
  }
  return segments;
}

const encoder = new TextEncoder();
const strictDecoder = new TextDecoder('utf-8', { fatal: true });

function toBytes(content: string | Uint8Array): Uint8Array {
  return typeof content === 'string' ? encoder.encode(content) : content;
}

/**
 * Builds the catalog: one entry per folder holding a `SKILL.md`, listing every file under it (a nested
 * skill's files included) with its SHA-256 digest and size. Invalid skills are skipped with a warning.
 */
export async function buildSkillCatalog(
  config: MCPServerSkills,
  warn: (message: string) => void,
): Promise<SkillCatalog> {
  const prefix = config.prefix === undefined ? [] : splitPath(config.prefix);
  if (prefix === undefined) throw new TypeError(`Invalid skills prefix: ${JSON.stringify(config.prefix)}`);

  const files = new Map<string, Uint8Array>();
  for (const [path, content] of Object.entries(config.files)) {
    const segments = splitPath(path);
    if (segments === undefined) {
      warn(`Skill file path ${JSON.stringify(path)} is not a relative '/'-separated path (skipped)`);
      continue;
    }
    files.set(segments.join('/'), toBytes(content));
  }

  if (files.has('SKILL.md')) warn('A SKILL.md at the skills root has no skill folder (skipped)');
  const skillDirs = [...files.keys()]
    .filter(path => path.endsWith('/SKILL.md'))
    .map(path => path.slice(0, -'/SKILL.md'.length));

  const skills: Skill[] = [];
  const servedFiles = new Map<string, SkillFile>();
  const servedPaths = new Set<string>();
  const servedDirs = new Set<string>();

  for (const dir of skillDirs) {
    const inside: Record<string, Uint8Array> = {};
    for (const [path, bytes] of files) {
      if (path.startsWith(`${dir}/`)) inside[path.slice(dir.length + 1)] = bytes;
    }
    let skill: Skill;
    try {
      skill = await skillEntry([...prefix, dir].join('/'), inside);
    } catch (error) {
      warn(`Skill ${dir} is invalid (skipped): ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const uris = new Set(Array.isArray(skill.resources) ? skill.resources.map(resource => resource.uri) : []);
    const paths = Object.keys(inside).map(relative => `${dir}/${relative}`);
    if (paths.some(path => !uris.has(uriOf([...prefix, ...path.split('/')])))) {
      warn(`Skill ${dir} has file names that cannot be served as skill:// URIs (skipped)`);
      continue;
    }
    const total = paths.reduce((sum, path) => sum + files.get(path)!.byteLength, 0);
    if (paths.length > SKILL_LIMITS.files || total > SKILL_LIMITS.bytes) {
      warn(`Skill ${dir} has ${paths.length} files / ${total} bytes, over the limits some hosts enforce`);
    }
    skills.push(skill);
    for (const path of paths) servedPaths.add(path);
    const dirSegments = dir.split('/');
    for (const path of paths) {
      const segments = path.split('/');
      for (let depth = dirSegments.length; depth < segments.length; depth++) {
        servedDirs.add(segments.slice(0, depth).join('/'));
      }
    }
  }

  for (const path of servedPaths) {
    servedFiles.set(uriOf([...prefix, ...path.split('/')]), {
      bytes: files.get(path)!,
      mimeType: path.endsWith('/SKILL.md') ? 'text/markdown' : mimeTypeFor(path.slice(path.lastIndexOf('/') + 1)),
    });
  }

  const dirs = new Map<string, Resource[]>();
  for (const dir of servedDirs) {
    const children = new Map<string, Resource>();
    for (const path of servedPaths) {
      if (!path.startsWith(`${dir}/`)) continue;
      const [name, ...rest] = path.slice(dir.length + 1).split('/');
      const childSegments = [...prefix, ...dir.split('/'), name!];
      if (rest.length > 0) {
        children.set(name!, { uri: uriOf(childSegments), name: name!, mimeType: DIRECTORY_MIME_TYPE });
      } else {
        const file = servedFiles.get(uriOf(childSegments))!;
        children.set(name!, {
          uri: uriOf(childSegments),
          name: name!,
          mimeType: file.mimeType,
          size: file.bytes.byteLength,
        });
      }
    }
    dirs.set(uriOf([...prefix, ...dir.split('/')]), [...children.values()].sort(byUri));
  }

  skills.sort(byUri);
  return {
    skills,
    byUri: new Map(skills.map(skill => [skill.uri, skill])),
    files: servedFiles,
    dirs,
    listed: skills.map(skill => ({
      uri: skill.uri,
      name: String(skill.frontmatter.name),
      description: String(skill.frontmatter.description),
      mimeType: 'text/markdown',
      size: servedFiles.get(skill.uri)?.bytes.byteLength,
    })),
  };
}

/** A skill file as `resources/read` contents: `text` when the bytes are UTF-8, a base64 `blob` otherwise. */
export function skillFileContents(
  uri: string,
  file: SkillFile,
): { uri: string; mimeType: string } & ({ text: string } | { blob: string }) {
  try {
    return { uri, mimeType: file.mimeType, text: strictDecoder.decode(file.bytes) };
  } catch {
    let binary = '';
    for (const byte of file.bytes) binary += String.fromCharCode(byte);
    return { uri, mimeType: file.mimeType, blob: btoa(binary) };
  }
}

function page<T>(items: readonly T[], cursor: string | undefined, size: number): { items: T[]; nextCursor?: string } {
  let offset = 0;
  if (cursor !== undefined) {
    offset = Number(cursor);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > items.length) {
      throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Invalid cursor: ${cursor}`);
    }
  }
  const next = offset + size;
  return next < items.length
    ? { items: items.slice(offset, next), nextCursor: String(next) }
    : { items: items.slice(offset) };
}

export interface SkillHandlerDeps {
  catalog: () => Promise<SkillCatalog>;
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

/** Registers `skills/list`, `skills/get` and `resources/directory/read` on one protocol instance. */
export function registerSkillHandlers(server: Server, deps: SkillHandlerDeps): void {
  const pageSize = deps.config.pageSize ?? DEFAULT_PAGE_SIZE;
  const cache = deps.config.cacheHint ?? { ttlMs: 0, cacheScope: 'private' as const };

  server.setRequestHandler(SKILLS_LIST_METHOD, { params: ListSkillsRequestParamsSchema }, (params, ctx) =>
    deps.trace(server, SKILLS_LIST_METHOD, params, ctx, async () => {
      const { items, nextCursor } = page((await deps.catalog()).skills, params.cursor, pageSize);
      return { skills: items, ...(nextCursor === undefined ? {} : { nextCursor }), ...cache };
    }),
  );

  server.setRequestHandler(SKILLS_GET_METHOD, { params: GetSkillRequestParamsSchema }, (params, ctx) =>
    deps.trace(server, SKILLS_GET_METHOD, params, ctx, async () => {
      const skill = (await deps.catalog()).byUri.get(params.uri);
      if (!skill) throw new ProtocolError(ProtocolErrorCode.InvalidParams, `No skill is served at ${params.uri}`);
      return { skill, ...cache };
    }),
  );

  server.setRequestHandler(
    RESOURCES_DIRECTORY_READ_METHOD,
    { params: ReadResourceDirectoryRequestParamsSchema },
    (params, ctx) =>
      deps.trace(server, RESOURCES_DIRECTORY_READ_METHOD, params, ctx, async () => {
        const children = (await deps.catalog()).dirs.get(params.uri);
        if (!children)
          throw new ProtocolError(ProtocolErrorCode.InvalidParams, `${params.uri} is not a directory resource`);
        const { items, nextCursor } = page(children, params.cursor, pageSize);
        return { resources: items, ...(nextCursor === undefined ? {} : { nextCursor }), ...cache };
      }),
  );
}

/**
 * Reads a folder of skills from disk into the `files` map `MCPServer`'s `skills` option takes.
 * Symbolic links and other special files are skipped. Node.js only.
 */
export async function readSkillFiles(root: string): Promise<Record<string, Uint8Array>> {
  const { readdir, readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const files: Record<string, Uint8Array> = {};
  const walk = async (relative: string): Promise<void> => {
    for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
      const path = relative === '' ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files[path] = new Uint8Array(await readFile(join(root, path)));
    }
  };
  await walk('');
  return files;
}
