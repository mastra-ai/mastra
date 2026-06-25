import type { ProcessorContext } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';

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

function readBuiltInMetadataValues(metadata: ExtractedValueMetadata): Partial<Record<BuiltInExtractorSlug, unknown>> {
  const values: Partial<Record<BuiltInExtractorSlug, unknown>> = {};
  for (const slug of BUILT_IN_EXTRACTOR_SLUGS) {
    const { metadataField } = BUILT_IN_METADATA_FIELDS[slug]!;
    values[slug] = metadata[metadataField];
  }
  return values;
}

export function getPriorExtractedValues(metadata?: ExtractedValueMetadata): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  return mergeExtractedValues(readBuiltInMetadataValues(metadata), metadata.extracted);
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
      .filter(extractor => !isBuiltInExtractorSlug(extractor.slug) && extractor.injectionBehaviour !== 'none')
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

export function filterUserExtractedValues(values?: Record<string, unknown>): Record<string, unknown> | undefined {
  const normalized = normalizeExtractedValues(values);
  if (!normalized) {
    return undefined;
  }

  const userValues = Object.fromEntries(Object.entries(normalized).filter(([slug]) => !isBuiltInExtractorSlug(slug)));
  return Object.keys(userValues).length > 0 ? userValues : undefined;
}

export function buildThreadMetadataFromExtractedValues(values?: Record<string, unknown>): ExtractedValueMetadata {
  const builtIns = getBuiltInExtractedValues(values);
  const metadata: ExtractedValueMetadata = { extracted: filterUserExtractedValues(values) };
  for (const slug of BUILT_IN_EXTRACTOR_SLUGS) {
    const { metadataField, builtInField } = BUILT_IN_METADATA_FIELDS[slug]!;
    metadata[metadataField] = builtIns[builtInField];
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
        sendSignal: opts.sendSignal,
        requestContext: opts.requestContext,
      });
      const nextValue = hookValue === undefined ? current : hookValue;
      const parsed = extractor.schema.safeParse(nextValue);
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
