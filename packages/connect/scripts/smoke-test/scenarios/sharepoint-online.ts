import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch, probeTool } from '../scenario.js';

/**
 * Deep SharePoint Online scenario: drive item + list + content type + site
 * column + site page lifecycle inside one test site. Every record carries the
 * runId and is deleted at the end.
 *
 * Writes only go to the site named by `MASTRA_SMOKE_SHAREPOINT_SITE_ID` (a
 * Graph site id, `<host>,<site-guid>,<web-guid>`), so the scenario never
 * writes into a real site it happened to find. Without it the scenario skips.
 *
 * Granting a person access shares the item with them. Set
 * `MASTRA_SMOKE_SHAREPOINT_GRANTEE` (an email in the test tenant) to run
 * add/update/remove permission for real, always with `sendInvitation: false`;
 * otherwise add/update are probed with synthetic ids.
 */
export const sharepointOnlineScenario: Scenario = {
  integrationId: 'sharepoint-online',
  summary: 'drive item + list + content type + site column + site page CRUD',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const accountType = process.env.MASTRA_SMOKE_MICROSOFT_ACCOUNT_TYPE?.trim().toLowerCase();
    if (accountType === 'personal') {
      steps.push(
        makeStep(
          'account requirement',
          undefined,
          'skip',
          'SharePoint Online requires a Microsoft work or school account.',
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
      'sharepoint_online_get_site',
      'sharepoint_online_list_drives',
      'sharepoint_online_create_drive_folder',
      'sharepoint_online_upload_drive_item',
      'sharepoint_online_delete_drive_item',
      'sharepoint_online_create_list',
      'sharepoint_online_delete_list',
    ]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    const siteId = process.env.MASTRA_SMOKE_SHAREPOINT_SITE_ID?.trim();
    if (!siteId) {
      steps.push(
        makeStep(
          'pick site',
          'sharepoint_online_get_site',
          'skip',
          'Set MASTRA_SMOKE_SHAREPOINT_SITE_ID=<host>,<site-guid>,<web-guid> to run the SharePoint lifecycle in that site.',
        ),
      );
      return steps;
    }

    let siteName: string | undefined;
    try {
      const site = await call<{ id: string; name?: string; displayName?: string }>('sharepoint_online_get_site', {
        siteId,
      });
      siteName = site.displayName ?? site.name;
      steps.push(makeStep('pick site', 'sharepoint_online_get_site', 'pass', siteName ?? site.id));
    } catch (error) {
      steps.push(makeStep('pick site', 'sharepoint_online_get_site', 'fail', errorMessage(error)));
      return steps;
    }

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['sharepoint_online_list_shared_sites', {}],
          ['sharepoint_online_search_sites', { query: siteName ?? '*' }],
          ['sharepoint_online_list_lists', { siteId }],
          ['sharepoint_online_list_content_types', { siteId }],
          ['sharepoint_online_list_site_columns', { siteId }],
          ['sharepoint_online_list_site_pages', { siteId }],
        ],
        tools,
      )),
    );

    // ---- Drive items, inside a run folder in the site's document library ----

    let driveId: string | undefined;
    try {
      const drives = await call<{ items: Array<{ id: string; name: string }> }>('sharepoint_online_list_drives', {
        siteId,
      });
      // Every site library is a 'documentLibrary'; prefer the default one over
      // system libraries like Site Assets.
      const drive = drives.items.find(d => d.name === 'Documents') ?? drives.items[0];
      driveId = drive?.id;
      steps.push(
        makeStep('list drives', 'sharepoint_online_list_drives', driveId ? 'pass' : 'fail', drive?.name ?? 'no drive'),
      );
    } catch (error) {
      steps.push(makeStep('list drives', 'sharepoint_online_list_drives', 'fail', errorMessage(error)));
    }

    if (driveId && tools['sharepoint_online_get_drive']) {
      try {
        await call('sharepoint_online_get_drive', { siteId, driveId });
        steps.push(makeStep('get drive', 'sharepoint_online_get_drive', 'pass'));
      } catch (error) {
        steps.push(makeStep('get drive', 'sharepoint_online_get_drive', 'fail', errorMessage(error)));
      }
    }

    let folderId: string | undefined;
    if (driveId) {
      try {
        const folder = await call<{ id: string }>('sharepoint_online_create_drive_folder', {
          siteId,
          driveId,
          parentItemId: 'root',
          name: `${runId} smoke folder`,
          conflictBehavior: 'fail',
        });
        folderId = folder.id;
        steps.push(makeStep('create folder', 'sharepoint_online_create_drive_folder', 'pass', folderId));
      } catch (error) {
        steps.push(makeStep('create folder', 'sharepoint_online_create_drive_folder', 'fail', errorMessage(error)));
      }
    }

    // Two uploads to the same name give the file a second version, which the
    // version list + restore steps below need.
    const fileName = `${runId}-smoke.txt`;
    let fileId: string | undefined;
    if (folderId) {
      try {
        const uploaded = await call<{ id: string }>('sharepoint_online_upload_drive_item', {
          siteId,
          driveId,
          parentItemId: folderId,
          fileName,
          content: Buffer.from('Automated @mastra/connect smoke test. Safe to delete. v1').toString('base64'),
          contentType: 'text/plain',
        });
        fileId = uploaded.id;
        steps.push(makeStep('upload file', 'sharepoint_online_upload_drive_item', 'pass', fileId));
      } catch (error) {
        steps.push(makeStep('upload file', 'sharepoint_online_upload_drive_item', 'fail', errorMessage(error)));
      }
    }
    if (fileId) {
      try {
        await call('sharepoint_online_upload_drive_item', {
          siteId,
          driveId,
          parentItemId: folderId,
          fileName,
          content: Buffer.from('Automated @mastra/connect smoke test. Safe to delete. v2').toString('base64'),
          contentType: 'text/plain',
        });
        steps.push(makeStep('upload new version', 'sharepoint_online_upload_drive_item', 'pass'));
      } catch (error) {
        steps.push(makeStep('upload new version', 'sharepoint_online_upload_drive_item', 'fail', errorMessage(error)));
      }
    }

    if (fileId) {
      steps.push(
        ...(await runReadBatch(
          call,
          [
            ['sharepoint_online_get_drive_item', { siteId, driveId, itemId: fileId }],
            ['sharepoint_online_list_drive_children', { siteId, driveId, itemId: folderId }],
            ['sharepoint_online_download_drive_item_content', { siteId, driveId, itemId: fileId }],
            ['sharepoint_online_get_drive_item_thumbnail', { siteId, driveId, itemId: fileId }],
            ['sharepoint_online_search_drive_items', { siteId, driveId, query: runId }],
          ],
          tools,
        )),
      );
    }

    // Versions come back newest first; restore the newest one that isn't current.
    let olderVersionId: string | undefined;
    if (fileId && tools['sharepoint_online_list_drive_item_versions']) {
      try {
        const versions = await call<{ items: Array<{ id: string }> }>('sharepoint_online_list_drive_item_versions', {
          site_id: siteId,
          drive_id: driveId,
          item_id: fileId,
        });
        olderVersionId = versions.items[1]?.id;
        steps.push(
          makeStep('list versions', 'sharepoint_online_list_drive_item_versions', 'pass', `${versions.items.length}`),
        );
      } catch (error) {
        steps.push(
          makeStep('list versions', 'sharepoint_online_list_drive_item_versions', 'fail', errorMessage(error)),
        );
      }
    }
    if (olderVersionId && tools['sharepoint_online_restore_drive_item_version']) {
      try {
        await call('sharepoint_online_restore_drive_item_version', {
          siteId,
          driveId,
          itemId: fileId,
          versionId: olderVersionId,
        });
        steps.push(makeStep('restore version', 'sharepoint_online_restore_drive_item_version', 'pass', olderVersionId));
      } catch (error) {
        steps.push(
          makeStep('restore version', 'sharepoint_online_restore_drive_item_version', 'fail', errorMessage(error)),
        );
      }
    } else if (fileId) {
      // No older version to restore (library versioning off, or the version
      // list failed); probe with a synthetic version id.
      steps.push(
        await probeTool(call, tools, 'restore version', 'sharepoint_online_restore_drive_item_version', {
          siteId,
          driveId,
          itemId: fileId,
          versionId: '999.0',
        }),
      );
    }

    if (fileId && tools['sharepoint_online_update_drive_item']) {
      try {
        await call('sharepoint_online_update_drive_item', {
          siteId,
          driveId,
          itemId: fileId,
          name: `${runId}-smoke-renamed.txt`,
        });
        steps.push(makeStep('rename file', 'sharepoint_online_update_drive_item', 'pass'));
      } catch (error) {
        steps.push(makeStep('rename file', 'sharepoint_online_update_drive_item', 'fail', errorMessage(error)));
      }
    }

    // Copy is async on the Graph side; the copy lands in the run folder, so
    // deleting the folder at the end removes it too.
    if (fileId && tools['sharepoint_online_copy_drive_item']) {
      try {
        const copy = await call<{ status: string }>('sharepoint_online_copy_drive_item', {
          siteId,
          driveId,
          itemId: fileId,
          parentDriveId: driveId,
          parentItemId: folderId,
          name: `${runId}-smoke-copy.txt`,
          conflictBehavior: 'rename',
        });
        steps.push(makeStep('copy file', 'sharepoint_online_copy_drive_item', 'pass', copy.status));
      } catch (error) {
        steps.push(makeStep('copy file', 'sharepoint_online_copy_drive_item', 'fail', errorMessage(error)));
      }
    }

    // An upload session creates no item until bytes are sent, and Graph
    // expires the unused session on its own.
    if (folderId && tools['sharepoint_online_create_drive_upload_session']) {
      try {
        await call('sharepoint_online_create_drive_upload_session', {
          siteId,
          driveId,
          parentItemId: folderId,
          fileName: `${runId}-smoke-session.txt`,
          conflictBehavior: 'rename',
        });
        steps.push(makeStep('create upload session', 'sharepoint_online_create_drive_upload_session', 'pass'));
      } catch (error) {
        steps.push(
          makeStep(
            'create upload session',
            'sharepoint_online_create_drive_upload_session',
            'fail',
            errorMessage(error),
          ),
        );
      }
    }

    // Permissions: an organization view link is a permission the scenario can
    // create and remove without involving anyone else.
    let linkPermissionId: string | undefined;
    if (fileId && tools['sharepoint_online_create_sharing_link']) {
      try {
        const link = await call<{ id?: string }>('sharepoint_online_create_sharing_link', {
          siteId,
          driveId,
          itemId: fileId,
          type: 'view',
          scope: 'organization',
        });
        linkPermissionId = link.id;
        steps.push(
          makeStep(
            'create sharing link',
            'sharepoint_online_create_sharing_link',
            linkPermissionId ? 'pass' : 'fail',
            linkPermissionId ?? 'no permission id returned',
          ),
        );
      } catch (error) {
        steps.push(
          makeStep('create sharing link', 'sharepoint_online_create_sharing_link', 'fail', errorMessage(error)),
        );
      }
    }

    if (fileId && tools['sharepoint_online_list_drive_item_permissions']) {
      try {
        const perms = await call<{ permissions: unknown[] }>('sharepoint_online_list_drive_item_permissions', {
          site_id: siteId,
          drive_id: driveId,
          item_id: fileId,
        });
        steps.push(
          makeStep(
            'list permissions',
            'sharepoint_online_list_drive_item_permissions',
            'pass',
            `${perms.permissions.length}`,
          ),
        );
      } catch (error) {
        steps.push(
          makeStep('list permissions', 'sharepoint_online_list_drive_item_permissions', 'fail', errorMessage(error)),
        );
      }
    }

    const grantee = process.env.MASTRA_SMOKE_SHAREPOINT_GRANTEE?.trim();
    let granteePermissionId: string | undefined;
    if (fileId && grantee && tools['sharepoint_online_add_drive_item_permission']) {
      try {
        const added = await call<{ permissions: Array<{ id: string }> }>(
          'sharepoint_online_add_drive_item_permission',
          {
            siteId,
            driveId,
            itemId: fileId,
            recipients: [{ email: grantee }],
            roles: ['read'],
            requireSignIn: true,
            sendInvitation: false,
          },
        );
        granteePermissionId = added.permissions[0]?.id;
        steps.push(
          makeStep(
            'add permission',
            'sharepoint_online_add_drive_item_permission',
            granteePermissionId ? 'pass' : 'fail',
            granteePermissionId ?? 'no permission id returned',
          ),
        );
      } catch (error) {
        steps.push(
          makeStep('add permission', 'sharepoint_online_add_drive_item_permission', 'fail', errorMessage(error)),
        );
      }
    } else if (driveId) {
      // Granting access touches a real person, so without a test grantee
      // probe with a synthetic item id that shares with nobody.
      steps.push(
        await probeTool(call, tools, 'add permission', 'sharepoint_online_add_drive_item_permission', {
          siteId,
          driveId,
          itemId: `smoke-${runId}`,
          recipients: [{ email: `smoke-${runId}@example.com` }],
          roles: ['read'],
          sendInvitation: false,
        }),
      );
    }

    if (granteePermissionId && tools['sharepoint_online_update_drive_item_permission']) {
      try {
        await call('sharepoint_online_update_drive_item_permission', {
          siteId,
          driveId,
          itemId: fileId,
          permissionId: granteePermissionId,
          roles: ['write'],
        });
        steps.push(makeStep('update permission', 'sharepoint_online_update_drive_item_permission', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('update permission', 'sharepoint_online_update_drive_item_permission', 'fail', errorMessage(error)),
        );
      }
    } else if (fileId) {
      // No grantee permission to re-role (the sharing link's roles can't be
      // changed); probe with a synthetic permission id.
      steps.push(
        await probeTool(call, tools, 'update permission', 'sharepoint_online_update_drive_item_permission', {
          siteId,
          driveId,
          itemId: fileId,
          permissionId: `smoke-${runId}`,
          roles: ['read'],
        }),
      );
    }

    if (granteePermissionId && tools['sharepoint_online_remove_drive_item_permission']) {
      try {
        await call('sharepoint_online_remove_drive_item_permission', {
          siteId,
          driveId,
          itemId: fileId,
          permissionId: granteePermissionId,
        });
        steps.push(makeStep('remove grantee permission', 'sharepoint_online_remove_drive_item_permission', 'pass'));
      } catch (error) {
        log.error(`Failed to remove smoke grantee permission ${granteePermissionId} on ${fileId}`, errorMessage(error));
        steps.push(
          makeStep(
            'remove grantee permission',
            'sharepoint_online_remove_drive_item_permission',
            'fail',
            errorMessage(error),
          ),
        );
      }
    }

    if (linkPermissionId && tools['sharepoint_online_remove_drive_item_permission']) {
      try {
        await call('sharepoint_online_remove_drive_item_permission', {
          siteId,
          driveId,
          itemId: fileId,
          permissionId: linkPermissionId,
        });
        steps.push(makeStep('remove sharing link', 'sharepoint_online_remove_drive_item_permission', 'pass'));
      } catch (error) {
        log.error(`Failed to remove smoke sharing link ${linkPermissionId} on ${fileId}`, errorMessage(error));
        steps.push(
          makeStep(
            'remove sharing link',
            'sharepoint_online_remove_drive_item_permission',
            'fail',
            errorMessage(error),
          ),
        );
      }
    }

    // ---- List, list columns and list items ----

    let listId: string | undefined;
    try {
      const list = await call<{ id: string }>('sharepoint_online_create_list', {
        siteId,
        displayName: `${runId} smoke list`,
        description: 'Automated @mastra/connect smoke test. Safe to delete.',
        template: 'genericList',
        contentTypesEnabled: true,
      });
      listId = list.id;
      steps.push(makeStep('create list', 'sharepoint_online_create_list', 'pass', listId));
    } catch (error) {
      steps.push(makeStep('create list', 'sharepoint_online_create_list', 'fail', errorMessage(error)));
    }

    if (listId && tools['sharepoint_online_get_list']) {
      try {
        await call('sharepoint_online_get_list', { siteId, listId });
        steps.push(makeStep('get list', 'sharepoint_online_get_list', 'pass'));
      } catch (error) {
        steps.push(makeStep('get list', 'sharepoint_online_get_list', 'fail', errorMessage(error)));
      }
    }

    if (listId && tools['sharepoint_online_update_list']) {
      try {
        await call('sharepoint_online_update_list', { siteId, listId, description: `${runId} edited` });
        steps.push(makeStep('update list', 'sharepoint_online_update_list', 'pass'));
      } catch (error) {
        steps.push(makeStep('update list', 'sharepoint_online_update_list', 'fail', errorMessage(error)));
      }
    }

    let listColumnId: string | undefined;
    if (listId && tools['sharepoint_online_create_list_column']) {
      try {
        const column = await call<{ id: string }>('sharepoint_online_create_list_column', {
          siteId,
          listId,
          name: 'SmokeNote',
          displayName: `${runId} note`,
          text: {},
        });
        listColumnId = column.id;
        steps.push(makeStep('create list column', 'sharepoint_online_create_list_column', 'pass', listColumnId));
      } catch (error) {
        steps.push(makeStep('create list column', 'sharepoint_online_create_list_column', 'fail', errorMessage(error)));
      }
    }

    if (listId && tools['sharepoint_online_list_list_columns']) {
      try {
        await call('sharepoint_online_list_list_columns', { siteId, listId });
        steps.push(makeStep('list list columns', 'sharepoint_online_list_list_columns', 'pass'));
      } catch (error) {
        steps.push(makeStep('list list columns', 'sharepoint_online_list_list_columns', 'fail', errorMessage(error)));
      }
    }

    if (listColumnId && tools['sharepoint_online_update_list_column']) {
      try {
        await call('sharepoint_online_update_list_column', {
          siteId,
          listId,
          columnId: listColumnId,
          columnDefinition: { description: `${runId} edited` },
        });
        steps.push(makeStep('update list column', 'sharepoint_online_update_list_column', 'pass'));
      } catch (error) {
        steps.push(makeStep('update list column', 'sharepoint_online_update_list_column', 'fail', errorMessage(error)));
      }
    }

    let listItemId: string | undefined;
    if (listId && tools['sharepoint_online_create_list_item']) {
      try {
        const item = await call<{ id: string }>('sharepoint_online_create_list_item', {
          siteId,
          listId,
          fields: { Title: `${runId} smoke item` },
        });
        listItemId = item.id;
        steps.push(makeStep('create list item', 'sharepoint_online_create_list_item', 'pass', listItemId));
      } catch (error) {
        steps.push(makeStep('create list item', 'sharepoint_online_create_list_item', 'fail', errorMessage(error)));
      }
    }

    if (listItemId) {
      steps.push(
        ...(await runReadBatch(
          call,
          [
            ['sharepoint_online_list_list_items', { siteId, listId, expandFields: true }],
            ['sharepoint_online_get_list_item', { siteId, listId, itemId: listItemId, expandFields: true }],
          ],
          tools,
        )),
      );
    }

    if (listItemId && tools['sharepoint_online_update_list_item']) {
      try {
        await call('sharepoint_online_update_list_item', {
          site_id: siteId,
          list_id: listId,
          item_id: listItemId,
          fields: { Title: `${runId} smoke item (edited)` },
        });
        steps.push(makeStep('update list item', 'sharepoint_online_update_list_item', 'pass'));
      } catch (error) {
        steps.push(makeStep('update list item', 'sharepoint_online_update_list_item', 'fail', errorMessage(error)));
      }
    }

    if (listItemId && tools['sharepoint_online_delete_list_item']) {
      try {
        await call('sharepoint_online_delete_list_item', { siteId, listId, itemId: listItemId });
        steps.push(makeStep('delete list item', 'sharepoint_online_delete_list_item', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete list item', 'sharepoint_online_delete_list_item', 'fail', errorMessage(error)));
      }
    }

    if (listColumnId && tools['sharepoint_online_delete_list_column']) {
      try {
        await call('sharepoint_online_delete_list_column', { siteId, listId, columnId: listColumnId });
        steps.push(makeStep('delete list column', 'sharepoint_online_delete_list_column', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete list column', 'sharepoint_online_delete_list_column', 'fail', errorMessage(error)));
      }
    }

    // ---- Site content type, added to the run list ----

    let contentTypeId: string | undefined;
    if (tools['sharepoint_online_create_content_type']) {
      try {
        const contentType = await call<{ id: string }>('sharepoint_online_create_content_type', {
          siteId,
          name: `${runId} smoke type`,
          description: 'Automated @mastra/connect smoke test. Safe to delete.',
          group: 'Mastra smoke',
          base: { id: '0x01' },
        });
        contentTypeId = contentType.id;
        steps.push(makeStep('create content type', 'sharepoint_online_create_content_type', 'pass', contentTypeId));
      } catch (error) {
        steps.push(
          makeStep('create content type', 'sharepoint_online_create_content_type', 'fail', errorMessage(error)),
        );
      }
    }

    if (contentTypeId && tools['sharepoint_online_get_content_type']) {
      try {
        await call('sharepoint_online_get_content_type', { siteId, contentTypeId });
        steps.push(makeStep('get content type', 'sharepoint_online_get_content_type', 'pass'));
      } catch (error) {
        steps.push(makeStep('get content type', 'sharepoint_online_get_content_type', 'fail', errorMessage(error)));
      }
    }

    if (listId && contentTypeId && tools['sharepoint_online_add_content_type_to_list']) {
      try {
        await call('sharepoint_online_add_content_type_to_list', { siteId, listId, contentTypeId });
        steps.push(makeStep('add content type to list', 'sharepoint_online_add_content_type_to_list', 'pass'));
      } catch (error) {
        steps.push(
          makeStep(
            'add content type to list',
            'sharepoint_online_add_content_type_to_list',
            'fail',
            errorMessage(error),
          ),
        );
      }
    }

    if (listId && tools['sharepoint_online_list_list_content_types']) {
      try {
        await call('sharepoint_online_list_list_content_types', { siteId, listId });
        steps.push(makeStep('list list content types', 'sharepoint_online_list_list_content_types', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('list list content types', 'sharepoint_online_list_list_content_types', 'fail', errorMessage(error)),
        );
      }
    }

    // ---- Site column ----

    let siteColumnId: string | undefined;
    if (tools['sharepoint_online_create_site_column']) {
      try {
        const column = await call<{ id?: string }>('sharepoint_online_create_site_column', {
          siteId,
          name: `Smoke${runId.replace(/[^a-zA-Z0-9]/g, '')}`,
          description: 'Automated @mastra/connect smoke test. Safe to delete.',
          text: {},
        });
        siteColumnId = column.id;
        steps.push(
          makeStep(
            'create site column',
            'sharepoint_online_create_site_column',
            siteColumnId ? 'pass' : 'fail',
            siteColumnId ?? 'no column id returned',
          ),
        );
      } catch (error) {
        steps.push(makeStep('create site column', 'sharepoint_online_create_site_column', 'fail', errorMessage(error)));
      }
    }

    if (siteColumnId && tools['sharepoint_online_update_site_column']) {
      try {
        await call('sharepoint_online_update_site_column', {
          siteId,
          columnId: siteColumnId,
          description: `${runId} edited`,
        });
        steps.push(makeStep('update site column', 'sharepoint_online_update_site_column', 'pass'));
      } catch (error) {
        steps.push(makeStep('update site column', 'sharepoint_online_update_site_column', 'fail', errorMessage(error)));
      }
    }

    if (siteColumnId && tools['sharepoint_online_delete_site_column']) {
      try {
        await call('sharepoint_online_delete_site_column', { siteId, columnId: siteColumnId });
        steps.push(makeStep('delete site column', 'sharepoint_online_delete_site_column', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke site column ${siteColumnId} — clean up manually.`, errorMessage(error));
        steps.push(makeStep('delete site column', 'sharepoint_online_delete_site_column', 'fail', errorMessage(error)));
      }
    }

    // ---- Site page ----

    let pageId: string | undefined;
    if (tools['sharepoint_online_create_site_page']) {
      try {
        const page = await call<{ id: string }>('sharepoint_online_create_site_page', {
          siteId,
          name: `${runId}-smoke.aspx`,
          title: `${runId} smoke page`,
          pageLayout: 'article',
        });
        pageId = page.id;
        steps.push(makeStep('create site page', 'sharepoint_online_create_site_page', 'pass', pageId));
      } catch (error) {
        steps.push(makeStep('create site page', 'sharepoint_online_create_site_page', 'fail', errorMessage(error)));
      }
    }

    if (pageId && tools['sharepoint_online_get_site_page']) {
      try {
        await call('sharepoint_online_get_site_page', { siteId, pageId });
        steps.push(makeStep('get site page', 'sharepoint_online_get_site_page', 'pass'));
      } catch (error) {
        steps.push(makeStep('get site page', 'sharepoint_online_get_site_page', 'fail', errorMessage(error)));
      }
    }

    if (pageId && tools['sharepoint_online_update_site_page']) {
      try {
        await call('sharepoint_online_update_site_page', { siteId, pageId, title: `${runId} smoke page (edited)` });
        steps.push(makeStep('update site page', 'sharepoint_online_update_site_page', 'pass'));
      } catch (error) {
        steps.push(makeStep('update site page', 'sharepoint_online_update_site_page', 'fail', errorMessage(error)));
      }
    }

    if (pageId && tools['sharepoint_online_publish_site_page']) {
      try {
        await call('sharepoint_online_publish_site_page', { siteId, pageId });
        steps.push(makeStep('publish site page', 'sharepoint_online_publish_site_page', 'pass'));
      } catch (error) {
        steps.push(makeStep('publish site page', 'sharepoint_online_publish_site_page', 'fail', errorMessage(error)));
      }
    }

    if (pageId && tools['sharepoint_online_delete_site_page']) {
      try {
        await call('sharepoint_online_delete_site_page', { siteId, pageId });
        steps.push(makeStep('delete site page', 'sharepoint_online_delete_site_page', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke site page ${pageId} — clean up manually.`, errorMessage(error));
        steps.push(makeStep('delete site page', 'sharepoint_online_delete_site_page', 'fail', errorMessage(error)));
      }
    }

    // ---- Clean up: list before content type, since a content type still in
    // use by a list can't be deleted. Deleting the run folder also removes the
    // file and its copy. ----

    if (listId) {
      try {
        await call('sharepoint_online_delete_list', { siteId, listId });
        steps.push(makeStep('delete list', 'sharepoint_online_delete_list', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke list ${listId} — clean up manually.`, errorMessage(error));
        steps.push(makeStep('delete list', 'sharepoint_online_delete_list', 'fail', errorMessage(error)));
      }
    }

    if (contentTypeId && tools['sharepoint_online_delete_content_type']) {
      try {
        await call('sharepoint_online_delete_content_type', { siteId, contentTypeId });
        steps.push(makeStep('delete content type', 'sharepoint_online_delete_content_type', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke content type ${contentTypeId} — clean up manually.`, errorMessage(error));
        steps.push(
          makeStep('delete content type', 'sharepoint_online_delete_content_type', 'fail', errorMessage(error)),
        );
      }
    }

    if (folderId) {
      try {
        await call('sharepoint_online_delete_drive_item', { siteId, driveId, itemId: folderId });
        steps.push(makeStep('delete folder', 'sharepoint_online_delete_drive_item', 'pass'));
      } catch (error) {
        log.error(
          `Failed to delete smoke folder ${folderId} (holds the file and its copy) — clean up manually.`,
          errorMessage(error),
        );
        steps.push(makeStep('delete folder', 'sharepoint_online_delete_drive_item', 'fail', errorMessage(error)));
      }
    }

    return steps;
  },
};
