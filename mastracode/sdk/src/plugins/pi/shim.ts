export type {
  PiExtensionApi as ExtensionAPI,
  PiExtensionFactory as ExtensionFactory,
  PiRegisteredCommand as RegisteredCommand,
  PiRegisteredTool as ToolDefinition,
} from './types.js';

export function defineTool<TTool>(tool: TTool): TTool {
  return tool;
}
