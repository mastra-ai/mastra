import {
  decodeExactStructuredPath,
  decodeStructuredScalar,
  encodeExactStructuredPath,
  encodeStructuredScalar,
  formatStructuredScalar,
  normalizeStructuredPath,
} from './trace-structured-filter-codec';
import type { StructuredPath, StructuredScalar } from './trace-structured-filter-codec';

export type TraceMetadataPath = StructuredPath<'metadata'>;
export type TraceMetadataScalar = StructuredScalar;

const EXACT_FIELD_PREFIX = 'metadataExact.v1.';
const LEGACY_FIELD_PREFIX = 'metadata.';
const FIELD_PARAM_PREFIX = 'filterMetadataPath.v1.';
const EXACT_PARAM_PREFIX = 'filterMetadataExact.v1.';
const LEGACY_PARAM_PREFIX = 'filterMetadata.';
const TYPED_VALUE_PREFIX = '~metadata-v1~';

export const normalizeTraceMetadataPath = (path: string | readonly string[]): TraceMetadataPath | undefined =>
  normalizeStructuredPath(path, 'metadata');

export const traceMetadataPathToField = (
  path: string | readonly string[],
): { id: string; label: string; path: TraceMetadataPath } | undefined => {
  const normalized = normalizeTraceMetadataPath(path);
  if (!normalized) return undefined;
  if (typeof normalized === 'string') {
    return { id: normalized, label: normalized.slice(LEGACY_FIELD_PREFIX.length), path: normalized };
  }

  return {
    id: EXACT_FIELD_PREFIX + encodeExactStructuredPath(normalized),
    label: JSON.stringify(normalized.slice(1)),
    path: normalized,
  };
};

export const traceMetadataFieldIdToPath = (fieldId: string): TraceMetadataPath | undefined => {
  if (fieldId.startsWith(EXACT_FIELD_PREFIX)) {
    return decodeExactStructuredPath(fieldId.slice(EXACT_FIELD_PREFIX.length), 'metadata');
  }
  if (fieldId.startsWith(LEGACY_FIELD_PREFIX)) {
    return normalizeTraceMetadataPath(fieldId);
  }
  return undefined;
};

export const isTraceMetadataFieldId = (fieldId: string) => traceMetadataFieldIdToPath(fieldId) !== undefined;

export const traceMetadataFieldIdToParam = (fieldId: string): string | undefined =>
  isTraceMetadataFieldId(fieldId) ? FIELD_PARAM_PREFIX + encodeURIComponent(JSON.stringify(fieldId)) : undefined;

export const traceMetadataParamToFieldId = (param: string): string | undefined => {
  if (param.startsWith(FIELD_PARAM_PREFIX)) {
    try {
      const fieldId: unknown = JSON.parse(decodeURIComponent(param.slice(FIELD_PARAM_PREFIX.length)));
      return typeof fieldId === 'string' && isTraceMetadataFieldId(fieldId) ? fieldId : undefined;
    } catch {
      return undefined;
    }
  }
  if (param.startsWith(EXACT_PARAM_PREFIX)) {
    const fieldId = EXACT_FIELD_PREFIX + param.slice(EXACT_PARAM_PREFIX.length);
    return isTraceMetadataFieldId(fieldId) ? fieldId : undefined;
  }
  if (param.startsWith(LEGACY_PARAM_PREFIX) && param.length > LEGACY_PARAM_PREFIX.length) {
    const fieldId = LEGACY_FIELD_PREFIX + param.slice(LEGACY_PARAM_PREFIX.length);
    return isTraceMetadataFieldId(fieldId) ? fieldId : undefined;
  }
  return undefined;
};

export const isTraceMetadataParam = (param: string) =>
  param.startsWith(FIELD_PARAM_PREFIX) || param.startsWith(EXACT_PARAM_PREFIX) || param.startsWith(LEGACY_PARAM_PREFIX);

export const encodeTraceMetadataValue = (value: TraceMetadataScalar): string =>
  encodeStructuredScalar(value, TYPED_VALUE_PREFIX);

export const decodeTraceMetadataValue = (value: string): TraceMetadataScalar | undefined =>
  decodeStructuredScalar(value, TYPED_VALUE_PREFIX);

export const formatTraceMetadataValue = formatStructuredScalar;
