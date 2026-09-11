// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { copyStorageObjectTool } from './tools/copy-storage-object.js';
import { createAuthUserTool } from './tools/create-auth-user.js';
import { createSignedUploadUrlTool } from './tools/create-signed-upload-url.js';
import { createSignedUrlTool } from './tools/create-signed-url.js';
import { createStorageBucketTool } from './tools/create-storage-bucket.js';
import { createStorageObjectTool } from './tools/create-storage-object.js';
import { deleteAuthFactorTool } from './tools/delete-auth-factor.js';
import { deleteAuthUserTool } from './tools/delete-auth-user.js';
import { deleteStorageBucketTool } from './tools/delete-storage-bucket.js';
import { deleteStorageObjectTool } from './tools/delete-storage-object.js';
import { deleteTableRowsTool } from './tools/delete-table-rows.js';
import { generateAuthLinkTool } from './tools/generate-auth-link.js';
import { getAuthUserTool } from './tools/get-auth-user.js';
import { getStorageBucketTool } from './tools/get-storage-bucket.js';
import { getStorageObjectTool } from './tools/get-storage-object.js';
import { insertTableRowTool } from './tools/insert-table-row.js';
import { invokeRpcTool } from './tools/invoke-rpc.js';
import { listAuthFactorsTool } from './tools/list-auth-factors.js';
import { listAuthUsersTool } from './tools/list-auth-users.js';
import { listStorageBucketsTool } from './tools/list-storage-buckets.js';
import { listStorageObjectsTool } from './tools/list-storage-objects.js';
import { queryTableRowsTool } from './tools/query-table-rows.js';
import { updateAuthUserTool } from './tools/update-auth-user.js';
import { updateStorageBucketTool } from './tools/update-storage-bucket.js';
import { updateStorageObjectTool } from './tools/update-storage-object.js';
import { updateTableRowsTool } from './tools/update-table-rows.js';
import { upsertTableRowTool } from './tools/upsert-table-row.js';

export function createSupabaseTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    supabase_copy_storage_object: copyStorageObjectTool(platformProxy),
    supabase_create_auth_user: createAuthUserTool(platformProxy),
    supabase_create_signed_upload_url: createSignedUploadUrlTool(platformProxy),
    supabase_create_signed_url: createSignedUrlTool(platformProxy),
    supabase_create_storage_bucket: createStorageBucketTool(platformProxy),
    supabase_create_storage_object: createStorageObjectTool(platformProxy),
    supabase_delete_auth_factor: deleteAuthFactorTool(platformProxy),
    supabase_delete_auth_user: deleteAuthUserTool(platformProxy),
    supabase_delete_storage_bucket: deleteStorageBucketTool(platformProxy),
    supabase_delete_storage_object: deleteStorageObjectTool(platformProxy),
    supabase_delete_table_rows: deleteTableRowsTool(platformProxy),
    supabase_generate_auth_link: generateAuthLinkTool(platformProxy),
    supabase_get_auth_user: getAuthUserTool(platformProxy),
    supabase_get_storage_bucket: getStorageBucketTool(platformProxy),
    supabase_get_storage_object: getStorageObjectTool(platformProxy),
    supabase_insert_table_row: insertTableRowTool(platformProxy),
    supabase_invoke_rpc: invokeRpcTool(platformProxy),
    supabase_list_auth_factors: listAuthFactorsTool(platformProxy),
    supabase_list_auth_users: listAuthUsersTool(platformProxy),
    supabase_list_storage_buckets: listStorageBucketsTool(platformProxy),
    supabase_list_storage_objects: listStorageObjectsTool(platformProxy),
    supabase_query_table_rows: queryTableRowsTool(platformProxy),
    supabase_update_auth_user: updateAuthUserTool(platformProxy),
    supabase_update_storage_bucket: updateStorageBucketTool(platformProxy),
    supabase_update_storage_object: updateStorageObjectTool(platformProxy),
    supabase_update_table_rows: updateTableRowsTool(platformProxy),
    supabase_upsert_table_row: upsertTableRowTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
