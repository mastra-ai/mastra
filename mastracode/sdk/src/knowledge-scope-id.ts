/**
 * Copy of `encodeKnowledgeScopeId` from `@mastra/core/knowledge` (core 1.84+), kept here so code-sdk
 * still loads when npm resolves an older core. Escapes `%`, `/`, `#` and `:` so an id stays one scope
 * segment. knowledge-scope-id.test.ts pins it to core's output.
 */
export function encodeKnowledgeScopeId(id: string): string {
  return id.replaceAll('%', '%25').replaceAll('/', '%2F').replaceAll('#', '%23').replaceAll(':', '%3A');
}
