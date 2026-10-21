import type { Scenario, ScenarioStep } from '../scenario.js';
import { enrichToolError, errorMessage, makeStep, probeTool, requireTools } from '../scenario.js';

const DOCX_BASE64 =
  'UEsDBBQAAAAIAJRQU115bjPX6AAAAK0BAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH1QyU7DMBD9FWuuKHHggBCK0wPLETiUDxjZk8SqN3nc0v49Tlt6QIXjzFv1+tXeO7GjzDYGBbdtB4KCjsaGScHn+rV5AMEFg0EXAyk4EMNq6NeHRCyqNrCCuZT0KCXrmTxyGxOFiowxeyz1zJNMqDc4kbzrunupYygUSlMWDxj6Zxpx64p42df3qUcmxyCeTsQlSwGm5KzGUnG5C+ZXSnNOaKvyyOHZJr6pBJBXExbk74Cz7r0Ok60h8YG5vKGvLPkVs5Em6q2vyvZ/mys94zhaTRf94pZy1MRcF/euvSAebfjpL49zD99QSwMEFAAAAAgAlFBTXZv9N+qtAAAAKQEAAAsAAABfcmVscy8ucmVsc43POw7CMAwG4KtE3mlaBoRQ0y4IqSsqB7ASN61oHkrCo7cnAwNFDIy2f3+W6/ZpZnanECdnBVRFCYysdGqyWsClP232wGJCq3B2lgQsFKFt6jPNmPJKHCcfWTZsFDCm5A+cRzmSwVg4TzZPBhcMplwGzT3KK2ri27Lc8fBpwNpknRIQOlUB6xdP/9huGCZJRydvhmz6ceIrkWUMmpKAhwuKq3e7yCzwpuarF5sXUEsDBBQAAAAIAJRQU13Mongs4AAAAF0BAAARAAAAd29yZC9kb2N1bWVudC54bWxFUMtuwyAQ/BXEvcGx0iqybOfWW6RIbT+AwMa2aljEbkrTry84snyZ3dnHzEJ7+nWz+IFIE/pO7neVFOAN2skPnfz6fH85SkGsvdUzeujkA0ie+jY1Fs3dgWeRBTw1qZMjc2iUIjOC07TDAD73bhid5kzjoBJGGyIaIMr6blZ1Vb0ppycvi+QV7aPEUCAW4P6siaMW5PAbBAOxWI1bVfoF44LLFoHhy7Iaho8/kcpd+7o+5GelZsz56zHn6jlw1jFXGUOuH54jcRpG3ugVmdFtfIbb2lWL6eqn1uvV9jP9P1BLAQIUAxQAAAAIAJRQU115bjPX6AAAAK0BAAATAAAAAAAAAAAAAACAAQAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQDFAAAAAgAlFBTXZv9N+qtAAAAKQEAAAsAAAAAAAAAAAAAAIABGQEAAF9yZWxzLy5yZWxzUEsBAhQDFAAAAAgAlFBTXcyieCzgAAAAXQEAABEAAAAAAAAAAAAAAIAB7wEAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAADAAMAuQAAAP4CAAAAAA==';

const isPersonalAccount = process.env.MASTRA_SMOKE_MICROSOFT_ACCOUNT_TYPE?.trim().toLowerCase() === 'personal';

function isAccountCapabilityError(error: unknown): boolean {
  const detail = errorMessage(error);
  return (
    /personal|msa account|tenant-directory|work or school|sharepoint/i.test(detail) ||
    (isPersonalAccount && /status=(400|401|403|405|501)/i.test(detail))
  );
}

export const microsoftWordScenario: Scenario = {
  integrationId: 'microsoft-word',
  summary: 'account-aware drive discovery → Word document lifecycle → cleanup',
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
    const missing = requireTools(tools, [
      'microsoft_word_get_user_drive',
      'microsoft_word_create_folder',
      'microsoft_word_create_word_document',
      'microsoft_word_delete_word_document',
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
        steps.push(makeStep(name, toolId, 'fail', errorMessage(enrichToolError(toolId, error))));
        return false;
      }
    }

    let userId: string | undefined;
    try {
      const users = await call<{ items: Array<{ id: string }> }>('microsoft_word_list_users', { top: 1 });
      userId = users.items[0]?.id;
      steps.push(
        makeStep('list users (work/school)', 'microsoft_word_list_users', 'pass', `${users.items.length} returned`),
      );
    } catch (error) {
      const enriched = enrichToolError('microsoft_word_list_users', error);
      steps.push(
        makeStep(
          'list users (work/school)',
          'microsoft_word_list_users',
          isAccountCapabilityError(enriched) ? 'skip' : 'fail',
          errorMessage(enriched),
        ),
      );
    }

    let siteId: string | undefined;
    try {
      const sites = await call<{ sites: Array<{ id: string }> }>('microsoft_word_list_sites', { query: '*' });
      siteId = sites.sites[0]?.id;
      steps.push(
        makeStep('list sites (work/school)', 'microsoft_word_list_sites', 'pass', `${sites.sites.length} returned`),
      );
    } catch (error) {
      const enriched = enrichToolError('microsoft_word_list_sites', error);
      steps.push(
        makeStep(
          'list sites (work/school)',
          'microsoft_word_list_sites',
          isAccountCapabilityError(enriched) ? 'skip' : 'fail',
          errorMessage(enriched),
        ),
      );
    }

    if (siteId) {
      await attempt('get site drive (work/school)', 'microsoft_word_get_site_drive', { siteId });
    } else {
      steps.push(
        await probeTool(
          call,
          tools,
          'get site drive (work/school probe)',
          'microsoft_word_get_site_drive',
          { siteId: 'mastra-smoke-missing' },
          /status=(400|401|403|404)|personal|msa account|work or school|sharepoint/i,
        ),
      );
    }

    let driveId: string;
    try {
      const drive = await call<{ id: string; driveType?: string }>('microsoft_word_get_user_drive', {});
      driveId = drive.id;
      steps.push(makeStep('get connected user drive', 'microsoft_word_get_user_drive', 'pass', drive.driveType));
    } catch (error) {
      steps.push(makeStep('get connected user drive', 'microsoft_word_get_user_drive', 'fail', errorMessage(error)));
      return steps;
    }

    if (userId) {
      await attempt('get tenant user drive (work/school)', 'microsoft_word_get_user_drive', { userId });
    }

    let sourceFolderId: string | undefined;
    let targetFolderId: string | undefined;
    let documentId: string | undefined;
    let copyId: string | undefined;

    try {
      const source = await call<{ id: string }>('microsoft_word_create_folder', {
        driveId,
        parentId: 'root',
        name: `${runId}-source`,
      });
      sourceFolderId = source.id;
      steps.push(makeStep('create source folder', 'microsoft_word_create_folder', 'pass', source.id));

      const target = await call<{ id: string }>('microsoft_word_create_folder', {
        driveId,
        parentId: 'root',
        name: `${runId}-target`,
      });
      targetFolderId = target.id;
      steps.push(makeStep('create target folder', 'microsoft_word_create_folder', 'pass', target.id));
    } catch (error) {
      steps.push(makeStep('create folders', 'microsoft_word_create_folder', 'fail', errorMessage(error)));
    }

    if (sourceFolderId) {
      try {
        const document = await call<{ id: string }>('microsoft_word_create_word_document', {
          driveId,
          parentId: sourceFolderId,
          fileName: `${runId}.docx`,
          contentBase64: DOCX_BASE64,
        });
        documentId = document.id;
        steps.push(makeStep('create Word document', 'microsoft_word_create_word_document', 'pass', document.id));
      } catch (error) {
        steps.push(
          makeStep('create Word document', 'microsoft_word_create_word_document', 'fail', errorMessage(error)),
        );
      }
    }

    if (documentId) {
      await attempt('get Word document', 'microsoft_word_get_word_document', { driveId, itemId: documentId });
      await attempt('list Word documents', 'microsoft_word_list_word_documents', { driveId, query: runId });
      await attempt('get Word content', 'microsoft_word_get_word_document_content', { driveId, itemId: documentId });
      await attempt('get Word PDF', 'microsoft_word_get_word_document_as_pdf', { driveId, itemId: documentId });
      await attempt('list Word versions', 'microsoft_word_list_word_document_versions', {
        driveId,
        itemId: documentId,
      });
      await attempt('update Word content', 'microsoft_word_update_word_document_content', {
        driveId,
        itemId: documentId,
        contentBase64: DOCX_BASE64,
      });
      await attempt('update Word metadata', 'microsoft_word_update_word_document_metadata', {
        driveId,
        itemId: documentId,
        name: `${runId}-updated.docx`,
        description: `@mastra/connect smoke test ${runId}`,
      });

      if (isPersonalAccount) {
        // Personal accounts cannot create organization-scoped links. Probe with a synthetic item so the smoke test never publishes an anonymous link.
        steps.push(
          await probeTool(
            call,
            tools,
            'create sharing link (personal account probe)',
            'microsoft_word_create_sharing_link',
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
          const link = await call<{ id: string }>('microsoft_word_create_sharing_link', {
            driveId,
            itemId: documentId,
            type: 'view',
            scope: 'organization',
          });
          steps.push(makeStep('create sharing link', 'microsoft_word_create_sharing_link', 'pass', link.id));
        } catch (error) {
          steps.push(
            makeStep('create sharing link', 'microsoft_word_create_sharing_link', 'fail', errorMessage(error)),
          );
        }
      }
      await attempt('list Word permissions', 'microsoft_word_list_word_document_permissions', {
        drive_id: driveId,
        item_id: documentId,
      });

      if (targetFolderId) {
        try {
          const copied = await call<{ id?: string }>('microsoft_word_copy_word_document', {
            driveId,
            itemId: documentId,
            destinationFolderId: targetFolderId,
            name: `${runId}-copy.docx`,
          });
          copyId = copied.id;
          steps.push(makeStep('copy Word document', 'microsoft_word_copy_word_document', 'pass', copyId));
        } catch (error) {
          steps.push(makeStep('copy Word document', 'microsoft_word_copy_word_document', 'fail', errorMessage(error)));
        }

        await attempt('move Word document', 'microsoft_word_move_word_document', {
          driveId,
          itemId: documentId,
          destinationFolderId: targetFolderId,
        });
      }
    }

    for (const [name, itemId] of [
      ['delete copied document', copyId],
      ['delete Word document', documentId],
      ['delete source folder', sourceFolderId],
      ['delete target folder', targetFolderId],
    ] as const) {
      if (!itemId) continue;
      try {
        await call('microsoft_word_delete_word_document', { driveId, itemId });
        steps.push(makeStep(name, 'microsoft_word_delete_word_document', 'pass', itemId));
      } catch (error) {
        const detail = errorMessage(error);
        if (name === 'delete Word document' && /status=404|not found/i.test(detail)) {
          steps.push(makeStep(name, 'microsoft_word_delete_word_document', 'pass', 'removed with parent lifecycle'));
          continue;
        }
        log.error(`Word smoke test leaked ${name}`, { itemId, error: detail });
        steps.push(makeStep(name, 'microsoft_word_delete_word_document', 'fail', detail));
      }
    }

    return steps;
  },
};
