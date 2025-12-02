import { AuthenticateWithOptionsBase, SerializedAuthenticateWithOptionsBase } from './authenticate-with-options-base.interface';
export interface AuthenticateWithEmailVerificationOptions extends AuthenticateWithOptionsBase {
    code: string;
    pendingAuthenticationToken: string;
}
export interface AuthenticateUserWithEmailVerificationCredentials {
    clientSecret: string | undefined;
}
export interface SerializedAuthenticateWithEmailVerificationOptions extends SerializedAuthenticateWithOptionsBase {
    grant_type: 'urn:workos:oauth:grant-type:email-verification:code';
    code: string;
    pending_authentication_token: string;
}
