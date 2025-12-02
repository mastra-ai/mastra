import { AuthenticateWithOptionsBase, SerializedAuthenticateWithOptionsBase } from './authenticate-with-options-base.interface';
export interface AuthenticateWithMagicAuthOptions extends AuthenticateWithOptionsBase {
    code: string;
    email: string;
    invitationToken?: string;
    linkAuthorizationCode?: string;
}
export interface AuthenticateUserWithMagicAuthCredentials {
    clientSecret: string | undefined;
}
export interface SerializedAuthenticateWithMagicAuthOptions extends SerializedAuthenticateWithOptionsBase {
    grant_type: 'urn:workos:oauth:grant-type:magic-auth:code';
    code: string;
    email: string;
    invitation_token?: string;
    link_authorization_code?: string;
}
