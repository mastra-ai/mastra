import type { ProcessorContext } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod';

export type ExtractorMode = 'inline' | 'structured';
export type ExtractorInjectionBehaviour = 'carry-forward' | 'none';
export type ExtractorSource = 'observer' | 'reflector';

export interface ExtractorOnExtractedContext<T = unknown> {
  source: ExtractorSource;
  extractor: Extractor<T>;
  threadId: string;
  resourceId?: string;
  previous?: T;
  current: T;
  mainAgent?: ProcessorContext['agent'];
  sendSignal?: ProcessorContext['sendSignal'];
  requestContext?: RequestContext;
}

export interface ExtractorConfig<T = unknown> {
  /** Human-readable extractor name. Converted to a stable kebab-case slug for XML tags and metadata keys. */
  name: string;
  /** Instructions describing what this extractor should return. */
  instructions: string;
  /** Zod schema used to validate the extracted value. Defaults to `z.string()`. */
  schema?: z.ZodType<T>;
  /** Inline extractors are emitted as XML in the observer/reflector output. Structured extractors run in a follow-up structured-output call. */
  mode?: ExtractorMode;
  /** Whether the previous value should be shown to the extractor prompt. */
  injectionBehaviour?: ExtractorInjectionBehaviour;
  /** Optional lifecycle hook invoked after a value is parsed and before it is persisted. */
  onExtracted?: (context: ExtractorOnExtractedContext<T>) => Promise<T | void | undefined> | T | void | undefined;
}

const BUILT_IN_SLUGS = new Set(['current-task', 'suggested-response', 'thread-title']);

const RESERVED_XML_TAGS = new Set([
  'observations',
  'observation',
  'thread',
  'message',
  'messages',
  'conversation',
  'history',
  'system',
  'user',
  'assistant',
  'tool',
  ...BUILT_IN_SLUGS,
]);

export const BUILT_IN_EXTRACTOR_SLUGS = [...BUILT_IN_SLUGS] as const;
export type BuiltInExtractorSlug = (typeof BUILT_IN_EXTRACTOR_SLUGS)[number];

export function isBuiltInExtractorSlug(slug: string): slug is BuiltInExtractorSlug {
  return BUILT_IN_SLUGS.has(slug);
}

export function slugifyExtractorName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function assertValidSlug(slug: string, name: string): void {
  if (!slug) {
    throw new Error(`Extractor name "${name}" must produce a non-empty slug.`);
  }
  if (!/^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/.test(slug)) {
    throw new Error(`Extractor name "${name}" produced invalid slug "${slug}".`);
  }
}

export class Extractor<T = unknown> {
  readonly name: string;
  readonly slug: string;
  readonly instructions: string;
  readonly schema: z.ZodType<T>;
  readonly mode: ExtractorMode;
  readonly injectionBehaviour: ExtractorInjectionBehaviour;
  readonly onExtracted?: ExtractorConfig<T>['onExtracted'];
  /** @internal */
  readonly internal: boolean;

  constructor(config: ExtractorConfig<T>, internal = false) {
    const name = config.name.trim();
    const instructions = config.instructions.trim();
    const slug = slugifyExtractorName(name);

    if (!name) {
      throw new Error('Extractor name is required.');
    }
    if (!instructions) {
      throw new Error(`Extractor "${name}" must include instructions.`);
    }
    assertValidSlug(slug, name);
    if (!internal && RESERVED_XML_TAGS.has(slug)) {
      throw new Error(`Extractor slug "${slug}" is reserved by Observational Memory.`);
    }

    this.name = name;
    this.slug = slug;
    this.instructions = instructions;
    this.schema = (config.schema ?? z.string()) as z.ZodType<T>;
    this.mode = config.mode ?? 'structured';
    this.injectionBehaviour = config.injectionBehaviour ?? 'carry-forward';
    this.onExtracted = config.onExtracted;
    this.internal = internal;
  }
}

export function validateExtractorList(extractors: readonly Extractor<any>[]): Extractor<any>[] {
  const seen = new Map<string, string>();
  for (const extractor of extractors) {
    assertValidSlug(extractor.slug, extractor.name);
    if (!extractor.internal && RESERVED_XML_TAGS.has(extractor.slug)) {
      throw new Error(`Extractor slug "${extractor.slug}" is reserved by Observational Memory.`);
    }
    const previous = seen.get(extractor.slug);
    if (previous) {
      throw new Error(`Duplicate extractor slug "${extractor.slug}" from "${previous}" and "${extractor.name}".`);
    }
    seen.set(extractor.slug, extractor.name);
  }
  return [...extractors];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isJsonLike(value: string): boolean {
  return /^(?:[\[{"-]|\d|true\b|false\b|null\b)/.test(value.trim());
}

function candidateValues(raw: string): unknown[] {
  const trimmed = raw.trim();
  const candidates: unknown[] = [];
  const add = (value: unknown) => {
    if (!candidates.some(candidate => Object.is(candidate, value))) {
      candidates.push(value);
    }
  };

  if (isJsonLike(trimmed)) {
    try {
      add(JSON.parse(trimmed));
    } catch {
      // The value may intentionally be a plain string that starts with a JSON-like character.
    }
  }

  add(trimmed);

  if (!isJsonLike(trimmed)) {
    try {
      add(JSON.parse(trimmed));
    } catch {
      // Plain strings are valid extractor values.
    }
  }

  return candidates;
}

export function parseExtractorValue<T>(extractor: Extractor<T>, raw: string): T {
  const failures: string[] = [];
  for (const candidate of candidateValues(raw)) {
    const parsed = extractor.schema.safeParse(candidate);
    if (parsed.success) {
      return parsed.data;
    }
    failures.push(parsed.error.message);
  }
  throw new Error(`Extractor "${extractor.slug}" output did not match its schema: ${failures[0] ?? 'invalid value'}`);
}

export interface ParsedExtractedValues {
  values: Record<string, unknown>;
  failures: Array<{ slug: string; error: string }>;
}

export function parseExtractedValues(output: string, extractors: readonly Extractor<any>[]): ParsedExtractedValues {
  const values: Record<string, unknown> = {};
  const failures: Array<{ slug: string; error: string }> = [];

  for (const extractor of extractors) {
    const tag = escapeRegExp(extractor.slug);
    const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    const matches = [...output.matchAll(regex)];
    if (matches.length === 0) {
      continue;
    }

    const raw = matches
      .map(match => match[1]?.trim() ?? '')
      .filter(Boolean)
      .join('\n');
    if (!raw) {
      continue;
    }

    try {
      values[extractor.slug] = parseExtractorValue(extractor as Extractor<unknown>, raw);
    } catch (error) {
      failures.push({ slug: extractor.slug, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { values, failures };
}

export function stripExtractorSections(output: string, extractors: readonly Extractor<any>[]): string {
  let stripped = output;
  for (const extractor of extractors) {
    const tag = escapeRegExp(extractor.slug);
    stripped = stripped.replace(new RegExp(`[ \\t]*<${tag}>[\\s\\S]*?<\\/${tag}>\\s*`, 'gi'), '');
  }
  return stripped;
}

export function buildExtractorOutputSections(extractors: readonly Extractor<any>[]): string {
  const inlineExtractors = extractors.filter(extractor => extractor.mode === 'inline');
  if (inlineExtractors.length === 0) {
    return '';
  }

  return inlineExtractors
    .map(extractor => `<${extractor.slug}>\n${extractor.instructions}\n</${extractor.slug}>`)
    .join('\n\n');
}

function renderPriorValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function buildExtractorPriorLines(
  extractors: readonly Extractor<any>[],
  priorExtractedValues?: Record<string, unknown>,
): string[] {
  if (!priorExtractedValues) {
    return [];
  }

  const lines: string[] = [];
  for (const extractor of extractors) {
    if (extractor.injectionBehaviour === 'none') {
      continue;
    }
    const value = priorExtractedValues[extractor.slug];
    if (value === undefined || value === null || value === '') {
      continue;
    }
    lines.push(`<${extractor.slug}>\n${renderPriorValue(value)}\n</${extractor.slug}>`);
  }
  return lines;
}
