import { AbstractAPI } from './AbstractApi';
type ChangeDomainParams = {
    /**
     * The new home URL of the production instance e.g. https://www.example.com
     */
    homeUrl?: string;
    /**
     * Whether this is a domain for a secondary app, meaning that any subdomain
     * provided is significant and will be stored as part of the domain. This is
     * useful for supporting multiple apps (one primary and multiple secondaries)
     * on the same root domain (eTLD+1).
     */
    isSecondary?: boolean;
};
export declare class BetaFeaturesAPI extends AbstractAPI {
    /**
     * Change the domain of a production instance.
     *
     * Changing the domain requires updating the DNS records accordingly, deploying new SSL certificates,
     * updating your Social Connection's redirect URLs and setting the new keys in your code.
     *
     * @remarks
     * WARNING: Changing your domain will invalidate all current user sessions (i.e. users will be logged out).
     *          Also, while your application is being deployed, a small downtime is expected to occur.
     */
    changeDomain(params: ChangeDomainParams): Promise<void>;
}
export {};
//# sourceMappingURL=BetaFeaturesApi.d.ts.map