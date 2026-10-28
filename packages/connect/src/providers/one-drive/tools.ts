// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyToolFilter } from '../../toolset.js';
import { copyItemTool } from './tools/copy-item.js';
import { createFolderTool } from './tools/create-folder.js';
import { createSharingLinkTool } from './tools/create-sharing-link.js';
import { createUploadSessionTool } from './tools/create-upload-session.js';
import { deleteItemTool } from './tools/delete-item.js';
import { deletePermissionTool } from './tools/delete-permission.js';
import { getDriveTool } from './tools/get-drive.js';
import { getItemTool } from './tools/get-item.js';
import { getPermissionTool } from './tools/get-permission.js';
import { inviteRecipientsTool } from './tools/invite-recipients.js';
import { listChildrenTool } from './tools/list-children.js';
import { listDrivesTool } from './tools/list-drives.js';
import { listPermissionsTool } from './tools/list-permissions.js';
import { listRecentItemsTool } from './tools/list-recent-items.js';
import { listSharedItemsTool } from './tools/list-shared-items.js';
import { listVersionsTool } from './tools/list-versions.js';
import { moveItemTool } from './tools/move-item.js';
import { searchItemsTool } from './tools/search-items.js';
import { updateItemTool } from './tools/update-item.js';
import { uploadSmallFileTool } from './tools/upload-small-file.js';

export function createOneDriveTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    one_drive_copy_item: copyItemTool(platformProxy),
    one_drive_create_folder: createFolderTool(platformProxy),
    one_drive_create_sharing_link: createSharingLinkTool(platformProxy),
    one_drive_create_upload_session: createUploadSessionTool(platformProxy),
    one_drive_delete_item: deleteItemTool(platformProxy),
    one_drive_delete_permission: deletePermissionTool(platformProxy),
    one_drive_get_drive: getDriveTool(platformProxy),
    one_drive_get_item: getItemTool(platformProxy),
    one_drive_get_permission: getPermissionTool(platformProxy),
    one_drive_invite_recipients: inviteRecipientsTool(platformProxy),
    one_drive_list_children: listChildrenTool(platformProxy),
    one_drive_list_drives: listDrivesTool(platformProxy),
    one_drive_list_permissions: listPermissionsTool(platformProxy),
    one_drive_list_recent_items: listRecentItemsTool(platformProxy),
    one_drive_list_shared_items: listSharedItemsTool(platformProxy),
    one_drive_list_versions: listVersionsTool(platformProxy),
    one_drive_move_item: moveItemTool(platformProxy),
    one_drive_search_items: searchItemsTool(platformProxy),
    one_drive_update_item: updateItemTool(platformProxy),
    one_drive_upload_small_file: uploadSmallFileTool(platformProxy),
  };
  return applyToolFilter(tools, { allowTools: options?.allowTools, disallowTools: options?.disallowTools });
}
