import type { ProcessorContext } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';

import type { Memory } from '../..';
import type { BuiltInExtractorSlug, Extractor, ExtractorSource } from './extractor';
import { BUILT_IN_EXTRACTOR_SLUGS, isBuiltInExtractorSlug } from './extractor';

export interface ExtractedValueMetadata {
  currentTask?: string;
  suggestedResponse?: string;
  threadTitle?: string;
  extracted?: Record<string, unknown>;
}

export interface ExtractionFailure {
  slug: string;
  error: string;
}

export interface ExtractedBuiltInValues {
  currentTask?: string;
  suggestedContinuation?: string;
  threadTitle?: string;
}

type BuiltInMetadataField = Exclude<keyof ExtractedValueMetadata, 'extracted'>;
type ExtractedBuiltInField = keyof ExtractedBuiltInValues;

const BUILT_IN_METADATA_FIELDS: Record<
  BuiltInExtractorSlug,
  { metadataField: BuiltInMetadataField; builtInField: ExtractedBuiltInField }
> = {
  'current-task': { metadataField: 'currentTask', builtInField: 'currentTask' },
  'suggested-response': { metadataField: 'suggestedResponse', builtInField: 'suggestedContinuation' },
  'thread-title': { metadataField: 'threadTitle', builtInField: 'threadTitle' },
};

function isPresentExtractedValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

export function normalizeExtractedValues(values?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!values) {
    return undefined;
  }

  const normalized = Object.fromEntries(Object.entries(values).filter(([, value]) => isPresentExtractedValue(value)));
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function mergeExtractedValues(
  ...valueSets: Array<Record<string, unknown> | undefined>
): Record<string, unknown> | undefined {
  const merged: Record<string, unknown> = {};
  for (const values of valueSets) {
    const normalized = normalizeExtractedValues(values);
    if (normalized) {
      Object.assign(merged, normalized);
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

export function mergeExtractionFailures(
  ...failureSets: Array<ExtractionFailure[] | undefined>
): ExtractionFailure[] | undefined {
  const failures = failureSets.flatMap(set => set ?? []);
  return failures.length > 0 ? failures : undefined;
}

const UNSAFE_METADATA_PATH_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

function getMetadataPathSegments(keyPath: string | false): string[] | undefined {
  if (keyPath === false) {
    return undefined;
  }

  const segments = keyPath.split('.').filter(Boolean);
  if (segments.some(segment => UNSAFE_METADATA_PATH_SEGMENTS.has(segment))) {
    throw new Error(`Extractor metadataKeyPath "${keyPath}" contains an unsafe path segment.`);
  }
  return segments.length > 0 ? segments : undefined;
}

function getValueAtPath(metadata: ExtractedValueMetadata | undefined, keyPath: string | false): unknown {
  if (!metadata) {
    return undefined;
  }

  const segments = getMetadataPathSegments(keyPath);
  if (!segments) {
    return undefined;
  }

  let current: unknown = metadata;
  for (const segment of segments) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function setValueAtPath(metadata: ExtractedValueMetadata, keyPath: string | false, value: unknown): void {
  if (!isPresentExtractedValue(value)) {
    return;
  }

  const segments = getMetadataPathSegments(keyPath);
  if (!segments) {
    return;
  }

  let current = metadata as Record<string, unknown>;
  for (const segment of segments.slice(0, -1)) {
    const next = current[segment];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }
  current[segments[segments.length - 1]!] = value;
}

function readBuiltInMetadataValues(metadata: ExtractedValueMetadata): Partial<Record<BuiltInExtractorSlug, unknown>> {
  const values: Partial<Record<BuiltInExtractorSlug, unknown>> = {};
  for (const slug of BUILT_IN_EXTRACTOR_SLUGS) {
    const { metadataField } = BUILT_IN_METADATA_FIELDS[slug]!;
    values[slug] = metadata[metadataField];
  }
  return values;
}

export function getPriorExtractedValues(
  metadata?: ExtractedValueMetadata,
  extractors?: readonly Extractor<any>[],
): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  if (!extractors) {
    return mergeExtractedValues(readBuiltInMetadataValues(metadata), metadata.extracted);
  }

  const values: Record<string, unknown> = {};
  for (const extractor of extractors) {
    const value = getValueAtPath(metadata, extractor.metadataKeyPath);
    if (isPresentExtractedValue(value)) {
      values[extractor.slug] = value;
    }
  }
  return normalizeExtractedValues(values);
}

function renderExtractedValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function buildExtractedValueContextSections(
  extractors: readonly Extractor<any>[],
  values?: Record<string, unknown>,
): string[] {
  const normalized = normalizeExtractedValues(values);
  if (!normalized) {
    return [];
  }

  const injectableSlugs = new Set(
    extractors
      .filter(extractor => !isBuiltInExtractorSlug(extractor.slug) && extractor.includePreviousExtraction)
      .map(extractor => extractor.slug),
  );

  return Object.entries(normalized)
    .filter(([slug]) => injectableSlugs.has(slug))
    .map(([slug, value]) => `<${slug}>\n${renderExtractedValue(value)}\n</${slug}>`);
}

function getStringExtractedValue(values: Record<string, unknown> | undefined, slug: string): string | undefined {
  const value = values?.[slug];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function getBuiltInExtractedValues(values?: Record<string, unknown>): ExtractedBuiltInValues {
  const builtIns: ExtractedBuiltInValues = {};
  for (const slug of BUILT_IN_EXTRACTOR_SLUGS) {
    const { builtInField } = BUILT_IN_METADATA_FIELDS[slug]!;
    builtIns[builtInField] = getStringExtractedValue(values, slug);
  }
  return builtIns;
}

export function filterUserExtractedValues(
  values?: Record<string, unknown>,
  extractors?: readonly Extractor<any>[],
): Record<string, unknown> | undefined {
  const normalized = normalizeExtractedValues(values);
  if (!normalized) {
    return undefined;
  }

  const userValues = Object.fromEntries(
    Object.entries(normalized).filter(([slug]) => {
      const extractor = extractors?.find(candidate => candidate.slug === slug);
      return extractor
        ? extractor.metadataKeyPath !== false && extractor.metadataKeyPath.startsWith('extracted.')
        : !isBuiltInExtractorSlug(slug);
    }),
  );
  return Object.keys(userValues).length > 0 ? userValues : undefined;
}

export function buildThreadMetadataFromExtractedValues(
  extractors: readonly Extractor<any>[],
  values?: Record<string, unknown>,
): ExtractedValueMetadata {
  const metadata: ExtractedValueMetadata = {};
  const normalized = normalizeExtractedValues(values);
  if (!normalized) {
    return metadata;
  }

  for (const extractor of extractors) {
    if (!Object.prototype.hasOwnProperty.call(normalized, extractor.slug)) {
      continue;
    }
    setValueAtPath(metadata, extractor.metadataKeyPath, normalized[extractor.slug]);
  }
  return metadata;
}

export async function applyExtractorHooks(opts: {
  source: ExtractorSource;
  extractors: readonly Extractor<any>[];
  values?: Record<string, unknown>;
  failures?: ExtractionFailure[];
  previousValues?: Record<string, unknown>;
  threadId: string;
  resourceId?: string;
  mainAgent?: ProcessorContext['agent'];
  memory?: Memory;
  sendSignal?: ProcessorContext['sendSignal'];
  requestContext?: RequestContext;
}): Promise<{ values?: Record<string, unknown>; failures?: ExtractionFailure[] }> {
  const values = normalizeExtractedValues(opts.values) ?? {};
  const failures: ExtractionFailure[] = [...(opts.failures ?? [])];

  for (const extractor of opts.extractors) {
    if (!Object.prototype.hasOwnProperty.call(values, extractor.slug)) {
      continue;
    }

    const current = values[extractor.slug];
    if (!isPresentExtractedValue(current)) {
      delete values[extractor.slug];
      continue;
    }

    if (!extractor.onExtracted || extractor.internal) {
      continue;
    }

    try {
      const hookValue = await extractor.onExtracted({
        source: opts.source,
        extractor,
        threadId: opts.threadId,
        resourceId: opts.resourceId,
        previous: opts.previousValues?.[extractor.slug],
        current,
        mainAgent: opts.mainAgent,
        memory: opts.memory,
        sendSignal: opts.sendSignal,
        requestContext: opts.requestContext,
      });
      if (hookValue === undefined) {
        // Undefined means the hook did not replace the extracted value.
        continue;
      }
      const parsed = extractor.schema.safeParse(hookValue);
      if (parsed.success) {
        values[extractor.slug] = parsed.data;
      } else {
        delete values[extractor.slug];
        failures.push({ slug: extractor.slug, error: parsed.error.message });
      }
    } catch (error) {
      delete values[extractor.slug];
      failures.push({ slug: extractor.slug, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    values: normalizeExtractedValues(values),
    failures: mergeExtractionFailures(failures),
  };
}
