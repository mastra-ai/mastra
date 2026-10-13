// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyToolFilter } from '../../toolset.js';
import { copyFileTool } from './tools/copy-file.js';
import { createCommentTool } from './tools/create-comment.js';
import { createFolderTool } from './tools/create-folder.js';
import { createSharedDriveTool } from './tools/create-shared-drive.js';
import { deleteCommentTool } from './tools/delete-comment.js';
import { deleteFileTool } from './tools/delete-file.js';
import { deletePermissionTool } from './tools/delete-permission.js';
import { deleteSharedDriveTool } from './tools/delete-shared-drive.js';
import { emptyTrashTool } from './tools/empty-trash.js';
import { findFileTool } from './tools/find-file.js';
import { findFolderTool } from './tools/find-folder.js';
import { getAboutTool } from './tools/get-about.js';
import { getChangesStartPageTokenTool } from './tools/get-changes-start-page-token.js';
import { getCommentTool } from './tools/get-comment.js';
import { getPermissionTool } from './tools/get-permission.js';
import { getRevisionTool } from './tools/get-revision.js';
import { getSharedDriveTool } from './tools/get-shared-drive.js';
import { hideSharedDriveTool } from './tools/hide-shared-drive.js';
import { listChangesTool } from './tools/list-changes.js';
import { listCommentsTool } from './tools/list-comments.js';
import { listDrivesTool } from './tools/list-drives.js';
import { listFilesNonUnifiedTool } from './tools/list-files-non-unified.js';
import { listPermissionsTool } from './tools/list-permissions.js';
import { moveFileTool } from './tools/move-file.js';
import { unhideSharedDriveTool } from './tools/unhide-shared-drive.js';
import { updateCommentTool } from './tools/update-comment.js';
import { updateFileTool } from './tools/update-file.js';
import { updatePermissionTool } from './tools/update-permission.js';
import { updateSharedDriveTool } from './tools/update-shared-drive.js';
import { uploadDocumentTool } from './tools/upload-document.js';

export function createGoogleDriveTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    google_drive_copy_file: copyFileTool(platformProxy),
    google_drive_create_comment: createCommentTool(platformProxy),
    google_drive_create_folder: createFolderTool(platformProxy),
    google_drive_create_shared_drive: createSharedDriveTool(platformProxy),
    google_drive_delete_comment: deleteCommentTool(platformProxy),
    google_drive_delete_file: deleteFileTool(platformProxy),
    google_drive_delete_permission: deletePermissionTool(platformProxy),
    google_drive_delete_shared_drive: deleteSharedDriveTool(platformProxy),
    google_drive_empty_trash: emptyTrashTool(platformProxy),
    google_drive_find_file: findFileTool(platformProxy),
    google_drive_find_folder: findFolderTool(platformProxy),
    google_drive_get_about: getAboutTool(platformProxy),
    google_drive_get_changes_start_page_token: getChangesStartPageTokenTool(platformProxy),
    google_drive_get_comment: getCommentTool(platformProxy),
    google_drive_get_permission: getPermissionTool(platformProxy),
    google_drive_get_revision: getRevisionTool(platformProxy),
    google_drive_get_shared_drive: getSharedDriveTool(platformProxy),
    google_drive_hide_shared_drive: hideSharedDriveTool(platformProxy),
    google_drive_list_changes: listChangesTool(platformProxy),
    google_drive_list_comments: listCommentsTool(platformProxy),
    google_drive_list_drives: listDrivesTool(platformProxy),
    google_drive_list_files_non_unified: listFilesNonUnifiedTool(platformProxy),
    google_drive_list_permissions: listPermissionsTool(platformProxy),
    google_drive_move_file: moveFileTool(platformProxy),
    google_drive_unhide_shared_drive: unhideSharedDriveTool(platformProxy),
    google_drive_update_comment: updateCommentTool(platformProxy),
    google_drive_update_file: updateFileTool(platformProxy),
    google_drive_update_permission: updatePermissionTool(platformProxy),
    google_drive_update_shared_drive: updateSharedDriveTool(platformProxy),
    google_drive_upload_document: uploadDocumentTool(platformProxy),
  };
  return applyToolFilter(tools, { allowTools: options?.allowTools, disallowTools: options?.disallowTools });
}
