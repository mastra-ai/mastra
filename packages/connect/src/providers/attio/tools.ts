// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { createCommentTool } from './tools/create-comment.js';
import { createListEntryTool } from './tools/create-list-entry.js';
import { createListTool } from './tools/create-list.js';
import { createNoteTool } from './tools/create-note.js';
import { createObjectTool } from './tools/create-object.js';
import { createRecordTool } from './tools/create-record.js';
import { createTaskTool } from './tools/create-task.js';
import { createWebhookTool } from './tools/create-webhook.js';
import { deleteCommentTool } from './tools/delete-comment.js';
import { deleteListEntryTool } from './tools/delete-list-entry.js';
import { deleteNoteTool } from './tools/delete-note.js';
import { deleteRecordTool } from './tools/delete-record.js';
import { deleteTaskTool } from './tools/delete-task.js';
import { deleteWebhookTool } from './tools/delete-webhook.js';
import { getCommentTool } from './tools/get-comment.js';
import { getListEntryTool } from './tools/get-list-entry.js';
import { getListTool } from './tools/get-list.js';
import { getNoteTool } from './tools/get-note.js';
import { getObjectTool } from './tools/get-object.js';
import { getRecordTool } from './tools/get-record.js';
import { getTaskTool } from './tools/get-task.js';
import { getWebhookTool } from './tools/get-webhook.js';
import { getWorkspaceMemberTool } from './tools/get-workspace-member.js';
import { listAttributesTool } from './tools/list-attributes.js';
import { listListEntriesTool } from './tools/list-list-entries.js';
import { listListsTool } from './tools/list-lists.js';
import { listNotesTool } from './tools/list-notes.js';
import { listObjectsTool } from './tools/list-objects.js';
import { listRecordsTool } from './tools/list-records.js';
import { listTasksTool } from './tools/list-tasks.js';
import { listWebhooksTool } from './tools/list-webhooks.js';
import { listWorkspaceMembersTool } from './tools/list-workspace-members.js';
import { updateListEntryTool } from './tools/update-list-entry.js';
import { updateListTool } from './tools/update-list.js';
import { updateObjectTool } from './tools/update-object.js';
import { updateRecordTool } from './tools/update-record.js';
import { updateTaskTool } from './tools/update-task.js';
import { updateWebhookTool } from './tools/update-webhook.js';
import { upsertListEntryTool } from './tools/upsert-list-entry.js';
import { upsertRecordTool } from './tools/upsert-record.js';

export function createAttioTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    attio_create_comment: createCommentTool(platformProxy),
    attio_create_list_entry: createListEntryTool(platformProxy),
    attio_create_list: createListTool(platformProxy),
    attio_create_note: createNoteTool(platformProxy),
    attio_create_object: createObjectTool(platformProxy),
    attio_create_record: createRecordTool(platformProxy),
    attio_create_task: createTaskTool(platformProxy),
    attio_create_webhook: createWebhookTool(platformProxy),
    attio_delete_comment: deleteCommentTool(platformProxy),
    attio_delete_list_entry: deleteListEntryTool(platformProxy),
    attio_delete_note: deleteNoteTool(platformProxy),
    attio_delete_record: deleteRecordTool(platformProxy),
    attio_delete_task: deleteTaskTool(platformProxy),
    attio_delete_webhook: deleteWebhookTool(platformProxy),
    attio_get_comment: getCommentTool(platformProxy),
    attio_get_list_entry: getListEntryTool(platformProxy),
    attio_get_list: getListTool(platformProxy),
    attio_get_note: getNoteTool(platformProxy),
    attio_get_object: getObjectTool(platformProxy),
    attio_get_record: getRecordTool(platformProxy),
    attio_get_task: getTaskTool(platformProxy),
    attio_get_webhook: getWebhookTool(platformProxy),
    attio_get_workspace_member: getWorkspaceMemberTool(platformProxy),
    attio_list_attributes: listAttributesTool(platformProxy),
    attio_list_list_entries: listListEntriesTool(platformProxy),
    attio_list_lists: listListsTool(platformProxy),
    attio_list_notes: listNotesTool(platformProxy),
    attio_list_objects: listObjectsTool(platformProxy),
    attio_list_records: listRecordsTool(platformProxy),
    attio_list_tasks: listTasksTool(platformProxy),
    attio_list_webhooks: listWebhooksTool(platformProxy),
    attio_list_workspace_members: listWorkspaceMembersTool(platformProxy),
    attio_update_list_entry: updateListEntryTool(platformProxy),
    attio_update_list: updateListTool(platformProxy),
    attio_update_object: updateObjectTool(platformProxy),
    attio_update_record: updateRecordTool(platformProxy),
    attio_update_task: updateTaskTool(platformProxy),
    attio_update_webhook: updateWebhookTool(platformProxy),
    attio_upsert_list_entry: upsertListEntryTool(platformProxy),
    attio_upsert_record: upsertRecordTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
