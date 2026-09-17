import { constants } from 'node:fs';
import { access, lstat, readdir, readFile, realpath } from 'node:fs/promises';
import { basename, relative, resolve, sep } from 'node:path';
import { TextDecoder } from 'node:util';

import { ContainmentActionTypeSchema } from '../../schemas/containment.js';
import { RunbookError } from './errors.js';
import { sha256 } from './hashes.js';
import { RunbookFrontmatterSchema, type AllowedAction, type RunbookFrontmatter } from './schemas.js';
import { RUNBOOK_SECTIONS, sectionKey } from './sections.js';

const MAX_RUNBOOK_BYTES = 65_536;
const redactionFixtureMarker = /<!-- redaction-source: [^<>\r\n]{1,512} -->\n?/gu;
const actionPolicy = {
  unauthorized_privilege_change: ['restore_previous_role', 'revoke_session'],
  disallowed_country_login: ['revoke_session', 'require_reauthentication'],
  unknown_device_login: ['revoke_session', 'mark_device_for_review'],
} as const satisfies Readonly<Record<string, readonly AllowedAction[]>>;

export type LoadedRunbook = Readonly<{
  metadata: RunbookFrontmatter;
  sourcePath: string;
  sourceHash: string;
  parsedHash: string;
  sections: readonly Readonly<{ heading: string; key: string; body: string }>[];
  allowedActions: readonly AllowedAction[];
  prohibitedActions: readonly string[];
}>;

export async function loadRunbooks(root: string): Promise<readonly LoadedRunbook[]> {
  const rootPath = await realpath(root);
  const entries = (await readdir(rootPath, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
  const loaded: LoadedRunbook[] = [];
  for (const entry of entries) {
    if (!/^[a-z0-9-]+\.md$/u.test(entry.name) || !entry.isFile() || entry.isSymbolicLink()) fail();
    loaded.push(await loadRunbook(rootPath, entry.name));
  }
  if (loaded.length === 0) fail();
  const identities = new Set<string>();
  const activeKinds = new Set<string>();
  for (const runbook of loaded) {
    const identity = `${runbook.metadata.id}@${runbook.metadata.version}`;
    if (identities.has(identity)) fail();
    identities.add(identity);
    if (runbook.metadata.status === 'active') {
      const kind = runbook.metadata.incidentKinds[0];
      if (!kind || activeKinds.has(kind)) fail();
      activeKinds.add(kind);
    }
  }
  return Object.freeze(loaded);
}

export async function loadRunbook(root: string, fileName: string): Promise<LoadedRunbook> {
  if (basename(fileName) !== fileName || !/^[a-z0-9-]+\.md$/u.test(fileName)) fail();
  const rootPath = await realpath(root);
  const requested = resolve(rootPath, fileName);
  const requestedStats = await lstat(requested).catch(() => fail());
  if (!requestedStats.isFile() || requestedStats.isSymbolicLink()) fail();
  const file = await realpath(requested);
  if (!isChild(rootPath, file)) fail();
  const stats = await lstat(file);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size > MAX_RUNBOOK_BYTES) fail();
  await access(file, constants.R_OK);
  const bytes = await readFile(file);
  if (bytes.includes(0) || (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)) fail();
  let markdown: string;
  try {
    markdown = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    fail();
  }
  if (markdown.includes('\r')) fail();
  // A redaction-test marker is excluded from retrievable text while the byte
  // hash still commits to the exact source file.
  const { frontmatter, body } = parseFrontmatter(markdown.replace(redactionFixtureMarker, ''));
  const metadataResult = RunbookFrontmatterSchema.safeParse(frontmatter);
  if (!metadataResult.success) fail();
  const metadata = metadataResult.data;
  if (metadata.incidentKinds.length !== 1) fail();
  const kind = metadata.incidentKinds[0];
  if (!kind) fail();
  const sections = parseSections(body);
  if (!sections[0]?.body.includes(`Incident kind: \`${kind}\``)) fail();
  await validateLinks(body, rootPath);
  const actions = parseActions(sections[5]?.body ?? '');
  if (
    actions.allowed.join('\0') !== actionPolicy[kind].join('\0') ||
    actions.prohibited.some(action => actions.allowed.includes(action as AllowedAction))
  )
    fail();
  const sourcePath = `runbooks/${fileName}`;
  return Object.freeze({
    metadata,
    sourcePath,
    sourceHash: sha256(bytes),
    parsedHash: sha256(JSON.stringify({ metadata, sections, actions })),
    sections: Object.freeze(sections),
    allowedActions: Object.freeze(actions.allowed),
    prohibitedActions: Object.freeze(actions.prohibited),
  });
}

function parseFrontmatter(markdown: string): {
  frontmatter: unknown;
  body: string;
} {
  const lines = markdown.split('\n');
  if (lines[0] !== '---') fail();
  const close = lines.indexOf('---', 1);
  if (close < 1 || lines.indexOf('---', close + 1) !== -1) fail();
  const header = lines.slice(1, close);
  if (header.some(line => /[\t&*!]|<<|\{|\}|\[|\]/u.test(line))) fail();
  const result: Record<string, unknown> = {};
  let list: string[] | undefined;
  for (const line of header) {
    const item = /^ {2}- ([A-Za-z0-9 ,.'`()_-]{1,512})$/u.exec(line);
    if (item) {
      if (!list || !item[1]) fail();
      list.push(item[1]);
      continue;
    }
    const scalar = /^([A-Za-z][A-Za-z]*): ([A-Za-z0-9._-]+)$/u.exec(line);
    const listStart = /^([A-Za-z][A-Za-z]*):$/u.exec(line);
    const key = scalar?.[1] ?? listStart?.[1];
    if (!key || Object.hasOwn(result, key)) fail();
    if (listStart) {
      list = [];
      result[key] = list;
    } else {
      list = undefined;
      result[key] = scalar?.[2];
    }
  }
  return { frontmatter: result, body: lines.slice(close + 1).join('\n') };
}

function parseSections(body: string): LoadedRunbook['sections'] {
  const lines = body.split('\n');
  const headings = lines.map((line, index) => ({ line, index })).filter(({ line }) => line.startsWith('## '));
  if (headings.length !== RUNBOOK_SECTIONS.length) fail();
  const sections = headings.map((current, ordinal) => {
    const heading = current.line.slice(3);
    if (heading !== RUNBOOK_SECTIONS[ordinal]) fail();
    const next = headings[ordinal + 1]?.index ?? lines.length;
    const content = lines
      .slice(current.index + 1, next)
      .join('\n')
      .trim();
    if (!content || content.length > 16_384) fail();
    return Object.freeze({ heading, key: sectionKey(heading), body: content });
  });
  if (lines.some(line => /^# |^#{4,} /u.test(line))) fail();
  return Object.freeze(sections);
}

function parseActions(body: string): {
  allowed: AllowedAction[];
  prohibited: string[];
} {
  const allowedIndex = body.indexOf('### Allowed\n');
  const prohibitedIndex = body.indexOf('### Prohibited\n');
  if (allowedIndex !== 0 || prohibitedIndex <= allowedIndex) fail();
  const parseList = (value: string) => {
    const lines = value.trim().split('\n');
    if (lines.length === 0) fail();
    return lines.map(line => {
      const match = /^- `([a-z][a-z0-9_]{2,63})`: .{8,512}$/u.exec(line);
      if (!match?.[1]) fail();
      return match[1];
    });
  };
  const allowedRaw = parseList(body.slice('### Allowed\n'.length, prohibitedIndex));
  const prohibited = parseList(body.slice(prohibitedIndex + '### Prohibited\n'.length));
  if (new Set([...allowedRaw, ...prohibited]).size !== allowedRaw.length + prohibited.length) fail();
  const allowed = allowedRaw.map(action => {
    const parsed = ContainmentActionTypeSchema.safeParse(action);
    if (!parsed.success) fail();
    return parsed.data;
  });
  return { allowed, prohibited };
}

async function validateLinks(body: string, root: string): Promise<void> {
  for (const match of body.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
    const target = match[1];
    if (!target || target.includes('\0') || target.startsWith('/') || target.startsWith('../')) fail();
    if (/^(file|javascript|data):/iu.test(target)) fail();
    if (target.startsWith('https://')) {
      let url: URL;
      try {
        url = new URL(target);
      } catch {
        fail();
      }
      if (url.hostname !== 'mastra.ai') fail();
    } else if (target.startsWith('#')) {
      const anchor = target.slice(1);
      const knownAnchors = new Set(
        body
          .split('\n')
          .filter(line => /^#{2,3} /u.test(line))
          .map(line => sectionKey(line.replace(/^#{2,3} /u, ''))),
      );
      if (!knownAnchors.has(anchor)) fail();
    } else {
      const localTarget = target.split('#', 1)[0];
      if (!localTarget) fail();
      const localPath = await realpath(resolve(root, localTarget)).catch(() => fail());
      if (!isChild(root, localPath)) fail();
    }
  }
}

function isChild(root: string, target: string): boolean {
  const child = relative(root, target);
  return child !== '' && !child.startsWith('..') && !child.includes(`${sep}..${sep}`);
}

function fail(): never {
  throw new RunbookError('RUNBOOK_VALIDATION_FAILED');
}
