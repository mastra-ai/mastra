import type { CreateBackendApiOptions, Organization, Session, User } from '../api';
import type { AuthObject } from '../tokens/authObjects';
type DecorateAuthWithResourcesOptions = {
    loadSession?: boolean;
    loadUser?: boolean;
    loadOrganization?: boolean;
};
type WithResources<T> = T & {
    session?: Session | null;
    user?: User | null;
    organization?: Organization | null;
};
/**
 * @internal
 */
export declare const decorateObjectWithResources: <T extends object>(obj: T, authObj: AuthObject, opts: CreateBackendApiOptions & DecorateAuthWithResourcesOptions) => Promise<WithResources<T>>;
/**
 * @internal
 */
export declare function stripPrivateDataFromObject<T extends WithResources<object>>(authObject: T): T;
export {};
//# sourceMappingURL=decorateObjectWithResources.d.ts.map