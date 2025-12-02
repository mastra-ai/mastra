"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var _Cloudflare_instances, _a, _Cloudflare_baseURLOverridden;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnprocessableEntityError = exports.PermissionDeniedError = exports.InternalServerError = exports.AuthenticationError = exports.BadRequestError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.APIUserAbortError = exports.APIConnectionTimeoutError = exports.APIConnectionError = exports.APIError = exports.CloudflareError = exports.fileFromPath = exports.toFile = exports.Cloudflare = void 0;
const qs = __importStar(require("./internal/qs/index.js"));
const Core = __importStar(require("./core.js"));
const Errors = __importStar(require("./error.js"));
const Pagination = __importStar(require("./pagination.js"));
const Uploads = __importStar(require("./uploads.js"));
const API = __importStar(require("./resources/index.js"));
const abuse_reports_1 = require("./resources/abuse-reports.js");
const audit_logs_1 = require("./resources/audit-logs.js");
const bot_management_1 = require("./resources/bot-management.js");
const client_certificates_1 = require("./resources/client-certificates.js");
const custom_nameservers_1 = require("./resources/custom-nameservers.js");
const custom_pages_1 = require("./resources/custom-pages.js");
const dcv_delegation_1 = require("./resources/dcv-delegation.js");
const filters_1 = require("./resources/filters.js");
const ips_1 = require("./resources/ips.js");
const keyless_certificates_1 = require("./resources/keyless-certificates.js");
const managed_transforms_1 = require("./resources/managed-transforms.js");
const memberships_1 = require("./resources/memberships.js");
const origin_ca_certificates_1 = require("./resources/origin-ca-certificates.js");
const origin_post_quantum_encryption_1 = require("./resources/origin-post-quantum-encryption.js");
const page_rules_1 = require("./resources/page-rules.js");
const pipelines_1 = require("./resources/pipelines.js");
const rate_limits_1 = require("./resources/rate-limits.js");
const security_txt_1 = require("./resources/security-txt.js");
const url_normalization_1 = require("./resources/url-normalization.js");
const accounts_1 = require("./resources/accounts/accounts.js");
const acm_1 = require("./resources/acm/acm.js");
const addressing_1 = require("./resources/addressing/addressing.js");
const ai_gateway_1 = require("./resources/ai-gateway/ai-gateway.js");
const ai_1 = require("./resources/ai/ai.js");
const alerting_1 = require("./resources/alerting/alerting.js");
const api_gateway_1 = require("./resources/api-gateway/api-gateway.js");
const argo_1 = require("./resources/argo/argo.js");
const billing_1 = require("./resources/billing/billing.js");
const botnet_feed_1 = require("./resources/botnet-feed/botnet-feed.js");
const brand_protection_1 = require("./resources/brand-protection/brand-protection.js");
const browser_rendering_1 = require("./resources/browser-rendering/browser-rendering.js");
const cache_1 = require("./resources/cache/cache.js");
const calls_1 = require("./resources/calls/calls.js");
const certificate_authorities_1 = require("./resources/certificate-authorities/certificate-authorities.js");
const cloud_connector_1 = require("./resources/cloud-connector/cloud-connector.js");
const cloudforce_one_1 = require("./resources/cloudforce-one/cloudforce-one.js");
const content_scanning_1 = require("./resources/content-scanning/content-scanning.js");
const custom_certificates_1 = require("./resources/custom-certificates/custom-certificates.js");
const custom_hostnames_1 = require("./resources/custom-hostnames/custom-hostnames.js");
const d1_1 = require("./resources/d1/d1.js");
const diagnostics_1 = require("./resources/diagnostics/diagnostics.js");
const dns_firewall_1 = require("./resources/dns-firewall/dns-firewall.js");
const dns_1 = require("./resources/dns/dns.js");
const durable_objects_1 = require("./resources/durable-objects/durable-objects.js");
const email_routing_1 = require("./resources/email-routing/email-routing.js");
const email_security_1 = require("./resources/email-security/email-security.js");
const firewall_1 = require("./resources/firewall/firewall.js");
const healthchecks_1 = require("./resources/healthchecks/healthchecks.js");
const hostnames_1 = require("./resources/hostnames/hostnames.js");
const hyperdrive_1 = require("./resources/hyperdrive/hyperdrive.js");
const iam_1 = require("./resources/iam/iam.js");
const images_1 = require("./resources/images/images.js");
const intel_1 = require("./resources/intel/intel.js");
const kv_1 = require("./resources/kv/kv.js");
const leaked_credential_checks_1 = require("./resources/leaked-credential-checks/leaked-credential-checks.js");
const load_balancers_1 = require("./resources/load-balancers/load-balancers.js");
const logpush_1 = require("./resources/logpush/logpush.js");
const logs_1 = require("./resources/logs/logs.js");
const magic_cloud_networking_1 = require("./resources/magic-cloud-networking/magic-cloud-networking.js");
const magic_network_monitoring_1 = require("./resources/magic-network-monitoring/magic-network-monitoring.js");
const magic_transit_1 = require("./resources/magic-transit/magic-transit.js");
const mtls_certificates_1 = require("./resources/mtls-certificates/mtls-certificates.js");
const network_interconnects_1 = require("./resources/network-interconnects/network-interconnects.js");
const origin_tls_client_auth_1 = require("./resources/origin-tls-client-auth/origin-tls-client-auth.js");
const page_shield_1 = require("./resources/page-shield/page-shield.js");
const pages_1 = require("./resources/pages/pages.js");
const queues_1 = require("./resources/queues/queues.js");
const r2_1 = require("./resources/r2/r2.js");
const radar_1 = require("./resources/radar/radar.js");
const registrar_1 = require("./resources/registrar/registrar.js");
const request_tracers_1 = require("./resources/request-tracers/request-tracers.js");
const resource_sharing_1 = require("./resources/resource-sharing/resource-sharing.js");
const rules_1 = require("./resources/rules/rules.js");
const rulesets_1 = require("./resources/rulesets/rulesets.js");
const rum_1 = require("./resources/rum/rum.js");
const schema_validation_1 = require("./resources/schema-validation/schema-validation.js");
const secrets_store_1 = require("./resources/secrets-store/secrets-store.js");
const security_center_1 = require("./resources/security-center/security-center.js");
const snippets_1 = require("./resources/snippets/snippets.js");
const spectrum_1 = require("./resources/spectrum/spectrum.js");
const speed_1 = require("./resources/speed/speed.js");
const ssl_1 = require("./resources/ssl/ssl.js");
const stream_1 = require("./resources/stream/stream.js");
const turnstile_1 = require("./resources/turnstile/turnstile.js");
const url_scanner_1 = require("./resources/url-scanner/url-scanner.js");
const user_1 = require("./resources/user/user.js");
const vectorize_1 = require("./resources/vectorize/vectorize.js");
const waiting_rooms_1 = require("./resources/waiting-rooms/waiting-rooms.js");
const web3_1 = require("./resources/web3/web3.js");
const workers_for_platforms_1 = require("./resources/workers-for-platforms/workers-for-platforms.js");
const workers_1 = require("./resources/workers/workers.js");
const workflows_1 = require("./resources/workflows/workflows.js");
const zaraz_1 = require("./resources/zaraz/zaraz.js");
const zero_trust_1 = require("./resources/zero-trust/zero-trust.js");
const zones_1 = require("./resources/zones/zones.js");
/**
 * API Client for interfacing with the Cloudflare API.
 */
class Cloudflare extends Core.APIClient {
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
exports.Cloudflare = Cloudflare;
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
Cloudflare.Accounts = accounts_1.Accounts;
Cloudflare.OriginCACertificates = origin_ca_certificates_1.OriginCACertificates;
Cloudflare.IPs = ips_1.IPs;
Cloudflare.Memberships = memberships_1.Memberships;
Cloudflare.User = user_1.User;
Cloudflare.Zones = zones_1.Zones;
Cloudflare.LoadBalancers = load_balancers_1.LoadBalancers;
Cloudflare.Cache = cache_1.Cache;
Cloudflare.SSL = ssl_1.SSL;
Cloudflare.ACM = acm_1.ACM;
Cloudflare.Argo = argo_1.Argo;
Cloudflare.CertificateAuthorities = certificate_authorities_1.CertificateAuthorities;
Cloudflare.ClientCertificates = client_certificates_1.ClientCertificates;
Cloudflare.CustomCertificates = custom_certificates_1.CustomCertificates;
Cloudflare.CustomHostnames = custom_hostnames_1.CustomHostnames;
Cloudflare.CustomNameservers = custom_nameservers_1.CustomNameservers;
Cloudflare.DNSFirewall = dns_firewall_1.DNSFirewall;
Cloudflare.DNS = dns_1.DNS;
Cloudflare.EmailSecurity = email_security_1.EmailSecurity;
Cloudflare.EmailRouting = email_routing_1.EmailRouting;
Cloudflare.Filters = filters_1.Filters;
Cloudflare.Firewall = firewall_1.Firewall;
Cloudflare.Healthchecks = healthchecks_1.Healthchecks;
Cloudflare.KeylessCertificates = keyless_certificates_1.KeylessCertificates;
Cloudflare.Logpush = logpush_1.Logpush;
Cloudflare.Logs = logs_1.Logs;
Cloudflare.OriginTLSClientAuth = origin_tls_client_auth_1.OriginTLSClientAuth;
Cloudflare.PageRules = page_rules_1.PageRules;
Cloudflare.RateLimits = rate_limits_1.RateLimits;
Cloudflare.WaitingRooms = waiting_rooms_1.WaitingRooms;
Cloudflare.Web3 = web3_1.Web3;
Cloudflare.Workers = workers_1.Workers;
Cloudflare.KV = kv_1.KV;
Cloudflare.DurableObjects = durable_objects_1.DurableObjects;
Cloudflare.Queues = queues_1.Queues;
Cloudflare.APIGateway = api_gateway_1.APIGateway;
Cloudflare.ManagedTransforms = managed_transforms_1.ManagedTransforms;
Cloudflare.PageShield = page_shield_1.PageShield;
Cloudflare.Rulesets = rulesets_1.Rulesets;
Cloudflare.URLNormalization = url_normalization_1.URLNormalization;
Cloudflare.Spectrum = spectrum_1.Spectrum;
Cloudflare.Addressing = addressing_1.Addressing;
Cloudflare.AuditLogs = audit_logs_1.AuditLogs;
Cloudflare.Billing = billing_1.Billing;
Cloudflare.BrandProtection = brand_protection_1.BrandProtection;
Cloudflare.Diagnostics = diagnostics_1.Diagnostics;
Cloudflare.Images = images_1.Images;
Cloudflare.Intel = intel_1.Intel;
Cloudflare.MagicTransit = magic_transit_1.MagicTransit;
Cloudflare.MagicNetworkMonitoring = magic_network_monitoring_1.MagicNetworkMonitoring;
Cloudflare.MagicCloudNetworking = magic_cloud_networking_1.MagicCloudNetworking;
Cloudflare.NetworkInterconnects = network_interconnects_1.NetworkInterconnects;
Cloudflare.MTLSCertificates = mtls_certificates_1.MTLSCertificates;
Cloudflare.Pages = pages_1.Pages;
Cloudflare.Registrar = registrar_1.Registrar;
Cloudflare.RequestTracers = request_tracers_1.RequestTracers;
Cloudflare.Rules = rules_1.Rules;
Cloudflare.Stream = stream_1.Stream;
Cloudflare.Alerting = alerting_1.Alerting;
Cloudflare.D1Resource = d1_1.D1Resource;
Cloudflare.R2 = r2_1.R2;
Cloudflare.WorkersForPlatforms = workers_for_platforms_1.WorkersForPlatforms;
Cloudflare.ZeroTrust = zero_trust_1.ZeroTrust;
Cloudflare.Turnstile = turnstile_1.Turnstile;
Cloudflare.HyperdriveResource = hyperdrive_1.HyperdriveResource;
Cloudflare.RUM = rum_1.RUM;
Cloudflare.Vectorize = vectorize_1.Vectorize;
Cloudflare.URLScanner = url_scanner_1.URLScanner;
Cloudflare.Radar = radar_1.Radar;
Cloudflare.BotManagement = bot_management_1.BotManagement;
Cloudflare.OriginPostQuantumEncryption = origin_post_quantum_encryption_1.OriginPostQuantumEncryption;
Cloudflare.Zaraz = zaraz_1.Zaraz;
Cloudflare.Speed = speed_1.Speed;
Cloudflare.DCVDelegation = dcv_delegation_1.DCVDelegation;
Cloudflare.Hostnames = hostnames_1.Hostnames;
Cloudflare.Snippets = snippets_1.Snippets;
Cloudflare.Calls = calls_1.Calls;
Cloudflare.CloudforceOne = cloudforce_one_1.CloudforceOne;
Cloudflare.AIGateway = ai_gateway_1.AIGateway;
Cloudflare.IAM = iam_1.IAM;
Cloudflare.CloudConnector = cloud_connector_1.CloudConnector;
Cloudflare.BotnetFeed = botnet_feed_1.BotnetFeed;
Cloudflare.SecurityTXT = security_txt_1.SecurityTXT;
Cloudflare.Workflows = workflows_1.Workflows;
Cloudflare.ResourceSharing = resource_sharing_1.ResourceSharing;
Cloudflare.LeakedCredentialChecks = leaked_credential_checks_1.LeakedCredentialChecks;
Cloudflare.ContentScanning = content_scanning_1.ContentScanning;
Cloudflare.AbuseReports = abuse_reports_1.AbuseReports;
Cloudflare.AI = ai_1.AI;
Cloudflare.SecurityCenter = security_center_1.SecurityCenter;
Cloudflare.BrowserRendering = browser_rendering_1.BrowserRendering;
Cloudflare.CustomPages = custom_pages_1.CustomPages;
Cloudflare.SecretsStore = secrets_store_1.SecretsStore;
Cloudflare.Pipelines = pipelines_1.Pipelines;
Cloudflare.SchemaValidation = schema_validation_1.SchemaValidation;
var uploads_1 = require("./uploads.js");
Object.defineProperty(exports, "toFile", { enumerable: true, get: function () { return uploads_1.toFile; } });
Object.defineProperty(exports, "fileFromPath", { enumerable: true, get: function () { return uploads_1.fileFromPath; } });
var error_1 = require("./error.js");
Object.defineProperty(exports, "CloudflareError", { enumerable: true, get: function () { return error_1.CloudflareError; } });
Object.defineProperty(exports, "APIError", { enumerable: true, get: function () { return error_1.APIError; } });
Object.defineProperty(exports, "APIConnectionError", { enumerable: true, get: function () { return error_1.APIConnectionError; } });
Object.defineProperty(exports, "APIConnectionTimeoutError", { enumerable: true, get: function () { return error_1.APIConnectionTimeoutError; } });
Object.defineProperty(exports, "APIUserAbortError", { enumerable: true, get: function () { return error_1.APIUserAbortError; } });
Object.defineProperty(exports, "NotFoundError", { enumerable: true, get: function () { return error_1.NotFoundError; } });
Object.defineProperty(exports, "ConflictError", { enumerable: true, get: function () { return error_1.ConflictError; } });
Object.defineProperty(exports, "RateLimitError", { enumerable: true, get: function () { return error_1.RateLimitError; } });
Object.defineProperty(exports, "BadRequestError", { enumerable: true, get: function () { return error_1.BadRequestError; } });
Object.defineProperty(exports, "AuthenticationError", { enumerable: true, get: function () { return error_1.AuthenticationError; } });
Object.defineProperty(exports, "InternalServerError", { enumerable: true, get: function () { return error_1.InternalServerError; } });
Object.defineProperty(exports, "PermissionDeniedError", { enumerable: true, get: function () { return error_1.PermissionDeniedError; } });
Object.defineProperty(exports, "UnprocessableEntityError", { enumerable: true, get: function () { return error_1.UnprocessableEntityError; } });
exports = module.exports = Cloudflare;
exports.default = Cloudflare;
//# sourceMappingURL=index.js.map