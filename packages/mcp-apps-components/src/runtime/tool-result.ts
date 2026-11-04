type ToolResultContent = ReadonlyArray<{ type: string; text?: unknown }>;

export function firstText(content: ToolResultContent) {
  const text = content.find(block => block.type === 'text' && typeof block.text === 'string')?.text;
  return typeof text === 'string' ? text : undefined;
}

// Some hosts forward only `content`; by MCP convention a tool with an output schema also
// serializes its structured output as JSON in the first text block.
export function structuredOutput(result: { structuredContent?: unknown; content: ToolResultContent }) {
  if (result.structuredContent !== undefined) return result.structuredContent;
  const text = firstText(result.content);
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
