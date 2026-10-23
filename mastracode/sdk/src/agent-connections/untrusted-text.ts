export const UNTRUSTED_PEER_ID_MAX_LENGTH = 512;
export const UNTRUSTED_PEER_METADATA_MAX_LENGTH = 256;

export function boundUntrustedText(value: string | undefined, maxLength: number): string | undefined {
  if (value === undefined || value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…`;
}

export function serializeUntrustedData(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, character => {
    switch (character) {
      case '<':
        return '\\u003c';
      case '>':
        return '\\u003e';
      case '&':
        return '\\u0026';
      case '\u2028':
        return '\\u2028';
      default:
        return '\\u2029';
    }
  });
}
