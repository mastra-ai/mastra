/** Reserved characters are escaped once at the raw-id boundary; Knowledge addresses stay canonical. */
export function encodeKnowledgeScopeValue(value: string): string {
  return value.replaceAll('%', '%25').replaceAll('/', '%2F').replaceAll('#', '%23').replaceAll(':', '%3A');
}

export function decodeKnowledgeScopeValue(value: string): string | null {
  const decoded = value.replace(/%(25|2F|23|3A)/g, (_, code: string) => {
    switch (code) {
      case '25':
        return '%';
      case '2F':
        return '/';
      case '23':
        return '#';
      default:
        return ':';
    }
  });
  return encodeKnowledgeScopeValue(decoded) === value ? decoded : null;
}

/**
 * Encodes an id (a tenant, user or resource id) for one segment of a canonical Knowledge scope
 * address, e.g. `org:${encodeKnowledgeScopeId('auth0|a:b')}`. `:`, `/`, `#` and `%` are escaped, so
 * the id can't spill into another segment, a child scope or a page ref.
 * @experimental
 */
export function encodeKnowledgeScopeId(id: string): string {
  return encodeKnowledgeScopeValue(id);
}

/**
 * The id back from one segment of a canonical Knowledge scope address; null when the segment isn't
 * canonically encoded.
 * @experimental
 */
export function decodeKnowledgeScopeId(segment: string): string | null {
  return decodeKnowledgeScopeValue(segment);
}
