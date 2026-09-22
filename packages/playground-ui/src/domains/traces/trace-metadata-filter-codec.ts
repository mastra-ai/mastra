export type TraceMetadataPath = string | ['metadata', string, ...string[]];
export type TraceMetadataScalar = string | number | boolean;

const EXACT_FIELD_PREFIX = 'metadataExact.v1.';
const LEGACY_FIELD_PREFIX = 'metadata.';
const EXACT_PARAM_PREFIX = 'filterMetadataExact.v1.';
const LEGACY_PARAM_PREFIX = 'filterMetadata.';
const TYPED_VALUE_PREFIX = '~metadata-v1~';
const MAX_PATH_SEGMENTS = 12;
const MAX_PATH_BYTES = 128;
const MAX_PATH_SEGMENT_BYTES = 128;

const encodeJson = (value: unknown) => encodeURIComponent(JSON.stringify(value));

const decodeJson = (value: string): unknown => {
  try {
    return JSON.parse(decodeURIComponent(value));
  } catch {
    return undefined;
  }
};

const isStringArray = (value: unknown[]): value is string[] => value.every(item => typeof item === 'string');
const utf8Length = (value: string) => new TextEncoder().encode(value).byteLength;

const isValidMetadataPath = (segments: string[]) =>
  segments.length >= 2 &&
  segments.length <= MAX_PATH_SEGMENTS &&
  segments[0] === 'metadata' &&
  segments.every(
    segment => segment.length > 0 && !segment.includes('\0') && utf8Length(segment) <= MAX_PATH_SEGMENT_BYTES,
  ) &&
  utf8Length(segments.join('.')) <= MAX_PATH_BYTES;

export const normalizeTraceMetadataPath = (path: string | readonly string[]): TraceMetadataPath | undefined => {
  if (typeof path === 'string') {
    return isValidMetadataPath(path.split('.')) ? path : undefined;
  }
  const segments = [...path];
  if (!isStringArray(segments) || !isValidMetadataPath(segments)) return undefined;
  const [root, child, ...rest] = segments;
  if (root !== 'metadata' || child === undefined || !segments.slice(1).some(segment => segment.includes('.'))) {
    return undefined;
  }
  return ['metadata', child, ...rest];
};

const decodeExactPath = (value: string): TraceMetadataPath | undefined => {
  const decoded = decodeJson(value);
  return typeof decoded === 'string' || Array.isArray(decoded) ? normalizeTraceMetadataPath(decoded) : undefined;
};

export const traceMetadataPathToField = (
  path: string | readonly string[],
): { id: string; label: string; path: TraceMetadataPath } | undefined => {
  const normalized = normalizeTraceMetadataPath(path);
  if (!normalized) return undefined;
  if (typeof normalized === 'string') {
    return { id: normalized, label: normalized.slice(LEGACY_FIELD_PREFIX.length), path: normalized };
  }

  return {
    id: EXACT_FIELD_PREFIX + encodeJson(normalized),
    label: JSON.stringify(normalized.slice(1)),
    path: normalized,
  };
};

export const traceMetadataFieldIdToPath = (fieldId: string): TraceMetadataPath | undefined => {
  if (fieldId.startsWith(EXACT_FIELD_PREFIX)) {
    return decodeExactPath(fieldId.slice(EXACT_FIELD_PREFIX.length));
  }
  if (fieldId.startsWith(LEGACY_FIELD_PREFIX)) {
    return normalizeTraceMetadataPath(fieldId);
  }
  return undefined;
};

export const isTraceMetadataFieldId = (fieldId: string) => traceMetadataFieldIdToPath(fieldId) !== undefined;

export const traceMetadataFieldIdToParam = (fieldId: string): string | undefined => {
  if (!isTraceMetadataFieldId(fieldId)) return undefined;
  if (fieldId.startsWith(EXACT_FIELD_PREFIX)) {
    return EXACT_PARAM_PREFIX + fieldId.slice(EXACT_FIELD_PREFIX.length);
  }
  return LEGACY_PARAM_PREFIX + fieldId.slice(LEGACY_FIELD_PREFIX.length);
};

export const traceMetadataParamToFieldId = (param: string): string | undefined => {
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
  param.startsWith(EXACT_PARAM_PREFIX) || param.startsWith(LEGACY_PARAM_PREFIX);

export const encodeTraceMetadataValue = (value: TraceMetadataScalar): string => {
  if (typeof value === 'string' && value.length > 0 && !value.startsWith(TYPED_VALUE_PREFIX)) return value;
  return TYPED_VALUE_PREFIX + encodeJson(value);
};

export const decodeTraceMetadataValue = (value: string): TraceMetadataScalar | undefined => {
  if (!value.startsWith(TYPED_VALUE_PREFIX)) return value;
  const decoded = decodeJson(value.slice(TYPED_VALUE_PREFIX.length));
  if (typeof decoded === 'string' || typeof decoded === 'boolean') return decoded;
  return typeof decoded === 'number' && Number.isFinite(decoded) ? decoded : undefined;
};

export const formatTraceMetadataValue = (value: TraceMetadataScalar): string => {
  if (typeof value !== 'string') return String(value);
  return value.length === 0 || value.trim().length === 0 ? JSON.stringify(value) : value;
};
