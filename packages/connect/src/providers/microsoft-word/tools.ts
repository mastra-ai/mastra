// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyToolFilter } from '../../toolset.js';
import { copyWordDocumentTool } from './tools/copy-word-document.js';
import { createFolderTool } from './tools/create-folder.js';
import { createSharingLinkTool } from './tools/create-sharing-link.js';
import { createWordDocumentTool } from './tools/create-word-document.js';
import { deleteWordDocumentTool } from './tools/delete-word-document.js';
import { getSiteDriveTool } from './tools/get-site-drive.js';
import { getUserDriveTool } from './tools/get-user-drive.js';
import { getWordDocumentAsPdfTool } from './tools/get-word-document-as-pdf.js';
import { getWordDocumentContentTool } from './tools/get-word-document-content.js';
import { getWordDocumentTool } from './tools/get-word-document.js';
import { listSitesTool } from './tools/list-sites.js';
import { listUsersTool } from './tools/list-users.js';
import { listWordDocumentPermissionsTool } from './tools/list-word-document-permissions.js';
import { listWordDocumentVersionsTool } from './tools/list-word-document-versions.js';
import { listWordDocumentsTool } from './tools/list-word-documents.js';
import { moveWordDocumentTool } from './tools/move-word-document.js';
import { updateWordDocumentContentTool } from './tools/update-word-document-content.js';
import { updateWordDocumentMetadataTool } from './tools/update-word-document-metadata.js';

export function createMicrosoftWordTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    microsoft_word_copy_word_document: copyWordDocumentTool(platformProxy),
    microsoft_word_create_folder: createFolderTool(platformProxy),
    microsoft_word_create_sharing_link: createSharingLinkTool(platformProxy),
    microsoft_word_create_word_document: createWordDocumentTool(platformProxy),
    microsoft_word_delete_word_document: deleteWordDocumentTool(platformProxy),
    microsoft_word_get_site_drive: getSiteDriveTool(platformProxy),
    microsoft_word_get_user_drive: getUserDriveTool(platformProxy),
    microsoft_word_get_word_document_as_pdf: getWordDocumentAsPdfTool(platformProxy),
    microsoft_word_get_word_document_content: getWordDocumentContentTool(platformProxy),
    microsoft_word_get_word_document: getWordDocumentTool(platformProxy),
    microsoft_word_list_sites: listSitesTool(platformProxy),
    microsoft_word_list_users: listUsersTool(platformProxy),
    microsoft_word_list_word_document_permissions: listWordDocumentPermissionsTool(platformProxy),
    microsoft_word_list_word_document_versions: listWordDocumentVersionsTool(platformProxy),
    microsoft_word_list_word_documents: listWordDocumentsTool(platformProxy),
    microsoft_word_move_word_document: moveWordDocumentTool(platformProxy),
    microsoft_word_update_word_document_content: updateWordDocumentContentTool(platformProxy),
    microsoft_word_update_word_document_metadata: updateWordDocumentMetadataTool(platformProxy),
  };
  return applyToolFilter(tools, { allowTools: options?.allowTools, disallowTools: options?.disallowTools });
}
