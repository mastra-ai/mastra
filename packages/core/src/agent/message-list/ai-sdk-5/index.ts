import type { ToolUIPart } from 'ai';

// This is a replacement for this buggy AI SDK v5 function which breaks if a tool name contains hyphens:
// function getToolName(part) {
//   return part.type.split("-")[1];
// }
export function getToolName(part: ToolUIPart<any>) {
  if (!part.type.startsWith('tool-')) {
    throw new Error(`Part is not a tool-* UI part ${JSON.stringify(part)}`);
  }
  const [_, ...nameParts] = part.type.split('-');
  return nameParts.join('-');
}
