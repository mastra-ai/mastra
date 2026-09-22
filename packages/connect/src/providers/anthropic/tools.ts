// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { cancelMessageBatchTool } from './tools/cancel-message-batch.js';
import { countMessageTokensTool } from './tools/count-message-tokens.js';
import { createMessageBatchTool } from './tools/create-message-batch.js';
import { createMessageTool } from './tools/create-message.js';
import { deleteFileTool } from './tools/delete-file.js';
import { getFileTool } from './tools/get-file.js';
import { getMessageBatchTool } from './tools/get-message-batch.js';
import { getModelTool } from './tools/get-model.js';
import { listFilesTool } from './tools/list-files.js';
import { listMessageBatchResultsTool } from './tools/list-message-batch-results.js';
import { listMessageBatchesTool } from './tools/list-message-batches.js';
import { listModelsTool } from './tools/list-models.js';

export function createAnthropicTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    anthropic_cancel_message_batch: cancelMessageBatchTool(platformProxy),
    anthropic_count_message_tokens: countMessageTokensTool(platformProxy),
    anthropic_create_message_batch: createMessageBatchTool(platformProxy),
    anthropic_create_message: createMessageTool(platformProxy),
    anthropic_delete_file: deleteFileTool(platformProxy),
    anthropic_get_file: getFileTool(platformProxy),
    anthropic_get_message_batch: getMessageBatchTool(platformProxy),
    anthropic_get_model: getModelTool(platformProxy),
    anthropic_list_files: listFilesTool(platformProxy),
    anthropic_list_message_batch_results: listMessageBatchResultsTool(platformProxy),
    anthropic_list_message_batches: listMessageBatchesTool(platformProxy),
    anthropic_list_models: listModelsTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
