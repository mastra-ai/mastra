import { type Agent } from "./_shims/index.js";
import * as Core from "./core.js";
import * as Errors from "./error.js";
import * as Pagination from "./pagination.js";
import { type CursorLimitPaginationParams, CursorLimitPaginationResponse, type CursorPaginationParams, CursorPaginationResponse, SinglePageResponse, type V4PagePaginationArrayParams, V4PagePaginationArrayResponse, type V4PagePaginationParams, V4PagePaginationResponse } from "./pagination.js";
import * as Uploads from "./uploads.js";
import * as API from "./resources/index.js";
import { AbuseReports } from "./resources/abuse-reports.js";
import { AuditLogs } from "./resources/audit-logs.js";
import { BotManagement } from "./resources/bot-management.js";
import { ClientCertificates } from "./resources/client-certificates.js";
import { CustomNameservers } from "./resources/custom-nameservers.js";
import { CustomPages } from "./resources/custom-pages.js";
import { DCVDelegation } from "./resources/dcv-delegation.js";
import { Filters } from "./resources/filters.js";
import { IPs } from "./resources/ips.js";
import { KeylessCertificates } from "./resources/keyless-certificates.js";
import { ManagedTransforms } from "./resources/managed-transforms.js";
import { Memberships } from "./resources/memberships.js";
import { OriginCACertificates } from "./resources/origin-ca-certificates.js";
import { OriginPostQuantumEncryption } from "./resources/origin-post-quantum-encryption.js";
import { PageRules } from "./resources/page-rules.js";
import { Pipelines } from "./resources/pipelines.js";
import { RateLimits } from "./resources/rate-limits.js";
import { SecurityTXT } from "./resources/security-txt.js";
import { URLNormalization } from "./resources/url-normalization.js";
import { Accounts } from "./resources/accounts/accounts.js";
import { ACM } from "./resources/acm/acm.js";
import { Addressing } from "./resources/addressing/addressing.js";
import { AIGateway } from "./resources/ai-gateway/ai-gateway.js";
import { AI } from "./resources/ai/ai.js";
import { Alerting } from "./resources/alerting/alerting.js";
import { APIGateway } from "./resources/api-gateway/api-gateway.js";
import { Argo } from "./resources/argo/argo.js";
import { Billing } from "./resources/billing/billing.js";
import { BotnetFeed } from "./resources/botnet-feed/botnet-feed.js";
import { BrandProtection } from "./resources/brand-protection/brand-protection.js";
import { BrowserRendering } from "./resources/browser-rendering/browser-rendering.js";
import { Cache } from "./resources/cache/cache.js";
import { Calls } from "./resources/calls/calls.js";
import { CertificateAuthorities } from "./resources/certificate-authorities/certificate-authorities.js";
import { CloudConnector } from "./resources/cloud-connector/cloud-connector.js";
import { CloudforceOne } from "./resources/cloudforce-one/cloudforce-one.js";
import { ContentScanning } from "./resources/content-scanning/content-scanning.js";
import { CustomCertificates } from "./resources/custom-certificates/custom-certificates.js";
import { CustomHostnames } from "./resources/custom-hostnames/custom-hostnames.js";
import { D1Resource } from "./resources/d1/d1.js";
import { Diagnostics } from "./resources/diagnostics/diagnostics.js";
import { DNSFirewall } from "./resources/dns-firewall/dns-firewall.js";
import { DNS } from "./resources/dns/dns.js";
import { DurableObjects } from "./resources/durable-objects/durable-objects.js";
import { EmailRouting } from "./resources/email-routing/email-routing.js";
import { EmailSecurity } from "./resources/email-security/email-security.js";
import { Firewall } from "./resources/firewall/firewall.js";
import { Healthchecks } from "./resources/healthchecks/healthchecks.js";
import { Hostnames } from "./resources/hostnames/hostnames.js";
import { HyperdriveResource } from "./resources/hyperdrive/hyperdrive.js";
import { IAM } from "./resources/iam/iam.js";
import { Images } from "./resources/images/images.js";
import { Intel } from "./resources/intel/intel.js";
import { KV } from "./resources/kv/kv.js";
import { LeakedCredentialChecks } from "./resources/leaked-credential-checks/leaked-credential-checks.js";
import { LoadBalancers } from "./resources/load-balancers/load-balancers.js";
import { Logpush } from "./resources/logpush/logpush.js";
import { Logs } from "./resources/logs/logs.js";
import { MagicCloudNetworking } from "./resources/magic-cloud-networking/magic-cloud-networking.js";
import { MagicNetworkMonitoring } from "./resources/magic-network-monitoring/magic-network-monitoring.js";
import { MagicTransit } from "./resources/magic-transit/magic-transit.js";
import { MTLSCertificates } from "./resources/mtls-certificates/mtls-certificates.js";
import { NetworkInterconnects } from "./resources/network-interconnects/network-interconnects.js";
import { OriginTLSClientAuth } from "./resources/origin-tls-client-auth/origin-tls-client-auth.js";
import { PageShield } from "./resources/page-shield/page-shield.js";
import { Pages } from "./resources/pages/pages.js";
import { Queues } from "./resources/queues/queues.js";
import { R2 } from "./resources/r2/r2.js";
import { Radar } from "./resources/radar/radar.js";
import { Registrar } from "./resources/registrar/registrar.js";
import { RequestTracers } from "./resources/request-tracers/request-tracers.js";
import { ResourceSharing } from "./resources/resource-sharing/resource-sharing.js";
import { Rules } from "./resources/rules/rules.js";
import { Rulesets } from "./resources/rulesets/rulesets.js";
import { RUM } from "./resources/rum/rum.js";
import { SchemaValidation } from "./resources/schema-validation/schema-validation.js";
import { SecretsStore } from "./resources/secrets-store/secrets-store.js";
import { SecurityCenter } from "./resources/security-center/security-center.js";
import { Snippets } from "./resources/snippets/snippets.js";
import { Spectrum } from "./resources/spectrum/spectrum.js";
import { Speed } from "./resources/speed/speed.js";
import { SSL } from "./resources/ssl/ssl.js";
import { Stream } from "./resources/stream/stream.js";
import { Turnstile } from "./resources/turnstile/turnstile.js";
import { URLScanner } from "./resources/url-scanner/url-scanner.js";
import { User } from "./resources/user/user.js";
import { Vectorize } from "./resources/vectorize/vectorize.js";
import { WaitingRooms } from "./resources/waiting-rooms/waiting-rooms.js";
import { Web3 } from "./resources/web3/web3.js";
import { WorkersForPlatforms } from "./resources/workers-for-platforms/workers-for-platforms.js";
import { Workers } from "./resources/workers/workers.js";
import { Workflows } from "./resources/workflows/workflows.js";
import { Zaraz } from "./resources/zaraz/zaraz.js";
import { ZeroTrust } from "./resources/zero-trust/zero-trust.js";
import { Zones } from "./resources/zones/zones.js";
export interface ClientOptions {
    /**
     * The preferred authorization scheme for interacting with the Cloudflare API. [Create a token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/).
     */
    apiToken?: string | null | undefined;
    /**
     * The previous authorization scheme for interacting with the Cloudflare API. When possible, use API tokens instead of Global API keys.
     */
    apiKey?: string | null | undefined;
    /**
     * The previous authorization scheme for interacting with the Cloudflare API, used in conjunction with a Global API key.
     */
    apiEmail?: string | null | undefined;
    /**
     * Used when interacting with the Origin CA certificates API. [View/change your key](https://developers.cloudflare.com/fundamentals/api/get-started/ca-keys/#viewchange-your-origin-ca-keys).
     */
    userServiceKey?: string | null | undefined;
    /**
     * Override the default base URL for the API, e.g., "https://api.example.com/v2/"
     *
     * Defaults to process.env['CLOUDFLARE_BASE_URL'].
     */
    baseURL?: string | null | undefined;
    /**
     * Define the API version to target for the requests, e.g., "2025-01-01"
     */
    apiVersion?: string | null;
    /**
     * The maximum amount of time (in milliseconds) that the client should wait for a response
     * from the server before timing out a single request.
     *
     * Note that request timeouts are retried by default, so in a worst-case scenario you may wait
     * much longer than this timeout before the promise succeeds or fails.
     *
     * @unit milliseconds
     */
    timeout?: number | undefined;
    /**
     * An HTTP agent used to manage HTTP(S) connections.
     *
     * If not provided, an agent will be constructed by default in the Node.js environment,
     * otherwise no agent is used.
     */
    httpAgent?: Agent | undefined;
    /**
     * Specify a custom `fetch` function implementation.
     *
     * If not provided, we use `node-fetch` on Node.js and otherwise expect that `fetch` is
     * defined globally.
     */
    fetch?: Core.Fetch | undefined;
    /**
     * The maximum number of times that the client will retry a request in case of a
     * temporary failure, like a network error or a 5XX error from the server.
     *
     * @default 2
     */
    maxRetries?: number | undefined;
    /**
     * Default headers to include with every request to the API.
     *
     * These can be removed in individual requests by explicitly setting the
     * header to `undefined` or `null` in request options.
     */
    defaultHeaders?: Core.Headers | undefined;
    /**
     * Default query parameters to include with every request to the API.
     *
     * These can be removed in individual requests by explicitly setting the
     * param to `undefined` in request options.
     */
    defaultQuery?: Core.DefaultQuery | undefined;
}
/**
 * API Client for interfacing with the Cloudflare API.
 */
export declare class Cloudflare extends Core.APIClient {
    #private;
    apiToken: string | null;
    apiKey: string | null;
    apiEmail: string | null;
    userServiceKey: string | null;
    private _options;
    /**
     * API Client for interfacing with the Cloudflare API.
     *
     * @param {string | null | undefined} [opts.apiToken=process.env['CLOUDFLARE_API_TOKEN'] ?? null]
     * @param {string | null | undefined} [opts.apiKey=process.env['CLOUDFLARE_API_KEY'] ?? null]
     * @param {string | null | undefined} [opts.apiEmail=process.env['CLOUDFLARE_EMAIL'] ?? null]
     * @param {string | null | undefined} [opts.userServiceKey=process.env['CLOUDFLARE_API_USER_SERVICE_KEY'] ?? null]
     * @param {string} [opts.baseURL=process.env['CLOUDFLARE_BASE_URL'] ?? https://api.cloudflare.com/client/v4] - Override the default base URL for the API.
     * @param {string | null} [opts.apiVersion] - Define the version to target for the API.
     * @param {number} [opts.timeout=1 minute] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
     * @param {number} [opts.httpAgent] - An HTTP agent used to manage HTTP(s) connections.
     * @param {Core.Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
     * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
     * @param {Core.Headers} opts.defaultHeaders - Default headers to include with every request to the API.
     * @param {Core.DefaultQuery} opts.defaultQuery - Default query parameters to include with every request to the API.
     */
    constructor({ baseURL, apiVersion, apiToken, apiKey, apiEmail, userServiceKey, ...opts }?: ClientOptions);
    accounts: API.Accounts;
    originCACertificates: API.OriginCACertificates;
    ips: API.IPs;
    memberships: API.Memberships;
    user: API.User;
    zones: API.Zones;
    loadBalancers: API.LoadBalancers;
    cache: API.Cache;
    ssl: API.SSL;
    acm: API.ACM;
    argo: API.Argo;
    certificateAuthorities: API.CertificateAuthorities;
    clientCertificates: API.ClientCertificates;
    customCertificates: API.CustomCertificates;
    customHostnames: API.CustomHostnames;
    customNameservers: API.CustomNameservers;
    dnsFirewall: API.DNSFirewall;
    dns: API.DNS;
    emailSecurity: API.EmailSecurity;
    emailRouting: API.EmailRouting;
    filters: API.Filters;
    firewall: API.Firewall;
    healthchecks: API.Healthchecks;
    keylessCertificates: API.KeylessCertificates;
    logpush: API.Logpush;
    logs: API.Logs;
    originTLSClientAuth: API.OriginTLSClientAuth;
    pageRules: API.PageRules;
    rateLimits: API.RateLimits;
    waitingRooms: API.WaitingRooms;
    web3: API.Web3;
    workers: API.Workers;
    kv: API.KV;
    durableObjects: API.DurableObjects;
    queues: API.Queues;
    apiGateway: API.APIGateway;
    managedTransforms: API.ManagedTransforms;
    pageShield: API.PageShield;
    rulesets: API.Rulesets;
    urlNormalization: API.URLNormalization;
    spectrum: API.Spectrum;
    addressing: API.Addressing;
    auditLogs: API.AuditLogs;
    billing: API.Billing;
    brandProtection: API.BrandProtection;
    diagnostics: API.Diagnostics;
    images: API.Images;
    intel: API.Intel;
    magicTransit: API.MagicTransit;
    magicNetworkMonitoring: API.MagicNetworkMonitoring;
    magicCloudNetworking: API.MagicCloudNetworking;
    networkInterconnects: API.NetworkInterconnects;
    mtlsCertificates: API.MTLSCertificates;
    pages: API.Pages;
    registrar: API.Registrar;
    requestTracers: API.RequestTracers;
    rules: API.Rules;
    stream: API.Stream;
    alerting: API.Alerting;
    d1: API.D1Resource;
    r2: API.R2;
    workersForPlatforms: API.WorkersForPlatforms;
    zeroTrust: API.ZeroTrust;
    turnstile: API.Turnstile;
    hyperdrive: API.HyperdriveResource;
    rum: API.RUM;
    vectorize: API.Vectorize;
    urlScanner: API.URLScanner;
    radar: API.Radar;
    botManagement: API.BotManagement;
    originPostQuantumEncryption: API.OriginPostQuantumEncryption;
    zaraz: API.Zaraz;
    speed: API.Speed;
    dcvDelegation: API.DCVDelegation;
    hostnames: API.Hostnames;
    snippets: API.Snippets;
    calls: API.Calls;
    cloudforceOne: API.CloudforceOne;
    aiGateway: API.AIGateway;
    iam: API.IAM;
    cloudConnector: API.CloudConnector;
    botnetFeed: API.BotnetFeed;
    securityTXT: API.SecurityTXT;
    workflows: API.Workflows;
    resourceSharing: API.ResourceSharing;
    leakedCredentialChecks: API.LeakedCredentialChecks;
    contentScanning: API.ContentScanning;
    abuseReports: API.AbuseReports;
    ai: API.AI;
    securityCenter: API.SecurityCenter;
    browserRendering: API.BrowserRendering;
    customPages: API.CustomPages;
    secretsStore: API.SecretsStore;
    pipelines: API.Pipelines;
    schemaValidation: API.SchemaValidation;
    protected defaultQuery(): Core.DefaultQuery | undefined;
    protected defaultHeaders(opts: Core.FinalRequestOptions): Core.Headers;
    protected validateHeaders(headers: Core.Headers, customHeaders: Core.Headers): void;
    protected authHeaders(opts: Core.FinalRequestOptions): Core.Headers;
    protected apiEmailAuth(opts: Core.FinalRequestOptions): Core.Headers;
    protected apiKeyAuth(opts: Core.FinalRequestOptions): Core.Headers;
    protected apiTokenAuth(opts: Core.FinalRequestOptions): Core.Headers;
    protected userServiceKeyAuth(opts: Core.FinalRequestOptions): Core.Headers;
    protected stringifyQuery(query: Record<string, unknown>): string;
    static Cloudflare: typeof Cloudflare;
    static DEFAULT_TIMEOUT: number;
    static CloudflareError: typeof Errors.CloudflareError;
    static APIError: typeof Errors.APIError;
    static APIConnectionError: typeof Errors.APIConnectionError;
    static APIConnectionTimeoutError: typeof Errors.APIConnectionTimeoutError;
    static APIUserAbortError: typeof Errors.APIUserAbortError;
    static NotFoundError: typeof Errors.NotFoundError;
    static ConflictError: typeof Errors.ConflictError;
    static RateLimitError: typeof Errors.RateLimitError;
    static BadRequestError: typeof Errors.BadRequestError;
    static AuthenticationError: typeof Errors.AuthenticationError;
    static InternalServerError: typeof Errors.InternalServerError;
    static PermissionDeniedError: typeof Errors.PermissionDeniedError;
    static UnprocessableEntityError: typeof Errors.UnprocessableEntityError;
    static toFile: typeof Uploads.toFile;
    static fileFromPath: typeof Uploads.fileFromPath;
}
export declare namespace Cloudflare {
    export type RequestOptions = Core.RequestOptions;
    export import V4PagePagination = Pagination.V4PagePagination;
    export { type V4PagePaginationParams as V4PagePaginationParams, type V4PagePaginationResponse as V4PagePaginationResponse, };
    export import V4PagePaginationArray = Pagination.V4PagePaginationArray;
    export { type V4PagePaginationArrayParams as V4PagePaginationArrayParams, type V4PagePaginationArrayResponse as V4PagePaginationArrayResponse, };
    export import CursorPagination = Pagination.CursorPagination;
    export { type CursorPaginationParams as CursorPaginationParams, type CursorPaginationResponse as CursorPaginationResponse, };
    export import CursorLimitPagination = Pagination.CursorLimitPagination;
    export { type CursorLimitPaginationParams as CursorLimitPaginationParams, type CursorLimitPaginationResponse as CursorLimitPaginationResponse, };
    export import SinglePage = Pagination.SinglePage;
    export { type SinglePageResponse as SinglePageResponse };
    export { Accounts as Accounts };
    export { OriginCACertificates as OriginCACertificates };
    export { IPs as IPs };
    export { Memberships as Memberships };
    export { User as User };
    export { Zones as Zones };
    export { LoadBalancers as LoadBalancers };
    export { Cache as Cache };
    export { SSL as SSL };
    export { ACM as ACM };
    export { Argo as Argo };
    export { CertificateAuthorities as CertificateAuthorities };
    export { ClientCertificates as ClientCertificates };
    export { CustomCertificates as CustomCertificates };
    export { CustomHostnames as CustomHostnames };
    export { CustomNameservers as CustomNameservers };
    export { DNSFirewall as DNSFirewall };
    export { DNS as DNS };
    export { EmailSecurity as EmailSecurity };
    export { EmailRouting as EmailRouting };
    export { Filters as Filters };
    export { Firewall as Firewall };
    export { Healthchecks as Healthchecks };
    export { KeylessCertificates as KeylessCertificates };
    export { Logpush as Logpush };
    export { Logs as Logs };
    export { OriginTLSClientAuth as OriginTLSClientAuth };
    export { PageRules as PageRules };
    export { RateLimits as RateLimits };
    export { WaitingRooms as WaitingRooms };
    export { Web3 as Web3 };
    export { Workers as Workers };
    export { KV as KV };
    export { DurableObjects as DurableObjects };
    export { Queues as Queues };
    export { APIGateway as APIGateway };
    export { ManagedTransforms as ManagedTransforms };
    export { PageShield as PageShield };
    export { Rulesets as Rulesets };
    export { URLNormalization as URLNormalization };
    export { Spectrum as Spectrum };
    export { Addressing as Addressing };
    export { AuditLogs as AuditLogs };
    export { Billing as Billing };
    export { BrandProtection as BrandProtection };
    export { Diagnostics as Diagnostics };
    export { Images as Images };
    export { Intel as Intel };
    export { MagicTransit as MagicTransit };
    export { MagicNetworkMonitoring as MagicNetworkMonitoring };
    export { MagicCloudNetworking as MagicCloudNetworking };
    export { NetworkInterconnects as NetworkInterconnects };
    export { MTLSCertificates as MTLSCertificates };
    export { Pages as Pages };
    export { Registrar as Registrar };
    export { RequestTracers as RequestTracers };
    export { Rules as Rules };
    export { Stream as Stream };
    export { Alerting as Alerting };
    export { D1Resource as D1Resource };
    export { R2 as R2 };
    export { WorkersForPlatforms as WorkersForPlatforms };
    export { ZeroTrust as ZeroTrust };
    export { Turnstile as Turnstile };
    export { HyperdriveResource as HyperdriveResource };
    export { RUM as RUM };
    export { Vectorize as Vectorize };
    export { URLScanner as URLScanner };
    export { Radar as Radar };
    export { BotManagement as BotManagement };
    export { OriginPostQuantumEncryption as OriginPostQuantumEncryption };
    export { Zaraz as Zaraz };
    export { Speed as Speed };
    export { DCVDelegation as DCVDelegation };
    export { Hostnames as Hostnames };
    export { Snippets as Snippets };
    export { Calls as Calls };
    export { CloudforceOne as CloudforceOne };
    export { AIGateway as AIGateway };
    export { IAM as IAM };
    export { CloudConnector as CloudConnector };
    export { BotnetFeed as BotnetFeed };
    export { SecurityTXT as SecurityTXT };
    export { Workflows as Workflows };
    export { ResourceSharing as ResourceSharing };
    export { LeakedCredentialChecks as LeakedCredentialChecks };
    export { ContentScanning as ContentScanning };
    export { AbuseReports as AbuseReports };
    export { AI as AI };
    export { SecurityCenter as SecurityCenter };
    export { BrowserRendering as BrowserRendering };
    export { CustomPages as CustomPages };
    export { SecretsStore as SecretsStore };
    export { Pipelines as Pipelines };
    export { SchemaValidation as SchemaValidation };
    export type ASN = API.ASN;
    export type AuditLog = API.AuditLog;
    export type CertificateCA = API.CertificateCA;
    export type CertificateRequestType = API.CertificateRequestType;
    export type CloudflareTunnel = API.CloudflareTunnel;
    export type ErrorData = API.ErrorData;
    export type Identifier = API.Identifier;
    export type LoadBalancerPreview = API.LoadBalancerPreview;
    export type Member = API.Member;
    export type PaginationInfo = API.PaginationInfo;
    export type Permission = API.Permission;
    export type PermissionGrant = API.PermissionGrant;
    export type RatePlan = API.RatePlan;
    export type ResponseInfo = API.ResponseInfo;
    export type Result = API.Result;
    export type Role = API.Role;
    export type SortDirection = API.SortDirection;
    export type Subscription = API.Subscription;
    export type SubscriptionComponent = API.SubscriptionComponent;
    export type SubscriptionZone = API.SubscriptionZone;
    export type Token = API.Token;
    export type TokenConditionCIDRList = API.TokenConditionCIDRList;
    export type TokenPolicy = API.TokenPolicy;
    export type TokenValue = API.TokenValue;
}
export { toFile, fileFromPath } from "./uploads.js";
export { CloudflareError, APIError, APIConnectionError, APIConnectionTimeoutError, APIUserAbortError, NotFoundError, ConflictError, RateLimitError, BadRequestError, AuthenticationError, InternalServerError, PermissionDeniedError, UnprocessableEntityError, } from "./error.js";
export default Cloudflare;
//# sourceMappingURL=index.d.ts.map