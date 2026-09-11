// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { assignOrganizationRolePermissionTool } from './tools/assign-organization-role-permission.js';
import { createEmailAddressTool } from './tools/create-email-address.js';
import { createOrganizationDomainTool } from './tools/create-organization-domain.js';
import { createOrganizationInvitationTool } from './tools/create-organization-invitation.js';
import { createOrganizationMembershipTool } from './tools/create-organization-membership.js';
import { createOrganizationRoleTool } from './tools/create-organization-role.js';
import { createOrganizationTool } from './tools/create-organization.js';
import { createPhoneNumberTool } from './tools/create-phone-number.js';
import { createUserTool } from './tools/create-user.js';
import { deleteEmailAddressTool } from './tools/delete-email-address.js';
import { deleteOrganizationDomainTool } from './tools/delete-organization-domain.js';
import { deleteOrganizationMembershipTool } from './tools/delete-organization-membership.js';
import { deleteOrganizationRoleTool } from './tools/delete-organization-role.js';
import { deleteOrganizationTool } from './tools/delete-organization.js';
import { deletePhoneNumberTool } from './tools/delete-phone-number.js';
import { deleteUserTool } from './tools/delete-user.js';
import { getEmailAddressTool } from './tools/get-email-address.js';
import { getOrganizationInvitationTool } from './tools/get-organization-invitation.js';
import { getOrganizationRoleTool } from './tools/get-organization-role.js';
import { getOrganizationTool } from './tools/get-organization.js';
import { getPhoneNumberTool } from './tools/get-phone-number.js';
import { getSessionTool } from './tools/get-session.js';
import { getUserTool } from './tools/get-user.js';
import { listOrganizationDomainsTool } from './tools/list-organization-domains.js';
import { listOrganizationInvitationsTool } from './tools/list-organization-invitations.js';
import { listOrganizationMembershipsTool } from './tools/list-organization-memberships.js';
import { listOrganizationRolesTool } from './tools/list-organization-roles.js';
import { listOrganizationsTool } from './tools/list-organizations.js';
import { listSessionsTool } from './tools/list-sessions.js';
import { listUsersTool } from './tools/list-users.js';
import { removeOrganizationRolePermissionTool } from './tools/remove-organization-role-permission.js';
import { revokeOrganizationInvitationTool } from './tools/revoke-organization-invitation.js';
import { revokeSessionTool } from './tools/revoke-session.js';
import { updateEmailAddressTool } from './tools/update-email-address.js';
import { updateOrganizationDomainTool } from './tools/update-organization-domain.js';
import { updateOrganizationMembershipMetadataTool } from './tools/update-organization-membership-metadata.js';
import { updateOrganizationMembershipTool } from './tools/update-organization-membership.js';
import { updateOrganizationRoleTool } from './tools/update-organization-role.js';
import { updateOrganizationTool } from './tools/update-organization.js';
import { updatePhoneNumberTool } from './tools/update-phone-number.js';
import { updateUserTool } from './tools/update-user.js';
import { verifyOrganizationDomainTool } from './tools/verify-organization-domain.js';

export function createClerkTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    clerk_assign_organization_role_permission: assignOrganizationRolePermissionTool(platformProxy),
    clerk_create_email_address: createEmailAddressTool(platformProxy),
    clerk_create_organization_domain: createOrganizationDomainTool(platformProxy),
    clerk_create_organization_invitation: createOrganizationInvitationTool(platformProxy),
    clerk_create_organization_membership: createOrganizationMembershipTool(platformProxy),
    clerk_create_organization_role: createOrganizationRoleTool(platformProxy),
    clerk_create_organization: createOrganizationTool(platformProxy),
    clerk_create_phone_number: createPhoneNumberTool(platformProxy),
    clerk_create_user: createUserTool(platformProxy),
    clerk_delete_email_address: deleteEmailAddressTool(platformProxy),
    clerk_delete_organization_domain: deleteOrganizationDomainTool(platformProxy),
    clerk_delete_organization_membership: deleteOrganizationMembershipTool(platformProxy),
    clerk_delete_organization_role: deleteOrganizationRoleTool(platformProxy),
    clerk_delete_organization: deleteOrganizationTool(platformProxy),
    clerk_delete_phone_number: deletePhoneNumberTool(platformProxy),
    clerk_delete_user: deleteUserTool(platformProxy),
    clerk_get_email_address: getEmailAddressTool(platformProxy),
    clerk_get_organization_invitation: getOrganizationInvitationTool(platformProxy),
    clerk_get_organization_role: getOrganizationRoleTool(platformProxy),
    clerk_get_organization: getOrganizationTool(platformProxy),
    clerk_get_phone_number: getPhoneNumberTool(platformProxy),
    clerk_get_session: getSessionTool(platformProxy),
    clerk_get_user: getUserTool(platformProxy),
    clerk_list_organization_domains: listOrganizationDomainsTool(platformProxy),
    clerk_list_organization_invitations: listOrganizationInvitationsTool(platformProxy),
    clerk_list_organization_memberships: listOrganizationMembershipsTool(platformProxy),
    clerk_list_organization_roles: listOrganizationRolesTool(platformProxy),
    clerk_list_organizations: listOrganizationsTool(platformProxy),
    clerk_list_sessions: listSessionsTool(platformProxy),
    clerk_list_users: listUsersTool(platformProxy),
    clerk_remove_organization_role_permission: removeOrganizationRolePermissionTool(platformProxy),
    clerk_revoke_organization_invitation: revokeOrganizationInvitationTool(platformProxy),
    clerk_revoke_session: revokeSessionTool(platformProxy),
    clerk_update_email_address: updateEmailAddressTool(platformProxy),
    clerk_update_organization_domain: updateOrganizationDomainTool(platformProxy),
    clerk_update_organization_membership_metadata: updateOrganizationMembershipMetadataTool(platformProxy),
    clerk_update_organization_membership: updateOrganizationMembershipTool(platformProxy),
    clerk_update_organization_role: updateOrganizationRoleTool(platformProxy),
    clerk_update_organization: updateOrganizationTool(platformProxy),
    clerk_update_phone_number: updatePhoneNumberTool(platformProxy),
    clerk_update_user: updateUserTool(platformProxy),
    clerk_verify_organization_domain: verifyOrganizationDomainTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
