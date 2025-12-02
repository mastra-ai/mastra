// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { type Agent } from './_shims/index';
import * as qs from './internal/qs';
import * as Core from './core';
import * as Errors from './error';
import * as Pagination from './pagination';
import {
  type CursorLimitPaginationParams,
  CursorLimitPaginationResponse,
  type CursorPaginationParams,
  CursorPaginationResponse,
  SinglePageResponse,
  type V4PagePaginationArrayParams,
  V4PagePaginationArrayResponse,
  type V4PagePaginationParams,
  V4PagePaginationResponse,
} from './pagination';
import * as Uploads from './uploads';
import * as API from './resources/index';
import { AbuseReports } from './resources/abuse-reports';
import { AuditLogs } from './resources/audit-logs';
import { BotManagement } from './resources/bot-management';
import { ClientCertificates } from './resources/client-certificates';
import { CustomNameservers } from './resources/custom-nameservers';
import { CustomPages } from './resources/custom-pages';
import { DCVDelegation } from './resources/dcv-delegation';
import { Filters } from './resources/filters';
import { IPs } from './resources/ips';
import { KeylessCertificates } from './resources/keyless-certificates';
import { ManagedTransforms } from './resources/managed-transforms';
import { Memberships } from './resources/memberships';
import { OriginCACertificates } from './resources/origin-ca-certificates';
import { OriginPostQuantumEncryption } from './resources/origin-post-quantum-encryption';
import { PageRules } from './resources/page-rules';
import { Pipelines } from './resources/pipelines';
import { RateLimits } from './resources/rate-limits';
import { SecurityTXT } from './resources/security-txt';
import { URLNormalization } from './resources/url-normalization';
import { Accounts } from './resources/accounts/accounts';
import { ACM } from './resources/acm/acm';
import { Addressing } from './resources/addressing/addressing';
import { AIGateway } from './resources/ai-gateway/ai-gateway';
import { AI } from './resources/ai/ai';
import { Alerting } from './resources/alerting/alerting';
import { APIGateway } from './resources/api-gateway/api-gateway';
import { Argo } from './resources/argo/argo';
import { Billing } from './resources/billing/billing';
import { BotnetFeed } from './resources/botnet-feed/botnet-feed';
import { BrandProtection } from './resources/brand-protection/brand-protection';
import { BrowserRendering } from './resources/browser-rendering/browser-rendering';
import { Cache } from './resources/cache/cache';
import { Calls } from './resources/calls/calls';
import { CertificateAuthorities } from './resources/certificate-authorities/certificate-authorities';
import { CloudConnector } from './resources/cloud-connector/cloud-connector';
import { CloudforceOne } from './resources/cloudforce-one/cloudforce-one';
import { ContentScanning } from './resources/content-scanning/content-scanning';
import { CustomCertificates } from './resources/custom-certificates/custom-certificates';
import { CustomHostnames } from './resources/custom-hostnames/custom-hostnames';
import { D1Resource } from './resources/d1/d1';
import { Diagnostics } from './resources/diagnostics/diagnostics';
import { DNSFirewall } from './resources/dns-firewall/dns-firewall';
import { DNS } from './resources/dns/dns';
import { DurableObjects } from './resources/durable-objects/durable-objects';
import { EmailRouting } from './resources/email-routing/email-routing';
import { EmailSecurity } from './resources/email-security/email-security';
import { Firewall } from './resources/firewall/firewall';
import { Healthchecks } from './resources/healthchecks/healthchecks';
import { Hostnames } from './resources/hostnames/hostnames';
import { HyperdriveResource } from './resources/hyperdrive/hyperdrive';
import { IAM } from './resources/iam/iam';
import { Images } from './resources/images/images';
import { Intel } from './resources/intel/intel';
import { KV } from './resources/kv/kv';
import { LeakedCredentialChecks } from './resources/leaked-credential-checks/leaked-credential-checks';
import { LoadBalancers } from './resources/load-balancers/load-balancers';
import { Logpush } from './resources/logpush/logpush';
import { Logs } from './resources/logs/logs';
import { MagicCloudNetworking } from './resources/magic-cloud-networking/magic-cloud-networking';
import { MagicNetworkMonitoring } from './resources/magic-network-monitoring/magic-network-monitoring';
import { MagicTransit } from './resources/magic-transit/magic-transit';
import { MTLSCertificates } from './resources/mtls-certificates/mtls-certificates';
import { NetworkInterconnects } from './resources/network-interconnects/network-interconnects';
import { OriginTLSClientAuth } from './resources/origin-tls-client-auth/origin-tls-client-auth';
import { PageShield } from './resources/page-shield/page-shield';
import { Pages } from './resources/pages/pages';
import { Queues } from './resources/queues/queues';
import { R2 } from './resources/r2/r2';
import { Radar } from './resources/radar/radar';
import { Registrar } from './resources/registrar/registrar';
import { RequestTracers } from './resources/request-tracers/request-tracers';
import { ResourceSharing } from './resources/resource-sharing/resource-sharing';
import { Rules } from './resources/rules/rules';
import { Rulesets } from './resources/rulesets/rulesets';
import { RUM } from './resources/rum/rum';
import { SchemaValidation } from './resources/schema-validation/schema-validation';
import { SecretsStore } from './resources/secrets-store/secrets-store';
import { SecurityCenter } from './resources/security-center/security-center';
import { Snippets } from './resources/snippets/snippets';
import { Spectrum } from './resources/spectrum/spectrum';
import { Speed } from './resources/speed/speed';
import { SSL } from './resources/ssl/ssl';
import { Stream } from './resources/stream/stream';
import { Turnstile } from './resources/turnstile/turnstile';
import { URLScanner } from './resources/url-scanner/url-scanner';
import { User } from './resources/user/user';
import { Vectorize } from './resources/vectorize/vectorize';
import { WaitingRooms } from './resources/waiting-rooms/waiting-rooms';
import { Web3 } from './resources/web3/web3';
import { WorkersForPlatforms } from './resources/workers-for-platforms/workers-for-platforms';
import { Workers } from './resources/workers/workers';
import { Workflows } from './resources/workflows/workflows';
import { Zaraz } from './resources/zaraz/zaraz';
import { ZeroTrust } from './resources/zero-trust/zero-trust';
import { Zones } from './resources/zones/zones';

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
export class Cloudflare extends Core.APIClient {
  apiToken: string | null;
  apiKey: string | null;
  apiEmail: string | null;
  userServiceKey: string | null;

  private _options: ClientOptions;

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
  constructor({
    baseURL = Core.readEnv('CLOUDFLARE_BASE_URL'),
    apiVersion = null,
    apiToken = Core.readEnv('CLOUDFLARE_API_TOKEN') ?? null,
    apiKey = Core.readEnv('CLOUDFLARE_API_KEY') ?? null,
    apiEmail = Core.readEnv('CLOUDFLARE_EMAIL') ?? null,
    userServiceKey = Core.readEnv('CLOUDFLARE_API_USER_SERVICE_KEY') ?? null,
    ...opts
  }: ClientOptions = {}) {
    const options: ClientOptions = {
      apiToken,
      apiKey,
      apiEmail,
      userServiceKey,
      ...opts,
      baseURL: baseURL || `https://api.cloudflare.com/client/v4`,
      apiVersion: apiVersion || new Date().toISOString().slice(0, 10),
    };

    super({
      baseURL: options.baseURL!,
      apiVersion: options.apiVersion!,
      baseURLOverridden: baseURL ? baseURL !== 'https://api.cloudflare.com/client/v4' : false,
      timeout: options.timeout ?? 60000 /* 1 minute */,
      httpAgent: options.httpAgent,
      maxRetries: options.maxRetries,
      fetch: options.fetch,
    });

    this._options = options;

    this.apiToken = apiToken;
    this.apiKey = apiKey;
    this.apiEmail = apiEmail;
    this.userServiceKey = userServiceKey;
  }

  accounts: API.Accounts = new API.Accounts(this);
  originCACertificates: API.OriginCACertificates = new API.OriginCACertificates(this);
  ips: API.IPs = new API.IPs(this);
  memberships: API.Memberships = new API.Memberships(this);
  user: API.User = new API.User(this);
  zones: API.Zones = new API.Zones(this);
  loadBalancers: API.LoadBalancers = new API.LoadBalancers(this);
  cache: API.Cache = new API.Cache(this);
  ssl: API.SSL = new API.SSL(this);
  acm: API.ACM = new API.ACM(this);
  argo: API.Argo = new API.Argo(this);
  certificateAuthorities: API.CertificateAuthorities = new API.CertificateAuthorities(this);
  clientCertificates: API.ClientCertificates = new API.ClientCertificates(this);
  customCertificates: API.CustomCertificates = new API.CustomCertificates(this);
  customHostnames: API.CustomHostnames = new API.CustomHostnames(this);
  customNameservers: API.CustomNameservers = new API.CustomNameservers(this);
  dnsFirewall: API.DNSFirewall = new API.DNSFirewall(this);
  dns: API.DNS = new API.DNS(this);
  emailSecurity: API.EmailSecurity = new API.EmailSecurity(this);
  emailRouting: API.EmailRouting = new API.EmailRouting(this);
  filters: API.Filters = new API.Filters(this);
  firewall: API.Firewall = new API.Firewall(this);
  healthchecks: API.Healthchecks = new API.Healthchecks(this);
  keylessCertificates: API.KeylessCertificates = new API.KeylessCertificates(this);
  logpush: API.Logpush = new API.Logpush(this);
  logs: API.Logs = new API.Logs(this);
  originTLSClientAuth: API.OriginTLSClientAuth = new API.OriginTLSClientAuth(this);
  pageRules: API.PageRules = new API.PageRules(this);
  rateLimits: API.RateLimits = new API.RateLimits(this);
  waitingRooms: API.WaitingRooms = new API.WaitingRooms(this);
  web3: API.Web3 = new API.Web3(this);
  workers: API.Workers = new API.Workers(this);
  kv: API.KV = new API.KV(this);
  durableObjects: API.DurableObjects = new API.DurableObjects(this);
  queues: API.Queues = new API.Queues(this);
  apiGateway: API.APIGateway = new API.APIGateway(this);
  managedTransforms: API.ManagedTransforms = new API.ManagedTransforms(this);
  pageShield: API.PageShield = new API.PageShield(this);
  rulesets: API.Rulesets = new API.Rulesets(this);
  urlNormalization: API.URLNormalization = new API.URLNormalization(this);
  spectrum: API.Spectrum = new API.Spectrum(this);
  addressing: API.Addressing = new API.Addressing(this);
  auditLogs: API.AuditLogs = new API.AuditLogs(this);
  billing: API.Billing = new API.Billing(this);
  brandProtection: API.BrandProtection = new API.BrandProtection(this);
  diagnostics: API.Diagnostics = new API.Diagnostics(this);
  images: API.Images = new API.Images(this);
  intel: API.Intel = new API.Intel(this);
  magicTransit: API.MagicTransit = new API.MagicTransit(this);
  magicNetworkMonitoring: API.MagicNetworkMonitoring = new API.MagicNetworkMonitoring(this);
  magicCloudNetworking: API.MagicCloudNetworking = new API.MagicCloudNetworking(this);
  networkInterconnects: API.NetworkInterconnects = new API.NetworkInterconnects(this);
  mtlsCertificates: API.MTLSCertificates = new API.MTLSCertificates(this);
  pages: API.Pages = new API.Pages(this);
  registrar: API.Registrar = new API.Registrar(this);
  requestTracers: API.RequestTracers = new API.RequestTracers(this);
  rules: API.Rules = new API.Rules(this);
  stream: API.Stream = new API.Stream(this);
  alerting: API.Alerting = new API.Alerting(this);
  d1: API.D1Resource = new API.D1Resource(this);
  r2: API.R2 = new API.R2(this);
  workersForPlatforms: API.WorkersForPlatforms = new API.WorkersForPlatforms(this);
  zeroTrust: API.ZeroTrust = new API.ZeroTrust(this);
  turnstile: API.Turnstile = new API.Turnstile(this);
  hyperdrive: API.HyperdriveResource = new API.HyperdriveResource(this);
  rum: API.RUM = new API.RUM(this);
  vectorize: API.Vectorize = new API.Vectorize(this);
  urlScanner: API.URLScanner = new API.URLScanner(this);
  radar: API.Radar = new API.Radar(this);
  botManagement: API.BotManagement = new API.BotManagement(this);
  originPostQuantumEncryption: API.OriginPostQuantumEncryption = new API.OriginPostQuantumEncryption(this);
  zaraz: API.Zaraz = new API.Zaraz(this);
  speed: API.Speed = new API.Speed(this);
  dcvDelegation: API.DCVDelegation = new API.DCVDelegation(this);
  hostnames: API.Hostnames = new API.Hostnames(this);
  snippets: API.Snippets = new API.Snippets(this);
  calls: API.Calls = new API.Calls(this);
  cloudforceOne: API.CloudforceOne = new API.CloudforceOne(this);
  aiGateway: API.AIGateway = new API.AIGateway(this);
  iam: API.IAM = new API.IAM(this);
  cloudConnector: API.CloudConnector = new API.CloudConnector(this);
  botnetFeed: API.BotnetFeed = new API.BotnetFeed(this);
  securityTXT: API.SecurityTXT = new API.SecurityTXT(this);
  workflows: API.Workflows = new API.Workflows(this);
  resourceSharing: API.ResourceSharing = new API.ResourceSharing(this);
  leakedCredentialChecks: API.LeakedCredentialChecks = new API.LeakedCredentialChecks(this);
  contentScanning: API.ContentScanning = new API.ContentScanning(this);
  abuseReports: API.AbuseReports = new API.AbuseReports(this);
  ai: API.AI = new API.AI(this);
  securityCenter: API.SecurityCenter = new API.SecurityCenter(this);
  browserRendering: API.BrowserRendering = new API.BrowserRendering(this);
  customPages: API.CustomPages = new API.CustomPages(this);
  secretsStore: API.SecretsStore = new API.SecretsStore(this);
  pipelines: API.Pipelines = new API.Pipelines(this);
  schemaValidation: API.SchemaValidation = new API.SchemaValidation(this);

  /**
   * Check whether the base URL is set to its default.
   */
  #baseURLOverridden(): boolean {
    return this.baseURL !== 'https://api.cloudflare.com/client/v4';
  }

  protected override defaultQuery(): Core.DefaultQuery | undefined {
    return this._options.defaultQuery;
  }

  protected override defaultHeaders(opts: Core.FinalRequestOptions): Core.Headers {
    return {
      ...super.defaultHeaders(opts),
      'X-Auth-Key': this.apiKey,
      'X-Auth-Email': this.apiEmail,
      ...this._options.defaultHeaders,
    };
  }

  protected override validateHeaders(headers: Core.Headers, customHeaders: Core.Headers) {
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

    throw new Error(
      'Could not resolve authentication method. Expected one of apiEmail, apiKey, apiToken or userServiceKey to be set. Or for one of the "X-Auth-Email", "X-Auth-Key", "Authorization" or "X-Auth-User-Service-Key" headers to be explicitly omitted',
    );
  }

  protected override authHeaders(opts: Core.FinalRequestOptions): Core.Headers {
    const apiEmailAuth = this.apiEmailAuth(opts);
    const apiKeyAuth = this.apiKeyAuth(opts);
    const apiTokenAuth = this.apiTokenAuth(opts);
    const userServiceKeyAuth = this.userServiceKeyAuth(opts);

    if (
      apiEmailAuth != null &&
      !Core.isEmptyObj(apiEmailAuth) &&
      apiKeyAuth != null &&
      !Core.isEmptyObj(apiKeyAuth)
    ) {
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

  protected apiEmailAuth(opts: Core.FinalRequestOptions): Core.Headers {
    if (this.apiEmail == null) {
      return {};
    }
    return { 'X-Auth-Email': this.apiEmail };
  }

  protected apiKeyAuth(opts: Core.FinalRequestOptions): Core.Headers {
    if (this.apiKey == null) {
      return {};
    }
    return { 'X-Auth-Key': this.apiKey };
  }

  protected apiTokenAuth(opts: Core.FinalRequestOptions): Core.Headers {
    if (this.apiToken == null) {
      return {};
    }
    return { Authorization: `Bearer ${this.apiToken}` };
  }

  protected userServiceKeyAuth(opts: Core.FinalRequestOptions): Core.Headers {
    if (this.userServiceKey == null) {
      return {};
    }
    return { 'X-Auth-User-Service-Key': this.userServiceKey };
  }

  protected override stringifyQuery(query: Record<string, unknown>): string {
    return qs.stringify(query, { allowDots: true, arrayFormat: 'repeat' });
  }

  static Cloudflare = this;
  static DEFAULT_TIMEOUT = 60000; // 1 minute

  static CloudflareError = Errors.CloudflareError;
  static APIError = Errors.APIError;
  static APIConnectionError = Errors.APIConnectionError;
  static APIConnectionTimeoutError = Errors.APIConnectionTimeoutError;
  static APIUserAbortError = Errors.APIUserAbortError;
  static NotFoundError = Errors.NotFoundError;
  static ConflictError = Errors.ConflictError;
  static RateLimitError = Errors.RateLimitError;
  static BadRequestError = Errors.BadRequestError;
  static AuthenticationError = Errors.AuthenticationError;
  static InternalServerError = Errors.InternalServerError;
  static PermissionDeniedError = Errors.PermissionDeniedError;
  static UnprocessableEntityError = Errors.UnprocessableEntityError;

  static toFile = Uploads.toFile;
  static fileFromPath = Uploads.fileFromPath;
}

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
export declare namespace Cloudflare {
  export type RequestOptions = Core.RequestOptions;

  export import V4PagePagination = Pagination.V4PagePagination;
  export {
    type V4PagePaginationParams as V4PagePaginationParams,
    type V4PagePaginationResponse as V4PagePaginationResponse,
  };

  export import V4PagePaginationArray = Pagination.V4PagePaginationArray;
  export {
    type V4PagePaginationArrayParams as V4PagePaginationArrayParams,
    type V4PagePaginationArrayResponse as V4PagePaginationArrayResponse,
  };

  export import CursorPagination = Pagination.CursorPagination;
  export {
    type CursorPaginationParams as CursorPaginationParams,
    type CursorPaginationResponse as CursorPaginationResponse,
  };

  export import CursorLimitPagination = Pagination.CursorLimitPagination;
  export {
    type CursorLimitPaginationParams as CursorLimitPaginationParams,
    type CursorLimitPaginationResponse as CursorLimitPaginationResponse,
  };

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

export { toFile, fileFromPath } from './uploads';
export {
  CloudflareError,
  APIError,
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  BadRequestError,
  AuthenticationError,
  InternalServerError,
  PermissionDeniedError,
  UnprocessableEntityError,
} from './error';

export default Cloudflare;
