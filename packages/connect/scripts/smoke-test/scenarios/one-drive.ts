import type { Scenario, ScenarioStep } from '../scenario.js';
import { errorMessage, makeStep, probeTool, requireTools } from '../scenario.js';

/**
 * OneDrive for Business lifecycle. Platform warns before OAuth that this
 * integration requires a work or school account, while the underlying Graph
 * file endpoints remain current-user scoped (`/me/drive`).
 */
export const oneDriveScenario: Scenario = {
  integrationId: 'one-drive',
  summary: 'drive reads → folder/file/share/copy/move lifecycle → cleanup',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const accountType = process.env.MASTRA_SMOKE_MICROSOFT_ACCOUNT_TYPE?.trim().toLowerCase();
    if (accountType === 'personal') {
      steps.push(
        makeStep(
          'account requirement',
          undefined,
          'skip',
          'The OneDrive for Business integration requires a Microsoft work or school account.',
        ),
      );
      return steps;
    }
    steps.push(
      makeStep(
        'account type',
        undefined,
        'pass',
        accountType ?? 'unknown; set MASTRA_SMOKE_MICROSOFT_ACCOUNT_TYPE=work for capability classification',
      ),
    );
    const missing = requireTools(tools, [
      'one_drive_get_drive',
      'one_drive_list_drives',
      'one_drive_list_recent_items',
      'one_drive_list_shared_items',
      'one_drive_create_folder',
      'one_drive_upload_small_file',
      'one_drive_get_item',
      'one_drive_list_children',
      'one_drive_search_items',
      'one_drive_update_item',
      'one_drive_list_versions',
      'one_drive_create_sharing_link',
      'one_drive_list_permissions',
      'one_drive_get_permission',
      'one_drive_delete_permission',
      'one_drive_invite_recipients',
      'one_drive_create_upload_session',
      'one_drive_copy_item',
      'one_drive_move_item',
      'one_drive_delete_item',
    ]);
    if (missing) {
      steps.push(makeStep('preflight', undefined, 'skip', missing));
      return steps;
    }

    async function attempt(name: string, toolId: string, input: unknown): Promise<boolean> {
      try {
        await call(toolId, input);
        steps.push(makeStep(name, toolId, 'pass'));
        return true;
      } catch (error) {
        steps.push(makeStep(name, toolId, 'fail', errorMessage(error)));
        return false;
      }
    }

    try {
      const drive = await call<{ id: string; driveType?: string }>('one_drive_get_drive', {});
      steps.push(makeStep('get drive', 'one_drive_get_drive', 'pass', `${drive.driveType ?? 'drive'} ${drive.id}`));
    } catch (error) {
      steps.push(makeStep('get drive', 'one_drive_get_drive', 'fail', errorMessage(error)));
      return steps;
    }

    await attempt('list drives', 'one_drive_list_drives', {});
    await attempt('list recent items', 'one_drive_list_recent_items', {});
    await attempt('list shared items', 'one_drive_list_shared_items', {});

    let sourceFolderId: string | undefined;
    let targetFolderId: string | undefined;
    let fileId: string | undefined;
    let copiedItemId: string | undefined;

    try {
      const source = await call<{ id: string }>('one_drive_create_folder', {
        parentItemId: 'root',
        name: `${runId}-source`,
        conflictBehavior: 'fail',
      });
      sourceFolderId = source.id;
      steps.push(makeStep('create source folder', 'one_drive_create_folder', 'pass', source.id));

      const target = await call<{ id: string }>('one_drive_create_folder', {
        parentItemId: 'root',
        name: `${runId}-target`,
        conflictBehavior: 'fail',
      });
      targetFolderId = target.id;
      steps.push(makeStep('create target folder', 'one_drive_create_folder', 'pass', target.id));
    } catch (error) {
      steps.push(makeStep('create folders', 'one_drive_create_folder', 'fail', errorMessage(error)));
    }

    if (sourceFolderId) {
      try {
        const uploaded = await call<{ id: string }>('one_drive_upload_small_file', {
          parent_item_id: sourceFolderId,
          file_name: `${runId}.txt`,
          content: Buffer.from(`@mastra/connect smoke test ${runId}`).toString('base64'),
          content_type: 'text/plain',
        });
        fileId = uploaded.id;
        steps.push(makeStep('upload file', 'one_drive_upload_small_file', 'pass', uploaded.id));
      } catch (error) {
        steps.push(makeStep('upload file', 'one_drive_upload_small_file', 'fail', errorMessage(error)));
      }
    }

    if (fileId && sourceFolderId) {
      await attempt('get item', 'one_drive_get_item', { itemId: fileId });
      await attempt('list children', 'one_drive_list_children', { itemId: sourceFolderId });
      await attempt('search items', 'one_drive_search_items', { query: runId });
      await attempt('update item', 'one_drive_update_item', {
        itemId: fileId,
        name: `${runId}-updated.txt`,
        description: `Smoke test ${runId}`,
      });
      await attempt('list versions', 'one_drive_list_versions', { itemId: fileId });

      let permissionId: string | undefined;
      try {
        const link = await call<{ id?: string }>('one_drive_create_sharing_link', {
          itemId: fileId,
          type: 'view',
          scope: 'organization',
        });
        permissionId = link.id;
        steps.push(makeStep('create sharing link', 'one_drive_create_sharing_link', 'pass', permissionId));
      } catch (error) {
        steps.push(makeStep('create sharing link', 'one_drive_create_sharing_link', 'fail', errorMessage(error)));
      }

      try {
        const listed = await call<{ permissions: Array<{ id: string }> }>('one_drive_list_permissions', {
          itemId: fileId,
        });
        // Only the permission created by this scenario (the sharing link above) may be
        // deleted; listed permissions are not identifiable as scenario-owned.
        steps.push(
          makeStep('list permissions', 'one_drive_list_permissions', 'pass', `${listed.permissions.length} returned`),
        );
      } catch (error) {
        steps.push(makeStep('list permissions', 'one_drive_list_permissions', 'fail', errorMessage(error)));
      }

      if (permissionId) {
        await attempt('get permission', 'one_drive_get_permission', { itemId: fileId, permissionId });
        await attempt('delete permission', 'one_drive_delete_permission', { itemId: fileId, permissionId });
      } else {
        steps.push(
          await probeTool(call, tools, 'get permission (probe)', 'one_drive_get_permission', {
            itemId: fileId,
            permissionId: 'mastra-smoke-missing',
          }),
        );
        steps.push(
          await probeTool(call, tools, 'delete permission (probe)', 'one_drive_delete_permission', {
            itemId: fileId,
            permissionId: 'mastra-smoke-missing',
          }),
        );
      }

      steps.push(
        await probeTool(call, tools, 'invite recipient (probe)', 'one_drive_invite_recipients', {
          itemId: 'mastra-smoke-missing',
          recipients: [{ email: 'nobody@invalid.example' }],
          roles: ['read'],
          requireSignIn: true,
          sendInvitation: false,
        }),
      );

      await attempt('create upload session', 'one_drive_create_upload_session', {
        parentItemId: sourceFolderId,
        fileName: `${runId}-large.bin`,
      });

      if (targetFolderId) {
        try {
          const copied = await call<{ itemId?: string; status?: string }>('one_drive_copy_item', {
            itemId: fileId,
            targetParentId: targetFolderId,
            newName: `${runId}-copy.txt`,
          });
          copiedItemId = copied.itemId;
          steps.push(makeStep('copy item', 'one_drive_copy_item', 'pass', copied.status));
        } catch (error) {
          steps.push(makeStep('copy item', 'one_drive_copy_item', 'fail', errorMessage(error)));
        }

        if (!copiedItemId) {
          try {
            const children = await call<{ items: Array<{ id: string; name?: string }> }>('one_drive_list_children', {
              itemId: targetFolderId,
            });
            copiedItemId = children.items.find(item => item.name === `${runId}-copy.txt`)?.id;
          } catch {
            // Cleanup below still removes the target folder recursively.
          }
        }

        await attempt('move item', 'one_drive_move_item', {
          itemId: fileId,
          parentFolderId: targetFolderId,
          name: `${runId}-moved.txt`,
        });
      }
    }

    for (const [name, itemId] of [
      ['delete copied item', copiedItemId],
      ['delete file', fileId],
      ['delete source folder', sourceFolderId],
      ['delete target folder', targetFolderId],
    ] as const) {
      if (!itemId) continue;
      try {
        await call('one_drive_delete_item', { itemId });
        steps.push(makeStep(name, 'one_drive_delete_item', 'pass', itemId));
      } catch (error) {
        const detail = errorMessage(error);
        if (name === 'delete file' && /status=404|not found/i.test(detail)) {
          steps.push(makeStep(name, 'one_drive_delete_item', 'pass', 'removed with parent/copy lifecycle'));
          continue;
        }
        log.error(`OneDrive smoke test leaked ${name}`, { itemId, error: detail });
        steps.push(makeStep(name, 'one_drive_delete_item', 'fail', detail));
      }
    }

    return steps;
  },
};
