/**
 * Sanitizes serialized JSON before a PostgreSQL jsonb cast.
 *
 * PostgreSQL rejects NUL escapes and unpaired UTF-16 surrogate escapes. Valid
 * surrogate pairs are preserved, while the escaped-backslash variant of an
 * unsafe escape is removed as a unit so it cannot leave behind invalid JSON.
 * Any other invalid escapes are made literal.
 */
export function sanitizeJsonForPg(jsonString: string): string {
  const unsupportedUnicodeEscape = /\\\\?u(0000|[Dd][89A-Fa-f][0-9A-Fa-f]{2})/g;
  const escapes = Array.from(jsonString.matchAll(unsupportedUnicodeEscape));
  const pairedSurrogateOffsets = new Set<number>();

  for (let i = 0; i < escapes.length - 1; i++) {
    const high = escapes[i]!;
    const low = escapes[i + 1]!;
    const highOffset = high.index;
    const lowOffset = low.index;
    const highCodeUnit = Number.parseInt(high[1]!, 16);
    const lowCodeUnit = Number.parseInt(low[1]!, 16);

    if (
      highOffset !== undefined &&
      lowOffset !== undefined &&
      highCodeUnit >= 0xd800 &&
      highCodeUnit <= 0xdbff &&
      lowCodeUnit >= 0xdc00 &&
      lowCodeUnit <= 0xdfff &&
      highOffset + high[0].length === lowOffset &&
      high[0].length === low[0].length
    ) {
      pairedSurrogateOffsets.add(highOffset);
      pairedSurrogateOffsets.add(lowOffset);
      i += 1;
    }
  }

  return jsonString
    .replace(unsupportedUnicodeEscape, (escape: string, _codeUnit: string, offset: number) =>
      pairedSurrogateOffsets.has(offset) ? escape : '',
    )
    .replace(/(^|[^\\])(\\(?!["\\/bfnrtu]))/g, '$1\\\\');
}
