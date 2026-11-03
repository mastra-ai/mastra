/** Reserved characters are escaped once at the raw-id boundary; Knowledge addresses stay canonical. */
export function encodeKnowledgeScopeValue(value: string, final: boolean): string {
  const encoded = value.replaceAll('%', '%25').replaceAll('/', '%2F').replaceAll('#', '%23');
  return final ? encoded : encoded.replaceAll(':', '%3A');
}

export function decodeKnowledgeScopeValue(value: string, final: boolean): string | null {
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
  return encodeKnowledgeScopeValue(decoded, final) === value ? decoded : null;
}
