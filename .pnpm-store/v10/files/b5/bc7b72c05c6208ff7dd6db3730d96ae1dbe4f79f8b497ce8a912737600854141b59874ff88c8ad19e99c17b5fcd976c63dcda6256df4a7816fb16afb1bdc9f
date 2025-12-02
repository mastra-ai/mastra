import { UnknownRecord } from '../common/interfaces/unknown-record.interface';
import { AutoPaginatable } from '../common/utils/pagination';
import { WorkOS } from '../workos';
import { Connection, GetProfileAndTokenOptions, GetProfileOptions, ListConnectionsOptions, Profile, ProfileAndToken, SSOAuthorizationURLOptions } from './interfaces';
export declare class SSO {
    private readonly workos;
    constructor(workos: WorkOS);
    listConnections(options?: ListConnectionsOptions): Promise<AutoPaginatable<Connection>>;
    deleteConnection(id: string): Promise<void>;
    getAuthorizationUrl({ connection, clientId, domain, domainHint, loginHint, organization, provider, providerQueryParams, providerScopes, redirectUri, state, }: SSOAuthorizationURLOptions): string;
    getConnection(id: string): Promise<Connection>;
    getProfileAndToken<CustomAttributesType extends UnknownRecord = UnknownRecord>({ code, clientId, }: GetProfileAndTokenOptions): Promise<ProfileAndToken<CustomAttributesType>>;
    getProfile<CustomAttributesType extends UnknownRecord = UnknownRecord>({ accessToken, }: GetProfileOptions): Promise<Profile<CustomAttributesType>>;
}
