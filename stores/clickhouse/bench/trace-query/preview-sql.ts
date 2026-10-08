/**
 * QX21: `buildInputPreview()` (packages/core .../observability/tracing.ts) written as a ClickHouse expression,
 * to measure building the list preview at read time instead of returning the whole `input` blob.
 *
 * Mirrors the TypeScript rules: blank → null; `{` / `[` documents must be valid JSON (else null); a message
 * list (top-level array, or `messages` array) previews the user turns' text joined by ` | `; a JSON string is
 * unwrapped; anything else previews as its own text. Cut at 100 characters plus `…`. Known gaps: JSON
 * documents that aren't message lists preview their stored text rather than a re-serialisation, and the cut
 * counts code points where JavaScript counts UTF-16 units.
 */
export function previewSql(column: string): string {
  const s = `trimBoth(ifNull(${column}, ''))`;
  const isDoc = `(startsWith(${s}, '{') OR startsWith(${s}, '['))`;
  const msgs = `if(startsWith(${s}, '['), ${s}, if(JSONType(${s}, 'messages') = 'Array', JSONExtractRaw(${s}, 'messages'), ''))`;
  const part = `if(JSONType(p) = 'String', JSONExtractString(p), if(JSONExtractString(p, 'type') = 'text', JSONExtractString(p, 'text'), ''))`;
  const content = `multiIf(JSONType(m, 'content') = 'String', JSONExtractString(m, 'content'), JSONType(m, 'content') = 'Array', arrayStringConcat(arrayFilter(x -> x != '', arrayMap(p -> ${part}, JSONExtractArrayRaw(m, 'content'))), ' '), '')`;
  const userText = `arrayStringConcat(arrayFilter(x -> x != '', arrayMap(m -> ${content}, arrayFilter(m -> JSONExtractString(m, 'role') = 'user', JSONExtractArrayRaw(${msgs})))), ' | ')`;
  const text = `multiIf(${s} = '', '', ${isDoc} AND NOT isValidJSON(${s}), '', ${isDoc} AND ${msgs} != '', ${userText}, startsWith(${s}, '"') AND isValidJSON(${s}), JSONExtractString(${s}), ${s})`;
  return `nullIf(if(lengthUTF8(${text}) > 100, concat(leftUTF8(${text}, 100), '…'), ${text}), '')`;
}
