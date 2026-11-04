import type { z } from 'zod';

export type ParsedToolResult<Input> = { success: true; input: Input } | { success: false; message: string };

/** Reads a tool result's `structuredContent` with `schema`, describing the first problem for the user. */
export function parseStructuredContent<Schema extends z.ZodType>(
  schema: Schema,
  structuredContent: unknown,
): ParsedToolResult<z.output<Schema>> {
  const parsed = schema.safeParse(structuredContent);
  if (parsed.success) return { success: true, input: parsed.data };

  const issue = parsed.error.issues[0];
  const where = issue?.path.length ? `\`${issue.path.join('.')}\`: ` : '';
  return { success: false, message: `The tool result can't be shown here. ${where}${issue?.message}` };
}
