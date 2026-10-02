import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep Clerk scenario: user + organization + membership + role lifecycle plus
 * the read-only user/org inventory surface.
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
          ['clerk_list_sessions', { limit: 5 }],
        ],
        tools,
      )),
    );

    const email = `smoke+${runId}@mastra-smoke.invalid`;
    let userId: string | undefined;
    try {
      const user = await call<{ id: string }>('clerk_create_user', {
        emailAddress: [email],
        firstName: 'Mastra',
        lastName: `Smoke-${runId}`,
      });
      userId = user.id;
      steps.push(makeStep('create user', 'clerk_create_user', 'pass', userId));
    } catch (error) {
      steps.push(makeStep('create user', 'clerk_create_user', 'fail', errorMessage(error)));
      return steps;
    }

    try {
      await call('clerk_get_user', { userId });
      steps.push(makeStep('read user', 'clerk_get_user', 'pass'));
    } catch (error) {
      steps.push(makeStep('read user', 'clerk_get_user', 'fail', errorMessage(error)));
    }

    try {
      await call('clerk_update_user', {
        userId,
        firstName: 'Mastra-edited',
      });
      steps.push(makeStep('update user', 'clerk_update_user', 'pass'));
    } catch (error) {
      steps.push(makeStep('update user', 'clerk_update_user', 'fail', errorMessage(error)));
    }

    let organizationId: string | undefined;
    try {
      const org = await call<{ id: string }>('clerk_create_organization', {
        name: `${runId} smoke org`,
        createdBy: userId,
      });
      organizationId = org.id;
      steps.push(makeStep('create organization', 'clerk_create_organization', 'pass', organizationId));
    } catch (error) {
      steps.push(makeStep('create organization', 'clerk_create_organization', 'fail', errorMessage(error)));
    }

    if (organizationId && tools['clerk_get_organization']) {
      try {
        await call('clerk_get_organization', { organizationId });
        steps.push(makeStep('read organization', 'clerk_get_organization', 'pass'));
      } catch (error) {
        steps.push(makeStep('read organization', 'clerk_get_organization', 'fail', errorMessage(error)));
      }
    }

    if (organizationId && tools['clerk_update_organization']) {
      try {
        await call('clerk_update_organization', {
          organizationId,
          name: `${runId} smoke org (renamed)`,
        });
        steps.push(makeStep('update organization', 'clerk_update_organization', 'pass'));
      } catch (error) {
        steps.push(makeStep('update organization', 'clerk_update_organization', 'fail', errorMessage(error)));
      }
    }

    let membershipId: string | undefined;
    if (organizationId && tools['clerk_create_organization_membership']) {
      try {
        const membership = await call<{ id: string }>('clerk_create_organization_membership', {
          organizationId,
          userId,
          role: 'org:member',
        });
        membershipId = membership.id;
        steps.push(makeStep('create membership', 'clerk_create_organization_membership', 'pass', membershipId));
      } catch (error) {
        steps.push(makeStep('create membership', 'clerk_create_organization_membership', 'fail', errorMessage(error)));
      }
    }

    if (membershipId && tools['clerk_delete_organization_membership']) {
      try {
        await call('clerk_delete_organization_membership', {
          organizationId,
          userId,
        });
        steps.push(makeStep('delete membership', 'clerk_delete_organization_membership', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke membership ${membershipId}`, errorMessage(error));
        steps.push(makeStep('delete membership', 'clerk_delete_organization_membership', 'fail', errorMessage(error)));
      }
    }

    if (organizationId) {
      try {
        await call('clerk_delete_organization', { organizationId });
        steps.push(makeStep('delete organization', 'clerk_delete_organization', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke org ${organizationId}`, errorMessage(error));
        steps.push(makeStep('delete organization', 'clerk_delete_organization', 'fail', errorMessage(error)));
      }
    }

    try {
      await call('clerk_delete_user', { userId });
      steps.push(makeStep('delete user', 'clerk_delete_user', 'pass'));
    } catch (error) {
      log.error(`Failed to delete smoke user ${userId}`, errorMessage(error));
      steps.push(makeStep('delete user', 'clerk_delete_user', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
