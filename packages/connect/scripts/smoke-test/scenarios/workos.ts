import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep WorkOS scenario: organization + membership + user lifecycle plus the
 * read-only directory and connection surface.
 */
export const workosScenario: Scenario = {
  integrationId: 'workos',
  summary: 'organization + membership + user CRUD',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, [
      'workos_create_organization',
      'workos_get_organization',
      'workos_update_organization',
      'workos_delete_organization',
    ]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['workos_list_organizations', { limit: 5 }],
          ['workos_list_users', { limit: 5 }],
          ['workos_list_directories', { limit: 5 }],
          ['workos_list_connections', { limit: 5 }],
          ['workos_list_events', { limit: 5 }],
          ['workos_list_invitations', { limit: 5 }],
        ],
        tools,
      )),
    );

    let organizationId: string | undefined;
    try {
      const org = await call<{ id: string }>('workos_create_organization', {
        name: `${runId} smoke org`,
      });
      organizationId = org.id;
      steps.push(makeStep('create organization', 'workos_create_organization', 'pass', organizationId));
    } catch (error) {
      steps.push(makeStep('create organization', 'workos_create_organization', 'fail', errorMessage(error)));
      return steps;
    }

    try {
      await call('workos_get_organization', { organizationId });
      steps.push(makeStep('read organization', 'workos_get_organization', 'pass'));
    } catch (error) {
      steps.push(makeStep('read organization', 'workos_get_organization', 'fail', errorMessage(error)));
    }

    try {
      await call('workos_update_organization', {
        organizationId,
        name: `${runId} smoke org (renamed)`,
      });
      steps.push(makeStep('update organization', 'workos_update_organization', 'pass'));
    } catch (error) {
      steps.push(makeStep('update organization', 'workos_update_organization', 'fail', errorMessage(error)));
    }

    let userId: string | undefined;
    if (tools['workos_create_user']) {
      try {
        const user = await call<{ id: string }>('workos_create_user', {
          email: `smoke+${runId}@mastra-smoke.invalid`,
          firstName: 'Mastra',
          lastName: 'Smoke',
        });
        userId = user.id;
        steps.push(makeStep('create user', 'workos_create_user', 'pass', userId));
      } catch (error) {
        steps.push(makeStep('create user', 'workos_create_user', 'fail', errorMessage(error)));
      }
    }

    let membershipId: string | undefined;
    if (userId && tools['workos_create_organization_membership']) {
      try {
        const membership = await call<{ id: string }>('workos_create_organization_membership', {
          organizationId,
          userId,
        });
        membershipId = membership.id;
        steps.push(makeStep('create membership', 'workos_create_organization_membership', 'pass', membershipId));
      } catch (error) {
        steps.push(makeStep('create membership', 'workos_create_organization_membership', 'fail', errorMessage(error)));
      }
    }

    if (membershipId && tools['workos_update_organization_membership']) {
      try {
        await call('workos_update_organization_membership', {
          organizationMembershipId: membershipId,
          roleSlug: 'member',
        });
        steps.push(makeStep('update membership', 'workos_update_organization_membership', 'pass'));
      } catch (error) {
        steps.push(makeStep('update membership', 'workos_update_organization_membership', 'fail', errorMessage(error)));
      }
    }

    if (membershipId && tools['workos_delete_organization_membership']) {
      try {
        await call('workos_delete_organization_membership', { organizationMembershipId: membershipId });
        steps.push(makeStep('delete membership', 'workos_delete_organization_membership', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke membership ${membershipId}`, errorMessage(error));
        steps.push(makeStep('delete membership', 'workos_delete_organization_membership', 'fail', errorMessage(error)));
      }
    }

    if (userId && tools['workos_delete_user']) {
      try {
        await call('workos_delete_user', { userId });
        steps.push(makeStep('delete user', 'workos_delete_user', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke user ${userId}`, errorMessage(error));
        steps.push(makeStep('delete user', 'workos_delete_user', 'fail', errorMessage(error)));
      }
    }

    try {
      await call('workos_delete_organization', { organizationId });
      steps.push(makeStep('delete organization', 'workos_delete_organization', 'pass'));
    } catch (error) {
      log.error(`Failed to delete smoke org ${organizationId}`, errorMessage(error));
      steps.push(makeStep('delete organization', 'workos_delete_organization', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
