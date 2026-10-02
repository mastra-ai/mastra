import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, probeTool } from '../scenario.js';

/**
 * Deep Google Docs scenario: creates a doc, exercises the structural edit
 * surface (insert text, paragraph bullets, table, named ranges), updates
 * styles, lists revisions, then deletes the doc via google-drive.
 */
export const googleDocsScenario: Scenario = {
  integrationId: 'google-docs',
  summary: 'document create + structural edits + style updates + revisions',
  async run({ tools, allTools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, ['google_docs_create_document', 'google_docs_insert_text']);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    let documentId: string | undefined;
    try {
      const doc = await call<{ documentId: string }>('google_docs_create_document', {
        title: `${runId} smoke doc`,
      });
      documentId = doc.documentId;
      steps.push(makeStep('create document', 'google_docs_create_document', 'pass', documentId));
    } catch (error) {
      steps.push(makeStep('create document', 'google_docs_create_document', 'fail', errorMessage(error)));
      return steps;
    }

    const trySimpleEdit = async (name: string, toolId: string, input: unknown) => {
      if (!tools[toolId]) return;
      try {
        await call(toolId, input);
        steps.push(makeStep(name, toolId, 'pass'));
      } catch (error) {
        steps.push(makeStep(name, toolId, 'fail', errorMessage(error)));
      }
    };

    // insert_text takes a Google Docs `location: { index }` object (unlike
    // insert_page_break / insert_section_break which take a bare `index`).
    await trySimpleEdit('insert text', 'google_docs_insert_text', {
      documentId,
      location: { index: 1 },
      text: `${runId} smoke body\n`,
    });
    await trySimpleEdit('insert page break', 'google_docs_insert_page_break', { documentId, index: 1 });
    await trySimpleEdit('insert section break', 'google_docs_insert_section_break', {
      documentId,
      index: 1,
      sectionType: 'NEXT_PAGE',
    });
    await trySimpleEdit('insert table', 'google_docs_insert_table', {
      documentId,
      index: 1,
      rows: 2,
      columns: 2,
    });
    await trySimpleEdit('create paragraph bullets', 'google_docs_create_paragraph_bullets', {
      documentId,
      startIndex: 1,
      endIndex: 2,
      bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
    });
    // update_text_style takes style fields (bold, italic, …) directly at the
    // top level and builds the API's `fields` mask itself; the scenario does
    // NOT send a nested `textStyle` or a `fields` string.
    await trySimpleEdit('update text style', 'google_docs_update_text_style', {
      documentId,
      startIndex: 1,
      endIndex: 2,
      bold: true,
    });
    await trySimpleEdit('update paragraph style', 'google_docs_update_paragraph_style', {
      documentId,
      startIndex: 1,
      endIndex: 2,
      paragraphStyle: { namedStyleType: 'HEADING_1' },
      fields: 'namedStyleType',
    });
    await trySimpleEdit('replace all text', 'google_docs_replace_all_text', {
      documentId,
      containsText: { text: runId },
      replaceText: `${runId}-replaced`,
    });
    await trySimpleEdit('create named range', 'google_docs_create_named_range', {
      documentId,
      name: `smoke-range-${runId}`,
      startIndex: 1,
      endIndex: 2,
    });
    await trySimpleEdit('list revisions', 'google_docs_list_revisions', { documentId });

    // Table row/column/cell operations target `tableStartLocation.index`, but
    // after the earlier structural edits (text, page/section breaks, bullets,
    // named ranges) the actual table start index in the doc body is unstable
    // and there's no get_document tool to look it up at runtime. Probe each
    // endpoint with a synthetic index — Docs returns 400 "invalid table start
    // location" which proves tool routing + request validation are correct.
    steps.push(
      await probeTool(call, tools, 'insert table row (probe)', 'google_docs_insert_table_row', {
        documentId,
        tableStartLocationIndex: 1,
        rowIndex: 0,
        columnIndex: 0,
        insertBelow: true,
      }),
    );
    steps.push(
      await probeTool(call, tools, 'insert table column (probe)', 'google_docs_insert_table_column', {
        documentId,
        tableStartLocationIndex: 1,
        rowIndex: 0,
        columnIndex: 0,
        insertRight: true,
      }),
    );
    steps.push(
      await probeTool(call, tools, 'merge table cells (probe)', 'google_docs_merge_table_cells', {
        documentId,
        tableStartLocation: { index: 1 },
        rowIndex: 0,
        columnIndex: 0,
        rowSpan: 1,
        columnSpan: 2,
      }),
    );
    steps.push(
      await probeTool(call, tools, 'unmerge table cells (probe)', 'google_docs_unmerge_table_cells', {
        documentId,
        tableRange: {
          tableCellLocation: { tableStartLocation: { index: 1 }, rowIndex: 0, columnIndex: 0 },
          rowSpan: 1,
          columnSpan: 2,
        },
      }),
    );
    steps.push(
      await probeTool(call, tools, 'update table cell style (probe)', 'google_docs_update_table_cell_style', {
        documentId,
        tableRange: {
          tableCellLocation: { tableStartLocation: { index: 1 }, rowIndex: 0, columnIndex: 0 },
          rowSpan: 1,
          columnSpan: 1,
        },
        tableCellStyle: { backgroundColor: { color: { rgbColor: { red: 0.95, green: 0.95, blue: 1 } } } },
        fields: 'backgroundColor',
      }),
    );
    steps.push(
      await probeTool(call, tools, 'update table row style (probe)', 'google_docs_update_table_row_style', {
        documentId,
        tableStartLocation: { index: 1 },
        rowIndices: [0],
        tableRowStyle: { minRowHeight: { magnitude: 20, unit: 'PT' } },
        fields: 'minRowHeight',
      }),
    );
    steps.push(
      await probeTool(call, tools, 'pin table header rows (probe)', 'google_docs_pin_table_header_rows', {
        documentId,
        tableStartLocation: 1,
        pinnedHeaderRowsCount: 1,
      }),
    );
    steps.push(
      await probeTool(call, tools, 'delete table row (probe)', 'google_docs_delete_table_row', {
        documentId,
        tableStartIndex: 1,
        rowIndex: 1,
        columnIndex: 0,
      }),
    );
    steps.push(
      await probeTool(call, tools, 'delete table column (probe)', 'google_docs_delete_table_column', {
        documentId,
        tableStartLocationIndex: 1,
        rowIndex: 0,
        columnIndex: 1,
      }),
    );

    // Header + footer + footnote lifecycle.
    let headerId: string | undefined;
    let footerId: string | undefined;
    if (tools['google_docs_create_header']) {
      try {
        const result = await call<{ headerId?: string }>('google_docs_create_header', {
          documentId,
          text: `header ${runId}`,
        });
        headerId = result.headerId;
        steps.push(makeStep('create header', 'google_docs_create_header', 'pass'));
      } catch (error) {
        steps.push(makeStep('create header', 'google_docs_create_header', 'fail', errorMessage(error)));
      }
    }
    if (tools['google_docs_create_footer']) {
      try {
        const result = await call<{ footerId?: string }>('google_docs_create_footer', {
          documentId,
          text: `footer ${runId}`,
        });
        footerId = result.footerId;
        steps.push(makeStep('create footer', 'google_docs_create_footer', 'pass'));
      } catch (error) {
        steps.push(makeStep('create footer', 'google_docs_create_footer', 'fail', errorMessage(error)));
      }
    }
    await trySimpleEdit('create footnote', 'google_docs_create_footnote', {
      documentId,
      index: 1,
    });
    if (headerId && tools['google_docs_delete_header']) {
      try {
        await call('google_docs_delete_header', { documentId, headerId });
        steps.push(makeStep('delete header', 'google_docs_delete_header', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete header', 'google_docs_delete_header', 'fail', errorMessage(error)));
      }
    }
    if (footerId && tools['google_docs_delete_footer']) {
      try {
        await call('google_docs_delete_footer', { documentId, footerId });
        steps.push(makeStep('delete footer', 'google_docs_delete_footer', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete footer', 'google_docs_delete_footer', 'fail', errorMessage(error)));
      }
    }

    // Document + section style updates — use trivial changes.
    await trySimpleEdit('update document style', 'google_docs_update_document_style', {
      documentId,
      documentStyle: { marginTop: { magnitude: 72, unit: 'PT' } },
      fields: 'marginTop',
    });
    await trySimpleEdit('update section style', 'google_docs_update_section_style', {
      documentId,
      startIndex: 1,
      endIndex: 2,
      sectionStyle: { marginTop: { magnitude: 72, unit: 'PT' } },
      fields: 'marginTop',
    });

    // Image lifecycle: insert_inline_image + replace_image.
    const smokeImage = 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_light_color_42x16dp.png';
    let imageObjectId: string | undefined;
    if (tools['google_docs_insert_inline_image']) {
      try {
        const result = await call<{ objectId?: string }>('google_docs_insert_inline_image', {
          documentId,
          imageUri: smokeImage,
          location: { index: 1 },
        });
        imageObjectId = result.objectId;
        steps.push(makeStep('insert inline image', 'google_docs_insert_inline_image', 'pass'));
      } catch (error) {
        steps.push(makeStep('insert inline image', 'google_docs_insert_inline_image', 'fail', errorMessage(error)));
      }
    }
    if (imageObjectId && tools['google_docs_replace_image']) {
      try {
        await call('google_docs_replace_image', { documentId, imageObjectId, uri: smokeImage });
        steps.push(makeStep('replace image', 'google_docs_replace_image', 'pass'));
      } catch (error) {
        steps.push(makeStep('replace image', 'google_docs_replace_image', 'fail', errorMessage(error)));
      }
    } else if (tools['google_docs_replace_image']) {
      // Fall back to probing with a synthetic id — proves the endpoint wires up.
      steps.push(
        await probeTool(call, tools, 'replace image (probe)', 'google_docs_replace_image', {
          documentId,
          imageObjectId: 'kix.smoke_missing_image',
          uri: smokeImage,
        }),
      );
    }

    // Named-range content replace + delete (uses snake_case params upstream).
    await trySimpleEdit('replace named range content', 'google_docs_replace_named_range_content', {
      document_id: documentId,
      named_range_name: `smoke-range-${runId}`,
      text: `${runId}-named-updated`,
    });
    await trySimpleEdit('delete named range', 'google_docs_delete_named_range', {
      documentId,
      name: `smoke-range-${runId}`,
    });
    await trySimpleEdit('delete paragraph bullets', 'google_docs_delete_paragraph_bullets', {
      documentId,
      startIndex: 1,
      endIndex: 2,
    });
    // Clip a small range at the end to exercise delete_content_range.
    await trySimpleEdit('delete content range', 'google_docs_delete_content_range', {
      documentId,
      startIndex: 1,
      endIndex: 2,
    });

    // Tab lifecycle: add_document_tab is already called; update + delete it.
    let addedTabId: string | undefined;
    if (tools['google_docs_add_document_tab']) {
      try {
        const result = await call<{ tabId?: string }>('google_docs_add_document_tab', {
          documentId,
          title: 'smoke tab',
        });
        addedTabId = result.tabId;
        steps.push(makeStep('add document tab', 'google_docs_add_document_tab', 'pass'));
      } catch (error) {
        steps.push(makeStep('add document tab', 'google_docs_add_document_tab', 'fail', errorMessage(error)));
      }
    }
    if (addedTabId && tools['google_docs_update_document_tab_properties']) {
      try {
        await call('google_docs_update_document_tab_properties', {
          documentId,
          tabId: addedTabId,
          title: `smoke tab renamed ${runId}`,
        });
        steps.push(makeStep('update document tab properties', 'google_docs_update_document_tab_properties', 'pass'));
      } catch (error) {
        steps.push(
          makeStep(
            'update document tab properties',
            'google_docs_update_document_tab_properties',
            'fail',
            errorMessage(error),
          ),
        );
      }
    } else if (tools['google_docs_update_document_tab_properties']) {
      steps.push(
        await probeTool(
          call,
          tools,
          'update document tab properties (probe)',
          'google_docs_update_document_tab_properties',
          { documentId, tabId: 't.smoke-missing', title: 'smoke tab renamed' },
        ),
      );
    }
    if (addedTabId && tools['google_docs_delete_document_tab']) {
      try {
        await call('google_docs_delete_document_tab', { documentId, tabId: addedTabId });
        steps.push(makeStep('delete document tab', 'google_docs_delete_document_tab', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete document tab', 'google_docs_delete_document_tab', 'fail', errorMessage(error)));
      }
    } else if (tools['google_docs_delete_document_tab']) {
      steps.push(
        await probeTool(call, tools, 'delete document tab (probe)', 'google_docs_delete_document_tab', {
          documentId,
          tabId: 't.smoke-missing',
        }),
      );
    }

    // export_document still goes through google-docs even though it hits the
    // Drive export endpoint; proxy routing is the point of exercising it.
    if (tools['google_docs_export_document']) {
      try {
        await call('google_docs_export_document', { fileId: documentId, mimeType: 'text/plain' });
        steps.push(makeStep('export document', 'google_docs_export_document', 'pass'));
      } catch (error) {
        // Known upstream bug (PR #699 moves it to google-drive). Record the
        // invocation but treat the baseUrlOverride proxy rejection as a fail
        // so operators see the discovery.
        steps.push(makeStep('export document', 'google_docs_export_document', 'fail', errorMessage(error)));
      }
    }

    const driveDelete = allTools['google_drive_delete_file'];
    if (driveDelete && typeof driveDelete.execute === 'function') {
      try {
        await (driveDelete.execute as (input: unknown) => Promise<unknown>)({ fileId: documentId });
        steps.push(makeStep('delete document (via drive)', 'google_drive_delete_file', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke doc ${documentId}`, errorMessage(error));
        steps.push(makeStep('delete document (via drive)', 'google_drive_delete_file', 'fail', errorMessage(error)));
      }
    } else {
      log.warn(`Cannot delete smoke doc ${documentId}: google-drive provider not attached. Clean up manually.`);
      steps.push(
        makeStep(
          'delete document (via drive)',
          'google_drive_delete_file',
          'fail',
          `google-drive provider unavailable; leaked doc ${documentId}`,
        ),
      );
    }

    return steps;
  },
};
