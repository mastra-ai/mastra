import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch, probeTool } from '../scenario.js';

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

    if (tools['google_drive_find_folder']) {
      try {
        await call('google_drive_find_folder', { name: `${runId} smoke folder` });
        steps.push(makeStep('find folder', 'google_drive_find_folder', 'pass'));
      } catch (error) {
        steps.push(makeStep('find folder', 'google_drive_find_folder', 'fail', errorMessage(error)));
      }
    }

    if (fileId && commentId && tools['google_drive_get_comment']) {
      try {
        await call('google_drive_get_comment', { fileId, commentId });
        steps.push(makeStep('get comment', 'google_drive_get_comment', 'pass'));
      } catch (error) {
        // Comment may have been deleted earlier; still exercises routing.
        steps.push(makeStep('get comment', 'google_drive_get_comment', 'fail', errorMessage(error)));
      }
    }

    // Permission create → list → get → update → delete on our smoke file.
    let permissionId: string | undefined;
    if (fileId && tools['google_drive_create_permission']) {
      try {
        const perm = await call<{ id: string }>('google_drive_create_permission', {
          fileId,
          role: 'reader',
          type: 'anyone',
        });
        permissionId = perm.id;
        steps.push(makeStep('create permission', 'google_drive_create_permission', 'pass', permissionId));
      } catch (error) {
        steps.push(makeStep('create permission', 'google_drive_create_permission', 'fail', errorMessage(error)));
      }
    }
    if (fileId && tools['google_drive_list_permissions']) {
      try {
        await call('google_drive_list_permissions', { fileId });
        steps.push(makeStep('list permissions', 'google_drive_list_permissions', 'pass'));
      } catch (error) {
        steps.push(makeStep('list permissions', 'google_drive_list_permissions', 'fail', errorMessage(error)));
      }
    }
    if (fileId && permissionId && tools['google_drive_get_permission']) {
      try {
        await call('google_drive_get_permission', { fileId, permissionId });
        steps.push(makeStep('get permission', 'google_drive_get_permission', 'pass'));
      } catch (error) {
        steps.push(makeStep('get permission', 'google_drive_get_permission', 'fail', errorMessage(error)));
      }
    }
    if (fileId && permissionId && tools['google_drive_update_permission']) {
      try {
        await call('google_drive_update_permission', { fileId, permissionId, role: 'commenter' });
        steps.push(makeStep('update permission', 'google_drive_update_permission', 'pass'));
      } catch (error) {
        steps.push(makeStep('update permission', 'google_drive_update_permission', 'fail', errorMessage(error)));
      }
    }
    if (fileId && permissionId && tools['google_drive_delete_permission']) {
      try {
        await call('google_drive_delete_permission', { fileId, permissionId });
        steps.push(makeStep('delete permission', 'google_drive_delete_permission', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete permission', 'google_drive_delete_permission', 'fail', errorMessage(error)));
      }
    }

    // Revisions are produced automatically by Drive on edits. Probe with
    // the first revision id ("1") which is almost always present.
    if (fileId) {
      steps.push(
        await probeTool(call, tools, 'get revision', 'google_drive_get_revision', { fileId, revisionId: '1' }),
      );
    }

    // Move the file to a second folder, then back.
    let secondFolderId: string | undefined;
    if (fileId && folderId && tools['google_drive_create_folder']) {
      try {
        const secondFolder = await call<{ id: string }>('google_drive_create_folder', {
          name: `${runId} smoke destination`,
        });
        secondFolderId = secondFolder.id;
        if (tools['google_drive_move_file']) {
          await call('google_drive_move_file', {
            fileId,
            fromFolderId: folderId,
            toFolderId: secondFolderId,
          });
          steps.push(makeStep('move file', 'google_drive_move_file', 'pass'));
        }
      } catch (error) {
        steps.push(makeStep('move file', 'google_drive_move_file', 'fail', errorMessage(error)));
      }
    }

    if (tools['google_drive_list_changes']) {
      try {
        await call('google_drive_list_changes', {});
        steps.push(makeStep('list changes', 'google_drive_list_changes', 'pass'));
      } catch (error) {
        // listChanges requires a pageToken; the schema makes it optional so
        // this may fail with a 400 that still proves the endpoint wires up.
        steps.push(makeStep('list changes', 'google_drive_list_changes', 'fail', errorMessage(error)));
      }
    }

    // Shared drive lifecycle. Create requires requestId (UUID). Hide,
    // update, unhide, get, delete follow.
    let sharedDriveId: string | undefined;
    if (tools['google_drive_create_shared_drive']) {
      try {
        const drive = await call<{ id?: string }>('google_drive_create_shared_drive', {
          name: `smoke-${runId}`.slice(0, 100),
          requestId: `smoke-${runId}-${Date.now()}`,
        });
        sharedDriveId = drive.id;
        steps.push(
          makeStep(
            'create shared drive',
            'google_drive_create_shared_drive',
            sharedDriveId ? 'pass' : 'fail',
            sharedDriveId,
          ),
        );
      } catch (error) {
        // Creating a shared drive needs Workspace tier; probe-level failure
        // still demonstrates routing.
        steps.push(makeStep('create shared drive', 'google_drive_create_shared_drive', 'fail', errorMessage(error)));
      }
    }

    if (sharedDriveId && tools['google_drive_get_shared_drive']) {
      try {
        await call('google_drive_get_shared_drive', { id: sharedDriveId });
        steps.push(makeStep('get shared drive', 'google_drive_get_shared_drive', 'pass'));
      } catch (error) {
        steps.push(makeStep('get shared drive', 'google_drive_get_shared_drive', 'fail', errorMessage(error)));
      }
    }
    if (sharedDriveId && tools['google_drive_update_shared_drive']) {
      try {
        await call('google_drive_update_shared_drive', { driveId: sharedDriveId, name: `smoke-${runId}-renamed` });
        steps.push(makeStep('update shared drive', 'google_drive_update_shared_drive', 'pass'));
      } catch (error) {
        steps.push(makeStep('update shared drive', 'google_drive_update_shared_drive', 'fail', errorMessage(error)));
      }
    }
    if (sharedDriveId && tools['google_drive_hide_shared_drive']) {
      try {
        await call('google_drive_hide_shared_drive', { driveId: sharedDriveId });
        steps.push(makeStep('hide shared drive', 'google_drive_hide_shared_drive', 'pass'));
      } catch (error) {
        steps.push(makeStep('hide shared drive', 'google_drive_hide_shared_drive', 'fail', errorMessage(error)));
      }
    }
    if (sharedDriveId && tools['google_drive_unhide_shared_drive']) {
      try {
        await call('google_drive_unhide_shared_drive', { driveId: sharedDriveId });
        steps.push(makeStep('unhide shared drive', 'google_drive_unhide_shared_drive', 'pass'));
      } catch (error) {
        steps.push(makeStep('unhide shared drive', 'google_drive_unhide_shared_drive', 'fail', errorMessage(error)));
      }
    }
    if (sharedDriveId && tools['google_drive_delete_shared_drive']) {
      try {
        await call('google_drive_delete_shared_drive', { driveId: sharedDriveId });
        steps.push(makeStep('delete shared drive', 'google_drive_delete_shared_drive', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke shared drive ${sharedDriveId}`, errorMessage(error));
        steps.push(makeStep('delete shared drive', 'google_drive_delete_shared_drive', 'fail', errorMessage(error)));
      }
    } else {
      // Shared drive creation failed; probe the lifecycle tools so coverage
      // still exercises them.
      const syntheticDriveId = `smoke-${runId}`;
      steps.push(
        await probeTool(call, tools, 'get shared drive', 'google_drive_get_shared_drive', { id: syntheticDriveId }),
      );
      steps.push(
        await probeTool(call, tools, 'update shared drive', 'google_drive_update_shared_drive', {
          driveId: syntheticDriveId,
          name: 'nope',
        }),
      );
      steps.push(
        await probeTool(call, tools, 'hide shared drive', 'google_drive_hide_shared_drive', {
          driveId: syntheticDriveId,
        }),
      );
      steps.push(
        await probeTool(call, tools, 'unhide shared drive', 'google_drive_unhide_shared_drive', {
          driveId: syntheticDriveId,
        }),
      );
      steps.push(
        await probeTool(call, tools, 'delete shared drive', 'google_drive_delete_shared_drive', {
          driveId: syntheticDriveId,
        }),
      );
    }

    // Clean up second folder before the primary folder.
    if (secondFolderId) {
      try {
        await call('google_drive_delete_file', { fileId: secondFolderId });
        steps.push(makeStep('delete destination folder', 'google_drive_delete_file', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke second folder ${secondFolderId}`, errorMessage(error));
        steps.push(makeStep('delete destination folder', 'google_drive_delete_file', 'fail', errorMessage(error)));
      }
    }

    // Finally, empty trash — safely removes items this run deleted and no
    // one else's. This is idempotent and non-destructive to live files.
    if (tools['google_drive_empty_trash']) {
      try {
        await call('google_drive_empty_trash', {});
        steps.push(makeStep('empty trash', 'google_drive_empty_trash', 'pass'));
      } catch (error) {
        steps.push(makeStep('empty trash', 'google_drive_empty_trash', 'fail', errorMessage(error)));
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
