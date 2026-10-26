import type { Scenario, ScenarioStep } from '../scenario.js';
import { errorMessage, makeStep, probeTool, requireTools } from '../scenario.js';

const POWERPOINT_CONTENT =
  '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';

const ESSENTIAL_TOOLS = [
  'microsoft_powerpoint_create_presentation',
  'microsoft_powerpoint_delete_presentation',
] as const;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isPersonalAccount = process.env.MASTRA_SMOKE_MICROSOFT_ACCOUNT_TYPE?.trim().toLowerCase() === 'personal';

function isAccountCapabilityError(error: unknown): boolean {
  const detail = errorMessage(error);
  return (
    /personal|msa account|tenant-directory|work or school|sharepoint operations require/i.test(detail) ||
    (isPersonalAccount && /status=(400|401|403|405|501)/i.test(detail))
  );
}

/**
 * Full Microsoft PowerPoint lifecycle against a disposable presentation in
 * an accessible tenant drive. The tiny PPTX fixture is the same valid OOXML
 * package used by the upstream integration template tests.
 */
export const microsoftPowerpointScenario: Scenario = {
  integrationId: 'microsoft-powerpoint',
  summary: 'discover drive → create → read/download/update/share/copy/move → delete presentations',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    steps.push(
      makeStep(
        'account type',
        undefined,
        'pass',
        process.env.MASTRA_SMOKE_MICROSOFT_ACCOUNT_TYPE?.trim().toLowerCase() ??
          'unknown; set MASTRA_SMOKE_MICROSOFT_ACCOUNT_TYPE=personal|work for capability classification',
      ),
    );
    const missing = requireTools(tools, ESSENTIAL_TOOLS);
    if (missing) {
      steps.push(makeStep('preflight', undefined, 'skip', missing));
      return steps;
    }

    let userDriveId: string | undefined;
    if (!tools['microsoft_powerpoint_get_user_drive']) {
      steps.push(
        makeStep('get user drive', 'microsoft_powerpoint_get_user_drive', 'skip', 'tool not in project toolset'),
      );
    } else {
      try {
        const drive = await call<{ id: string }>('microsoft_powerpoint_get_user_drive', {});
        userDriveId = drive.id;
        steps.push(
          makeStep('get user drive', 'microsoft_powerpoint_get_user_drive', 'pass', `connected user: ${drive.id}`),
        );
      } catch (error) {
        steps.push(makeStep('get user drive', 'microsoft_powerpoint_get_user_drive', 'fail', errorMessage(error)));
      }
    }

    let siteDriveId: string | undefined;
    if (!tools['microsoft_powerpoint_list_sites']) {
      steps.push(makeStep('list sites', 'microsoft_powerpoint_list_sites', 'skip', 'tool not in project toolset'));
    } else {
      try {
        const result = await call<{ sites: Array<{ id: string; displayName?: string }> }>(
          'microsoft_powerpoint_list_sites',
          { query: '*' },
        );
        const site = result.sites.find(candidate => candidate.id);
        steps.push(
          makeStep(
            'list sites',
            'microsoft_powerpoint_list_sites',
            'pass',
            site ? `using ${site.displayName ?? site.id}` : 'no accessible sites',
          ),
        );
        if (site && tools['microsoft_powerpoint_get_site_drive']) {
          try {
            const drive = await call<{ id: string }>('microsoft_powerpoint_get_site_drive', { siteId: site.id });
            siteDriveId = drive.id;
            steps.push(makeStep('get site drive', 'microsoft_powerpoint_get_site_drive', 'pass', drive.id));
          } catch (error) {
            steps.push(makeStep('get site drive', 'microsoft_powerpoint_get_site_drive', 'fail', errorMessage(error)));
          }
        }
      } catch (error) {
        steps.push(
          makeStep(
            'list sites',
            'microsoft_powerpoint_list_sites',
            isAccountCapabilityError(error) ? 'skip' : 'fail',
            errorMessage(error),
          ),
        );
      }
    }
    if (!siteDriveId) {
      steps.push(
        await probeTool(
          call,
          tools,
          'get site drive (probe)',
          'microsoft_powerpoint_get_site_drive',
          {
            siteId: 'mastra-smoke.invalid,00000000-0000-0000-0000-000000000000,00000000-0000-0000-0000-000000000000',
          },
          /status=(400|403|404)|personal|msa account|work or school|sharepoint/i,
        ),
      );
    }

    let users: Array<{ id: string; displayName?: string }> = [];
    if (!tools['microsoft_powerpoint_list_users']) {
      steps.push(makeStep('list users', 'microsoft_powerpoint_list_users', 'skip', 'tool not in project toolset'));
    } else {
      try {
        const result = await call<{ users: typeof users }>('microsoft_powerpoint_list_users', { top: 25 });
        users = result.users;
        steps.push(makeStep('list users', 'microsoft_powerpoint_list_users', 'pass', `${users.length} returned`));
      } catch (error) {
        steps.push(
          makeStep(
            'list users',
            'microsoft_powerpoint_list_users',
            isAccountCapabilityError(error) ? 'skip' : 'fail',
            errorMessage(error),
          ),
        );
      }
    }

    if (!userDriveId && tools['microsoft_powerpoint_get_user_drive']) {
      let lastError: unknown;
      for (const user of users) {
        try {
          const drive = await call<{ id: string }>('microsoft_powerpoint_get_user_drive', { userId: user.id });
          userDriveId = drive.id;
          steps.push(
            makeStep(
              'get listed user drive',
              'microsoft_powerpoint_get_user_drive',
              'pass',
              `${user.displayName ?? user.id}: ${drive.id}`,
            ),
          );
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!userDriveId && users.length > 0) {
        steps.push(
          makeStep(
            'get listed user drive',
            'microsoft_powerpoint_get_user_drive',
            'fail',
            `no listed user exposed a drive: ${errorMessage(lastError)}`,
          ),
        );
      }
    }

    const driveId = userDriveId ?? siteDriveId;
    if (!driveId) {
      steps.push(makeStep('select writable drive', undefined, 'skip', 'no accessible OneDrive or SharePoint drive'));
      return steps;
    }

    if (!tools['microsoft_powerpoint_list_presentations']) {
      steps.push(
        makeStep(
          'list presentations',
          'microsoft_powerpoint_list_presentations',
          'skip',
          'tool not in project toolset',
        ),
      );
    } else {
      try {
        await call('microsoft_powerpoint_list_presentations', { drive_id: driveId, query: runId });
        steps.push(makeStep('list presentations', 'microsoft_powerpoint_list_presentations', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('list presentations', 'microsoft_powerpoint_list_presentations', 'fail', errorMessage(error)),
        );
      }
    }

    const originalFilename = `${runId}-powerpoint`;
    const updatedName = `${runId}-powerpoint-updated.pptx`;
    const copyName = `${runId}-powerpoint-copy.pptx`;
    let originalId: string | undefined;
    let copyAttempted = false;
    const copyIds = new Set<string>();

    try {
      const created = await call<{ id: string; name: string }>('microsoft_powerpoint_create_presentation', {
        driveId,
        filename: originalFilename,
        content: POWERPOINT_CONTENT,
      });
      originalId = created.id;
      steps.push(makeStep('create presentation', 'microsoft_powerpoint_create_presentation', 'pass', created.id));
    } catch (error) {
      steps.push(
        makeStep('create presentation', 'microsoft_powerpoint_create_presentation', 'fail', errorMessage(error)),
      );
      return steps;
    }

    if (!tools['microsoft_powerpoint_get_presentation']) {
      steps.push(
        makeStep('get presentation', 'microsoft_powerpoint_get_presentation', 'skip', 'tool not in project toolset'),
      );
    } else {
      try {
        const presentation = await call<{ id: string; name: string }>('microsoft_powerpoint_get_presentation', {
          driveId,
          itemId: originalId,
        });
        const matches = presentation.id === originalId && presentation.name === `${originalFilename}.pptx`;
        steps.push(
          makeStep(
            'get presentation',
            'microsoft_powerpoint_get_presentation',
            matches ? 'pass' : 'fail',
            matches ? presentation.id : `unexpected id/name: ${presentation.id}/${presentation.name}`,
          ),
        );
      } catch (error) {
        steps.push(makeStep('get presentation', 'microsoft_powerpoint_get_presentation', 'fail', errorMessage(error)));
      }
    }

    if (!tools['microsoft_powerpoint_get_presentation_content']) {
      steps.push(
        makeStep(
          'download presentation',
          'microsoft_powerpoint_get_presentation_content',
          'skip',
          'tool not in project toolset',
        ),
      );
    } else {
      try {
        const result = await call<{ content: string }>('microsoft_powerpoint_get_presentation_content', {
          driveId,
          itemId: originalId,
        });
        steps.push(
          makeStep(
            'download presentation',
            'microsoft_powerpoint_get_presentation_content',
            result.content.length > 0 ? 'pass' : 'fail',
            result.content.length > 0 ? undefined : 'empty content',
          ),
        );
      } catch (error) {
        steps.push(
          makeStep(
            'download presentation',
            'microsoft_powerpoint_get_presentation_content',
            'fail',
            errorMessage(error),
          ),
        );
      }
    }

    if (!tools['microsoft_powerpoint_get_presentation_as_pdf']) {
      steps.push(
        makeStep(
          'download presentation as PDF',
          'microsoft_powerpoint_get_presentation_as_pdf',
          'skip',
          'tool not in project toolset',
        ),
      );
    } else {
      try {
        const result = await call<{ content: string; size?: number }>('microsoft_powerpoint_get_presentation_as_pdf', {
          driveId,
          itemId: originalId,
        });
        const nonEmpty = result.content.length > 0 && (result.size === undefined || result.size > 0);
        steps.push(
          makeStep(
            'download presentation as PDF',
            'microsoft_powerpoint_get_presentation_as_pdf',
            nonEmpty ? 'pass' : 'fail',
            nonEmpty ? undefined : 'empty PDF content',
          ),
        );
      } catch (error) {
        steps.push(
          makeStep(
            'download presentation as PDF',
            'microsoft_powerpoint_get_presentation_as_pdf',
            'fail',
            errorMessage(error),
          ),
        );
      }
    }

    if (!tools['microsoft_powerpoint_list_presentation_thumbnails']) {
      steps.push(
        makeStep(
          'list thumbnails',
          'microsoft_powerpoint_list_presentation_thumbnails',
          'skip',
          'tool not in project toolset',
        ),
      );
    } else {
      try {
        await call('microsoft_powerpoint_list_presentation_thumbnails', { driveId, itemId: originalId });
        steps.push(makeStep('list thumbnails', 'microsoft_powerpoint_list_presentation_thumbnails', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('list thumbnails', 'microsoft_powerpoint_list_presentation_thumbnails', 'fail', errorMessage(error)),
        );
      }
    }

    if (!tools['microsoft_powerpoint_list_presentation_permissions']) {
      steps.push(
        makeStep(
          'list permissions',
          'microsoft_powerpoint_list_presentation_permissions',
          'skip',
          'tool not in project toolset',
        ),
      );
    } else {
      try {
        await call('microsoft_powerpoint_list_presentation_permissions', { driveId, itemId: originalId });
        steps.push(makeStep('list permissions', 'microsoft_powerpoint_list_presentation_permissions', 'pass'));
      } catch (error) {
        steps.push(
          makeStep(
            'list permissions',
            'microsoft_powerpoint_list_presentation_permissions',
            'fail',
            errorMessage(error),
          ),
        );
      }
    }

    if (!tools['microsoft_powerpoint_update_presentation_content']) {
      steps.push(
        makeStep(
          'update content',
          'microsoft_powerpoint_update_presentation_content',
          'skip',
          'tool not in project toolset',
        ),
      );
    } else {
      try {
        await call('microsoft_powerpoint_update_presentation_content', {
          driveId,
          itemId: originalId,
          content: POWERPOINT_CONTENT,
        });
        steps.push(makeStep('update content', 'microsoft_powerpoint_update_presentation_content', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('update content', 'microsoft_powerpoint_update_presentation_content', 'fail', errorMessage(error)),
        );
      }
    }

    if (!tools['microsoft_powerpoint_update_presentation_metadata']) {
      steps.push(
        makeStep(
          'update metadata',
          'microsoft_powerpoint_update_presentation_metadata',
          'skip',
          'tool not in project toolset',
        ),
      );
    } else {
      try {
        await call('microsoft_powerpoint_update_presentation_metadata', {
          driveId,
          itemId: originalId,
          name: updatedName,
          description: `${runId} disposable smoke presentation`,
        });
        steps.push(makeStep('update metadata', 'microsoft_powerpoint_update_presentation_metadata', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('update metadata', 'microsoft_powerpoint_update_presentation_metadata', 'fail', errorMessage(error)),
        );
      }
    }

    if (!tools['microsoft_powerpoint_list_presentation_versions']) {
      steps.push(
        makeStep(
          'list versions',
          'microsoft_powerpoint_list_presentation_versions',
          'skip',
          'tool not in project toolset',
        ),
      );
    } else {
      try {
        await call('microsoft_powerpoint_list_presentation_versions', { driveId, itemId: originalId });
        steps.push(makeStep('list versions', 'microsoft_powerpoint_list_presentation_versions', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('list versions', 'microsoft_powerpoint_list_presentation_versions', 'fail', errorMessage(error)),
        );
      }
    }

    if (!tools['microsoft_powerpoint_create_sharing_link']) {
      steps.push(
        makeStep(
          'create sharing link',
          'microsoft_powerpoint_create_sharing_link',
          'skip',
          'tool not in project toolset',
        ),
      );
    } else if (isPersonalAccount) {
      // Personal accounts cannot create organization-scoped links. Probe with
      // a synthetic item so the smoke test never publishes an anonymous link.
      steps.push(
        await probeTool(
          call,
          tools,
          'create sharing link',
          'microsoft_powerpoint_create_sharing_link',
          {
            driveId,
            itemId: 'mastra-smoke-missing',
            type: 'view',
            scope: 'organization',
          },
          /status=(400|401|403|404)|personal|msa account|work or school|not supported/i,
        ),
      );
    } else {
      try {
        await call('microsoft_powerpoint_create_sharing_link', {
          driveId,
          itemId: originalId,
          type: 'view',
          scope: 'organization',
        });
        steps.push(makeStep('create sharing link', 'microsoft_powerpoint_create_sharing_link', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('create sharing link', 'microsoft_powerpoint_create_sharing_link', 'fail', errorMessage(error)),
        );
      }
    }

    if (!tools['microsoft_powerpoint_move_presentation']) {
      steps.push(
        makeStep('move presentation', 'microsoft_powerpoint_move_presentation', 'skip', 'tool not in project toolset'),
      );
    } else {
      log.error(
        'Cannot verify move presentation: the provider has no tool for creating a distinct destination folder.',
      );
      steps.push(
        makeStep(
          'move presentation',
          'microsoft_powerpoint_move_presentation',
          'skip',
          'no distinct destination folder available',
        ),
      );
    }

    if (!tools['microsoft_powerpoint_copy_presentation']) {
      steps.push(
        makeStep('copy presentation', 'microsoft_powerpoint_copy_presentation', 'skip', 'tool not in project toolset'),
      );
    } else if (!tools['microsoft_powerpoint_list_presentations']) {
      steps.push(
        makeStep(
          'copy presentation',
          'microsoft_powerpoint_copy_presentation',
          'skip',
          'list presentations is required to locate and delete the asynchronous copy',
        ),
      );
    } else {
      try {
        await call('microsoft_powerpoint_copy_presentation', {
          driveId,
          itemId: originalId,
          name: copyName,
        });
        copyAttempted = true;
        steps.push(makeStep('copy presentation', 'microsoft_powerpoint_copy_presentation', 'pass'));
      } catch (error) {
        copyAttempted = true;
        steps.push(
          makeStep('copy presentation', 'microsoft_powerpoint_copy_presentation', 'fail', errorMessage(error)),
        );
      }
    }

    if (copyAttempted) {
      let searchError: unknown;
      for (let attempt = 0; attempt < 10 && copyIds.size === 0; attempt++) {
        if (attempt > 0) await delay(1_000);
        try {
          const result = await call<{ items: Array<{ id: string; name: string }> }>(
            'microsoft_powerpoint_list_presentations',
            { drive_id: driveId, query: copyName },
          );
          for (const item of result.items) {
            if (item.name === copyName) copyIds.add(item.id);
          }
        } catch (error) {
          searchError = error;
        }
      }
      if (copyIds.size === 0) {
        const detail = searchError
          ? errorMessage(searchError)
          : `copy ${copyName} did not become visible within 10 seconds`;
        log.error(`Could not locate copied presentation ${copyName} — clean up manually.`, detail);
        steps.push(makeStep('locate copied presentation', 'microsoft_powerpoint_list_presentations', 'fail', detail));
      } else {
        steps.push(
          makeStep(
            'locate copied presentation',
            'microsoft_powerpoint_list_presentations',
            'pass',
            [...copyIds].join(', '),
          ),
        );
      }
    }

    for (const copyId of copyIds) {
      try {
        await call('microsoft_powerpoint_delete_presentation', { driveId, itemId: copyId });
        steps.push(makeStep('delete copied presentation', 'microsoft_powerpoint_delete_presentation', 'pass', copyId));
      } catch (error) {
        log.error(
          `Failed to delete copied presentation ${copyId} (${copyName}) — clean up manually.`,
          errorMessage(error),
        );
        steps.push(
          makeStep(
            'delete copied presentation',
            'microsoft_powerpoint_delete_presentation',
            'fail',
            errorMessage(error),
          ),
        );
      }
    }

    try {
      await call('microsoft_powerpoint_delete_presentation', { driveId, itemId: originalId });
      steps.push(
        makeStep('delete original presentation', 'microsoft_powerpoint_delete_presentation', 'pass', originalId),
      );
    } catch (error) {
      log.error(
        `Failed to delete presentation ${originalId} (${updatedName}) — clean up manually.`,
        errorMessage(error),
      );
      steps.push(
        makeStep(
          'delete original presentation',
          'microsoft_powerpoint_delete_presentation',
          'fail',
          errorMessage(error),
        ),
      );
    }

    return steps;
  },
};
