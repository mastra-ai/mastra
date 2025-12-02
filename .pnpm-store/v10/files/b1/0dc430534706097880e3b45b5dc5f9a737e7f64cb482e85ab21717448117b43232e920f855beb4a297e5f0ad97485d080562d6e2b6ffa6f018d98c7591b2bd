import { APIResource } from "../../../resource.js";
import * as BookmarksAPI from "./bookmarks.js";
import { Bookmark, BookmarkCreateParams, BookmarkDeleteParams, BookmarkDeleteResponse, BookmarkGetParams, BookmarkListParams, BookmarkUpdateParams, Bookmarks, BookmarksSinglePage } from "./bookmarks.js";
import * as CustomPagesAPI from "./custom-pages.js";
import { CustomPage, CustomPageCreateParams, CustomPageDeleteParams, CustomPageDeleteResponse, CustomPageGetParams, CustomPageListParams, CustomPageUpdateParams, CustomPageWithoutHTML, CustomPageWithoutHTMLsSinglePage, CustomPages } from "./custom-pages.js";
import * as GatewayCAAPI from "./gateway-ca.js";
import { GatewayCA, GatewayCACreateParams, GatewayCACreateResponse, GatewayCADeleteParams, GatewayCADeleteResponse, GatewayCAListParams, GatewayCAListResponse, GatewayCAListResponsesSinglePage } from "./gateway-ca.js";
import * as GroupsAPI from "./groups.js";
import { GroupCreateParams, GroupCreateResponse, GroupDeleteParams, GroupDeleteResponse, GroupGetParams, GroupGetResponse, GroupListParams, GroupListResponse, GroupListResponsesSinglePage, GroupUpdateParams, GroupUpdateResponse, Groups, ZeroTrustGroup } from "./groups.js";
import * as KeysAPI from "./keys.js";
import { KeyGetParams, KeyGetResponse, KeyRotateParams, KeyRotateResponse, KeyUpdateParams, KeyUpdateResponse, Keys } from "./keys.js";
import * as PoliciesAPI from "./policies.js";
import { ApprovalGroup, Policies, Policy, PolicyCreateParams, PolicyCreateResponse, PolicyDeleteParams, PolicyDeleteResponse, PolicyGetParams, PolicyGetResponse, PolicyListParams, PolicyListResponse, PolicyListResponsesSinglePage, PolicyUpdateParams, PolicyUpdateResponse } from "./policies.js";
import * as ServiceTokensAPI from "./service-tokens.js";
import { ServiceToken, ServiceTokenCreateParams, ServiceTokenCreateResponse, ServiceTokenDeleteParams, ServiceTokenGetParams, ServiceTokenListParams, ServiceTokenRefreshParams, ServiceTokenRotateParams, ServiceTokenRotateResponse, ServiceTokenUpdateParams, ServiceTokens, ServiceTokensSinglePage } from "./service-tokens.js";
import * as TagsAPI from "./tags.js";
import { Tag, TagCreateParams, TagDeleteParams, TagDeleteResponse, TagGetParams, TagListParams, TagUpdateParams, Tags, TagsSinglePage } from "./tags.js";
import * as ApplicationsAPI from "./applications/applications.js";
import { AllowedHeaders, AllowedIdPs, AllowedMethods, AllowedOrigins, AppID, Application, ApplicationCreateParams, ApplicationCreateResponse, ApplicationDeleteParams, ApplicationDeleteResponse, ApplicationGetParams, ApplicationGetResponse, ApplicationListParams, ApplicationListResponse, ApplicationListResponsesSinglePage, ApplicationPolicy, ApplicationRevokeTokensParams, ApplicationRevokeTokensResponse, ApplicationSCIMConfig, ApplicationType, ApplicationUpdateParams, ApplicationUpdateResponse, Applications, CORSHeaders, Decision, OIDCSaaSApp, SAMLSaaSApp, SCIMConfigAuthenticationHTTPBasic, SCIMConfigAuthenticationOAuthBearerToken, SCIMConfigAuthenticationOauth2, SCIMConfigMapping, SaaSAppNameIDFormat, SelfHostedDomains } from "./applications/applications.js";
import * as CertificatesAPI from "./certificates/certificates.js";
import { AssociatedHostnames, Certificate, CertificateCreateParams, CertificateDeleteParams, CertificateDeleteResponse, CertificateGetParams, CertificateListParams, CertificateUpdateParams, Certificates, CertificatesSinglePage } from "./certificates/certificates.js";
import * as InfrastructureAPI from "./infrastructure/infrastructure.js";
import { Infrastructure } from "./infrastructure/infrastructure.js";
import * as LogsAPI from "./logs/logs.js";
import { Logs } from "./logs/logs.js";
import * as UsersAPI from "./users/users.js";
import { AccessUser, UserListParams, UserListResponse, UserListResponsesSinglePage, Users } from "./users/users.js";
export declare class Access extends APIResource {
    gatewayCA: GatewayCAAPI.GatewayCA;
    infrastructure: InfrastructureAPI.Infrastructure;
    applications: ApplicationsAPI.Applications;
    certificates: CertificatesAPI.Certificates;
    groups: GroupsAPI.Groups;
    serviceTokens: ServiceTokensAPI.ServiceTokens;
    bookmarks: BookmarksAPI.Bookmarks;
    keys: KeysAPI.Keys;
    logs: LogsAPI.Logs;
    users: UsersAPI.Users;
    customPages: CustomPagesAPI.CustomPages;
    tags: TagsAPI.Tags;
    policies: PoliciesAPI.Policies;
}
export declare namespace Access {
    export { GatewayCA as GatewayCA, type GatewayCACreateResponse as GatewayCACreateResponse, type GatewayCAListResponse as GatewayCAListResponse, type GatewayCADeleteResponse as GatewayCADeleteResponse, GatewayCAListResponsesSinglePage as GatewayCAListResponsesSinglePage, type GatewayCACreateParams as GatewayCACreateParams, type GatewayCAListParams as GatewayCAListParams, type GatewayCADeleteParams as GatewayCADeleteParams, };
    export { Infrastructure as Infrastructure };
    export { Applications as Applications, type AllowedHeaders as AllowedHeaders, type AllowedIdPs as AllowedIdPs, type AllowedMethods as AllowedMethods, type AllowedOrigins as AllowedOrigins, type AppID as AppID, type Application as Application, type ApplicationPolicy as ApplicationPolicy, type ApplicationSCIMConfig as ApplicationSCIMConfig, type ApplicationType as ApplicationType, type CORSHeaders as CORSHeaders, type Decision as Decision, type OIDCSaaSApp as OIDCSaaSApp, type SaaSAppNameIDFormat as SaaSAppNameIDFormat, type SAMLSaaSApp as SAMLSaaSApp, type SCIMConfigAuthenticationHTTPBasic as SCIMConfigAuthenticationHTTPBasic, type SCIMConfigAuthenticationOAuthBearerToken as SCIMConfigAuthenticationOAuthBearerToken, type SCIMConfigAuthenticationOauth2 as SCIMConfigAuthenticationOauth2, type SCIMConfigMapping as SCIMConfigMapping, type SelfHostedDomains as SelfHostedDomains, type ApplicationCreateResponse as ApplicationCreateResponse, type ApplicationUpdateResponse as ApplicationUpdateResponse, type ApplicationListResponse as ApplicationListResponse, type ApplicationDeleteResponse as ApplicationDeleteResponse, type ApplicationGetResponse as ApplicationGetResponse, type ApplicationRevokeTokensResponse as ApplicationRevokeTokensResponse, ApplicationListResponsesSinglePage as ApplicationListResponsesSinglePage, type ApplicationCreateParams as ApplicationCreateParams, type ApplicationUpdateParams as ApplicationUpdateParams, type ApplicationListParams as ApplicationListParams, type ApplicationDeleteParams as ApplicationDeleteParams, type ApplicationGetParams as ApplicationGetParams, type ApplicationRevokeTokensParams as ApplicationRevokeTokensParams, };
    export { Certificates as Certificates, type AssociatedHostnames as AssociatedHostnames, type Certificate as Certificate, type CertificateDeleteResponse as CertificateDeleteResponse, CertificatesSinglePage as CertificatesSinglePage, type CertificateCreateParams as CertificateCreateParams, type CertificateUpdateParams as CertificateUpdateParams, type CertificateListParams as CertificateListParams, type CertificateDeleteParams as CertificateDeleteParams, type CertificateGetParams as CertificateGetParams, };
    export { Groups as Groups, type ZeroTrustGroup as ZeroTrustGroup, type GroupCreateResponse as GroupCreateResponse, type GroupUpdateResponse as GroupUpdateResponse, type GroupListResponse as GroupListResponse, type GroupDeleteResponse as GroupDeleteResponse, type GroupGetResponse as GroupGetResponse, GroupListResponsesSinglePage as GroupListResponsesSinglePage, type GroupCreateParams as GroupCreateParams, type GroupUpdateParams as GroupUpdateParams, type GroupListParams as GroupListParams, type GroupDeleteParams as GroupDeleteParams, type GroupGetParams as GroupGetParams, };
    export { ServiceTokens as ServiceTokens, type ServiceToken as ServiceToken, type ServiceTokenCreateResponse as ServiceTokenCreateResponse, type ServiceTokenRotateResponse as ServiceTokenRotateResponse, ServiceTokensSinglePage as ServiceTokensSinglePage, type ServiceTokenCreateParams as ServiceTokenCreateParams, type ServiceTokenUpdateParams as ServiceTokenUpdateParams, type ServiceTokenListParams as ServiceTokenListParams, type ServiceTokenDeleteParams as ServiceTokenDeleteParams, type ServiceTokenGetParams as ServiceTokenGetParams, type ServiceTokenRefreshParams as ServiceTokenRefreshParams, type ServiceTokenRotateParams as ServiceTokenRotateParams, };
    export { Bookmarks as Bookmarks, type Bookmark as Bookmark, type BookmarkDeleteResponse as BookmarkDeleteResponse, BookmarksSinglePage as BookmarksSinglePage, type BookmarkCreateParams as BookmarkCreateParams, type BookmarkUpdateParams as BookmarkUpdateParams, type BookmarkListParams as BookmarkListParams, type BookmarkDeleteParams as BookmarkDeleteParams, type BookmarkGetParams as BookmarkGetParams, };
    export { Keys as Keys, type KeyUpdateResponse as KeyUpdateResponse, type KeyGetResponse as KeyGetResponse, type KeyRotateResponse as KeyRotateResponse, type KeyUpdateParams as KeyUpdateParams, type KeyGetParams as KeyGetParams, type KeyRotateParams as KeyRotateParams, };
    export { Logs as Logs };
    export { Users as Users, type AccessUser as AccessUser, type UserListResponse as UserListResponse, UserListResponsesSinglePage as UserListResponsesSinglePage, type UserListParams as UserListParams, };
    export { CustomPages as CustomPages, type CustomPage as CustomPage, type CustomPageWithoutHTML as CustomPageWithoutHTML, type CustomPageDeleteResponse as CustomPageDeleteResponse, CustomPageWithoutHTMLsSinglePage as CustomPageWithoutHTMLsSinglePage, type CustomPageCreateParams as CustomPageCreateParams, type CustomPageUpdateParams as CustomPageUpdateParams, type CustomPageListParams as CustomPageListParams, type CustomPageDeleteParams as CustomPageDeleteParams, type CustomPageGetParams as CustomPageGetParams, };
    export { Tags as Tags, type Tag as Tag, type TagDeleteResponse as TagDeleteResponse, TagsSinglePage as TagsSinglePage, type TagCreateParams as TagCreateParams, type TagUpdateParams as TagUpdateParams, type TagListParams as TagListParams, type TagDeleteParams as TagDeleteParams, type TagGetParams as TagGetParams, };
    export { Policies as Policies, type ApprovalGroup as ApprovalGroup, type Policy as Policy, type PolicyCreateResponse as PolicyCreateResponse, type PolicyUpdateResponse as PolicyUpdateResponse, type PolicyListResponse as PolicyListResponse, type PolicyDeleteResponse as PolicyDeleteResponse, type PolicyGetResponse as PolicyGetResponse, PolicyListResponsesSinglePage as PolicyListResponsesSinglePage, type PolicyCreateParams as PolicyCreateParams, type PolicyUpdateParams as PolicyUpdateParams, type PolicyListParams as PolicyListParams, type PolicyDeleteParams as PolicyDeleteParams, type PolicyGetParams as PolicyGetParams, };
}
//# sourceMappingURL=access.d.ts.map