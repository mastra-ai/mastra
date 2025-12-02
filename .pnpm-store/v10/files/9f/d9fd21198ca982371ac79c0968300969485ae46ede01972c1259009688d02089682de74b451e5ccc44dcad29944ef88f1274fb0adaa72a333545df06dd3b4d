import { Organization, OrganizationResponse } from '../../organizations/interfaces';
import { Invitation, InvitationResponse, OrganizationMembership, OrganizationMembershipResponse, User, UserResponse } from '../../user-management/interfaces';
interface AuthenticationActionContext {
    id: string;
    object: 'authentication_action_context';
    user: User;
    organization?: Organization;
    organizationMembership?: OrganizationMembership;
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
    issuer?: string;
}
export interface UserData {
    object: 'user_data';
    email: string;
    firstName: string;
    lastName: string;
}
interface UserRegistrationActionContext {
    id: string;
    object: 'user_registration_action_context';
    userData: UserData;
    invitation?: Invitation;
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
}
export type ActionContext = AuthenticationActionContext | UserRegistrationActionContext;
interface AuthenticationActionPayload {
    id: string;
    object: 'authentication_action_context';
    user: UserResponse;
    organization?: OrganizationResponse;
    organization_membership?: OrganizationMembershipResponse;
    ip_address?: string;
    user_agent?: string;
    device_fingerprint?: string;
    issuer?: string;
}
export interface UserDataPayload {
    object: 'user_data';
    email: string;
    first_name: string;
    last_name: string;
}
export interface UserRegistrationActionPayload {
    id: string;
    object: 'user_registration_action_context';
    user_data: UserDataPayload;
    invitation?: InvitationResponse;
    ip_address?: string;
    user_agent?: string;
    device_fingerprint?: string;
}
export type ActionPayload = AuthenticationActionPayload | UserRegistrationActionPayload;
export {};
