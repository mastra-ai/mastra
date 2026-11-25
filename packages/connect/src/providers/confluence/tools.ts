// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyToolFilter } from '../../toolset.js';
import { createBlogPostTool } from './tools/create-blog-post.js';
import { createFooterCommentTool } from './tools/create-footer-comment.js';
import { createInlineCommentTool } from './tools/create-inline-comment.js';
import { createPagePropertyTool } from './tools/create-page-property.js';
import { createPageTool } from './tools/create-page.js';
import { deleteAttachmentTool } from './tools/delete-attachment.js';
import { deleteBlogPostTool } from './tools/delete-blog-post.js';
import { deleteFooterCommentTool } from './tools/delete-footer-comment.js';
import { deleteInlineCommentTool } from './tools/delete-inline-comment.js';
import { deletePagePropertyTool } from './tools/delete-page-property.js';
import { deletePageTool } from './tools/delete-page.js';
import { getAttachmentTool } from './tools/get-attachment.js';
import { getBlogPostTool } from './tools/get-blog-post.js';
import { getFooterCommentTool } from './tools/get-footer-comment.js';
import { getInlineCommentTool } from './tools/get-inline-comment.js';
import { getPagePropertyTool } from './tools/get-page-property.js';
import { getPageTool } from './tools/get-page.js';
import { getSpaceTool } from './tools/get-space.js';
import { listAttachmentsTool } from './tools/list-attachments.js';
import { listBlogPostsForLabelTool } from './tools/list-blog-posts-for-label.js';
import { listBlogPostsTool } from './tools/list-blog-posts.js';
import { listPageAttachmentsTool } from './tools/list-page-attachments.js';
import { listPageFooterCommentsTool } from './tools/list-page-footer-comments.js';
import { listPageInlineCommentsTool } from './tools/list-page-inline-comments.js';
import { listPagePropertiesTool } from './tools/list-page-properties.js';
import { listPagesForLabelTool } from './tools/list-pages-for-label.js';
import { listPagesTool } from './tools/list-pages.js';
import { listSpaceBlogPostsTool } from './tools/list-space-blog-posts.js';
import { listSpacePagesTool } from './tools/list-space-pages.js';
import { listSpacesTool } from './tools/list-spaces.js';
import { searchContentTool } from './tools/search-content.js';
import { updateBlogPostTool } from './tools/update-blog-post.js';
import { updateFooterCommentTool } from './tools/update-footer-comment.js';
import { updateInlineCommentTool } from './tools/update-inline-comment.js';
import { updatePagePropertyTool } from './tools/update-page-property.js';
import { updatePageTool } from './tools/update-page.js';

export function createConfluenceTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    confluence_create_blog_post: createBlogPostTool(platformProxy),
    confluence_create_footer_comment: createFooterCommentTool(platformProxy),
    confluence_create_inline_comment: createInlineCommentTool(platformProxy),
    confluence_create_page_property: createPagePropertyTool(platformProxy),
    confluence_create_page: createPageTool(platformProxy),
    confluence_delete_attachment: deleteAttachmentTool(platformProxy),
    confluence_delete_blog_post: deleteBlogPostTool(platformProxy),
    confluence_delete_footer_comment: deleteFooterCommentTool(platformProxy),
    confluence_delete_inline_comment: deleteInlineCommentTool(platformProxy),
    confluence_delete_page_property: deletePagePropertyTool(platformProxy),
    confluence_delete_page: deletePageTool(platformProxy),
    confluence_get_attachment: getAttachmentTool(platformProxy),
    confluence_get_blog_post: getBlogPostTool(platformProxy),
    confluence_get_footer_comment: getFooterCommentTool(platformProxy),
    confluence_get_inline_comment: getInlineCommentTool(platformProxy),
    confluence_get_page_property: getPagePropertyTool(platformProxy),
    confluence_get_page: getPageTool(platformProxy),
    confluence_get_space: getSpaceTool(platformProxy),
    confluence_list_attachments: listAttachmentsTool(platformProxy),
    confluence_list_blog_posts_for_label: listBlogPostsForLabelTool(platformProxy),
    confluence_list_blog_posts: listBlogPostsTool(platformProxy),
    confluence_list_page_attachments: listPageAttachmentsTool(platformProxy),
    confluence_list_page_footer_comments: listPageFooterCommentsTool(platformProxy),
    confluence_list_page_inline_comments: listPageInlineCommentsTool(platformProxy),
    confluence_list_page_properties: listPagePropertiesTool(platformProxy),
    confluence_list_pages_for_label: listPagesForLabelTool(platformProxy),
    confluence_list_pages: listPagesTool(platformProxy),
    confluence_list_space_blog_posts: listSpaceBlogPostsTool(platformProxy),
    confluence_list_space_pages: listSpacePagesTool(platformProxy),
    confluence_list_spaces: listSpacesTool(platformProxy),
    confluence_search_content: searchContentTool(platformProxy),
    confluence_update_blog_post: updateBlogPostTool(platformProxy),
    confluence_update_footer_comment: updateFooterCommentTool(platformProxy),
    confluence_update_inline_comment: updateInlineCommentTool(platformProxy),
    confluence_update_page_property: updatePagePropertyTool(platformProxy),
    confluence_update_page: updatePageTool(platformProxy),
  };
  return applyToolFilter(tools, { allowTools: options?.allowTools, disallowTools: options?.disallowTools });
}
