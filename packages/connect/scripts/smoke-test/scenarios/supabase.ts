import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, runReadBatch, probeTool } from '../scenario.js';

/**
 * Deep Supabase scenario: focuses on surfaces that don't require a specific
 * schema. Covers auth-user and storage CRUD. Table-row tools are called in
 * reach-only mode because the actual table layout is project-specific.
 */
export const supabaseScenario: Scenario = {
  integrationId: 'supabase',
  summary: 'auth-user + storage CRUD (schema-independent)',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const anyAuth = tools['supabase_create_auth_user'];
    const anyStorage = tools['supabase_create_storage_bucket'];
    if (!anyAuth && !anyStorage) {
      steps.push({
        name: 'preflight',
        status: 'skip',
        detail: 'Neither auth-user nor storage-bucket create tools are available.',
      });
      return steps;
    }

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['supabase_list_auth_users', { page: 1, perPage: 5 }],
          ['supabase_list_storage_buckets', {}],
        ],
        tools,
      )),
    );

    // Auth user lifecycle.
    let authUserId: string | undefined;
    if (anyAuth && tools['supabase_delete_auth_user']) {
      try {
        const user = await call<{ user?: { id: string }; id?: string }>('supabase_create_auth_user', {
          email: `smoke+${runId}@mastra-smoke.invalid`,
          password: `mastra-smoke-${runId}-password!`,
          email_confirm: true,
        });
        authUserId = user.user?.id ?? user.id;
        steps.push(makeStep('create auth user', 'supabase_create_auth_user', authUserId ? 'pass' : 'fail', authUserId));
      } catch (error) {
        steps.push(makeStep('create auth user', 'supabase_create_auth_user', 'fail', errorMessage(error)));
      }

      if (authUserId && tools['supabase_get_auth_user']) {
        try {
          await call('supabase_get_auth_user', { userId: authUserId });
          steps.push(makeStep('read auth user', 'supabase_get_auth_user', 'pass'));
        } catch (error) {
          steps.push(makeStep('read auth user', 'supabase_get_auth_user', 'fail', errorMessage(error)));
        }
      }

      if (authUserId && tools['supabase_update_auth_user']) {
        try {
          await call('supabase_update_auth_user', {
            userId: authUserId,
            user_metadata: { smoke: runId },
          });
          steps.push(makeStep('update auth user', 'supabase_update_auth_user', 'pass'));
        } catch (error) {
          steps.push(makeStep('update auth user', 'supabase_update_auth_user', 'fail', errorMessage(error)));
        }
      }

      // Auth factors (MFA): list is empty for a fresh user; delete probed
      // with a synthetic factor id since none exist to delete.
      if (authUserId && tools['supabase_list_auth_factors']) {
        try {
          await call('supabase_list_auth_factors', { user_id: authUserId });
          steps.push(makeStep('list auth factors', 'supabase_list_auth_factors', 'pass'));
        } catch (error) {
          steps.push(makeStep('list auth factors', 'supabase_list_auth_factors', 'fail', errorMessage(error)));
        }
      }
      if (authUserId) {
        steps.push(
          await probeTool(call, tools, 'delete auth factor', 'supabase_delete_auth_factor', {
            user_id: authUserId,
            factor_id: '00000000-0000-0000-0000-000000000000',
          }),
        );
      }

      // Generate a magiclink/recovery link for the smoke user. This doesn't
      // send email in itself; Supabase just produces the signed URL.
      if (authUserId && tools['supabase_generate_auth_link']) {
        try {
          await call('supabase_generate_auth_link', {
            type: 'magiclink',
            email: `smoke+${runId}@mastra-smoke.invalid`,
          });
          steps.push(makeStep('generate auth link', 'supabase_generate_auth_link', 'pass'));
        } catch (error) {
          steps.push(makeStep('generate auth link', 'supabase_generate_auth_link', 'fail', errorMessage(error)));
        }
      }

      if (authUserId) {
        try {
          await call('supabase_delete_auth_user', { userId: authUserId });
          steps.push(makeStep('delete auth user', 'supabase_delete_auth_user', 'pass'));
        } catch (error) {
          log.error(`Failed to delete smoke auth user ${authUserId}`, errorMessage(error));
          steps.push(makeStep('delete auth user', 'supabase_delete_auth_user', 'fail', errorMessage(error)));
        }
      }
    }

    // Storage bucket lifecycle.
    const bucketName = `smoke-${runId}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .slice(0, 60);
    let bucketCreated = false;
    if (anyStorage && tools['supabase_delete_storage_bucket']) {
      try {
        await call('supabase_create_storage_bucket', {
          id: bucketName,
          name: bucketName,
          public: false,
        });
        bucketCreated = true;
        steps.push(makeStep('create storage bucket', 'supabase_create_storage_bucket', 'pass', bucketName));
      } catch (error) {
        steps.push(makeStep('create storage bucket', 'supabase_create_storage_bucket', 'fail', errorMessage(error)));
      }

      if (bucketCreated && tools['supabase_get_storage_bucket']) {
        try {
          await call('supabase_get_storage_bucket', { bucketId: bucketName });
          steps.push(makeStep('read storage bucket', 'supabase_get_storage_bucket', 'pass'));
        } catch (error) {
          steps.push(makeStep('read storage bucket', 'supabase_get_storage_bucket', 'fail', errorMessage(error)));
        }
      }

      if (bucketCreated && tools['supabase_update_storage_bucket']) {
        try {
          await call('supabase_update_storage_bucket', { bucketId: bucketName, public: false });
          steps.push(makeStep('update storage bucket', 'supabase_update_storage_bucket', 'pass'));
        } catch (error) {
          steps.push(makeStep('update storage bucket', 'supabase_update_storage_bucket', 'fail', errorMessage(error)));
        }
      }

      if (bucketCreated && tools['supabase_list_storage_objects']) {
        try {
          await call('supabase_list_storage_objects', { bucketId: bucketName });
          steps.push(makeStep('list storage objects', 'supabase_list_storage_objects', 'pass'));
        } catch (error) {
          steps.push(makeStep('list storage objects', 'supabase_list_storage_objects', 'fail', errorMessage(error)));
        }
      }

      // Storage object lifecycle inside the smoke bucket: create → get →
      // update → copy → create-signed-url (both variants) → delete both.
      const objectPath = `smoke/${runId}.txt`;
      const copyPath = `smoke/${runId}-copy.txt`;
      let objectCreated = false;
      if (bucketCreated && tools['supabase_create_storage_object']) {
        try {
          await call('supabase_create_storage_object', {
            bucket_id: bucketName,
            path: objectPath,
            content: `mastra smoke ${runId}`,
            content_type: 'text/plain',
          });
          objectCreated = true;
          steps.push(makeStep('create storage object', 'supabase_create_storage_object', 'pass', objectPath));
        } catch (error) {
          steps.push(makeStep('create storage object', 'supabase_create_storage_object', 'fail', errorMessage(error)));
        }
      }

      if (objectCreated && tools['supabase_get_storage_object']) {
        try {
          await call('supabase_get_storage_object', { bucketId: bucketName, path: objectPath });
          steps.push(makeStep('get storage object', 'supabase_get_storage_object', 'pass'));
        } catch (error) {
          steps.push(makeStep('get storage object', 'supabase_get_storage_object', 'fail', errorMessage(error)));
        }
      }

      if (objectCreated && tools['supabase_update_storage_object']) {
        try {
          await call('supabase_update_storage_object', {
            bucket_id: bucketName,
            path: objectPath,
            content: `mastra smoke ${runId} (updated)`,
            content_type: 'text/plain',
          });
          steps.push(makeStep('update storage object', 'supabase_update_storage_object', 'pass'));
        } catch (error) {
          steps.push(makeStep('update storage object', 'supabase_update_storage_object', 'fail', errorMessage(error)));
        }
      }

      let copyCreated = false;
      if (objectCreated && tools['supabase_copy_storage_object']) {
        try {
          await call('supabase_copy_storage_object', {
            bucketId: bucketName,
            sourceKey: objectPath,
            destinationBucket: bucketName,
            destinationKey: copyPath,
          });
          copyCreated = true;
          steps.push(makeStep('copy storage object', 'supabase_copy_storage_object', 'pass', copyPath));
        } catch (error) {
          steps.push(makeStep('copy storage object', 'supabase_copy_storage_object', 'fail', errorMessage(error)));
        }
      }

      if (objectCreated && tools['supabase_create_signed_url']) {
        try {
          await call('supabase_create_signed_url', { bucket_id: bucketName, path: objectPath, expires_in: 300 });
          steps.push(makeStep('create signed url', 'supabase_create_signed_url', 'pass'));
        } catch (error) {
          steps.push(makeStep('create signed url', 'supabase_create_signed_url', 'fail', errorMessage(error)));
        }
      }

      if (bucketCreated && tools['supabase_create_signed_upload_url']) {
        try {
          await call('supabase_create_signed_upload_url', {
            bucket_id: bucketName,
            path: `smoke/${runId}-upload.txt`,
          });
          steps.push(makeStep('create signed upload url', 'supabase_create_signed_upload_url', 'pass'));
        } catch (error) {
          steps.push(
            makeStep('create signed upload url', 'supabase_create_signed_upload_url', 'fail', errorMessage(error)),
          );
        }
      }

      // Delete the objects before the bucket (bucket delete fails if non-empty).
      const toDelete = [objectPath, ...(copyCreated ? [copyPath] : [])];
      if (toDelete.length > 0 && tools['supabase_delete_storage_object']) {
        try {
          await call('supabase_delete_storage_object', { bucketId: bucketName, prefixes: toDelete });
          steps.push(makeStep('delete storage objects', 'supabase_delete_storage_object', 'pass'));
        } catch (error) {
          log.error(`Failed to delete smoke objects in ${bucketName}`, errorMessage(error));
          steps.push(makeStep('delete storage objects', 'supabase_delete_storage_object', 'fail', errorMessage(error)));
        }
      }

      if (bucketCreated) {
        try {
          await call('supabase_delete_storage_bucket', { bucketId: bucketName });
          steps.push(makeStep('delete storage bucket', 'supabase_delete_storage_bucket', 'pass'));
        } catch (error) {
          log.error(`Failed to delete smoke bucket ${bucketName}`, errorMessage(error));
          steps.push(makeStep('delete storage bucket', 'supabase_delete_storage_bucket', 'fail', errorMessage(error)));
        }
      }
    }

    // Table + RPC surface. The smoke project's Postgres schema is unknown
    // to us so we can't create a table through this tool belt; probe each
    // tool with a synthetic table/function name and accept the 404 / schema
    // error as proof that routing works.
    const probeTable = `mastra_smoke_nonexistent_${runId}`;
    steps.push(
      await probeTool(call, tools, 'insert table row', 'supabase_insert_table_row', {
        table: probeTable,
        row: { smoke: runId },
      }),
    );
    steps.push(
      await probeTool(call, tools, 'query table rows', 'supabase_query_table_rows', {
        table: probeTable,
        limit: 1,
      }),
    );
    steps.push(
      await probeTool(call, tools, 'upsert table row', 'supabase_upsert_table_row', {
        table: probeTable,
        row: { id: runId, smoke: true },
      }),
    );
    steps.push(
      await probeTool(call, tools, 'update table rows', 'supabase_update_table_rows', {
        table: probeTable,
        updates: { smoke: false },
        filters: { smoke: `eq.${runId}` },
      }),
    );
    steps.push(
      await probeTool(call, tools, 'delete table rows', 'supabase_delete_table_rows', {
        table: probeTable,
        filters: { smoke: `eq.${runId}` },
      }),
    );
    steps.push(
      await probeTool(call, tools, 'invoke rpc', 'supabase_invoke_rpc', {
        function_name: `mastra_smoke_nonexistent_${runId}`,
        args: {},
      }),
    );

    return steps;
  },
};
