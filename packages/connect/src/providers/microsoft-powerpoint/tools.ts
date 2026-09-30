// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyToolFilter } from '../../toolset.js';
import { copyPresentationTool } from './tools/copy-presentation.js';
import { createPresentationTool } from './tools/create-presentation.js';
import { createSharingLinkTool } from './tools/create-sharing-link.js';
import { deletePresentationTool } from './tools/delete-presentation.js';
import { getPresentationAsPdfTool } from './tools/get-presentation-as-pdf.js';
import { getPresentationContentTool } from './tools/get-presentation-content.js';
import { getPresentationTool } from './tools/get-presentation.js';
import { getSiteDriveTool } from './tools/get-site-drive.js';
import { getUserDriveTool } from './tools/get-user-drive.js';
import { listPresentationThumbnailsTool } from './tools/list-presentation-thumbnails.js';
import { listPresentationVersionsTool } from './tools/list-presentation-versions.js';
import { listPresentationsTool } from './tools/list-presentations.js';
import { listSitesTool } from './tools/list-sites.js';
import { listUsersTool } from './tools/list-users.js';
import { movePresentationTool } from './tools/move-presentation.js';
import { updatePresentationContentTool } from './tools/update-presentation-content.js';
import { updatePresentationMetadataTool } from './tools/update-presentation-metadata.js';

export function createMicrosoftPowerpointTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    microsoft_powerpoint_copy_presentation: copyPresentationTool(platformProxy),
    microsoft_powerpoint_create_presentation: createPresentationTool(platformProxy),
    microsoft_powerpoint_create_sharing_link: createSharingLinkTool(platformProxy),
    microsoft_powerpoint_delete_presentation: deletePresentationTool(platformProxy),
    microsoft_powerpoint_get_presentation_as_pdf: getPresentationAsPdfTool(platformProxy),
    microsoft_powerpoint_get_presentation_content: getPresentationContentTool(platformProxy),
    microsoft_powerpoint_get_presentation: getPresentationTool(platformProxy),
    microsoft_powerpoint_get_site_drive: getSiteDriveTool(platformProxy),
    microsoft_powerpoint_get_user_drive: getUserDriveTool(platformProxy),
    microsoft_powerpoint_list_presentation_thumbnails: listPresentationThumbnailsTool(platformProxy),
    microsoft_powerpoint_list_presentation_versions: listPresentationVersionsTool(platformProxy),
    microsoft_powerpoint_list_presentations: listPresentationsTool(platformProxy),
    microsoft_powerpoint_list_sites: listSitesTool(platformProxy),
    microsoft_powerpoint_list_users: listUsersTool(platformProxy),
    microsoft_powerpoint_move_presentation: movePresentationTool(platformProxy),
    microsoft_powerpoint_update_presentation_content: updatePresentationContentTool(platformProxy),
    microsoft_powerpoint_update_presentation_metadata: updatePresentationMetadataTool(platformProxy),
  };
  return applyToolFilter(tools, { allowTools: options?.allowTools, disallowTools: options?.disallowTools });
}
