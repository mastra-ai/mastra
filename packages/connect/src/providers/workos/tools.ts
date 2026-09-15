// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { createConnectionTool } from './tools/create-connection.js';
import { createInvitationTool } from './tools/create-invitation.js';
import { createOrganizationDomainTool } from './tools/create-organization-domain.js';
import { createOrganizationMembershipTool } from './tools/create-organization-membership.js';
import { createOrganizationTool } from './tools/create-organization.js';
import { createUserTool } from './tools/create-user.js';
import { deactivateOrganizationMembershipTool } from './tools/deactivate-organization-membership.js';
import { deleteConnectionTool } from './tools/delete-connection.js';
import { deleteDirectoryTool } from './tools/delete-directory.js';
import { deleteOrganizationDomainTool } from './tools/delete-organization-domain.js';
import { deleteOrganizationMembershipTool } from './tools/delete-organization-membership.js';
import { deleteOrganizationTool } from './tools/delete-organization.js';
import { deleteUserTool } from './tools/delete-user.js';
import { getConnectionTool } from './tools/get-connection.js';
import { getDirectoryGroupTool } from './tools/get-directory-group.js';
import { getDirectoryUserTool } from './tools/get-directory-user.js';
import { getDirectoryTool } from './tools/get-directory.js';
import { getInvitationTool } from './tools/get-invitation.js';
import { getOrganizationDomainTool } from './tools/get-organization-domain.js';
import { getOrganizationMembershipTool } from './tools/get-organization-membership.js';
import { getOrganizationTool } from './tools/get-organization.js';
import { getUserTool } from './tools/get-user.js';
import { listConnectionsTool } from './tools/list-connections.js';
import { listDirectoriesTool } from './tools/list-directories.js';
import { listDirectoryGroupsTool } from './tools/list-directory-groups.js';
import { listDirectoryUsersTool } from './tools/list-directory-users.js';
import { listEventsTool } from './tools/list-events.js';
import { listInvitationsTool } from './tools/list-invitations.js';
import { listOrganizationMembershipGroupsTool } from './tools/list-organization-membership-groups.js';
import { listOrganizationMembershipsTool } from './tools/list-organization-memberships.js';
import { listOrganizationsTool } from './tools/list-organizations.js';
import { listUsersTool } from './tools/list-users.js';
import { reactivateOrganizationMembershipTool } from './tools/reactivate-organization-membership.js';
import { resendInvitationTool } from './tools/resend-invitation.js';
import { revokeInvitationTool } from './tools/revoke-invitation.js';
import { updateConnectionTool } from './tools/update-connection.js';
import { updateOrganizationMembershipTool } from './tools/update-organization-membership.js';
import { updateOrganizationTool } from './tools/update-organization.js';
import { updateUserTool } from './tools/update-user.js';
import { verifyOrganizationDomainTool } from './tools/verify-organization-domain.js';

export function createWorkosTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    workos_create_connection: createConnectionTool(platformProxy),
    workos_create_invitation: createInvitationTool(platformProxy),
    workos_create_organization_domain: createOrganizationDomainTool(platformProxy),
    workos_create_organization_membership: createOrganizationMembershipTool(platformProxy),
    workos_create_organization: createOrganizationTool(platformProxy),
    workos_create_user: createUserTool(platformProxy),
    workos_deactivate_organization_membership: deactivateOrganizationMembershipTool(platformProxy),
    workos_delete_connection: deleteConnectionTool(platformProxy),
    workos_delete_directory: deleteDirectoryTool(platformProxy),
    workos_delete_organization_domain: deleteOrganizationDomainTool(platformProxy),
    workos_delete_organization_membership: deleteOrganizationMembershipTool(platformProxy),
    workos_delete_organization: deleteOrganizationTool(platformProxy),
    workos_delete_user: deleteUserTool(platformProxy),
    workos_get_connection: getConnectionTool(platformProxy),
    workos_get_directory_group: getDirectoryGroupTool(platformProxy),
    workos_get_directory_user: getDirectoryUserTool(platformProxy),
    workos_get_directory: getDirectoryTool(platformProxy),
    workos_get_invitation: getInvitationTool(platformProxy),
    workos_get_organization_domain: getOrganizationDomainTool(platformProxy),
    workos_get_organization_membership: getOrganizationMembershipTool(platformProxy),
    workos_get_organization: getOrganizationTool(platformProxy),
    workos_get_user: getUserTool(platformProxy),
    workos_list_connections: listConnectionsTool(platformProxy),
    workos_list_directories: listDirectoriesTool(platformProxy),
    workos_list_directory_groups: listDirectoryGroupsTool(platformProxy),
    workos_list_directory_users: listDirectoryUsersTool(platformProxy),
    workos_list_events: listEventsTool(platformProxy),
    workos_list_invitations: listInvitationsTool(platformProxy),
    workos_list_organization_membership_groups: listOrganizationMembershipGroupsTool(platformProxy),
    workos_list_organization_memberships: listOrganizationMembershipsTool(platformProxy),
    workos_list_organizations: listOrganizationsTool(platformProxy),
    workos_list_users: listUsersTool(platformProxy),
    workos_reactivate_organization_membership: reactivateOrganizationMembershipTool(platformProxy),
    workos_resend_invitation: resendInvitationTool(platformProxy),
    workos_revoke_invitation: revokeInvitationTool(platformProxy),
    workos_update_connection: updateConnectionTool(platformProxy),
    workos_update_organization_membership: updateOrganizationMembershipTool(platformProxy),
    workos_update_organization: updateOrganizationTool(platformProxy),
    workos_update_user: updateUserTool(platformProxy),
    workos_verify_organization_domain: verifyOrganizationDomainTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
