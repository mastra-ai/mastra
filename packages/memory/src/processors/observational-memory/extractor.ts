import type { ProcessorContext } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod';

import type { Memory } from '../..';

type ExtractorMode = 'inline' | 'structured';
export type ExtractorSource = 'observer' | 'reflector';

export interface ExtractorRuntimeContext {
  source: ExtractorSource;
  threadId?: string;
  resourceId?: string;
  mainAgent?: ProcessorContext['agent'];
  memory?: Memory;
  requestContext?: RequestContext;
}

export interface ExtractorOnExtractedContext<T = unknown> extends ExtractorRuntimeContext {
  extractor: Extractor<T>;
  threadId: string;
  previous?: T;
  current: T;
  sendSignal?: ProcessorContext['sendSignal'];
}

type MaybePromise<T> = T | Promise<T>;
type ExtractorConfigValue<TValue> = TValue | ((context: ExtractorRuntimeContext) => MaybePromise<TValue>);

export interface ExtractorConfig<T = unknown> {
  /** Human-readable extractor name. Converted to a stable kebab-case slug for XML tags and metadata keys. */
  name: string;
  /** Instructions describing what this extractor should return. */
  instructions: ExtractorConfigValue<string>;
  /** Zod schema used for structured extraction. Omit to extract an inline string value from the observer/reflector output. */
  schema?: ExtractorConfigValue<z.ZodType<T> | undefined>;
  /** Whether the previous extraction should be shown to the extractor prompt. Defaults to true. */
  includePreviousExtraction?: boolean;
  /** Optional lifecycle hook invoked after a value is parsed and before it is persisted. */
  onExtracted?: (context: ExtractorOnExtractedContext<T>) => Promise<T | void | undefined> | T | void | undefined;
}

const BUILT_IN_SLUGS = new Set(['current-task', 'suggested-response', 'thread-title']);

const EXTRACTED_VALUES_TAG = 'extracted-values';

const RESERVED_XML_TAGS = new Set([
  'observations',
  'observation',
  EXTRACTED_VALUES_TAG,
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
  readonly includePreviousExtraction: boolean;
  readonly onExtracted?: ExtractorConfig<T>['onExtracted'];
  /** @internal */
  readonly internal: boolean;
  private readonly instructionsConfig: ExtractorConfigValue<string>;
  private readonly schemaConfig?: ExtractorConfigValue<z.ZodType<T> | undefined>;

  constructor(config: ExtractorConfig<T>, internal = false) {
    const name = config.name.trim();
    const instructions = typeof config.instructions === 'string' ? config.instructions.trim() : undefined;
    const slug = slugifyExtractorName(name);

    if (!name) {
      throw new Error('Extractor name is required.');
    }
    if (instructions !== undefined && !instructions) {
      throw new Error(`Extractor "${name}" must include instructions.`);
    }
    assertValidSlug(slug, name);
    if (!internal && RESERVED_XML_TAGS.has(slug)) {
      throw new Error(`Extractor slug "${slug}" is reserved by Observational Memory.`);
    }

    this.name = name;
    this.slug = slug;
    this.instructionsConfig = config.instructions;
    this.schemaConfig = config.schema;
    this.instructions = instructions ?? '';
    this.schema = (typeof config.schema === 'function' ? z.string() : (config.schema ?? z.string())) as z.ZodType<T>;
    this.mode = internal || !config.schema ? 'inline' : 'structured';
    this.includePreviousExtraction = config.includePreviousExtraction ?? true;
    this.onExtracted = config.onExtracted;
    this.internal = internal;
  }

  async resolve(context: ExtractorRuntimeContext): Promise<Extractor<T>> {
    const instructions =
      typeof this.instructionsConfig === 'function'
        ? (await this.instructionsConfig(context)).trim()
        : this.instructionsConfig.trim();
    if (!instructions) {
      throw new Error(`Extractor "${this.name}" must include instructions.`);
    }

    const schema = typeof this.schemaConfig === 'function' ? await this.schemaConfig(context) : this.schemaConfig;
    return new Extractor(
      {
        name: this.name,
        instructions,
        ...(schema ? { schema } : {}),
        includePreviousExtraction: this.includePreviousExtraction,
        onExtracted: this.onExtracted,
      },
      this.internal,
    );
  }
}

export async function resolveExtractors(
  extractors: readonly Extractor<any>[],
  context: ExtractorRuntimeContext,
): Promise<Extractor<any>[]> {
  return Promise.all(extractors.map(extractor => extractor.resolve(context)));
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

function parseExtractedValuesObject(raw: string): Record<string, unknown> | undefined {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('Write only the extracted values JSON object here.')) {
    return undefined;
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${EXTRACTED_VALUES_TAG} must contain a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

export function parseExtractedValues(output: string, extractors: readonly Extractor<any>[]): ParsedExtractedValues {
  const values: Record<string, unknown> = {};
  const failures: Array<{ slug: string; error: string }> = [];
  const inlineExtractors = extractors.filter(extractor => extractor.mode === 'inline');

  const regex = new RegExp(`<${EXTRACTED_VALUES_TAG}>([\\s\\S]*?)<\\/${EXTRACTED_VALUES_TAG}>`, 'gi');
  const matches = [...output.matchAll(regex)];
  for (const match of matches) {
    try {
      const extractedValues = parseExtractedValuesObject(match[1] ?? '');
      if (!extractedValues) {
        continue;
      }

      for (const extractor of inlineExtractors) {
        if (!Object.prototype.hasOwnProperty.call(extractedValues, extractor.slug)) {
          continue;
        }
        const rawValue = extractedValues[extractor.slug];
        if (rawValue === undefined || rawValue === null || rawValue === '') {
          continue;
        }
        const parsed = extractor.schema.safeParse(rawValue);
        if (parsed.success) {
          values[extractor.slug] = parsed.data;
        } else {
          failures.push({ slug: extractor.slug, error: parsed.error.message });
        }
      }
    } catch (error) {
      failures.push({ slug: EXTRACTED_VALUES_TAG, error: error instanceof Error ? error.message : String(error) });
    }
  }

  for (const extractor of inlineExtractors) {
    if (Object.prototype.hasOwnProperty.call(values, extractor.slug)) {
      continue;
    }
    const tagRegex = new RegExp(`<${extractor.slug}>([\\s\\S]*?)<\\/${extractor.slug}>`, 'gi');
    const tagMatch = [...output.matchAll(tagRegex)].at(-1);
    const rawValue = tagMatch?.[1]?.trim();
    if (!rawValue) {
      continue;
    }
    try {
      values[extractor.slug] = parseExtractorValue(extractor, rawValue);
    } catch (error) {
      failures.push({ slug: extractor.slug, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { values, failures };
}

export function stripExtractorSections(output: string, extractors: readonly Extractor<any>[]): string {
  const inlineExtractors = extractors.filter(extractor => extractor.mode === 'inline');
  let stripped = output.replace(
    new RegExp(`[ \\t]*<${EXTRACTED_VALUES_TAG}>[\\s\\S]*?<\\/${EXTRACTED_VALUES_TAG}>\\s*`, 'gi'),
    '',
  );
  for (const extractor of inlineExtractors) {
    stripped = stripped.replace(new RegExp(`[ \\t]*<${extractor.slug}>[\\s\\S]*?<\\/${extractor.slug}>\\s*`, 'gi'), '');
  }
  return stripped;
}

export function buildExtractorOutputSections(extractors: readonly Extractor<any>[]): string {
  const inlineExtractors = extractors.filter(extractor => extractor.mode === 'inline');
  if (inlineExtractors.length === 0) {
    return '';
  }

  const sections = inlineExtractors
    .map(
      extractor => `<${extractor.slug}>
${extractor.instructions}
Include this section when the observations contain relevant information for <${extractor.slug}>. Write only that information inside the tag.
</${extractor.slug}>`,
    )
    .join('\n\n');

  return `Additional optional XML sections:\nIf the observations include information relevant to any of these tags, output that tag after <observations> and include the relevant information.\n${sections}`;
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
    if (!extractor.includePreviousExtraction) {
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
