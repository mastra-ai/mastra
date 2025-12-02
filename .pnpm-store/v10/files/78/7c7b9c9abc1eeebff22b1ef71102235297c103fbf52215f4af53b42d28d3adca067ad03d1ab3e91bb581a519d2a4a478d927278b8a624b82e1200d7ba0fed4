import { AuthenticateWithOptionsBase, SerializedAuthenticateWithOptionsBase } from './authenticate-with-options-base.interface';
export interface AuthenticateWithRefreshTokenOptions extends AuthenticateWithOptionsBase {
    refreshToken: string;
    organizationId?: string;
}
export interface AuthenticateUserWithRefreshTokenCredentials {
    clientSecret: string | undefined;
}
export interface SerializedAuthenticateWithRefreshTokenOptions extends SerializedAuthenticateWithOptionsBase {
    grant_type: 'refresh_token';
    refresh_token: string;
    organization_id: string | undefined;
}
