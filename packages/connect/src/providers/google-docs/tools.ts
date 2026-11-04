// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyToolFilter } from '../../toolset.js';
import { addDocumentTabTool } from './tools/add-document-tab.js';
import { createDocumentTool } from './tools/create-document.js';
import { createFooterTool } from './tools/create-footer.js';
import { createFootnoteTool } from './tools/create-footnote.js';
import { createHeaderTool } from './tools/create-header.js';
import { createNamedRangeTool } from './tools/create-named-range.js';
import { createParagraphBulletsTool } from './tools/create-paragraph-bullets.js';
import { deleteContentRangeTool } from './tools/delete-content-range.js';
import { deleteDocumentTabTool } from './tools/delete-document-tab.js';
import { deleteFooterTool } from './tools/delete-footer.js';
import { deleteHeaderTool } from './tools/delete-header.js';
import { deleteNamedRangeTool } from './tools/delete-named-range.js';
import { deleteParagraphBulletsTool } from './tools/delete-paragraph-bullets.js';
import { deleteTableColumnTool } from './tools/delete-table-column.js';
import { deleteTableRowTool } from './tools/delete-table-row.js';
import { exportDocumentTool } from './tools/export-document.js';
import { insertInlineImageTool } from './tools/insert-inline-image.js';
import { insertPageBreakTool } from './tools/insert-page-break.js';
import { insertSectionBreakTool } from './tools/insert-section-break.js';
import { insertTableColumnTool } from './tools/insert-table-column.js';
import { insertTableRowTool } from './tools/insert-table-row.js';
import { insertTableTool } from './tools/insert-table.js';
import { insertTextTool } from './tools/insert-text.js';
import { listRevisionsTool } from './tools/list-revisions.js';
import { mergeTableCellsTool } from './tools/merge-table-cells.js';
import { pinTableHeaderRowsTool } from './tools/pin-table-header-rows.js';
import { replaceAllTextTool } from './tools/replace-all-text.js';
import { replaceImageTool } from './tools/replace-image.js';
import { replaceNamedRangeContentTool } from './tools/replace-named-range-content.js';
import { unmergeTableCellsTool } from './tools/unmerge-table-cells.js';
import { updateDocumentStyleTool } from './tools/update-document-style.js';
import { updateDocumentTabPropertiesTool } from './tools/update-document-tab-properties.js';
import { updateParagraphStyleTool } from './tools/update-paragraph-style.js';
import { updateSectionStyleTool } from './tools/update-section-style.js';
import { updateTableCellStyleTool } from './tools/update-table-cell-style.js';
import { updateTableRowStyleTool } from './tools/update-table-row-style.js';
import { updateTextStyleTool } from './tools/update-text-style.js';

export function createGoogleDocsTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    google_docs_add_document_tab: addDocumentTabTool(platformProxy),
    google_docs_create_document: createDocumentTool(platformProxy),
    google_docs_create_footer: createFooterTool(platformProxy),
    google_docs_create_footnote: createFootnoteTool(platformProxy),
    google_docs_create_header: createHeaderTool(platformProxy),
    google_docs_create_named_range: createNamedRangeTool(platformProxy),
    google_docs_create_paragraph_bullets: createParagraphBulletsTool(platformProxy),
    google_docs_delete_content_range: deleteContentRangeTool(platformProxy),
    google_docs_delete_document_tab: deleteDocumentTabTool(platformProxy),
    google_docs_delete_footer: deleteFooterTool(platformProxy),
    google_docs_delete_header: deleteHeaderTool(platformProxy),
    google_docs_delete_named_range: deleteNamedRangeTool(platformProxy),
    google_docs_delete_paragraph_bullets: deleteParagraphBulletsTool(platformProxy),
    google_docs_delete_table_column: deleteTableColumnTool(platformProxy),
    google_docs_delete_table_row: deleteTableRowTool(platformProxy),
    google_docs_export_document: exportDocumentTool(platformProxy),
    google_docs_insert_inline_image: insertInlineImageTool(platformProxy),
    google_docs_insert_page_break: insertPageBreakTool(platformProxy),
    google_docs_insert_section_break: insertSectionBreakTool(platformProxy),
    google_docs_insert_table_column: insertTableColumnTool(platformProxy),
    google_docs_insert_table_row: insertTableRowTool(platformProxy),
    google_docs_insert_table: insertTableTool(platformProxy),
    google_docs_insert_text: insertTextTool(platformProxy),
    google_docs_list_revisions: listRevisionsTool(platformProxy),
    google_docs_merge_table_cells: mergeTableCellsTool(platformProxy),
    google_docs_pin_table_header_rows: pinTableHeaderRowsTool(platformProxy),
    google_docs_replace_all_text: replaceAllTextTool(platformProxy),
    google_docs_replace_image: replaceImageTool(platformProxy),
    google_docs_replace_named_range_content: replaceNamedRangeContentTool(platformProxy),
    google_docs_unmerge_table_cells: unmergeTableCellsTool(platformProxy),
    google_docs_update_document_style: updateDocumentStyleTool(platformProxy),
    google_docs_update_document_tab_properties: updateDocumentTabPropertiesTool(platformProxy),
    google_docs_update_paragraph_style: updateParagraphStyleTool(platformProxy),
    google_docs_update_section_style: updateSectionStyleTool(platformProxy),
    google_docs_update_table_cell_style: updateTableCellStyleTool(platformProxy),
    google_docs_update_table_row_style: updateTableRowStyleTool(platformProxy),
    google_docs_update_text_style: updateTextStyleTool(platformProxy),
  };
  return applyToolFilter(tools, { allowTools: options?.allowTools, disallowTools: options?.disallowTools });
}
