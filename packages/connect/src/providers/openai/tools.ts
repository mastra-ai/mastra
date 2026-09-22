// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { addVectorStoreFileTool } from './tools/add-vector-store-file.js';
import { cancelFineTuningJobTool } from './tools/cancel-fine-tuning-job.js';
import { createBatchTool } from './tools/create-batch.js';
import { createChatCompletionTool } from './tools/create-chat-completion.js';
import { createEmbeddingTool } from './tools/create-embedding.js';
import { createImageTool } from './tools/create-image.js';
import { createModerationTool } from './tools/create-moderation.js';
import { createResponseTool } from './tools/create-response.js';
import { createVectorStoreTool } from './tools/create-vector-store.js';
import { deleteResponseTool } from './tools/delete-response.js';
import { deleteVectorStoreFileTool } from './tools/delete-vector-store-file.js';
import { deleteVectorStoreTool } from './tools/delete-vector-store.js';
import { getBatchTool } from './tools/get-batch.js';
import { getFileTool } from './tools/get-file.js';
import { getModelTool } from './tools/get-model.js';
import { getResponseTool } from './tools/get-response.js';
import { getVectorStoreFileTool } from './tools/get-vector-store-file.js';
import { getVectorStoreTool } from './tools/get-vector-store.js';
import { listBatchesTool } from './tools/list-batches.js';
import { listFilesTool } from './tools/list-files.js';
import { listFineTuningJobsTool } from './tools/list-fine-tuning-jobs.js';
import { listModelsTool } from './tools/list-models.js';
import { listVectorStoreFilesTool } from './tools/list-vector-store-files.js';
import { listVectorStoresTool } from './tools/list-vector-stores.js';
import { searchVectorStoreTool } from './tools/search-vector-store.js';
import { updateVectorStoreTool } from './tools/update-vector-store.js';

export function createOpenaiTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    openai_add_vector_store_file: addVectorStoreFileTool(platformProxy),
    openai_cancel_fine_tuning_job: cancelFineTuningJobTool(platformProxy),
    openai_create_batch: createBatchTool(platformProxy),
    openai_create_chat_completion: createChatCompletionTool(platformProxy),
    openai_create_embedding: createEmbeddingTool(platformProxy),
    openai_create_image: createImageTool(platformProxy),
    openai_create_moderation: createModerationTool(platformProxy),
    openai_create_response: createResponseTool(platformProxy),
    openai_create_vector_store: createVectorStoreTool(platformProxy),
    openai_delete_response: deleteResponseTool(platformProxy),
    openai_delete_vector_store_file: deleteVectorStoreFileTool(platformProxy),
    openai_delete_vector_store: deleteVectorStoreTool(platformProxy),
    openai_get_batch: getBatchTool(platformProxy),
    openai_get_file: getFileTool(platformProxy),
    openai_get_model: getModelTool(platformProxy),
    openai_get_response: getResponseTool(platformProxy),
    openai_get_vector_store_file: getVectorStoreFileTool(platformProxy),
    openai_get_vector_store: getVectorStoreTool(platformProxy),
    openai_list_batches: listBatchesTool(platformProxy),
    openai_list_files: listFilesTool(platformProxy),
    openai_list_fine_tuning_jobs: listFineTuningJobsTool(platformProxy),
    openai_list_models: listModelsTool(platformProxy),
    openai_list_vector_store_files: listVectorStoreFilesTool(platformProxy),
    openai_list_vector_stores: listVectorStoresTool(platformProxy),
    openai_search_vector_store: searchVectorStoreTool(platformProxy),
    openai_update_vector_store: updateVectorStoreTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
