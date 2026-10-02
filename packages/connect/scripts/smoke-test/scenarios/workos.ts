import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch, probeTool } from '../scenario.js';

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

    // User read/update + get_user via snake_case schemas.
    if (userId && tools['workos_get_user']) {
      try {
        await call('workos_get_user', { user_id: userId });
        steps.push(makeStep('get user', 'workos_get_user', 'pass'));
      } catch (error) {
        steps.push(makeStep('get user', 'workos_get_user', 'fail', errorMessage(error)));
      }
    }
    if (userId && tools['workos_update_user']) {
      try {
        await call('workos_update_user', { user_id: userId, first_name: 'Mastra', last_name: 'Smoke-Updated' });
        steps.push(makeStep('update user', 'workos_update_user', 'pass'));
      } catch (error) {
        steps.push(makeStep('update user', 'workos_update_user', 'fail', errorMessage(error)));
      }
    }

    // Membership read + list surface.
    if (membershipId && tools['workos_get_organization_membership']) {
      try {
        await call('workos_get_organization_membership', { membership_id: membershipId });
        steps.push(makeStep('get membership', 'workos_get_organization_membership', 'pass'));
      } catch (error) {
        steps.push(makeStep('get membership', 'workos_get_organization_membership', 'fail', errorMessage(error)));
      }
    }
    if (membershipId && tools['workos_deactivate_organization_membership']) {
      try {
        await call('workos_deactivate_organization_membership', { membership_id: membershipId });
        steps.push(makeStep('deactivate membership', 'workos_deactivate_organization_membership', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('deactivate membership', 'workos_deactivate_organization_membership', 'fail', errorMessage(error)),
        );
      }
    }
    if (membershipId && tools['workos_reactivate_organization_membership']) {
      try {
        await call('workos_reactivate_organization_membership', { membership_id: membershipId });
        steps.push(makeStep('reactivate membership', 'workos_reactivate_organization_membership', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('reactivate membership', 'workos_reactivate_organization_membership', 'fail', errorMessage(error)),
        );
      }
    }
    if (tools['workos_list_organization_memberships']) {
      try {
        await call('workos_list_organization_memberships', { organization_id: organizationId, limit: 5 });
        steps.push(makeStep('list memberships', 'workos_list_organization_memberships', 'pass'));
      } catch (error) {
        steps.push(makeStep('list memberships', 'workos_list_organization_memberships', 'fail', errorMessage(error)));
      }
    }
    if (membershipId && tools['workos_list_organization_membership_groups']) {
      try {
        await call('workos_list_organization_membership_groups', { membership_id: membershipId, limit: 5 });
        steps.push(makeStep('list membership groups', 'workos_list_organization_membership_groups', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('list membership groups', 'workos_list_organization_membership_groups', 'fail', errorMessage(error)),
        );
      }
    }

    // Invitation CRUD against the fresh org.
    let invitationId: string | undefined;
    if (tools['workos_create_invitation']) {
      try {
        const inv = await call<{ id: string }>('workos_create_invitation', {
          email: `smoke+${runId}@mastra-smoke.invalid`,
          organization_id: organizationId,
          expires_in_days: 1,
        });
        invitationId = inv.id;
        steps.push(makeStep('create invitation', 'workos_create_invitation', 'pass', invitationId));
      } catch (error) {
        steps.push(makeStep('create invitation', 'workos_create_invitation', 'fail', errorMessage(error)));
      }
    }
    if (invitationId && tools['workos_get_invitation']) {
      try {
        await call('workos_get_invitation', { invitation_id: invitationId });
        steps.push(makeStep('get invitation', 'workos_get_invitation', 'pass'));
      } catch (error) {
        steps.push(makeStep('get invitation', 'workos_get_invitation', 'fail', errorMessage(error)));
      }
    }
    if (invitationId && tools['workos_resend_invitation']) {
      try {
        await call('workos_resend_invitation', { invitation_id: invitationId });
        steps.push(makeStep('resend invitation', 'workos_resend_invitation', 'pass'));
      } catch (error) {
        steps.push(makeStep('resend invitation', 'workos_resend_invitation', 'fail', errorMessage(error)));
      }
    }
    if (invitationId && tools['workos_revoke_invitation']) {
      try {
        await call('workos_revoke_invitation', { invitation_id: invitationId });
        steps.push(makeStep('revoke invitation', 'workos_revoke_invitation', 'pass'));
      } catch (error) {
        log.error(`Failed to revoke smoke invitation ${invitationId}`, errorMessage(error));
        steps.push(makeStep('revoke invitation', 'workos_revoke_invitation', 'fail', errorMessage(error)));
      }
    }

    // Organization domain CRUD against the fresh org.
    let organizationDomainId: string | undefined;
    if (tools['workos_create_organization_domain']) {
      try {
        const dom = await call<{ id: string }>('workos_create_organization_domain', {
          organization_id: organizationId,
          domain: `smoke-${runId}.mastra-smoke.invalid`,
        });
        organizationDomainId = dom.id;
        steps.push(
          makeStep('create organization domain', 'workos_create_organization_domain', 'pass', organizationDomainId),
        );
      } catch (error) {
        steps.push(
          makeStep('create organization domain', 'workos_create_organization_domain', 'fail', errorMessage(error)),
        );
      }
    }
    if (organizationDomainId && tools['workos_get_organization_domain']) {
      try {
        await call('workos_get_organization_domain', { organization_domain_id: organizationDomainId });
        steps.push(makeStep('get organization domain', 'workos_get_organization_domain', 'pass'));
      } catch (error) {
        steps.push(makeStep('get organization domain', 'workos_get_organization_domain', 'fail', errorMessage(error)));
      }
    }
    if (organizationDomainId && tools['workos_verify_organization_domain']) {
      // Verification needs DNS or manual proof the smoke suite can't provide;
      // probe to prove routing.
      steps.push(
        await probeTool(call, tools, 'verify organization domain (probe)', 'workos_verify_organization_domain', {
          organization_domain_id: organizationDomainId,
        }),
      );
    }
    if (organizationDomainId && tools['workos_delete_organization_domain']) {
      try {
        await call('workos_delete_organization_domain', { organization_domain_id: organizationDomainId });
        steps.push(makeStep('delete organization domain', 'workos_delete_organization_domain', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke org domain ${organizationDomainId}`, errorMessage(error));
        steps.push(
          makeStep('delete organization domain', 'workos_delete_organization_domain', 'fail', errorMessage(error)),
        );
      }
    }

    // Directory + connection probes against synthetic ids (create_connection
    // requires a provisioned SSO config, which the smoke suite cannot bootstrap).
    if (tools['workos_create_connection']) {
      steps.push(
        await probeTool(call, tools, 'create connection (probe)', 'workos_create_connection', {
          organization_id: organizationId,
          connection_type: 'OktaSAML',
          saml_options: {
            idp_metadata_url: 'https://smoke.invalid/metadata.xml',
          },
        }),
      );
    }
    if (tools['workos_get_connection']) {
      steps.push(
        await probeTool(call, tools, 'get connection (probe)', 'workos_get_connection', {
          connection_id: `conn_smoke_${runId}`,
        }),
      );
    }
    if (tools['workos_update_connection']) {
      steps.push(
        await probeTool(call, tools, 'update connection (probe)', 'workos_update_connection', {
          connection_id: `conn_smoke_${runId}`,
          name: `smoke-${runId}`,
        }),
      );
    }
    if (tools['workos_delete_connection']) {
      steps.push(
        await probeTool(call, tools, 'delete connection (probe)', 'workos_delete_connection', {
          connection_id: `conn_smoke_${runId}`,
        }),
      );
    }

    const syntheticDirectoryId = `directory_smoke_${runId}`;
    if (tools['workos_get_directory']) {
      steps.push(
        await probeTool(call, tools, 'get directory (probe)', 'workos_get_directory', {
          directory_id: syntheticDirectoryId,
        }),
      );
    }
    if (tools['workos_delete_directory']) {
      steps.push(
        await probeTool(call, tools, 'delete directory (probe)', 'workos_delete_directory', {
          directory_id: syntheticDirectoryId,
        }),
      );
    }
    if (tools['workos_list_directory_users']) {
      try {
        await call('workos_list_directory_users', { limit: 5 });
        steps.push(makeStep('list directory users', 'workos_list_directory_users', 'pass'));
      } catch (error) {
        steps.push(makeStep('list directory users', 'workos_list_directory_users', 'fail', errorMessage(error)));
      }
    }
    if (tools['workos_list_directory_groups']) {
      try {
        await call('workos_list_directory_groups', { limit: 5 });
        steps.push(makeStep('list directory groups', 'workos_list_directory_groups', 'pass'));
      } catch (error) {
        steps.push(makeStep('list directory groups', 'workos_list_directory_groups', 'fail', errorMessage(error)));
      }
    }
    if (tools['workos_get_directory_user']) {
      steps.push(
        await probeTool(call, tools, 'get directory user (probe)', 'workos_get_directory_user', {
          directory_user_id: `directory_user_smoke_${runId}`,
        }),
      );
    }
    if (tools['workos_get_directory_group']) {
      steps.push(
        await probeTool(call, tools, 'get directory group (probe)', 'workos_get_directory_group', {
          group_id: `directory_group_smoke_${runId}`,
        }),
      );
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
