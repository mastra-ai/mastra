import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep Clerk scenario: user + organization + membership + role lifecycle plus
 * the read-only user/org inventory surface.
 *
 * All Clerk tools accept snake_case parameter keys (user_id, email_address,
 * first_name, etc.) because the generator preserves Clerk's own API shape.
 * clerk_list_sessions requires at least one of {status, client_id, user_id};
 * we pass status: 'active' so the batch read doesn't 422 on an empty filter.
 */
export const clerkScenario: Scenario = {
  integrationId: 'clerk',
  summary: 'user + organization + membership + role CRUD',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, [
      'clerk_create_user',
      'clerk_get_user',
      'clerk_update_user',
      'clerk_delete_user',
      'clerk_create_organization',
      'clerk_delete_organization',
    ]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['clerk_list_users', { limit: 5 }],
          ['clerk_list_organizations', { limit: 5 }],
        ],
        tools,
      )),
    );

    // Clerk validates the email with its own validator and rejects reserved
    // test TLDs like `.invalid`. We use example.com with a per-run local part
    // to stay unique while passing Clerk's regex. These accounts never see
    // mail because `example.com` is RFC 2606 reserved for documentation.
    const email = `mastra-smoke+${runId}@example.com`;
    let userId: string | undefined;
    try {
      const user = await call<{ id: string }>('clerk_create_user', {
        email_address: [email],
        first_name: 'Mastra',
        last_name: `Smoke-${runId}`,
        // Clerk instances with password auth enabled reject creates that
        // omit a password. skip_password_requirement lets us create smoke
        // users regardless of instance policy; the account is deleted at
        // the end of the scenario.
        skip_password_requirement: true,
      });
      userId = user.id;
      steps.push(makeStep('create user', 'clerk_create_user', 'pass', userId));
    } catch (error) {
      steps.push(makeStep('create user', 'clerk_create_user', 'fail', errorMessage(error)));
      return steps;
    }

    try {
      await call('clerk_get_user', { user_id: userId });
      steps.push(makeStep('read user', 'clerk_get_user', 'pass'));
    } catch (error) {
      steps.push(makeStep('read user', 'clerk_get_user', 'fail', errorMessage(error)));
    }

    if (tools['clerk_list_sessions']) {
      // Clerk requires at least one of {client_id, user_id, status} on the
      // sessions endpoint. We call it here (after creating a user) with
      // user_id so the request shape is valid even on an empty project.
      try {
        await call('clerk_list_sessions', { user_id: userId, limit: 5 });
        steps.push(makeStep('list_sessions', 'clerk_list_sessions', 'pass'));
      } catch (error) {
        steps.push(makeStep('list_sessions', 'clerk_list_sessions', 'fail', errorMessage(error)));
      }
    }

    try {
      await call('clerk_update_user', {
        user_id: userId,
        first_name: 'Mastra-edited',
      });
      steps.push(makeStep('update user', 'clerk_update_user', 'pass'));
    } catch (error) {
      steps.push(makeStep('update user', 'clerk_update_user', 'fail', errorMessage(error)));
    }

    let organizationId: string | undefined;
    try {
      // Deliberately omit `created_by` so Clerk doesn't auto-add our user as
      // an admin; the scenario adds the membership explicitly below so we
      // actually exercise clerk_create_organization_membership.
      const org = await call<{ id: string }>('clerk_create_organization', {
        name: `${runId} smoke org`,
      });
      organizationId = org.id;
      steps.push(makeStep('create organization', 'clerk_create_organization', 'pass', organizationId));
    } catch (error) {
      steps.push(makeStep('create organization', 'clerk_create_organization', 'fail', errorMessage(error)));
    }

    if (organizationId && tools['clerk_get_organization']) {
      try {
        await call('clerk_get_organization', { organization_id: organizationId });
        steps.push(makeStep('read organization', 'clerk_get_organization', 'pass'));
      } catch (error) {
        steps.push(makeStep('read organization', 'clerk_get_organization', 'fail', errorMessage(error)));
      }
    }

    if (organizationId && tools['clerk_update_organization']) {
      try {
        await call('clerk_update_organization', {
          organization_id: organizationId,
          name: `${runId} smoke org (renamed)`,
        });
        steps.push(makeStep('update organization', 'clerk_update_organization', 'pass'));
      } catch (error) {
        steps.push(makeStep('update organization', 'clerk_update_organization', 'fail', errorMessage(error)));
      }
    }

    let membershipCreated = false;
    if (organizationId && tools['clerk_create_organization_membership']) {
      try {
        await call('clerk_create_organization_membership', {
          organization_id: organizationId,
          user_id: userId,
          role: 'org:member',
        });
        membershipCreated = true;
        steps.push(makeStep('create membership', 'clerk_create_organization_membership', 'pass'));
      } catch (error) {
        steps.push(makeStep('create membership', 'clerk_create_organization_membership', 'fail', errorMessage(error)));
      }
    }

    if (membershipCreated && tools['clerk_delete_organization_membership']) {
      try {
        await call('clerk_delete_organization_membership', {
          organization_id: organizationId,
          user_id: userId,
        });
        steps.push(makeStep('delete membership', 'clerk_delete_organization_membership', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke membership for user ${userId} in org ${organizationId}`, errorMessage(error));
        steps.push(makeStep('delete membership', 'clerk_delete_organization_membership', 'fail', errorMessage(error)));
      }
    }

    if (organizationId) {
      try {
        await call('clerk_delete_organization', { organization_id: organizationId });
        steps.push(makeStep('delete organization', 'clerk_delete_organization', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke org ${organizationId}`, errorMessage(error));
        steps.push(makeStep('delete organization', 'clerk_delete_organization', 'fail', errorMessage(error)));
      }
    }

    try {
      await call('clerk_delete_user', { user_id: userId });
      steps.push(makeStep('delete user', 'clerk_delete_user', 'pass'));
    } catch (error) {
      log.error(`Failed to delete smoke user ${userId}`, errorMessage(error));
      steps.push(makeStep('delete user', 'clerk_delete_user', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
