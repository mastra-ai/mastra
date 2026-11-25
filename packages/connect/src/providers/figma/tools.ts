// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyToolFilter } from '../../toolset.js';
import { createCommentReactionTool } from './tools/create-comment-reaction.js';
import { createCommentTool } from './tools/create-comment.js';
import { createDevResourcesTool } from './tools/create-dev-resources.js';
import { deleteCommentReactionTool } from './tools/delete-comment-reaction.js';
import { deleteCommentTool } from './tools/delete-comment.js';
import { deleteDevResourceTool } from './tools/delete-dev-resource.js';
import { getCommentTool } from './tools/get-comment.js';
import { getComponentSetTool } from './tools/get-component-set.js';
import { getComponentTool } from './tools/get-component.js';
import { getCurrentUserTool } from './tools/get-current-user.js';
import { getFileComponentSetsTool } from './tools/get-file-component-sets.js';
import { getFileComponentsTool } from './tools/get-file-components.js';
import { getFileNodeTool } from './tools/get-file-node.js';
import { getFileStylesTool } from './tools/get-file-styles.js';
import { getLocalVariablesTool } from './tools/get-local-variables.js';
import { getPublishedVariablesTool } from './tools/get-published-variables.js';
import { getStyleTool } from './tools/get-style.js';
import { getVersionTool } from './tools/get-version.js';
import { listCommentReactionsTool } from './tools/list-comment-reactions.js';
import { listCommentsTool } from './tools/list-comments.js';
import { listComponentSetsTool } from './tools/list-component-sets.js';
import { listComponentsTool } from './tools/list-components.js';
import { listDevResourcesTool } from './tools/list-dev-resources.js';
import { listFileNodesTool } from './tools/list-file-nodes.js';
import { listStylesTool } from './tools/list-styles.js';
import { listVersionsTool } from './tools/list-versions.js';
import { renderImagesTool } from './tools/render-images.js';
import { updateDevResourcesTool } from './tools/update-dev-resources.js';
import { updateVariablesTool } from './tools/update-variables.js';

export function createFigmaTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    figma_create_comment_reaction: createCommentReactionTool(platformProxy),
    figma_create_comment: createCommentTool(platformProxy),
    figma_create_dev_resources: createDevResourcesTool(platformProxy),
    figma_delete_comment_reaction: deleteCommentReactionTool(platformProxy),
    figma_delete_comment: deleteCommentTool(platformProxy),
    figma_delete_dev_resource: deleteDevResourceTool(platformProxy),
    figma_get_comment: getCommentTool(platformProxy),
    figma_get_component_set: getComponentSetTool(platformProxy),
    figma_get_component: getComponentTool(platformProxy),
    figma_get_current_user: getCurrentUserTool(platformProxy),
    figma_get_file_component_sets: getFileComponentSetsTool(platformProxy),
    figma_get_file_components: getFileComponentsTool(platformProxy),
    figma_get_file_node: getFileNodeTool(platformProxy),
    figma_get_file_styles: getFileStylesTool(platformProxy),
    figma_get_local_variables: getLocalVariablesTool(platformProxy),
    figma_get_published_variables: getPublishedVariablesTool(platformProxy),
    figma_get_style: getStyleTool(platformProxy),
    figma_get_version: getVersionTool(platformProxy),
    figma_list_comment_reactions: listCommentReactionsTool(platformProxy),
    figma_list_comments: listCommentsTool(platformProxy),
    figma_list_component_sets: listComponentSetsTool(platformProxy),
    figma_list_components: listComponentsTool(platformProxy),
    figma_list_dev_resources: listDevResourcesTool(platformProxy),
    figma_list_file_nodes: listFileNodesTool(platformProxy),
    figma_list_styles: listStylesTool(platformProxy),
    figma_list_versions: listVersionsTool(platformProxy),
    figma_render_images: renderImagesTool(platformProxy),
    figma_update_dev_resources: updateDevResourcesTool(platformProxy),
    figma_update_variables: updateVariablesTool(platformProxy),
  };
  return applyToolFilter(tools, { allowTools: options?.allowTools, disallowTools: options?.disallowTools });
}
