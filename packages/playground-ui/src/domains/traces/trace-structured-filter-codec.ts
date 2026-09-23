export type StructuredPath<TRoot extends string> = string | [TRoot, string, ...string[]];
export type StructuredScalar = string | number | boolean;

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

const isValidStructuredPath = (segments: string[], root: string) =>
  segments.length >= 2 &&
  segments.length <= MAX_PATH_SEGMENTS &&
  segments[0] === root &&
  segments.every(
    segment => segment.length > 0 && !segment.includes('\0') && utf8Length(segment) <= MAX_PATH_SEGMENT_BYTES,
  ) &&
  utf8Length(segments.join('.')) <= MAX_PATH_BYTES;

export const normalizeStructuredPath = <TRoot extends string>(
  path: string | readonly string[],
  root: TRoot,
): StructuredPath<TRoot> | undefined => {
  if (typeof path === 'string') {
    return isValidStructuredPath(path.split('.'), root) ? path : undefined;
  }
  const segments = [...path];
  if (!isStringArray(segments) || !isValidStructuredPath(segments, root)) return undefined;
  const [candidateRoot, child, ...rest] = segments;
  if (candidateRoot !== root || child === undefined || !segments.slice(1).some(segment => segment.includes('.'))) {
    return undefined;
  }
  return [root, child, ...rest];
};

export const encodeExactStructuredPath = <TRoot extends string>(path: [TRoot, string, ...string[]]): string =>
  encodeJson(path);

export const decodeExactStructuredPath = <TRoot extends string>(
  value: string,
  root: TRoot,
): StructuredPath<TRoot> | undefined => {
  const decoded = decodeJson(value);
  return typeof decoded === 'string' || Array.isArray(decoded) ? normalizeStructuredPath(decoded, root) : undefined;
};

export const encodeStructuredScalar = (value: StructuredScalar, prefix: string): string => {
  if (typeof value === 'string' && value.length > 0 && !value.startsWith(prefix)) return value;
  return prefix + encodeJson(value);
};

export const decodeStructuredScalar = (value: string, prefix: string): StructuredScalar | undefined => {
  if (!value.startsWith(prefix)) return value;
  const decoded = decodeJson(value.slice(prefix.length));
  if (typeof decoded === 'string' || typeof decoded === 'boolean') return decoded;
  return typeof decoded === 'number' && Number.isFinite(decoded) ? decoded : undefined;
};

export const formatStructuredScalar = (value: StructuredScalar): string => {
  if (typeof value !== 'string') return String(value);
  return value.length === 0 || value.trim().length === 0 ? JSON.stringify(value) : value;
};
