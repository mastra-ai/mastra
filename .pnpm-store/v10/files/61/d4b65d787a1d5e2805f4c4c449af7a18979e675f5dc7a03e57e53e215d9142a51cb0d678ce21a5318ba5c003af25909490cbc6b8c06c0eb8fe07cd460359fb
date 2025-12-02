import { UnknownRecord } from '../../common/interfaces/unknown-record.interface';
import { OauthTokens, OauthTokensResponse } from '../../user-management/interfaces/oauth-tokens.interface';
import { Profile, ProfileResponse } from './profile.interface';
export interface ProfileAndToken<CustomAttributesType extends UnknownRecord> {
    accessToken: string;
    profile: Profile<CustomAttributesType>;
    oauthTokens?: OauthTokens;
}
export interface ProfileAndTokenResponse<CustomAttributesType extends UnknownRecord> {
    access_token: string;
    profile: ProfileResponse<CustomAttributesType>;
    oauth_tokens?: OauthTokensResponse;
}
