// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyToolFilter } from '../../toolset.js';
import { addContentTypeToListTool } from './tools/add-content-type-to-list.js';
import { addDriveItemPermissionTool } from './tools/add-drive-item-permission.js';
import { copyDriveItemTool } from './tools/copy-drive-item.js';
import { createContentTypeTool } from './tools/create-content-type.js';
import { createDriveFolderTool } from './tools/create-drive-folder.js';
import { createDriveUploadSessionTool } from './tools/create-drive-upload-session.js';
import { createListColumnTool } from './tools/create-list-column.js';
import { createListItemTool } from './tools/create-list-item.js';
import { createListTool } from './tools/create-list.js';
import { createSharingLinkTool } from './tools/create-sharing-link.js';
import { createSiteColumnTool } from './tools/create-site-column.js';
import { createSitePageTool } from './tools/create-site-page.js';
import { deleteContentTypeTool } from './tools/delete-content-type.js';
import { deleteDriveItemTool } from './tools/delete-drive-item.js';
import { deleteListColumnTool } from './tools/delete-list-column.js';
import { deleteListItemTool } from './tools/delete-list-item.js';
import { deleteListTool } from './tools/delete-list.js';
import { deleteSiteColumnTool } from './tools/delete-site-column.js';
import { deleteSitePageTool } from './tools/delete-site-page.js';
import { downloadDriveItemContentTool } from './tools/download-drive-item-content.js';
import { getContentTypeTool } from './tools/get-content-type.js';
import { getDriveItemThumbnailTool } from './tools/get-drive-item-thumbnail.js';
import { getDriveItemTool } from './tools/get-drive-item.js';
import { getDriveTool } from './tools/get-drive.js';
import { getListItemTool } from './tools/get-list-item.js';
import { getListTool } from './tools/get-list.js';
import { getSitePageTool } from './tools/get-site-page.js';
import { getSiteTool } from './tools/get-site.js';
import { listContentTypesTool } from './tools/list-content-types.js';
import { listDriveChildrenTool } from './tools/list-drive-children.js';
import { listDriveItemPermissionsTool } from './tools/list-drive-item-permissions.js';
import { listDriveItemVersionsTool } from './tools/list-drive-item-versions.js';
import { listDrivesTool } from './tools/list-drives.js';
import { listListColumnsTool } from './tools/list-list-columns.js';
import { listListContentTypesTool } from './tools/list-list-content-types.js';
import { listListItemsTool } from './tools/list-list-items.js';
import { listListsTool } from './tools/list-lists.js';
import { listSharedSitesTool } from './tools/list-shared-sites.js';
import { listSiteColumnsTool } from './tools/list-site-columns.js';
import { listSitePagesTool } from './tools/list-site-pages.js';
import { publishSitePageTool } from './tools/publish-site-page.js';
import { removeDriveItemPermissionTool } from './tools/remove-drive-item-permission.js';
import { restoreDriveItemVersionTool } from './tools/restore-drive-item-version.js';
import { searchDriveItemsTool } from './tools/search-drive-items.js';
import { searchSitesTool } from './tools/search-sites.js';
import { updateDriveItemPermissionTool } from './tools/update-drive-item-permission.js';
import { updateDriveItemTool } from './tools/update-drive-item.js';
import { updateListColumnTool } from './tools/update-list-column.js';
import { updateListItemTool } from './tools/update-list-item.js';
import { updateListTool } from './tools/update-list.js';
import { updateSiteColumnTool } from './tools/update-site-column.js';
import { updateSitePageTool } from './tools/update-site-page.js';
import { uploadDriveItemTool } from './tools/upload-drive-item.js';

export function createSharepointOnlineTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    sharepoint_online_add_content_type_to_list: addContentTypeToListTool(platformProxy),
    sharepoint_online_add_drive_item_permission: addDriveItemPermissionTool(platformProxy),
    sharepoint_online_copy_drive_item: copyDriveItemTool(platformProxy),
    sharepoint_online_create_content_type: createContentTypeTool(platformProxy),
    sharepoint_online_create_drive_folder: createDriveFolderTool(platformProxy),
    sharepoint_online_create_drive_upload_session: createDriveUploadSessionTool(platformProxy),
    sharepoint_online_create_list_column: createListColumnTool(platformProxy),
    sharepoint_online_create_list_item: createListItemTool(platformProxy),
    sharepoint_online_create_list: createListTool(platformProxy),
    sharepoint_online_create_sharing_link: createSharingLinkTool(platformProxy),
    sharepoint_online_create_site_column: createSiteColumnTool(platformProxy),
    sharepoint_online_create_site_page: createSitePageTool(platformProxy),
    sharepoint_online_delete_content_type: deleteContentTypeTool(platformProxy),
    sharepoint_online_delete_drive_item: deleteDriveItemTool(platformProxy),
    sharepoint_online_delete_list_column: deleteListColumnTool(platformProxy),
    sharepoint_online_delete_list_item: deleteListItemTool(platformProxy),
    sharepoint_online_delete_list: deleteListTool(platformProxy),
    sharepoint_online_delete_site_column: deleteSiteColumnTool(platformProxy),
    sharepoint_online_delete_site_page: deleteSitePageTool(platformProxy),
    sharepoint_online_download_drive_item_content: downloadDriveItemContentTool(platformProxy),
    sharepoint_online_get_content_type: getContentTypeTool(platformProxy),
    sharepoint_online_get_drive_item_thumbnail: getDriveItemThumbnailTool(platformProxy),
    sharepoint_online_get_drive_item: getDriveItemTool(platformProxy),
    sharepoint_online_get_drive: getDriveTool(platformProxy),
    sharepoint_online_get_list_item: getListItemTool(platformProxy),
    sharepoint_online_get_list: getListTool(platformProxy),
    sharepoint_online_get_site_page: getSitePageTool(platformProxy),
    sharepoint_online_get_site: getSiteTool(platformProxy),
    sharepoint_online_list_content_types: listContentTypesTool(platformProxy),
    sharepoint_online_list_drive_children: listDriveChildrenTool(platformProxy),
    sharepoint_online_list_drive_item_permissions: listDriveItemPermissionsTool(platformProxy),
    sharepoint_online_list_drive_item_versions: listDriveItemVersionsTool(platformProxy),
    sharepoint_online_list_drives: listDrivesTool(platformProxy),
    sharepoint_online_list_list_columns: listListColumnsTool(platformProxy),
    sharepoint_online_list_list_content_types: listListContentTypesTool(platformProxy),
    sharepoint_online_list_list_items: listListItemsTool(platformProxy),
    sharepoint_online_list_lists: listListsTool(platformProxy),
    sharepoint_online_list_shared_sites: listSharedSitesTool(platformProxy),
    sharepoint_online_list_site_columns: listSiteColumnsTool(platformProxy),
    sharepoint_online_list_site_pages: listSitePagesTool(platformProxy),
    sharepoint_online_publish_site_page: publishSitePageTool(platformProxy),
    sharepoint_online_remove_drive_item_permission: removeDriveItemPermissionTool(platformProxy),
    sharepoint_online_restore_drive_item_version: restoreDriveItemVersionTool(platformProxy),
    sharepoint_online_search_drive_items: searchDriveItemsTool(platformProxy),
    sharepoint_online_search_sites: searchSitesTool(platformProxy),
    sharepoint_online_update_drive_item_permission: updateDriveItemPermissionTool(platformProxy),
    sharepoint_online_update_drive_item: updateDriveItemTool(platformProxy),
    sharepoint_online_update_list_column: updateListColumnTool(platformProxy),
    sharepoint_online_update_list_item: updateListItemTool(platformProxy),
    sharepoint_online_update_list: updateListTool(platformProxy),
    sharepoint_online_update_site_column: updateSiteColumnTool(platformProxy),
    sharepoint_online_update_site_page: updateSitePageTool(platformProxy),
    sharepoint_online_upload_drive_item: uploadDriveItemTool(platformProxy),
  };
  return applyToolFilter(tools, { allowTools: options?.allowTools, disallowTools: options?.disallowTools });
}
