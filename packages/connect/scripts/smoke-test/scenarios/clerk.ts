import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch, probeTool } from '../scenario.js';

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

    // Membership metadata + update + list surface.
    if (organizationId && membershipCreated && tools['clerk_update_organization_membership']) {
      try {
        await call('clerk_update_organization_membership', {
          organization_id: organizationId,
          user_id: userId!,
          role: 'org:admin',
        });
        steps.push(makeStep('update membership role', 'clerk_update_organization_membership', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('update membership role', 'clerk_update_organization_membership', 'fail', errorMessage(error)),
        );
      }
    }
    if (organizationId && membershipCreated && tools['clerk_update_organization_membership_metadata']) {
      try {
        await call('clerk_update_organization_membership_metadata', {
          organization_id: organizationId,
          user_id: userId!,
          public_metadata: { smokeRun: runId },
        });
        steps.push(makeStep('update membership metadata', 'clerk_update_organization_membership_metadata', 'pass'));
      } catch (error) {
        steps.push(
          makeStep(
            'update membership metadata',
            'clerk_update_organization_membership_metadata',
            'fail',
            errorMessage(error),
          ),
        );
      }
    }
    if (organizationId && tools['clerk_list_organization_memberships']) {
      try {
        await call('clerk_list_organization_memberships', { organization_id: organizationId, limit: 5 });
        steps.push(makeStep('list memberships', 'clerk_list_organization_memberships', 'pass'));
      } catch (error) {
        steps.push(makeStep('list memberships', 'clerk_list_organization_memberships', 'fail', errorMessage(error)));
      }
    }

    // Email + phone CRUD on the smoke user.
    let emailAddressId: string | undefined;
    if (userId && tools['clerk_create_email_address']) {
      try {
        const result = await call<{ id: string }>('clerk_create_email_address', {
          user_id: userId,
          email_address: `mastra-smoke+${runId}-2@example.com`,
          verified: true,
        });
        emailAddressId = result.id;
        steps.push(makeStep('create email address', 'clerk_create_email_address', 'pass', emailAddressId));
      } catch (error) {
        steps.push(makeStep('create email address', 'clerk_create_email_address', 'fail', errorMessage(error)));
      }
    }
    if (emailAddressId && tools['clerk_get_email_address']) {
      try {
        await call('clerk_get_email_address', { email_address_id: emailAddressId });
        steps.push(makeStep('get email address', 'clerk_get_email_address', 'pass'));
      } catch (error) {
        steps.push(makeStep('get email address', 'clerk_get_email_address', 'fail', errorMessage(error)));
      }
    }
    if (emailAddressId && tools['clerk_update_email_address']) {
      try {
        await call('clerk_update_email_address', { email_address_id: emailAddressId, primary: false });
        steps.push(makeStep('update email address', 'clerk_update_email_address', 'pass'));
      } catch (error) {
        steps.push(makeStep('update email address', 'clerk_update_email_address', 'fail', errorMessage(error)));
      }
    }
    if (emailAddressId && tools['clerk_delete_email_address']) {
      try {
        await call('clerk_delete_email_address', { email_address_id: emailAddressId });
        steps.push(makeStep('delete email address', 'clerk_delete_email_address', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete email address', 'clerk_delete_email_address', 'fail', errorMessage(error)));
      }
    }

    let phoneNumberId: string | undefined;
    if (userId && tools['clerk_create_phone_number']) {
      try {
        // E.164 format; marked verified so Clerk doesn't try to send SMS.
        const result = await call<{ id: string }>('clerk_create_phone_number', {
          user_id: userId,
          phone_number: '+15555550123',
          verified: true,
        });
        phoneNumberId = result.id;
        steps.push(makeStep('create phone number', 'clerk_create_phone_number', 'pass', phoneNumberId));
      } catch (error) {
        steps.push(makeStep('create phone number', 'clerk_create_phone_number', 'fail', errorMessage(error)));
      }
    }
    if (phoneNumberId && tools['clerk_get_phone_number']) {
      try {
        await call('clerk_get_phone_number', { phone_number_id: phoneNumberId });
        steps.push(makeStep('get phone number', 'clerk_get_phone_number', 'pass'));
      } catch (error) {
        steps.push(makeStep('get phone number', 'clerk_get_phone_number', 'fail', errorMessage(error)));
      }
    }
    if (phoneNumberId && tools['clerk_update_phone_number']) {
      try {
        await call('clerk_update_phone_number', { phone_number_id: phoneNumberId, reserved_for_second_factor: false });
        steps.push(makeStep('update phone number', 'clerk_update_phone_number', 'pass'));
      } catch (error) {
        steps.push(makeStep('update phone number', 'clerk_update_phone_number', 'fail', errorMessage(error)));
      }
    }
    if (phoneNumberId && tools['clerk_delete_phone_number']) {
      try {
        await call('clerk_delete_phone_number', { phone_number_id: phoneNumberId });
        steps.push(makeStep('delete phone number', 'clerk_delete_phone_number', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete phone number', 'clerk_delete_phone_number', 'fail', errorMessage(error)));
      }
    }

    // Session read + revoke probed with user's sessions (empty on fresh user).
    if (tools['clerk_get_session']) {
      steps.push(
        await probeTool(call, tools, 'get session (probe)', 'clerk_get_session', {
          session_id: `sess_smoke_${runId}`,
        }),
      );
    }
    if (tools['clerk_revoke_session']) {
      steps.push(
        await probeTool(call, tools, 'revoke session (probe)', 'clerk_revoke_session', {
          session_id: `sess_smoke_${runId}`,
        }),
      );
    }

    // Organization-invitation CRUD against the fresh org.
    let invitationId: string | undefined;
    if (organizationId && tools['clerk_create_organization_invitation']) {
      try {
        const inv = await call<{ id: string }>('clerk_create_organization_invitation', {
          organization_id: organizationId,
          email_address: `mastra-smoke+${runId}-invitee@example.com`,
          role: 'org:member',
          notify: false,
        });
        invitationId = inv.id;
        steps.push(makeStep('create org invitation', 'clerk_create_organization_invitation', 'pass', invitationId));
      } catch (error) {
        steps.push(
          makeStep('create org invitation', 'clerk_create_organization_invitation', 'fail', errorMessage(error)),
        );
      }
    }
    if (organizationId && tools['clerk_list_organization_invitations']) {
      try {
        await call('clerk_list_organization_invitations', { organization_id: organizationId, limit: 5 });
        steps.push(makeStep('list org invitations', 'clerk_list_organization_invitations', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('list org invitations', 'clerk_list_organization_invitations', 'fail', errorMessage(error)),
        );
      }
    }
    if (organizationId && invitationId && tools['clerk_get_organization_invitation']) {
      try {
        await call('clerk_get_organization_invitation', {
          organization_id: organizationId,
          invitation_id: invitationId,
        });
        steps.push(makeStep('get org invitation', 'clerk_get_organization_invitation', 'pass'));
      } catch (error) {
        steps.push(makeStep('get org invitation', 'clerk_get_organization_invitation', 'fail', errorMessage(error)));
      }
    }
    if (organizationId && invitationId && tools['clerk_revoke_organization_invitation']) {
      try {
        await call('clerk_revoke_organization_invitation', {
          organization_id: organizationId,
          invitation_id: invitationId,
        });
        steps.push(makeStep('revoke org invitation', 'clerk_revoke_organization_invitation', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('revoke org invitation', 'clerk_revoke_organization_invitation', 'fail', errorMessage(error)),
        );
      }
    }

    // Organization-domain CRUD. Clerk may reject unverified domains depending
    // on instance config; probe wraps common 400s.
    let orgDomainId: string | undefined;
    if (organizationId && tools['clerk_create_organization_domain']) {
      try {
        const result = await call<{ id?: string }>('clerk_create_organization_domain', {
          organization_id: organizationId,
          name: `smoke-${runId}.mastra-smoke.invalid`,
          enrollment_mode: 'manual_invitation',
        });
        orgDomainId = result.id;
        steps.push(makeStep('create org domain', 'clerk_create_organization_domain', 'pass', orgDomainId));
      } catch (error) {
        steps.push(makeStep('create org domain', 'clerk_create_organization_domain', 'fail', errorMessage(error)));
      }
    }
    if (organizationId && tools['clerk_list_organization_domains']) {
      try {
        await call('clerk_list_organization_domains', { organization_id: organizationId, limit: 5 });
        steps.push(makeStep('list org domains', 'clerk_list_organization_domains', 'pass'));
      } catch (error) {
        steps.push(makeStep('list org domains', 'clerk_list_organization_domains', 'fail', errorMessage(error)));
      }
    }
    if (organizationId && orgDomainId && tools['clerk_update_organization_domain']) {
      try {
        await call('clerk_update_organization_domain', {
          organization_id: organizationId,
          domain_id: orgDomainId,
          enrollment_mode: 'automatic_invitation',
        });
        steps.push(makeStep('update org domain', 'clerk_update_organization_domain', 'pass'));
      } catch (error) {
        steps.push(makeStep('update org domain', 'clerk_update_organization_domain', 'fail', errorMessage(error)));
      }
    }
    if (organizationId && orgDomainId && tools['clerk_verify_organization_domain']) {
      // Verification needs DNS proof we can't provide; probe accepts the
      // expected 400/422 and treats the rejection as proof of routing.
      steps.push(
        await probeTool(call, tools, 'verify org domain (probe)', 'clerk_verify_organization_domain', {
          organization_id: organizationId,
          domain_id: orgDomainId,
        }),
      );
    }
    if (organizationId && orgDomainId && tools['clerk_delete_organization_domain']) {
      try {
        await call('clerk_delete_organization_domain', { organization_id: organizationId, domain_id: orgDomainId });
        steps.push(makeStep('delete org domain', 'clerk_delete_organization_domain', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke org domain ${orgDomainId}`, errorMessage(error));
        steps.push(makeStep('delete org domain', 'clerk_delete_organization_domain', 'fail', errorMessage(error)));
      }
    }

    // Organization-role CRUD + permission wiring. Instances that don't have
    // custom-role support will reject with 400 — handled by try/catch.
    let roleId: string | undefined;
    if (tools['clerk_create_organization_role']) {
      try {
        const role = await call<{ id?: string }>('clerk_create_organization_role', {
          name: `smoke-${runId}`,
          key: `org:smoke_${runId.replace(/-/g, '_')}`,
          description: 'smoke test role',
          include_in_initial_role_set: false,
        });
        roleId = role.id;
        steps.push(makeStep('create org role', 'clerk_create_organization_role', 'pass', roleId));
      } catch (error) {
        steps.push(makeStep('create org role', 'clerk_create_organization_role', 'fail', errorMessage(error)));
      }
    }
    if (tools['clerk_list_organization_roles']) {
      try {
        await call('clerk_list_organization_roles', { limit: 5 });
        steps.push(makeStep('list org roles', 'clerk_list_organization_roles', 'pass'));
      } catch (error) {
        steps.push(makeStep('list org roles', 'clerk_list_organization_roles', 'fail', errorMessage(error)));
      }
    }
    if (roleId && tools['clerk_get_organization_role']) {
      try {
        await call('clerk_get_organization_role', { organization_role_id: roleId });
        steps.push(makeStep('get org role', 'clerk_get_organization_role', 'pass'));
      } catch (error) {
        steps.push(makeStep('get org role', 'clerk_get_organization_role', 'fail', errorMessage(error)));
      }
    }
    if (roleId && tools['clerk_update_organization_role']) {
      try {
        await call('clerk_update_organization_role', { organization_role_id: roleId, name: `smoke-${runId}-renamed` });
        steps.push(makeStep('update org role', 'clerk_update_organization_role', 'pass'));
      } catch (error) {
        steps.push(makeStep('update org role', 'clerk_update_organization_role', 'fail', errorMessage(error)));
      }
    }
    if (roleId && tools['clerk_assign_organization_role_permission']) {
      steps.push(
        await probeTool(call, tools, 'assign role permission (probe)', 'clerk_assign_organization_role_permission', {
          organization_role_id: roleId,
          permission_id: `perm_smoke_${runId}`,
        }),
      );
    }
    if (roleId && tools['clerk_remove_organization_role_permission']) {
      steps.push(
        await probeTool(call, tools, 'remove role permission (probe)', 'clerk_remove_organization_role_permission', {
          organization_role_id: roleId,
          permission_id: `perm_smoke_${runId}`,
        }),
      );
    }
    if (roleId && tools['clerk_delete_organization_role']) {
      try {
        await call('clerk_delete_organization_role', { organization_role_id: roleId });
        steps.push(makeStep('delete org role', 'clerk_delete_organization_role', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke role ${roleId}`, errorMessage(error));
        steps.push(makeStep('delete org role', 'clerk_delete_organization_role', 'fail', errorMessage(error)));
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
