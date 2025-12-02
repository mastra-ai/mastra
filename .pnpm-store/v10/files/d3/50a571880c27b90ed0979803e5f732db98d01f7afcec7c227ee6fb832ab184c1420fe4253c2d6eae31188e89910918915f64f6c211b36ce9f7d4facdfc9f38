// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var _Cloudflare_instances, _a, _Cloudflare_baseURLOverridden;
import * as qs from "./internal/qs/index.mjs";
import * as Core from "./core.mjs";
import * as Errors from "./error.mjs";
import * as Pagination from "./pagination.mjs";
import * as Uploads from "./uploads.mjs";
import * as API from "./resources/index.mjs";
import { AbuseReports } from "./resources/abuse-reports.mjs";
import { AuditLogs } from "./resources/audit-logs.mjs";
import { BotManagement } from "./resources/bot-management.mjs";
import { ClientCertificates } from "./resources/client-certificates.mjs";
import { CustomNameservers } from "./resources/custom-nameservers.mjs";
import { CustomPages } from "./resources/custom-pages.mjs";
import { DCVDelegation } from "./resources/dcv-delegation.mjs";
import { Filters } from "./resources/filters.mjs";
import { IPs } from "./resources/ips.mjs";
import { KeylessCertificates } from "./resources/keyless-certificates.mjs";
import { ManagedTransforms } from "./resources/managed-transforms.mjs";
import { Memberships } from "./resources/memberships.mjs";
import { OriginCACertificates } from "./resources/origin-ca-certificates.mjs";
import { OriginPostQuantumEncryption } from "./resources/origin-post-quantum-encryption.mjs";
import { PageRules } from "./resources/page-rules.mjs";
import { Pipelines } from "./resources/pipelines.mjs";
import { RateLimits } from "./resources/rate-limits.mjs";
import { SecurityTXT } from "./resources/security-txt.mjs";
import { URLNormalization } from "./resources/url-normalization.mjs";
import { Accounts } from "./resources/accounts/accounts.mjs";
import { ACM } from "./resources/acm/acm.mjs";
import { Addressing } from "./resources/addressing/addressing.mjs";
import { AIGateway } from "./resources/ai-gateway/ai-gateway.mjs";
import { AI } from "./resources/ai/ai.mjs";
import { Alerting } from "./resources/alerting/alerting.mjs";
import { APIGateway } from "./resources/api-gateway/api-gateway.mjs";
import { Argo } from "./resources/argo/argo.mjs";
import { Billing } from "./resources/billing/billing.mjs";
import { BotnetFeed } from "./resources/botnet-feed/botnet-feed.mjs";
import { BrandProtection } from "./resources/brand-protection/brand-protection.mjs";
import { BrowserRendering } from "./resources/browser-rendering/browser-rendering.mjs";
import { Cache } from "./resources/cache/cache.mjs";
import { Calls } from "./resources/calls/calls.mjs";
import { CertificateAuthorities } from "./resources/certificate-authorities/certificate-authorities.mjs";
import { CloudConnector } from "./resources/cloud-connector/cloud-connector.mjs";
import { CloudforceOne } from "./resources/cloudforce-one/cloudforce-one.mjs";
import { ContentScanning } from "./resources/content-scanning/content-scanning.mjs";
import { CustomCertificates } from "./resources/custom-certificates/custom-certificates.mjs";
import { CustomHostnames } from "./resources/custom-hostnames/custom-hostnames.mjs";
import { D1Resource } from "./resources/d1/d1.mjs";
import { Diagnostics } from "./resources/diagnostics/diagnostics.mjs";
import { DNSFirewall } from "./resources/dns-firewall/dns-firewall.mjs";
import { DNS } from "./resources/dns/dns.mjs";
import { DurableObjects } from "./resources/durable-objects/durable-objects.mjs";
import { EmailRouting } from "./resources/email-routing/email-routing.mjs";
import { EmailSecurity } from "./resources/email-security/email-security.mjs";
import { Firewall } from "./resources/firewall/firewall.mjs";
import { Healthchecks } from "./resources/healthchecks/healthchecks.mjs";
import { Hostnames } from "./resources/hostnames/hostnames.mjs";
import { HyperdriveResource } from "./resources/hyperdrive/hyperdrive.mjs";
import { IAM } from "./resources/iam/iam.mjs";
import { Images } from "./resources/images/images.mjs";
import { Intel } from "./resources/intel/intel.mjs";
import { KV } from "./resources/kv/kv.mjs";
import { LeakedCredentialChecks } from "./resources/leaked-credential-checks/leaked-credential-checks.mjs";
import { LoadBalancers } from "./resources/load-balancers/load-balancers.mjs";
import { Logpush } from "./resources/logpush/logpush.mjs";
import { Logs } from "./resources/logs/logs.mjs";
import { MagicCloudNetworking } from "./resources/magic-cloud-networking/magic-cloud-networking.mjs";
import { MagicNetworkMonitoring } from "./resources/magic-network-monitoring/magic-network-monitoring.mjs";
import { MagicTransit } from "./resources/magic-transit/magic-transit.mjs";
import { MTLSCertificates } from "./resources/mtls-certificates/mtls-certificates.mjs";
import { NetworkInterconnects } from "./resources/network-interconnects/network-interconnects.mjs";
import { OriginTLSClientAuth } from "./resources/origin-tls-client-auth/origin-tls-client-auth.mjs";
import { PageShield } from "./resources/page-shield/page-shield.mjs";
import { Pages } from "./resources/pages/pages.mjs";
import { Queues } from "./resources/queues/queues.mjs";
import { R2 } from "./resources/r2/r2.mjs";
import { Radar } from "./resources/radar/radar.mjs";
import { Registrar } from "./resources/registrar/registrar.mjs";
import { RequestTracers } from "./resources/request-tracers/request-tracers.mjs";
import { ResourceSharing } from "./resources/resource-sharing/resource-sharing.mjs";
import { Rules } from "./resources/rules/rules.mjs";
import { Rulesets } from "./resources/rulesets/rulesets.mjs";
import { RUM } from "./resources/rum/rum.mjs";
import { SchemaValidation } from "./resources/schema-validation/schema-validation.mjs";
import { SecretsStore } from "./resources/secrets-store/secrets-store.mjs";
import { SecurityCenter } from "./resources/security-center/security-center.mjs";
import { Snippets } from "./resources/snippets/snippets.mjs";
import { Spectrum } from "./resources/spectrum/spectrum.mjs";
import { Speed } from "./resources/speed/speed.mjs";
import { SSL } from "./resources/ssl/ssl.mjs";
import { Stream } from "./resources/stream/stream.mjs";
import { Turnstile } from "./resources/turnstile/turnstile.mjs";
import { URLScanner } from "./resources/url-scanner/url-scanner.mjs";
import { User } from "./resources/user/user.mjs";
import { Vectorize } from "./resources/vectorize/vectorize.mjs";
import { WaitingRooms } from "./resources/waiting-rooms/waiting-rooms.mjs";
import { Web3 } from "./resources/web3/web3.mjs";
import { WorkersForPlatforms } from "./resources/workers-for-platforms/workers-for-platforms.mjs";
import { Workers } from "./resources/workers/workers.mjs";
import { Workflows } from "./resources/workflows/workflows.mjs";
import { Zaraz } from "./resources/zaraz/zaraz.mjs";
import { ZeroTrust } from "./resources/zero-trust/zero-trust.mjs";
import { Zones } from "./resources/zones/zones.mjs";
/**
 * API Client for interfacing with the Cloudflare API.
 */
export class Cloudflare extends Core.APIClient {
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
    constructor({ baseURL = Core.readEnv('CLOUDFLARE_BASE_URL'), apiVersion = null, apiToken = Core.readEnv('CLOUDFLARE_API_TOKEN') ?? null, apiKey = Core.readEnv('CLOUDFLARE_API_KEY') ?? null, apiEmail = Core.readEnv('CLOUDFLARE_EMAIL') ?? null, userServiceKey = Core.readEnv('CLOUDFLARE_API_USER_SERVICE_KEY') ?? null, ...opts } = {}) {
        const options = {
            apiToken,
            apiKey,
            apiEmail,
            userServiceKey,
            ...opts,
            baseURL: baseURL || `https://api.cloudflare.com/client/v4`,
            apiVersion: apiVersion || new Date().toISOString().slice(0, 10),
        };
        super({
            baseURL: options.baseURL,
            apiVersion: options.apiVersion,
            baseURLOverridden: baseURL ? baseURL !== 'https://api.cloudflare.com/client/v4' : false,
            timeout: options.timeout ?? 60000 /* 1 minute */,
            httpAgent: options.httpAgent,
            maxRetries: options.maxRetries,
            fetch: options.fetch,
        });
        _Cloudflare_instances.add(this);
        this.accounts = new API.Accounts(this);
        this.originCACertificates = new API.OriginCACertificates(this);
        this.ips = new API.IPs(this);
        this.memberships = new API.Memberships(this);
        this.user = new API.User(this);
        this.zones = new API.Zones(this);
        this.loadBalancers = new API.LoadBalancers(this);
        this.cache = new API.Cache(this);
        this.ssl = new API.SSL(this);
        this.acm = new API.ACM(this);
        this.argo = new API.Argo(this);
        this.certificateAuthorities = new API.CertificateAuthorities(this);
        this.clientCertificates = new API.ClientCertificates(this);
        this.customCertificates = new API.CustomCertificates(this);
        this.customHostnames = new API.CustomHostnames(this);
        this.customNameservers = new API.CustomNameservers(this);
        this.dnsFirewall = new API.DNSFirewall(this);
        this.dns = new API.DNS(this);
        this.emailSecurity = new API.EmailSecurity(this);
        this.emailRouting = new API.EmailRouting(this);
        this.filters = new API.Filters(this);
        this.firewall = new API.Firewall(this);
        this.healthchecks = new API.Healthchecks(this);
        this.keylessCertificates = new API.KeylessCertificates(this);
        this.logpush = new API.Logpush(this);
        this.logs = new API.Logs(this);
        this.originTLSClientAuth = new API.OriginTLSClientAuth(this);
        this.pageRules = new API.PageRules(this);
        this.rateLimits = new API.RateLimits(this);
        this.waitingRooms = new API.WaitingRooms(this);
        this.web3 = new API.Web3(this);
        this.workers = new API.Workers(this);
        this.kv = new API.KV(this);
        this.durableObjects = new API.DurableObjects(this);
        this.queues = new API.Queues(this);
        this.apiGateway = new API.APIGateway(this);
        this.managedTransforms = new API.ManagedTransforms(this);
        this.pageShield = new API.PageShield(this);
        this.rulesets = new API.Rulesets(this);
        this.urlNormalization = new API.URLNormalization(this);
        this.spectrum = new API.Spectrum(this);
        this.addressing = new API.Addressing(this);
        this.auditLogs = new API.AuditLogs(this);
        this.billing = new API.Billing(this);
        this.brandProtection = new API.BrandProtection(this);
        this.diagnostics = new API.Diagnostics(this);
        this.images = new API.Images(this);
        this.intel = new API.Intel(this);
        this.magicTransit = new API.MagicTransit(this);
        this.magicNetworkMonitoring = new API.MagicNetworkMonitoring(this);
        this.magicCloudNetworking = new API.MagicCloudNetworking(this);
        this.networkInterconnects = new API.NetworkInterconnects(this);
        this.mtlsCertificates = new API.MTLSCertificates(this);
        this.pages = new API.Pages(this);
        this.registrar = new API.Registrar(this);
        this.requestTracers = new API.RequestTracers(this);
        this.rules = new API.Rules(this);
        this.stream = new API.Stream(this);
        this.alerting = new API.Alerting(this);
        this.d1 = new API.D1Resource(this);
        this.r2 = new API.R2(this);
        this.workersForPlatforms = new API.WorkersForPlatforms(this);
        this.zeroTrust = new API.ZeroTrust(this);
        this.turnstile = new API.Turnstile(this);
        this.hyperdrive = new API.HyperdriveResource(this);
        this.rum = new API.RUM(this);
        this.vectorize = new API.Vectorize(this);
        this.urlScanner = new API.URLScanner(this);
        this.radar = new API.Radar(this);
        this.botManagement = new API.BotManagement(this);
        this.originPostQuantumEncryption = new API.OriginPostQuantumEncryption(this);
        this.zaraz = new API.Zaraz(this);
        this.speed = new API.Speed(this);
        this.dcvDelegation = new API.DCVDelegation(this);
        this.hostnames = new API.Hostnames(this);
        this.snippets = new API.Snippets(this);
        this.calls = new API.Calls(this);
        this.cloudforceOne = new API.CloudforceOne(this);
        this.aiGateway = new API.AIGateway(this);
        this.iam = new API.IAM(this);
        this.cloudConnector = new API.CloudConnector(this);
        this.botnetFeed = new API.BotnetFeed(this);
        this.securityTXT = new API.SecurityTXT(this);
        this.workflows = new API.Workflows(this);
        this.resourceSharing = new API.ResourceSharing(this);
        this.leakedCredentialChecks = new API.LeakedCredentialChecks(this);
        this.contentScanning = new API.ContentScanning(this);
        this.abuseReports = new API.AbuseReports(this);
        this.ai = new API.AI(this);
        this.securityCenter = new API.SecurityCenter(this);
        this.browserRendering = new API.BrowserRendering(this);
        this.customPages = new API.CustomPages(this);
        this.secretsStore = new API.SecretsStore(this);
        this.pipelines = new API.Pipelines(this);
        this.schemaValidation = new API.SchemaValidation(this);
        this._options = options;
        this.apiToken = apiToken;
        this.apiKey = apiKey;
        this.apiEmail = apiEmail;
        this.userServiceKey = userServiceKey;
    }
    defaultQuery() {
        return this._options.defaultQuery;
    }
    defaultHeaders(opts) {
        return {
            ...super.defaultHeaders(opts),
            'X-Auth-Key': this.apiKey,
            'X-Auth-Email': this.apiEmail,
            ...this._options.defaultHeaders,
        };
    }
    validateHeaders(headers, customHeaders) {
        if (this.apiEmail && headers['x-auth-email']) {
            return;
        }
        if (customHeaders['x-auth-email'] === null) {
            return;
        }
        if (this.apiKey && headers['x-auth-key']) {
            return;
        }
        if (customHeaders['x-auth-key'] === null) {
            return;
        }
        if (this.apiToken && headers['authorization']) {
            return;
        }
        if (customHeaders['authorization'] === null) {
            return;
        }
        if (this.userServiceKey && headers['x-auth-user-service-key']) {
            return;
        }
        if (customHeaders['x-auth-user-service-key'] === null) {
            return;
        }
        throw new Error('Could not resolve authentication method. Expected one of apiEmail, apiKey, apiToken or userServiceKey to be set. Or for one of the "X-Auth-Email", "X-Auth-Key", "Authorization" or "X-Auth-User-Service-Key" headers to be explicitly omitted');
    }
    authHeaders(opts) {
        const apiEmailAuth = this.apiEmailAuth(opts);
        const apiKeyAuth = this.apiKeyAuth(opts);
        const apiTokenAuth = this.apiTokenAuth(opts);
        const userServiceKeyAuth = this.userServiceKeyAuth(opts);
        if (apiEmailAuth != null &&
            !Core.isEmptyObj(apiEmailAuth) &&
            apiKeyAuth != null &&
            !Core.isEmptyObj(apiKeyAuth)) {
            return { ...apiEmailAuth, ...apiKeyAuth };
        }
        if (apiTokenAuth != null && !Core.isEmptyObj(apiTokenAuth)) {
            return apiTokenAuth;
        }
        if (userServiceKeyAuth != null && !Core.isEmptyObj(userServiceKeyAuth)) {
            return userServiceKeyAuth;
        }
        return {};
    }
    apiEmailAuth(opts) {
        if (this.apiEmail == null) {
            return {};
        }
        return { 'X-Auth-Email': this.apiEmail };
    }
    apiKeyAuth(opts) {
        if (this.apiKey == null) {
            return {};
        }
        return { 'X-Auth-Key': this.apiKey };
    }
    apiTokenAuth(opts) {
        if (this.apiToken == null) {
            return {};
        }
        return { Authorization: `Bearer ${this.apiToken}` };
    }
    userServiceKeyAuth(opts) {
        if (this.userServiceKey == null) {
            return {};
        }
        return { 'X-Auth-User-Service-Key': this.userServiceKey };
    }
    stringifyQuery(query) {
        return qs.stringify(query, { allowDots: true, arrayFormat: 'repeat' });
    }
}
_a = Cloudflare, _Cloudflare_instances = new WeakSet(), _Cloudflare_baseURLOverridden = function _Cloudflare_baseURLOverridden() {
    return this.baseURL !== 'https://api.cloudflare.com/client/v4';
};
Cloudflare.Cloudflare = _a;
Cloudflare.DEFAULT_TIMEOUT = 60000; // 1 minute
Cloudflare.CloudflareError = Errors.CloudflareError;
Cloudflare.APIError = Errors.APIError;
Cloudflare.APIConnectionError = Errors.APIConnectionError;
Cloudflare.APIConnectionTimeoutError = Errors.APIConnectionTimeoutError;
Cloudflare.APIUserAbortError = Errors.APIUserAbortError;
Cloudflare.NotFoundError = Errors.NotFoundError;
Cloudflare.ConflictError = Errors.ConflictError;
Cloudflare.RateLimitError = Errors.RateLimitError;
Cloudflare.BadRequestError = Errors.BadRequestError;
Cloudflare.AuthenticationError = Errors.AuthenticationError;
Cloudflare.InternalServerError = Errors.InternalServerError;
Cloudflare.PermissionDeniedError = Errors.PermissionDeniedError;
Cloudflare.UnprocessableEntityError = Errors.UnprocessableEntityError;
Cloudflare.toFile = Uploads.toFile;
Cloudflare.fileFromPath = Uploads.fileFromPath;
Cloudflare.Accounts = Accounts;
Cloudflare.OriginCACertificates = OriginCACertificates;
Cloudflare.IPs = IPs;
Cloudflare.Memberships = Memberships;
Cloudflare.User = User;
Cloudflare.Zones = Zones;
Cloudflare.LoadBalancers = LoadBalancers;
Cloudflare.Cache = Cache;
Cloudflare.SSL = SSL;
Cloudflare.ACM = ACM;
Cloudflare.Argo = Argo;
Cloudflare.CertificateAuthorities = CertificateAuthorities;
Cloudflare.ClientCertificates = ClientCertificates;
Cloudflare.CustomCertificates = CustomCertificates;
Cloudflare.CustomHostnames = CustomHostnames;
Cloudflare.CustomNameservers = CustomNameservers;
Cloudflare.DNSFirewall = DNSFirewall;
Cloudflare.DNS = DNS;
Cloudflare.EmailSecurity = EmailSecurity;
Cloudflare.EmailRouting = EmailRouting;
Cloudflare.Filters = Filters;
Cloudflare.Firewall = Firewall;
Cloudflare.Healthchecks = Healthchecks;
Cloudflare.KeylessCertificates = KeylessCertificates;
Cloudflare.Logpush = Logpush;
Cloudflare.Logs = Logs;
Cloudflare.OriginTLSClientAuth = OriginTLSClientAuth;
Cloudflare.PageRules = PageRules;
Cloudflare.RateLimits = RateLimits;
Cloudflare.WaitingRooms = WaitingRooms;
Cloudflare.Web3 = Web3;
Cloudflare.Workers = Workers;
Cloudflare.KV = KV;
Cloudflare.DurableObjects = DurableObjects;
Cloudflare.Queues = Queues;
Cloudflare.APIGateway = APIGateway;
Cloudflare.ManagedTransforms = ManagedTransforms;
Cloudflare.PageShield = PageShield;
Cloudflare.Rulesets = Rulesets;
Cloudflare.URLNormalization = URLNormalization;
Cloudflare.Spectrum = Spectrum;
Cloudflare.Addressing = Addressing;
Cloudflare.AuditLogs = AuditLogs;
Cloudflare.Billing = Billing;
Cloudflare.BrandProtection = BrandProtection;
Cloudflare.Diagnostics = Diagnostics;
Cloudflare.Images = Images;
Cloudflare.Intel = Intel;
Cloudflare.MagicTransit = MagicTransit;
Cloudflare.MagicNetworkMonitoring = MagicNetworkMonitoring;
Cloudflare.MagicCloudNetworking = MagicCloudNetworking;
Cloudflare.NetworkInterconnects = NetworkInterconnects;
Cloudflare.MTLSCertificates = MTLSCertificates;
Cloudflare.Pages = Pages;
Cloudflare.Registrar = Registrar;
Cloudflare.RequestTracers = RequestTracers;
Cloudflare.Rules = Rules;
Cloudflare.Stream = Stream;
Cloudflare.Alerting = Alerting;
Cloudflare.D1Resource = D1Resource;
Cloudflare.R2 = R2;
Cloudflare.WorkersForPlatforms = WorkersForPlatforms;
Cloudflare.ZeroTrust = ZeroTrust;
Cloudflare.Turnstile = Turnstile;
Cloudflare.HyperdriveResource = HyperdriveResource;
Cloudflare.RUM = RUM;
Cloudflare.Vectorize = Vectorize;
Cloudflare.URLScanner = URLScanner;
Cloudflare.Radar = Radar;
Cloudflare.BotManagement = BotManagement;
Cloudflare.OriginPostQuantumEncryption = OriginPostQuantumEncryption;
Cloudflare.Zaraz = Zaraz;
Cloudflare.Speed = Speed;
Cloudflare.DCVDelegation = DCVDelegation;
Cloudflare.Hostnames = Hostnames;
Cloudflare.Snippets = Snippets;
Cloudflare.Calls = Calls;
Cloudflare.CloudforceOne = CloudforceOne;
Cloudflare.AIGateway = AIGateway;
Cloudflare.IAM = IAM;
Cloudflare.CloudConnector = CloudConnector;
Cloudflare.BotnetFeed = BotnetFeed;
Cloudflare.SecurityTXT = SecurityTXT;
Cloudflare.Workflows = Workflows;
Cloudflare.ResourceSharing = ResourceSharing;
Cloudflare.LeakedCredentialChecks = LeakedCredentialChecks;
Cloudflare.ContentScanning = ContentScanning;
Cloudflare.AbuseReports = AbuseReports;
Cloudflare.AI = AI;
Cloudflare.SecurityCenter = SecurityCenter;
Cloudflare.BrowserRendering = BrowserRendering;
Cloudflare.CustomPages = CustomPages;
Cloudflare.SecretsStore = SecretsStore;
Cloudflare.Pipelines = Pipelines;
Cloudflare.SchemaValidation = SchemaValidation;
export { toFile, fileFromPath } from "./uploads.mjs";
export { CloudflareError, APIError, APIConnectionError, APIConnectionTimeoutError, APIUserAbortError, NotFoundError, ConflictError, RateLimitError, BadRequestError, AuthenticationError, InternalServerError, PermissionDeniedError, UnprocessableEntityError, } from "./error.mjs";
export default Cloudflare;
//# sourceMappingURL=index.mjs.map