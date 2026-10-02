import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools } from '../scenario.js';

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
    await trySimpleEdit('add document tab', 'google_docs_add_document_tab', {
      documentId,
      title: 'smoke tab',
    });

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
