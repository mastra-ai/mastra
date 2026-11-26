import { open, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fromMarkdown } from 'mdast-util-from-markdown';
import {
  assertKnowledgeNoteTextWithinBound,
  assertKnowledgePageDescriptionWithinBound,
  knowledgeScopeAddress,
  knowledgeLinkRefKey,
  MAX_KNOWLEDGE_PAGE_DEPTH,
  MAX_KNOWLEDGE_PAGE_BODY_LINKS,
  MAX_KNOWLEDGE_PAGE_LINK_REF_LENGTH,
  type KnowledgePage,
} from '@mastra/core/knowledge';
import { validateProfile, type Profile } from '../identity.ts';
import { readApprovedPolicyRevisions, requiredPolicyContentIssue } from './required-policy.ts';
import { supportRecordEnvelope } from './support-record-envelope.ts';

export interface DatasetConfiguration {
  id: string;
  directory: string;
  /** Trusted relative manifest filename; content cannot select another root or authority. */
  manifestFile?: string;
  profiles: Profile[];
  mandatoryPolicies: { profileId: string; pageKey: string; ref?: string }[];
}

export const MAX_SUPPORT_RECORD_BODY_LENGTH = 1_000_000;
// UTF-8 takes at most three bytes per UTF-16 code unit. Allow additional bytes for normalized whitespace.
const MAX_MARKDOWN_FILE_BYTES = MAX_SUPPORT_RECORD_BODY_LENGTH * 4;
const MAX_MANIFEST_FILE_BYTES = 16 * 1024 * 1024;
const MAX_RENDERED_DATASET_LENGTH = 32_000_000;

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
  requiredPolicyFile?: string;
  links: Map<string, number>;
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
function string(value: unknown, label: string, max = 1000, preserveIndentation = false): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    (!preserveIndentation && value !== value.trim()) ||
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
    !/^https?:\/\/[^/]/iu.test(result) ||
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

async function containedFile(root: string, name: string) {
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
  return readBoundedFile(path, MAX_MARKDOWN_FILE_BYTES, `Markdown file ${name}`);
}

async function readBoundedFile(path: string, maxBytes: number, label: string) {
  const file = await open(path, 'r');
  try {
    const bytes = Buffer.allocUnsafe(maxBytes + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await file.read(bytes, offset, bytes.length - offset, null);
      if (!bytesRead) return bytes.toString('utf8', 0, offset);
      offset += bytesRead;
    }
    throw new Error(`${label} exceeds the ${maxBytes}-byte read bound`);
  } finally {
    await file.close();
  }
}

function placement(value: unknown, profiles: Map<string, Profile>) {
  const obj = object(value, ['kind', 'profile'], 'placement');
  const kind = obj.kind;
  if (kind !== 'docs' && kind !== 'tenant' && kind !== 'customer') throw new Error('Unregistered placement kind');
  const profile = profiles.get(key(obj.profile, 'profile key'));
  if (!profile) throw new Error('Unknown example profile');
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

type RenderLimit = { maxLength: number; message: string };

/** Conservative link grammar: managed wiki aliases/canonical refs, HTTPS/HTTP URLs, and local anchors. */
function renderLinks(text: string, resolveAlias: (ref: string) => string, literals: string[], limit: RenderLimit) {
  const links = new Map<string, number>();
  if (/<\/?[a-z!]/iu.test(text)) throw new Error('Unsupported or reserved Markdown syntax');
  // Keep URL-like text intact for GFM autolinks and generated source attribution.
  if (/\b(?:https?:\/\/|www\.)[^\s/?#]*@/iu.test(text)) throw new Error('Unsafe Markdown URL authority');
  const prose = text.replace(
    /\b(?:https?:\/\/|www\.)[^\s<>\u0000]+/giu,
    value => `\u0000${literals.push(value) - 1}\u0000`,
  );
  const rendered: string[] = [];
  const unlinked: string[] = [];
  let remaining = limit.maxLength;
  function append(value: string) {
    if (value.length > remaining) throw new Error(limit.message);
    remaining -= value.length;
    if (value) rendered.push(value);
  }
  let offset = 0;
  const token = /\[\[|\u0000(\d+)\u0000/gu;
  const delimiter = /[\[\]\r\n\u0000]/gu;
  for (let match = token.exec(prose); match; match = token.exec(prose)) {
    const plain = prose.slice(offset, match.index);
    append(plain);
    unlinked.push(plain, '\u0000');
    offset = token.lastIndex;
    if (match[1] !== undefined) {
      append(literals[Number(match[1])]!);
      continue;
    }
    delimiter.lastIndex = offset;
    const close = delimiter.exec(prose);
    if (!close || (close[0] === ']' && prose[close.index + 1] !== ']')) throw new Error('Malformed wiki link');
    if (close[0] !== ']') throw new Error('Ambiguous wiki link');
    const raw = prose.slice(offset, close.index);
    if (raw !== raw.trim()) throw new Error('Ambiguous wiki link');
    const ref = resolveAlias(raw);
    append(`[[${ref}]]`);
    links.set(ref, (links.get(ref) ?? 0) + 1);
    offset = token.lastIndex = close.index + 2;
  }
  const tail = prose.slice(offset);
  append(tail);
  unlinked.push(tail);
  const markdown = unlinked.join('');
  if (/<!--\s*knowledge-seed:|Seed note:|<\/?[a-z!]|\]\s*\[|\[(?:\\[\s\S]|[^\[\]\\])+\]:/iu.test(markdown))
    throw new Error('Unsupported or reserved Markdown syntax');
  return { text: rendered.join(''), links };
}

type MarkdownNode = {
  type: string;
  url?: string;
  position?: { start: { offset?: number }; end: { offset?: number } };
  children?: MarkdownNode[];
};

export function withoutMarkdownCode(body: string) {
  const bomLength = body.startsWith('\uFEFF') ? 1 : 0;
  const parts: string[] = [];
  let offset = 0;
  function visit(node: MarkdownNode) {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if ((node.type === 'code' || node.type === 'inlineCode') && start !== undefined && end !== undefined) {
      parts.push(body.slice(offset, start + bomLength), ' ');
      offset = end + bomLength;
    } else {
      node.children?.forEach(visit);
    }
  }
  visit(fromMarkdown(body));
  return [...parts, body.slice(offset)].join('');
}

function rejectHtml(node: MarkdownNode) {
  if (node.type === 'html') throw new Error('Unsupported or reserved Markdown syntax');
  node.children?.forEach(rejectHtml);
}

function renderMarkdownLinks(
  body: string,
  resolveAlias: (ref: string) => string,
  limit: RenderLimit,
  generatedOffset = body.length,
) {
  const bomLength = body.startsWith('\uFEFF') ? 1 : 0;
  const literals: string[] = [];
  const parts: string[] = [];
  let offset = 0;
  function mask(start: number, end: number) {
    parts.push(body.slice(offset, start), `\u0000${literals.push(body.slice(start, end)) - 1}\u0000`);
    offset = end;
  }
  function protect(node: MarkdownNode) {
    if (node.type === 'html') throw new Error('Unsupported or reserved Markdown syntax');
    const parsedStart = node.position?.start.offset;
    const parsedEnd = node.position?.end.offset;
    if (parsedStart === undefined || parsedEnd === undefined) return;
    const start = parsedStart + bomLength;
    const end = parsedEnd + bomLength;
    if (node.type === 'code' || node.type === 'inlineCode') {
      if (start < generatedOffset && end > generatedOffset)
        throw new Error('Unclosed Markdown code block before generated page content');
      mask(start, end);
      return;
    }
    node.children?.forEach(protect);
    if ((node.type !== 'link' && node.type !== 'image') || body[start] === '<') return;
    const target = node.url!;
    // The parser identifies the link. Keep the existing restricted syntax for its source destination.
    const source = body.slice(start, end);
    const destination = source.slice(source.lastIndexOf('](') + 2, -1);
    if (/[\r\n]/u.test(destination)) throw new Error('Multiline Markdown destinations are unsupported');
    if (destination !== target || /[()\r\n]|&(?:#(?:x[\da-f]+|\d+)|[a-z][a-z\d]*);/iu.test(target))
      throw new Error('Ambiguous Markdown destinations are unsupported');
    if (!/^#[a-zA-Z0-9_-]+$/u.test(target)) url(target);
    mask(end - target.length - 1, end - 1);
  }
  protect(fromMarkdown(body));
  parts.push(body.slice(offset));
  return renderLinks(parts.join(''), resolveAlias, literals, limit);
}

export const pageMarker = (dataset: string, page: string) => `<!-- knowledge-seed:page:${dataset}:${page} -->`;
export const noteMarker = (dataset: string, page: string, note: string) => `Seed note: ${dataset}/${page}/${note}`;
const httpsSourceMarker = '<!-- knowledge-seed:source:https -->';

export function hasSeededHttpsSource(page: KnowledgePage) {
  const author = page.createdBy.author;
  const [ownership, source] = page.body?.split('\n', 2) ?? [];
  return (
    author?.startsWith('seed:') &&
    page.updatedBy.author === author &&
    ownership?.startsWith(`<!-- knowledge-seed:page:${author.slice('seed:'.length)}:`) &&
    source === httpsSourceMarker
  );
}

/** Pure with respect to Knowledge storage: read and validate every input before opening a database. */
export async function prepareDataset(
  config: DatasetConfiguration,
  requiredPolicyReference: (profile: Profile) => string,
  policyApprovalFile = process.env.SUPPORT_POLICY_APPROVAL_FILE,
): Promise<PreparedDataset> {
  key(config.id, 'dataset ID');
  const profiles = new Map<string, Profile>();
  for (const profile of config.profiles) {
    validateProfile(profile);
    key(profile.id, 'profile key');
    if (profiles.has(profile.id)) throw new Error('Duplicate profile key');
    profiles.set(profile.id, profile);
  }
  const root = await realpath(config.directory);
  const manifestFile = config.manifestFile ?? 'manifest.json';
  if (!/^[a-z0-9-]+\.json$/u.test(manifestFile)) throw new Error('Invalid configured manifest filename');
  const manifestPath = await realpath(resolve(root, manifestFile));
  if (relative(root, manifestPath) !== manifestFile || !(await stat(manifestPath)).isFile())
    throw new Error('Manifest escapes the dataset');
  const manifest = object(
    JSON.parse(await readBoundedFile(manifestPath, MAX_MANIFEST_FILE_BYTES, `Manifest ${manifestFile}`)),
    ['schemaVersion', 'id', 'version', 'pages'],
    'manifest',
  );
  if (manifest.schemaVersion !== 1 || key(manifest.id, 'dataset ID') !== config.id)
    throw new Error('Incompatible dataset manifest');
  const version = line(manifest.version, 'dataset version', 80);
  const destinations = new Set<string>();
  const aliases = new Map<string, ReturnType<typeof readPage>>();
  function readPage(value: unknown, existing: ReadonlyMap<string, unknown>) {
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
    if (obj.kind !== undefined && obj.kind !== 'policy' && obj.kind !== 'reference' && obj.kind !== 'case')
      throw new Error('Invalid page kind');
    const description = obj.description === undefined ? undefined : line(obj.description, 'description', 1000);
    assertKnowledgePageDescriptionWithinBound(description);
    const file = string(obj.file, 'Markdown file', 500);
    return { input: obj, key: alias, path, name, description, placement: target, file, ref };
  }
  for (const value of array(manifest.pages, 'pages')) {
    const page = readPage(value, aliases);
    aliases.set(page.key, page);
  }
  const mandatoryPolicyKeys = new Set<string>();
  for (const mapping of config.mandatoryPolicies) {
    const profile = profiles.get(mapping.profileId);
    const page = aliases.get(mapping.pageKey);
    if (
      !profile ||
      !page ||
      page.ref !== (mapping.ref ?? requiredPolicyReference(profile)) ||
      page.input.kind !== 'policy' ||
      !['tenant', 'docs'].includes(page.placement.kind) ||
      page.placement.profile.tenantId !== profile.tenantId
    )
      throw new Error('Invalid mandatory policy mapping');
    mandatoryPolicyKeys.add(mapping.pageKey);
  }
  const byRef = new Map([...aliases.values()].map(page => [page.ref, page]));
  let remaining = MAX_RENDERED_DATASET_LENGTH;
  function retain(length: number) {
    if (length > remaining)
      throw new Error(
        `Rendered dataset ${config.id} exceeds the ${MAX_RENDERED_DATASET_LENGTH}-character output bound`,
      );
    remaining -= length;
  }
  const pages: PreparedPage[] = [];
  for (const [alias, page] of aliases) {
    const lookup = (ref: string) => {
      const target = aliases.get(ref) ?? byRef.get(ref);
      if (!target) throw new Error(`Unknown link alias or unmanaged reference: ${ref}`);
      if (!canLink(page.placement, target.placement)) throw new Error(`Link crosses its audience: ${ref}`);
      return target.ref;
    };
    const render = (text: string, label: string) =>
      renderMarkdownLinks(text, lookup, { maxLength: 1000, message: `Invalid ${label}` }).text;
    let markdown = string(
      (await containedFile(root, page.file))
        .replace(/\r\n/g, '\n')
        .replace(/^(?:[ \t]*\n)+/u, '')
        .trimEnd(),
      'Markdown body',
      MAX_SUPPORT_RECORD_BODY_LENGTH,
      true,
    );
    const authored = fromMarkdown(markdown);
    rejectHtml(authored);
    const envelope = supportRecordEnvelope(markdown, authored);
    if (envelope && page.input.record !== undefined) throw new Error('Duplicate support record envelope');
    const sourceRecord = envelope
      ? validateSupportRecord(JSON.parse(envelope.value))
      : page.input.record === undefined
        ? undefined
        : validateSupportRecord(page.input.record);
    const generated: string[] = [];
    if (sourceRecord) {
      const { summary, applicability } = sourceRecord;
      const record = validateSupportRecord({
        ...sourceRecord,
        summary: render(summary, 'record summary'),
        ...(applicability === undefined ? {} : { applicability: render(applicability, 'record applicability') }),
      });
      const fence =
        envelope && record.summary === summary && record.applicability === applicability
          ? envelope.raw
          : `\`\`\`support-record\n${JSON.stringify(record, null, 2)}\n\`\`\``;
      if (envelope) markdown = markdown.slice(0, envelope.start) + fence + markdown.slice(envelope.end);
      else generated.push(fence);
    }
    let hasHttpsSource = false;
    if (page.input.source !== undefined) {
      const source = object(page.input.source, ['kind', 'url', 'verifiedOn', 'license'], 'source');
      const sourceUrl = source.url === undefined ? undefined : url(source.url);
      hasHttpsSource = sourceUrl !== undefined && /^https:\/\//iu.test(sourceUrl);
      generated.push(
        `Source: ${line(source.kind, 'source kind')}${sourceUrl === undefined ? '' : ` (${sourceUrl})`}${source.verifiedOn === undefined ? '' : `; verified ${date(source.verifiedOn, 'source verification date')}`}${source.license === undefined ? '' : `; license: ${line(source.license, 'source license')}`}.`,
      );
    }
    if (page.input.links !== undefined) {
      const links = array(page.input.links, 'links', 100).map(value => lookup(key(value, 'link alias')));
      if (new Set(links).size !== links.length) throw new Error('Duplicate link alias');
      generated.push(links.map(ref => `- [[${ref}]]`).join('\n'));
    }
    const marker = pageMarker(config.id, alias);
    const prefix = `${marker}\n${hasHttpsSource ? `${httpsSourceMarker}\n` : ''}`;
    const bodyLimit = {
      maxLength: MAX_SUPPORT_RECORD_BODY_LENGTH - prefix.length - 1,
      message: `Rendered page body in ${page.file} exceeds the ${MAX_SUPPORT_RECORD_BODY_LENGTH}-character read bound`,
    };
    const renderedBody = renderMarkdownLinks(
      [markdown, ...generated].filter(Boolean).join('\n\n'),
      lookup,
      bodyLimit,
      markdown.length,
    );
    // Materialize the output so a short trimmed body cannot retain the raw file's backing string.
    const body = [prefix, renderedBody.text, '\n'].join('');
    retain(body.length);
    const requiredPolicyFile =
      mandatoryPolicyKeys.has(alias) || page.ref === requiredPolicyReference(page.placement.profile)
        ? page.file
        : undefined;
    const noteKeys = new Set<string>();
    const notes = (page.input.notes === undefined ? [] : array(page.input.notes, 'notes', 100)).map(value => {
      const obj = object(value, ['key', 'text', 'date', 'author'], 'note');
      const noteKey = key(obj.key, 'note key');
      if (noteKeys.has(noteKey)) throw new Error('Duplicate note key');
      noteKeys.add(noteKey);
      const rendered = renderMarkdownLinks(string(obj.text, 'note text', 5000), lookup, {
        maxLength: MAX_SUPPORT_RECORD_BODY_LENGTH,
        message: 'Rendered note exceeds the character read bound',
      });
      const marker = noteMarker(config.id, alias, noteKey);
      const attribution = obj.author === undefined ? '' : `\nFixture author: ${line(obj.author, 'fixture author')}`;
      const text = [marker, '\n', rendered.text, attribution].join('');
      assertKnowledgeNoteTextWithinBound(text);
      retain(text.length);
      return {
        key: noteKey,
        text,
        marker,
        refs: [...rendered.links.keys()],
        when: obj.date === undefined ? undefined : new Date(date(obj.date, 'note date')),
      };
    });
    const links = new Map([...renderedBody.links].slice(0, MAX_KNOWLEDGE_PAGE_BODY_LINKS));
    pages.push({
      key: alias,
      scope: page.placement.scope,
      path: page.path,
      name: page.name,
      description: page.description ?? '',
      body,
      marker,
      requiredPolicyFile,
      links,
      notes,
    });
  }
  const dataset = { id: config.id, version, pages };
  await validatePreparedPolicies(dataset, policyApprovalFile);
  return dataset;
}

export async function validatePreparedPolicies(
  dataset: PreparedDataset,
  policyApprovalFile = process.env.SUPPORT_POLICY_APPROVAL_FILE,
) {
  const approved = await readApprovedPolicyRevisions(policyApprovalFile);
  const issues: string[] = [];
  for (const page of dataset.pages) {
    if (!page.requiredPolicyFile) continue;
    const ref = `${page.scope}#${page.path}`;
    const issue = requiredPolicyContentIssue(page.body, ref, approved);
    if (issue) issues.push(`Invalid required policy ${ref} in ${page.requiredPolicyFile}. ${issue}.`);
  }
  if (issues.length) throw new Error(issues.join('\n'));
}
