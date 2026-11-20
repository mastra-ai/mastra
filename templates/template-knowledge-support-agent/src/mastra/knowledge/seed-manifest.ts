import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import {
  assertKnowledgeNoteTextWithinBound,
  assertKnowledgePageDescriptionWithinBound,
  knowledgeScopeAddress,
  knowledgeLinkRefKey,
  MAX_KNOWLEDGE_PAGE_DEPTH,
  MAX_KNOWLEDGE_PAGE_LINK_REF_LENGTH,
} from '@mastra/core/knowledge';
import { validateProfile, type Profile } from '../identity.ts';

export interface DatasetConfiguration {
  id: string;
  directory: string;
  profiles: Profile[];
  mandatoryPolicies: { profileId: string; pageKey: string; ref?: string }[];
}

export interface SupportRecord {
  topicTags: string[];
  observedOn: string;
  state: 'open' | 'approved';
  summary: string;
  applicability?: string;
}
export interface PreparedNote {
  key: string;
  text: string;
  when?: Date;
  marker: string;
  refs: string[];
}
export interface PreparedPage {
  key: string;
  scope: string;
  path: string;
  name: string;
  description: string;
  body: string;
  marker: string;
  refs: string[];
  notes: PreparedNote[];
}
export interface PreparedDataset {
  id: string;
  version: string;
  pages: PreparedPage[];
}

function object(value: unknown, fields: string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  const obj = value as Record<string, unknown>;
  if (Object.keys(obj).some(key => !fields.includes(key))) throw new Error(`Unknown field in ${label}`);
  return obj;
}
function string(value: unknown, label: string, max = 1000): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value !== value.trim() ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  ) {
    throw new Error(`Invalid ${label}`);
  }
  if (/<!--\s*knowledge-seed:|Seed note:/iu.test(value)) throw new Error(`Reserved seed marker in ${label}`);
  return value;
}
function line(value: unknown, label: string, max = 200): string {
  const text = string(value, label, max);
  if (/[\r\n<>\[\]]/u.test(text)) throw new Error(`Invalid ${label}`);
  return text;
}
function key(value: unknown, label: string): string {
  const result = string(value, label, 80);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(result)) throw new Error(`Expected a normalized ${label}`);
  return result;
}
function array(value: unknown, label: string, max = 500): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`Invalid ${label}`);
  return value;
}
function date(value: unknown, label: string): string {
  const result = string(value, label, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(result) ||
    !Number.isFinite(Date.parse(result)) ||
    new Date(result).toISOString().slice(0, 10) !== result
  ) {
    throw new Error(`Invalid ${label}`);
  }
  return result;
}
function url(value: unknown): string {
  const result = string(value, 'source URL', 2000);
  const parsed = URL.parse(result);
  if (!parsed) throw new Error('Invalid source URL');
  if (
    !['https:', 'http:'].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    /[\s<>\\]/u.test(result)
  )
    throw new Error('Unsafe source URL');
  return result;
}
export function validateSupportRecord(value: unknown): SupportRecord {
  const obj = object(value, ['topicTags', 'observedOn', 'state', 'summary', 'applicability'], 'support record');
  const tags = array(obj.topicTags, 'topic tags', 20).map(tag => key(tag, 'topic tag'));
  if (!tags.length || new Set(tags).size !== tags.length) throw new Error('Invalid topic tags');
  if (obj.state !== 'open' && obj.state !== 'approved') throw new Error('Invalid support record state');
  return {
    topicTags: tags,
    observedOn: date(obj.observedOn, 'observation date'),
    state: obj.state,
    summary: string(obj.summary, 'record summary', 1000),
    ...(obj.applicability === undefined
      ? {}
      : { applicability: string(obj.applicability, 'record applicability', 1000) }),
  };
}

async function containedFile(root: string, file: unknown) {
  const name = string(file, 'Markdown file', 500);
  if (
    isAbsolute(name) ||
    name.includes('\\') ||
    name.split('/').some(part => !part || part === '.' || part === '..') ||
    !name.endsWith('.md')
  )
    throw new Error('Expected a relative Markdown file');
  const path = await realpath(resolve(root, name));
  const rel = relative(root, path);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel) || !(await stat(path)).isFile())
    throw new Error('Markdown file escapes the dataset');
  return readFile(path, 'utf8');
}

function placement(value: unknown, profiles: Map<string, Profile>) {
  const obj = object(value, ['kind', 'profile'], 'placement');
  if (!['docs', 'tenant', 'customer'].includes(String(obj.kind))) throw new Error('Unregistered placement kind');
  const profile = profiles.get(key(obj.profile, 'profile key'));
  if (!profile) throw new Error('Unknown example profile');
  const kind = obj.kind as 'docs' | 'tenant' | 'customer';
  const scope =
    kind === 'customer'
      ? knowledgeScopeAddress('customer:$tenantId:$customerId', { ...profile })
      : knowledgeScopeAddress(`${kind}:$tenantId`, { ...profile });
  return { kind, profile, scope };
}

function canLink(from: ReturnType<typeof placement>, to: ReturnType<typeof placement>) {
  if (from.profile.tenantId !== to.profile.tenantId) return false;
  return to.kind !== 'customer' || (from.kind === 'customer' && from.profile.customerId === to.profile.customerId);
}

/** Conservative link grammar: managed wiki aliases/canonical refs, HTTPS/HTTP URLs, and local anchors. */
function renderLinks(text: string, resolveAlias: (ref: string) => string) {
  if (/<!--\s*knowledge-seed:|Seed note:|<\/?[a-z!]|\]\s*\[|\[(?:\\[\s\S]|[^\[\]\\])+\]:/iu.test(text))
    throw new Error('Unsupported or reserved Markdown syntax');
  const refs = new Set<string>();
  const rendered = text.replace(/\[\[([\s\S]*?)\]\]/gu, (_, raw: string) => {
    if (raw !== raw.trim() || /[\[\]\r\n]/u.test(raw)) throw new Error('Ambiguous wiki link');
    const ref = resolveAlias(raw);
    refs.add(ref);
    return `[[${ref}]]`;
  });
  for (const match of rendered.matchAll(/\]\(([^)]*)\)/gu)) {
    const target = match[1]!;
    if (/[\r\n]/u.test(target)) throw new Error('Multiline Markdown destinations are unsupported');
    if (target.includes('(') || /&(?:#(?:x[\da-f]+|\d+)|[a-z][a-z\d]*);/iu.test(target))
      throw new Error('Ambiguous Markdown destinations are unsupported');
    if (/^#[a-zA-Z0-9_-]+$/u.test(target)) continue;
    url(target);
  }
  // GFM autolinks both HTTP(S) URLs and www. authorities.
  if (/\b(?:https?:\/\/|www\.)[^\s/?#]*@/iu.test(rendered)) throw new Error('Unsafe Markdown URL authority');
  // A malformed wiki link must never turn into an unmanaged native reference.
  if (rendered.replace(/\[\[[^\[\]]+\]\]/gu, '').includes('[[')) throw new Error('Malformed wiki link');
  return { text: rendered, refs: [...refs] };
}

export const pageMarker = (dataset: string, page: string) => `<!-- knowledge-seed:page:${dataset}:${page} -->`;
export const noteMarker = (dataset: string, page: string, note: string) => `Seed note: ${dataset}/${page}/${note}`;

/** Pure with respect to Knowledge storage: read and validate every input before opening a database. */
export async function prepareDataset(config: DatasetConfiguration): Promise<PreparedDataset> {
  key(config.id, 'dataset ID');
  const profiles = new Map<string, Profile>();
  for (const profile of config.profiles) {
    validateProfile(profile);
    key(profile.id, 'profile key');
    if (profiles.has(profile.id)) throw new Error('Duplicate profile key');
    profiles.set(profile.id, profile);
  }
  const root = await realpath(config.directory);
  const manifestPath = await realpath(resolve(root, 'manifest.json'));
  if (relative(root, manifestPath) !== 'manifest.json') throw new Error('Manifest escapes the dataset');
  const manifest = object(
    JSON.parse(await readFile(manifestPath, 'utf8')),
    ['schemaVersion', 'id', 'version', 'pages'],
    'manifest',
  );
  if (manifest.schemaVersion !== 1 || key(manifest.id, 'dataset ID') !== config.id)
    throw new Error('Incompatible dataset manifest');
  const version = line(manifest.version, 'dataset version', 80);
  const destinations = new Set<string>();
  const aliases = new Map<string, Awaited<ReturnType<typeof readPage>>>();
  async function readPage(value: unknown, existing: ReadonlyMap<string, unknown>) {
    const obj = object(
      value,
      ['key', 'path', 'title', 'file', 'scope', 'kind', 'description', 'source', 'links', 'notes', 'record'],
      'page',
    );
    const alias = key(obj.key, 'page key');
    if (existing.has(alias)) throw new Error('Duplicate page key');
    const path = string(obj.path, 'page path', 800);
    const parts = path.split('/');
    if (parts.length > MAX_KNOWLEDGE_PAGE_DEPTH || parts.some(part => key(part, 'path key') !== part))
      throw new Error('Invalid page path');
    const target = placement(obj.scope, profiles);
    const ref = `${target.scope}#${path}`;
    if (ref.length > MAX_KNOWLEDGE_PAGE_LINK_REF_LENGTH)
      throw new Error('Canonical reference exceeds the native link limit');
    const destinationKey = knowledgeLinkRefKey(ref);
    if (destinations.has(destinationKey)) throw new Error('Duplicate or ambiguous canonical destination');
    destinations.add(destinationKey);
    const name = line(obj.title, 'page title');
    if (obj.kind !== undefined && !['policy', 'reference', 'case'].includes(String(obj.kind)))
      throw new Error('Invalid page kind');
    const description = obj.description === undefined ? undefined : line(obj.description, 'description', 1000);
    assertKnowledgePageDescriptionWithinBound(description);
    let body = string((await containedFile(root, obj.file)).trim(), 'Markdown body', 1_000_000);
    const envelopes = [...body.matchAll(/^```support-record\n([\s\S]*?)\n```[ \t]*$/gmu)];
    if (envelopes.length > 1 || (envelopes.length && obj.record !== undefined))
      throw new Error('Duplicate support record envelope');
    if (body.includes('```support-record') && !envelopes.length) throw new Error('Malformed support record envelope');
    if (envelopes.length) validateSupportRecord(JSON.parse(envelopes[0]![1]!));
    if (obj.record !== undefined)
      body += `\n\n\`\`\`support-record\n${JSON.stringify(validateSupportRecord(obj.record), null, 2)}\n\`\`\``;
    return { input: obj, key: alias, path, name, description, placement: target, body, ref };
  }
  for (const value of array(manifest.pages, 'pages')) {
    const page = await readPage(value, aliases);
    aliases.set(page.key, page);
  }
  for (const mapping of config.mandatoryPolicies) {
    const profile = profiles.get(mapping.profileId);
    const page = aliases.get(mapping.pageKey);
    if (
      !profile ||
      !page ||
      (mapping.ref !== undefined && page.ref !== mapping.ref) ||
      page.input.kind !== 'policy' ||
      !['tenant', 'docs'].includes(page.placement.kind) ||
      page.placement.profile.tenantId !== profile.tenantId
    )
      throw new Error('Invalid mandatory policy mapping');
  }
  const byRef = new Map([...aliases.values()].map(page => [page.ref, page]));
  const pages = [...aliases].map(([alias, page]) => {
    const lookup = (ref: string) => {
      const target = aliases.get(ref) ?? byRef.get(ref);
      if (!target) throw new Error(`Unknown link alias or unmanaged reference: ${ref}`);
      if (!canLink(page.placement, target.placement)) throw new Error(`Link crosses its audience: ${ref}`);
      return target.ref;
    };
    const parts = [page.body];
    if (page.input.source !== undefined) {
      const source = object(page.input.source, ['kind', 'url', 'verifiedOn', 'license'], 'source');
      parts.push(
        `Source: ${line(source.kind, 'source kind')}${source.url === undefined ? '' : ` (${url(source.url)})`}${source.verifiedOn === undefined ? '' : `; verified ${date(source.verifiedOn, 'source verification date')}`}${source.license === undefined ? '' : `; license: ${line(source.license, 'source license')}`}.`,
      );
    }
    if (page.input.links !== undefined) {
      const links = array(page.input.links, 'links', 100).map(value => lookup(key(value, 'link alias')));
      if (new Set(links).size !== links.length) throw new Error('Duplicate link alias');
      parts.push(links.map(ref => `- [[${ref}]]`).join('\n'));
    }
    const body = renderLinks(parts.join('\n\n'), lookup);
    const noteKeys = new Set<string>();
    const notes = (page.input.notes === undefined ? [] : array(page.input.notes, 'notes', 100)).map(value => {
      const obj = object(value, ['key', 'text', 'date', 'author'], 'note');
      const noteKey = key(obj.key, 'note key');
      if (noteKeys.has(noteKey)) throw new Error('Duplicate note key');
      noteKeys.add(noteKey);
      const rendered = renderLinks(string(obj.text, 'note text', 5000), lookup);
      const marker = noteMarker(config.id, alias, noteKey);
      const text = `${marker}\n${rendered.text}${obj.author === undefined ? '' : `\nFixture author: ${line(obj.author, 'fixture author')}`}`;
      assertKnowledgeNoteTextWithinBound(text);
      return {
        key: noteKey,
        text,
        marker,
        refs: rendered.refs,
        when: obj.date === undefined ? undefined : new Date(date(obj.date, 'note date')),
      };
    });
    const marker = pageMarker(config.id, alias);
    return {
      key: alias,
      scope: page.placement.scope,
      path: page.path,
      name: page.name,
      description: page.description ?? '',
      body: `${marker}\n${body.text}\n`,
      marker,
      refs: body.refs,
      notes,
    };
  });
  return { id: config.id, version, pages };
}
