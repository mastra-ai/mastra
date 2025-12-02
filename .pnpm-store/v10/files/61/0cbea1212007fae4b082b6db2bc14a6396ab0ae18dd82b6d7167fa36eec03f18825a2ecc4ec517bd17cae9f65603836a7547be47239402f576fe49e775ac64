/**
 * An identity provider is responsible for providing a token that can be used to authenticate with a service.
 */
/**
 * The response from an identity provider when requesting a token.
 *
 * note: "native" refers to the type of the token that the actual identity provider library is using.
 *
 * @type T The type of the native idp token.
 * @property token The token.
 * @property ttlMs The time-to-live of the token in epoch milliseconds extracted from the native token in local time.
 */
export type TokenResponse<T> = {
    token: T;
    ttlMs: number;
};
export interface IdentityProvider<T> {
    /**
     * Request a token from the identity provider.
     * @returns A promise that resolves to an object containing the token and the time-to-live in epoch milliseconds.
     */
    requestToken(): Promise<TokenResponse<T>>;
}
//# sourceMappingURL=identity-provider.d.ts.map