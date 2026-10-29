import type { GetToolResponse } from '@mastra/client-js';

/** The tool registry: `cookingTool` is the key, `cooking-tool` the id the tool page opens. */
export const registeredTools: Record<string, GetToolResponse> = {
  cookingTool: { id: 'cooking-tool', description: 'Suggests a recipe from what is in the fridge.' },
};
