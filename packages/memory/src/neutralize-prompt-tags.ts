/**
 * Escapes the opening `<` of any spelling of the given delimiter tags inside
 * stored or recalled content, so the content cannot close (or reopen) the
 * prompt region it is rendered into. Everything else is left as-is: a full XML
 * escape would be written back into storage when the model echoes the content
 * (for example through `updateWorkingMemory`).
 *
 * Kept local rather than imported from `@mastra/core` so it works across the
 * supported `@mastra/core` peer range.
 */
export function neutralizePromptTags(text: string, tagNames: readonly string[]): string {
  const pattern = new RegExp(`<(\\s*/?\\s*(?:${tagNames.join('|')})(?![\\w-]))`, 'gi');
  return text.replace(pattern, '&lt;$1');
}
