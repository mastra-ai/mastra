import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, runReadBatch } from '../scenario.js';

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

    return steps;
  },
};
