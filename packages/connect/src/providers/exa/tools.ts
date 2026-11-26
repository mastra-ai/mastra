// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyToolFilter } from '../../toolset.js';
import { answerTool } from './tools/answer.js';
import { getContentsTool } from './tools/get-contents.js';
import { searchTool } from './tools/search.js';

export function createExaTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    exa_answer: answerTool(platformProxy),
    exa_get_contents: getContentsTool(platformProxy),
    exa_search: searchTool(platformProxy),
  };
  return applyToolFilter(tools, { allowTools: options?.allowTools, disallowTools: options?.disallowTools });
}
