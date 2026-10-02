import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep Google Drive scenario: folder + file + comment + permission lifecycle.
 * Uses `upload-document` to create a tiny plain-text artifact and cleans
 * everything up at the end.
 */
export const googleDriveScenario: Scenario = {
  integrationId: 'google-drive',
  summary: 'folder + file + comment + permission CRUD',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, [
      'google_drive_create_folder',
      'google_drive_upload_document',
      'google_drive_delete_file',
    ]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['google_drive_get_about', {}],
          ['google_drive_list_drives', { pageSize: 5 }],
          ['google_drive_list_files_non_unified', { pageSize: 5 }],
          ['google_drive_get_changes_start_page_token', {}],
        ],
        tools,
      )),
    );

    let folderId: string | undefined;
    try {
      const folder = await call<{ id: string }>('google_drive_create_folder', {
        name: `${runId} smoke folder`,
      });
      folderId = folder.id;
      steps.push(makeStep('create folder', 'google_drive_create_folder', 'pass', folderId));
    } catch (error) {
      steps.push(makeStep('create folder', 'google_drive_create_folder', 'fail', errorMessage(error)));
      return steps;
    }

    let fileId: string | undefined;
    try {
      const uploaded = await call<{ id: string }>('google_drive_upload_document', {
        name: `${runId}-smoke.txt`,
        mimeType: 'text/plain',
        content: 'Automated @mastra/connect smoke test. Safe to delete.',
        parents: [folderId],
      });
      fileId = uploaded.id;
      steps.push(makeStep('upload file', 'google_drive_upload_document', 'pass', fileId));
    } catch (error) {
      steps.push(makeStep('upload file', 'google_drive_upload_document', 'fail', errorMessage(error)));
    }

    let copiedId: string | undefined;
    if (fileId && tools['google_drive_copy_file']) {
      try {
        const copy = await call<{ id: string }>('google_drive_copy_file', {
          fileId,
          name: `${runId}-smoke-copy.txt`,
        });
        copiedId = copy.id;
        steps.push(makeStep('copy file', 'google_drive_copy_file', 'pass', copiedId));
      } catch (error) {
        steps.push(makeStep('copy file', 'google_drive_copy_file', 'fail', errorMessage(error)));
      }
    }

    if (fileId && tools['google_drive_update_file']) {
      try {
        await call('google_drive_update_file', { fileId, name: `${runId}-smoke-renamed.txt` });
        steps.push(makeStep('update file', 'google_drive_update_file', 'pass'));
      } catch (error) {
        steps.push(makeStep('update file', 'google_drive_update_file', 'fail', errorMessage(error)));
      }
    }

    let commentId: string | undefined;
    if (fileId && tools['google_drive_create_comment']) {
      try {
        const comment = await call<{ id: string }>('google_drive_create_comment', {
          fileId,
          content: `${runId} smoke comment`,
        });
        commentId = comment.id;
        steps.push(makeStep('create comment', 'google_drive_create_comment', 'pass', commentId));
      } catch (error) {
        steps.push(makeStep('create comment', 'google_drive_create_comment', 'fail', errorMessage(error)));
      }
    }

    if (fileId && commentId && tools['google_drive_update_comment']) {
      try {
        await call('google_drive_update_comment', {
          fileId,
          commentId,
          content: 'edited',
        });
        steps.push(makeStep('update comment', 'google_drive_update_comment', 'pass'));
      } catch (error) {
        steps.push(makeStep('update comment', 'google_drive_update_comment', 'fail', errorMessage(error)));
      }
    }
    if (fileId && commentId && tools['google_drive_delete_comment']) {
      try {
        await call('google_drive_delete_comment', { fileId, commentId });
        steps.push(makeStep('delete comment', 'google_drive_delete_comment', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete comment', 'google_drive_delete_comment', 'fail', errorMessage(error)));
      }
    }

    if (fileId && tools['google_drive_list_comments']) {
      try {
        await call('google_drive_list_comments', { fileId });
        steps.push(makeStep('list comments', 'google_drive_list_comments', 'pass'));
      } catch (error) {
        steps.push(makeStep('list comments', 'google_drive_list_comments', 'fail', errorMessage(error)));
      }
    }

    if (fileId && tools['google_drive_find_file']) {
      try {
        await call('google_drive_find_file', { name: `${runId}-smoke-renamed.txt` });
        steps.push(makeStep('find file', 'google_drive_find_file', 'pass'));
      } catch (error) {
        steps.push(makeStep('find file', 'google_drive_find_file', 'fail', errorMessage(error)));
      }
    }

    if (copiedId) {
      try {
        await call('google_drive_delete_file', { fileId: copiedId });
        steps.push(makeStep('delete copy', 'google_drive_delete_file', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete copy', 'google_drive_delete_file', 'fail', errorMessage(error)));
      }
    }

    if (fileId) {
      try {
        await call('google_drive_delete_file', { fileId });
        steps.push(makeStep('delete file', 'google_drive_delete_file', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke file ${fileId} — clean up manually.`, errorMessage(error));
        steps.push(makeStep('delete file', 'google_drive_delete_file', 'fail', errorMessage(error)));
      }
    }

    try {
      await call('google_drive_delete_file', { fileId: folderId });
      steps.push(makeStep('delete folder', 'google_drive_delete_file', 'pass'));
    } catch (error) {
      log.error(`Failed to delete smoke folder ${folderId} — clean up manually.`, errorMessage(error));
      steps.push(makeStep('delete folder', 'google_drive_delete_file', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
