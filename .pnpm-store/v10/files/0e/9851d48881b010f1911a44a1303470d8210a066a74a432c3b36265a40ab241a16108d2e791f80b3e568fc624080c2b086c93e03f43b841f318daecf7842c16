import { AuthenticateWithOptionsBase, SerializedAuthenticateWithOptionsBase } from './authenticate-with-options-base.interface';
export interface AuthenticateWithOrganizationSelectionOptions extends AuthenticateWithOptionsBase {
    organizationId: string;
    pendingAuthenticationToken: string;
}
export interface AuthenticateUserWithOrganizationSelectionCredentials {
    clientSecret: string | undefined;
}
export interface SerializedAuthenticateWithOrganizationSelectionOptions extends SerializedAuthenticateWithOptionsBase {
    grant_type: 'urn:workos:oauth:grant-type:organization-selection';
    organization_id: string;
    pending_authentication_token: string;
}
