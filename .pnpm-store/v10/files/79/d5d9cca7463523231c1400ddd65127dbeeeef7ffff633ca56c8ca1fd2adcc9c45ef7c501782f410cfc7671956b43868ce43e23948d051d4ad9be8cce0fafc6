export type WidgetScope = 'widgets:users-table:manage' | 'widgets:sso:manage' | 'widgets:domain-verification:manage';
export interface GetTokenOptions {
    organizationId: string;
    userId?: string;
    scopes?: WidgetScope[];
}
export interface SerializedGetTokenOptions {
    organization_id: string;
    user_id?: string;
    scopes?: WidgetScope[];
}
export declare const serializeGetTokenOptions: (options: GetTokenOptions) => SerializedGetTokenOptions;
export interface GetTokenResponse {
    token: string;
}
export interface GetTokenResponseResponse {
    token: string;
}
export declare const deserializeGetTokenResponse: (data: GetTokenResponseResponse) => GetTokenResponse;
