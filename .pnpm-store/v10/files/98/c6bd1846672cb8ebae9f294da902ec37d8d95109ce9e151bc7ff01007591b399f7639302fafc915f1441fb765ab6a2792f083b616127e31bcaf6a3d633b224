import { AuthenticateWithOptionsBase, SerializedAuthenticateWithOptionsBase } from './authenticate-with-options-base.interface';
export interface AuthenticateWithTotpOptions extends AuthenticateWithOptionsBase {
    code: string;
    pendingAuthenticationToken: string;
    authenticationChallengeId: string;
}
export interface AuthenticateUserWithTotpCredentials {
    clientSecret: string | undefined;
}
export interface SerializedAuthenticateWithTotpOptions extends SerializedAuthenticateWithOptionsBase {
    grant_type: 'urn:workos:oauth:grant-type:mfa-totp';
    code: string;
    pending_authentication_token: string;
    authentication_challenge_id: string;
}
