import { AuthenticateWithOptionsBase, SerializedAuthenticateWithOptionsBase } from './authenticate-with-options-base.interface';
export interface AuthenticateWithCodeOptions extends AuthenticateWithOptionsBase {
    codeVerifier?: string;
    code: string;
    invitationToken?: string;
}
export interface AuthenticateUserWithCodeCredentials {
    clientSecret: string | undefined;
}
export interface SerializedAuthenticateWithCodeOptions extends SerializedAuthenticateWithOptionsBase {
    grant_type: 'authorization_code';
    code_verifier?: string;
    code: string;
    invitation_token?: string;
}
