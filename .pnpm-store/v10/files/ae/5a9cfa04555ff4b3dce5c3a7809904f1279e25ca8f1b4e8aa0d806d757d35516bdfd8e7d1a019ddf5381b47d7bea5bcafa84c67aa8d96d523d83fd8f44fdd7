// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as WorkersAPI from '../workers';
import * as ContentAPI from './content';
import { Content, ContentGetParams, ContentUpdateParams } from './content';
import * as DeploymentsAPI from './deployments';
import {
  Deployment,
  DeploymentCreateParams,
  DeploymentCreateResponse,
  DeploymentGetParams,
  DeploymentGetResponse,
  Deployments,
} from './deployments';
import * as SchedulesAPI from './schedules';
import {
  ScheduleGetParams,
  ScheduleGetResponse,
  ScheduleUpdateParams,
  ScheduleUpdateResponse,
  Schedules,
} from './schedules';
import * as ScriptAndVersionSettingsAPI from './script-and-version-settings';
import {
  ScriptAndVersionSettingEditParams,
  ScriptAndVersionSettingEditResponse,
  ScriptAndVersionSettingGetParams,
  ScriptAndVersionSettingGetResponse,
  ScriptAndVersionSettings,
} from './script-and-version-settings';
import * as SecretsAPI from './secrets';
import {
  SecretDeleteParams,
  SecretDeleteResponse,
  SecretGetParams,
  SecretGetResponse,
  SecretListParams,
  SecretListResponse,
  SecretListResponsesSinglePage,
  SecretUpdateParams,
  SecretUpdateResponse,
  Secrets,
} from './secrets';
import * as SettingsAPI from './settings';
import { SettingEditParams, SettingGetParams, Settings } from './settings';
import * as SubdomainAPI from './subdomain';
import {
  Subdomain,
  SubdomainCreateParams,
  SubdomainCreateResponse,
  SubdomainDeleteParams,
  SubdomainDeleteResponse,
  SubdomainGetParams,
  SubdomainGetResponse,
} from './subdomain';
import * as TailAPI from './tail';
import {
  ConsumerScript,
  Tail,
  TailCreateParams,
  TailCreateResponse,
  TailDeleteParams,
  TailDeleteResponse,
  TailGetParams,
  TailGetResponse,
} from './tail';
import * as VersionsAPI from './versions';
import {
  VersionCreateParams,
  VersionCreateResponse,
  VersionGetParams,
  VersionGetResponse,
  VersionListParams,
  VersionListResponse,
  VersionListResponsesV4PagePagination,
  Versions,
} from './versions';
import * as AssetsAPI from './assets/assets';
import { Assets as AssetsAPIAssets } from './assets/assets';
import { SinglePage } from '../../../pagination';

export class Scripts extends APIResource {
  assets: AssetsAPI.Assets = new AssetsAPI.Assets(this._client);
  subdomain: SubdomainAPI.Subdomain = new SubdomainAPI.Subdomain(this._client);
  schedules: SchedulesAPI.Schedules = new SchedulesAPI.Schedules(this._client);
  tail: TailAPI.Tail = new TailAPI.Tail(this._client);
  content: ContentAPI.Content = new ContentAPI.Content(this._client);
  settings: SettingsAPI.Settings = new SettingsAPI.Settings(this._client);
  deployments: DeploymentsAPI.Deployments = new DeploymentsAPI.Deployments(this._client);
  versions: VersionsAPI.Versions = new VersionsAPI.Versions(this._client);
  secrets: SecretsAPI.Secrets = new SecretsAPI.Secrets(this._client);
  scriptAndVersionSettings: ScriptAndVersionSettingsAPI.ScriptAndVersionSettings =
    new ScriptAndVersionSettingsAPI.ScriptAndVersionSettings(this._client);

  /**
   * Upload a worker module. You can find more about the multipart metadata on our
   * docs:
   * https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/.
   *
   * @example
   * ```ts
   * const script = await client.workers.scripts.update(
   *   'this-is_my_script-01',
   *   {
   *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *     metadata: {},
   *   },
   * );
   * ```
   */
  update(
    scriptName: string,
    params: ScriptUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ScriptUpdateResponse> {
    const { account_id, files, ...body } = params;
    return (
      this._client.put(
        `/accounts/${account_id}/workers/scripts/${scriptName}`,
        Core.maybeMultipartFormRequestOptions({
          body: { ...body, ...files },
          ...options,
          __multipartSyntax: 'json',
          headers: { 'Content-Type': 'application/javascript', ...options?.headers },
        }),
      ) as Core.APIPromise<{ result: ScriptUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetch a list of uploaded workers.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const script of client.workers.scripts.list({
   *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   * })) {
   *   // ...
   * }
   * ```
   */
  list(params: ScriptListParams, options?: Core.RequestOptions): Core.PagePromise<ScriptsSinglePage, Script> {
    const { account_id } = params;
    return this._client.getAPIList(`/accounts/${account_id}/workers/scripts`, ScriptsSinglePage, options);
  }

  /**
   * Delete your worker. This call has no response body on a successful delete.
   *
   * @example
   * ```ts
   * const script = await client.workers.scripts.delete(
   *   'this-is_my_script-01',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  delete(
    scriptName: string,
    params: ScriptDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<ScriptDeleteResponse | null> {
    const { account_id, force } = params;
    return (
      this._client.delete(`/accounts/${account_id}/workers/scripts/${scriptName}`, {
        query: { force },
        ...options,
      }) as Core.APIPromise<{ result: ScriptDeleteResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetch raw script content for your worker. Note this is the original script
   * content, not JSON encoded.
   *
   * @example
   * ```ts
   * const script = await client.workers.scripts.get(
   *   'this-is_my_script-01',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(scriptName: string, params: ScriptGetParams, options?: Core.RequestOptions): Core.APIPromise<string> {
    const { account_id } = params;
    return this._client.get(`/accounts/${account_id}/workers/scripts/${scriptName}`, {
      ...options,
      headers: { Accept: 'application/javascript', ...options?.headers },
    });
  }
}

export class ScriptsSinglePage extends SinglePage<Script> {}

export interface Script {
  /**
   * The id of the script in the Workers system. Usually the script name.
   */
  id?: string;

  /**
   * When the script was created.
   */
  created_on?: string;

  /**
   * Hashed script content, can be used in a If-None-Match header when updating.
   */
  etag?: string;

  /**
   * Whether a Worker contains assets.
   */
  has_assets?: boolean;

  /**
   * Whether a Worker contains modules.
   */
  has_modules?: boolean;

  /**
   * Whether Logpush is turned on for the Worker.
   */
  logpush?: boolean;

  /**
   * When the script was last modified.
   */
  modified_on?: string;

  /**
   * Configuration for
   * [Smart Placement](https://developers.cloudflare.com/workers/configuration/smart-placement).
   */
  placement?: Script.Placement;

  /**
   * @deprecated Enables
   * [Smart Placement](https://developers.cloudflare.com/workers/configuration/smart-placement).
   */
  placement_mode?: 'smart';

  /**
   * @deprecated Status of
   * [Smart Placement](https://developers.cloudflare.com/workers/configuration/smart-placement).
   */
  placement_status?: 'SUCCESS' | 'UNSUPPORTED_APPLICATION' | 'INSUFFICIENT_INVOCATIONS';

  /**
   * List of Workers that will consume logs from the attached Worker.
   */
  tail_consumers?: Array<TailAPI.ConsumerScript>;

  /**
   * Usage model for the Worker invocations.
   */
  usage_model?: 'standard';
}

export namespace Script {
  /**
   * Configuration for
   * [Smart Placement](https://developers.cloudflare.com/workers/configuration/smart-placement).
   */
  export interface Placement {
    /**
     * The last time the script was analyzed for
     * [Smart Placement](https://developers.cloudflare.com/workers/configuration/smart-placement).
     */
    last_analyzed_at?: string;

    /**
     * Enables
     * [Smart Placement](https://developers.cloudflare.com/workers/configuration/smart-placement).
     */
    mode?: 'smart';

    /**
     * Status of
     * [Smart Placement](https://developers.cloudflare.com/workers/configuration/smart-placement).
     */
    status?: 'SUCCESS' | 'UNSUPPORTED_APPLICATION' | 'INSUFFICIENT_INVOCATIONS';
  }
}

export interface ScriptSetting {
  /**
   * Whether Logpush is turned on for the Worker.
   */
  logpush?: boolean;

  /**
   * Observability settings for the Worker.
   */
  observability?: ScriptSetting.Observability | null;

  /**
   * List of Workers that will consume logs from the attached Worker.
   */
  tail_consumers?: Array<TailAPI.ConsumerScript> | null;
}

export namespace ScriptSetting {
  /**
   * Observability settings for the Worker.
   */
  export interface Observability {
    /**
     * Whether observability is enabled for the Worker.
     */
    enabled: boolean;

    /**
     * The sampling rate for incoming requests. From 0 to 1 (1 = 100%, 0.1 = 10%).
     * Default is 1.
     */
    head_sampling_rate?: number | null;

    /**
     * Log settings for the Worker.
     */
    logs?: Observability.Logs | null;
  }

  export namespace Observability {
    /**
     * Log settings for the Worker.
     */
    export interface Logs {
      /**
       * Whether logs are enabled for the Worker.
       */
      enabled: boolean;

      /**
       * Whether
       * [invocation logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/#invocation-logs)
       * are enabled for the Worker.
       */
      invocation_logs: boolean;

      /**
       * The sampling rate for logs. From 0 to 1 (1 = 100%, 0.1 = 10%). Default is 1.
       */
      head_sampling_rate?: number | null;
    }
  }
}

export interface ScriptUpdateResponse {
  startup_time_ms: number;

  /**
   * The id of the script in the Workers system. Usually the script name.
   */
  id?: string;

  /**
   * When the script was created.
   */
  created_on?: string;

  /**
   * Hashed script content, can be used in a If-None-Match header when updating.
   */
  etag?: string;

  /**
   * Whether a Worker contains assets.
   */
  has_assets?: boolean;

  /**
   * Whether a Worker contains modules.
   */
  has_modules?: boolean;

  /**
   * Whether Logpush is turned on for the Worker.
   */
  logpush?: boolean;

  /**
   * When the script was last modified.
   */
  modified_on?: string;

  /**
   * Configuration for
   * [Smart Placement](https://developers.cloudflare.com/workers/configuration/smart-placement).
   */
  placement?: ScriptUpdateResponse.Placement;

  /**
   * @deprecated
   */
  placement_mode?: 'smart';

  /**
   * @deprecated
   */
  placement_status?: 'SUCCESS' | 'UNSUPPORTED_APPLICATION' | 'INSUFFICIENT_INVOCATIONS';

  /**
   * List of Workers that will consume logs from the attached Worker.
   */
  tail_consumers?: Array<TailAPI.ConsumerScript>;

  /**
   * Usage model for the Worker invocations.
   */
  usage_model?: 'standard';
}

export namespace ScriptUpdateResponse {
  /**
   * Configuration for
   * [Smart Placement](https://developers.cloudflare.com/workers/configuration/smart-placement).
   */
  export interface Placement {
    /**
     * The last time the script was analyzed for
     * [Smart Placement](https://developers.cloudflare.com/workers/configuration/smart-placement).
     */
    last_analyzed_at?: string;

    /**
     * Enables
     * [Smart Placement](https://developers.cloudflare.com/workers/configuration/smart-placement).
     */
    mode?: 'smart';

    /**
     * Status of
     * [Smart Placement](https://developers.cloudflare.com/workers/configuration/smart-placement).
     */
    status?: 'SUCCESS' | 'UNSUPPORTED_APPLICATION' | 'INSUFFICIENT_INVOCATIONS';
  }
}

export type ScriptDeleteResponse = unknown;

export type ScriptGetResponse = string;

export interface ScriptUpdateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param: JSON encoded metadata about the uploaded parts and Worker
   * configuration.
   */
  metadata: ScriptUpdateParams.Metadata;

  files?: { [key: string]: Core.Uploadable };
}

export namespace ScriptUpdateParams {
  /**
   * JSON encoded metadata about the uploaded parts and Worker configuration.
   */
  export interface Metadata {
    /**
     * Configuration for assets within a Worker.
     */
    assets?: Metadata.Assets;

    /**
     * List of bindings attached to a Worker. You can find more about bindings on our
     * docs:
     * https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/#bindings.
     */
    bindings?: Array<
      | Metadata.WorkersBindingKindAI
      | Metadata.WorkersBindingKindAnalyticsEngine
      | Metadata.WorkersBindingKindAssets
      | Metadata.WorkersBindingKindBrowser
      | Metadata.WorkersBindingKindD1
      | Metadata.WorkersBindingKindDispatchNamespace
      | Metadata.WorkersBindingKindDurableObjectNamespace
      | Metadata.WorkersBindingKindHyperdrive
      | Metadata.WorkersBindingKindJson
      | Metadata.WorkersBindingKindKVNamespace
      | Metadata.WorkersBindingKindMTLSCertificate
      | Metadata.WorkersBindingKindPlainText
      | Metadata.WorkersBindingKindPipelines
      | Metadata.WorkersBindingKindQueue
      | Metadata.WorkersBindingKindR2Bucket
      | Metadata.WorkersBindingKindSecretText
      | Metadata.WorkersBindingKindService
      | Metadata.WorkersBindingKindTailConsumer
      | Metadata.WorkersBindingKindVectorize
      | Metadata.WorkersBindingKindVersionMetadata
      | Metadata.WorkersBindingKindSecretsStoreSecret
      | Metadata.WorkersBindingKindSecretKey
      | Metadata.WorkersBindingKindWorkflow
    >;

    /**
     * Name of the part in the multipart request that contains the script (e.g. the
     * file adding a listener to the `fetch` event). Indicates a
     * `service worker syntax` Worker.
     */
    body_part?: string;

    /**
     * Date indicating targeted support in the Workers runtime. Backwards incompatible
     * fixes to the runtime following this date will not affect this Worker.
     */
    compatibility_date?: string;

    /**
     * Flags that enable or disable certain features in the Workers runtime. Used to
     * enable upcoming features or opt in or out of specific changes not included in a
     * `compatibility_date`.
     */
    compatibility_flags?: Array<string>;

    /**
     * Retain assets which exist for a previously uploaded Worker version; used in lieu
     * of providing a completion token.
     */
    keep_assets?: boolean;

    /**
     * List of binding types to keep from previous_upload.
     */
    keep_bindings?: Array<string>;

    /**
     * Whether Logpush is turned on for the Worker.
     */
    logpush?: boolean;

    /**
     * Name of the part in the multipart request that contains the main module (e.g.
     * the file exporting a `fetch` handler). Indicates a `module syntax` Worker.
     */
    main_module?: string;

    /**
     * Migrations to apply for Durable Objects associated with this Worker.
     */
    migrations?: WorkersAPI.SingleStepMigrationParam | Metadata.WorkersMultipleStepMigrations;

    /**
     * Observability settings for the Worker.
     */
    observability?: Metadata.Observability;

    /**
     * Configuration for
     * [Smart Placement](https://developers.cloudflare.com/workers/configuration/smart-placement).
     */
    placement?: Metadata.Placement;

    /**
     * List of strings to use as tags for this Worker.
     */
    tags?: Array<string>;

    /**
     * List of Workers that will consume logs from the attached Worker.
     */
    tail_consumers?: Array<TailAPI.ConsumerScriptParam>;

    /**
     * Usage model for the Worker invocations.
     */
    usage_model?: 'standard';
  }

  export namespace Metadata {
    /**
     * Configuration for assets within a Worker.
     */
    export interface Assets {
      /**
       * Configuration for assets within a Worker.
       */
      config?: Assets.Config;

      /**
       * Token provided upon successful upload of all files from a registered manifest.
       */
      jwt?: string;
    }

    export namespace Assets {
      /**
       * Configuration for assets within a Worker.
       */
      export interface Config {
        /**
         * The contents of a \_headers file (used to attach custom headers on asset
         * responses).
         */
        _headers?: string;

        /**
         * The contents of a \_redirects file (used to apply redirects or proxy paths ahead
         * of asset serving).
         */
        _redirects?: string;

        /**
         * Determines the redirects and rewrites of requests for HTML content.
         */
        html_handling?: 'auto-trailing-slash' | 'force-trailing-slash' | 'drop-trailing-slash' | 'none';

        /**
         * Determines the response when a request does not match a static asset, and there
         * is no Worker script.
         */
        not_found_handling?: 'none' | '404-page' | 'single-page-application';

        /**
         * Contains a list path rules to control routing to either the Worker or assets.
         * Glob (\*) and negative (!) rules are supported. Rules must start with either '/'
         * or '!/'. At least one non-negative rule must be provided, and negative rules
         * have higher precedence than non-negative rules.
         */
        run_worker_first?: Array<string> | boolean;

        /**
         * @deprecated When true and the incoming request matches an asset, that will be
         * served instead of invoking the Worker script. When false, requests will always
         * invoke the Worker script.
         */
        serve_directly?: boolean;
      }
    }

    export interface WorkersBindingKindAI {
      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'ai';
    }

    export interface WorkersBindingKindAnalyticsEngine {
      /**
       * The name of the dataset to bind to.
       */
      dataset: string;

      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'analytics_engine';
    }

    export interface WorkersBindingKindAssets {
      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'assets';
    }

    export interface WorkersBindingKindBrowser {
      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'browser';
    }

    export interface WorkersBindingKindD1 {
      /**
       * Identifier of the D1 database to bind to.
       */
      id: string;

      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'd1';
    }

    export interface WorkersBindingKindDispatchNamespace {
      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * Namespace to bind to.
       */
      namespace: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'dispatch_namespace';

      /**
       * Outbound worker.
       */
      outbound?: WorkersBindingKindDispatchNamespace.Outbound;
    }

    export namespace WorkersBindingKindDispatchNamespace {
      /**
       * Outbound worker.
       */
      export interface Outbound {
        /**
         * Pass information from the Dispatch Worker to the Outbound Worker through the
         * parameters.
         */
        params?: Array<string>;

        /**
         * Outbound worker.
         */
        worker?: Outbound.Worker;
      }

      export namespace Outbound {
        /**
         * Outbound worker.
         */
        export interface Worker {
          /**
           * Environment of the outbound worker.
           */
          environment?: string;

          /**
           * Name of the outbound worker.
           */
          service?: string;
        }
      }
    }

    export interface WorkersBindingKindDurableObjectNamespace {
      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'durable_object_namespace';

      /**
       * The exported class name of the Durable Object.
       */
      class_name?: string;

      /**
       * The environment of the script_name to bind to.
       */
      environment?: string;

      /**
       * Namespace identifier tag.
       */
      namespace_id?: string;

      /**
       * The script where the Durable Object is defined, if it is external to this
       * Worker.
       */
      script_name?: string;
    }

    export interface WorkersBindingKindHyperdrive {
      /**
       * Identifier of the Hyperdrive connection to bind to.
       */
      id: string;

      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'hyperdrive';
    }

    export interface WorkersBindingKindJson {
      /**
       * JSON data to use.
       */
      json: string;

      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'json';
    }

    export interface WorkersBindingKindKVNamespace {
      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * Namespace identifier tag.
       */
      namespace_id: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'kv_namespace';
    }

    export interface WorkersBindingKindMTLSCertificate {
      /**
       * Identifier of the certificate to bind to.
       */
      certificate_id: string;

      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'mtls_certificate';
    }

    export interface WorkersBindingKindPlainText {
      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * The text value to use.
       */
      text: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'plain_text';
    }

    export interface WorkersBindingKindPipelines {
      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * Name of the Pipeline to bind to.
       */
      pipeline: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'pipelines';
    }

    export interface WorkersBindingKindQueue {
      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * Name of the Queue to bind to.
       */
      queue_name: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'queue';
    }

    export interface WorkersBindingKindR2Bucket {
      /**
       * R2 bucket to bind to.
       */
      bucket_name: string;

      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'r2_bucket';
    }

    export interface WorkersBindingKindSecretText {
      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * The secret value to use.
       */
      text: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'secret_text';
    }

    export interface WorkersBindingKindService {
      /**
       * Optional environment if the Worker utilizes one.
       */
      environment: string;

      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * Name of Worker to bind to.
       */
      service: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'service';
    }

    export interface WorkersBindingKindTailConsumer {
      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * Name of Tail Worker to bind to.
       */
      service: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'tail_consumer';
    }

    export interface WorkersBindingKindVectorize {
      /**
       * Name of the Vectorize index to bind to.
       */
      index_name: string;

      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'vectorize';
    }

    export interface WorkersBindingKindVersionMetadata {
      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'version_metadata';
    }

    export interface WorkersBindingKindSecretsStoreSecret {
      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * Name of the secret in the store.
       */
      secret_name: string;

      /**
       * ID of the store containing the secret.
       */
      store_id: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'secrets_store_secret';
    }

    export interface WorkersBindingKindSecretKey {
      /**
       * Algorithm-specific key parameters.
       * [Learn more](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#algorithm).
       */
      algorithm: unknown;

      /**
       * Data format of the key.
       * [Learn more](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#format).
       */
      format: 'raw' | 'pkcs8' | 'spki' | 'jwk';

      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'secret_key';

      /**
       * Allowed operations with the key.
       * [Learn more](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#keyUsages).
       */
      usages: Array<
        'encrypt' | 'decrypt' | 'sign' | 'verify' | 'deriveKey' | 'deriveBits' | 'wrapKey' | 'unwrapKey'
      >;

      /**
       * Base64-encoded key data. Required if `format` is "raw", "pkcs8", or "spki".
       */
      key_base64?: string;

      /**
       * Key data in
       * [JSON Web Key](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#json_web_key)
       * format. Required if `format` is "jwk".
       */
      key_jwk?: unknown;
    }

    export interface WorkersBindingKindWorkflow {
      /**
       * A JavaScript variable name for the binding.
       */
      name: string;

      /**
       * The kind of resource that the binding provides.
       */
      type: 'workflow';

      /**
       * Name of the Workflow to bind to.
       */
      workflow_name: string;

      /**
       * Class name of the Workflow. Should only be provided if the Workflow belongs to
       * this script.
       */
      class_name?: string;

      /**
       * Script name that contains the Workflow. If not provided, defaults to this script
       * name.
       */
      script_name?: string;
    }

    export interface WorkersMultipleStepMigrations {
      /**
       * Tag to set as the latest migration tag.
       */
      new_tag?: string;

      /**
       * Tag used to verify against the latest migration tag for this Worker. If they
       * don't match, the upload is rejected.
       */
      old_tag?: string;

      /**
       * Migrations to apply in order.
       */
      steps?: Array<WorkersAPI.MigrationStepParam>;
    }

    /**
     * Observability settings for the Worker.
     */
    export interface Observability {
      /**
       * Whether observability is enabled for the Worker.
       */
      enabled: boolean;

      /**
       * The sampling rate for incoming requests. From 0 to 1 (1 = 100%, 0.1 = 10%).
       * Default is 1.
       */
      head_sampling_rate?: number | null;

      /**
       * Log settings for the Worker.
       */
      logs?: Observability.Logs | null;
    }

    export namespace Observability {
      /**
       * Log settings for the Worker.
       */
      export interface Logs {
        /**
         * Whether logs are enabled for the Worker.
         */
        enabled: boolean;

        /**
         * Whether
         * [invocation logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/#invocation-logs)
         * are enabled for the Worker.
         */
        invocation_logs: boolean;

        /**
         * The sampling rate for logs. From 0 to 1 (1 = 100%, 0.1 = 10%). Default is 1.
         */
        head_sampling_rate?: number | null;
      }
    }

    /**
     * Configuration for
     * [Smart Placement](https://developers.cloudflare.com/workers/configuration/smart-placement).
     */
    export interface Placement {
      /**
       * Enables
       * [Smart Placement](https://developers.cloudflare.com/workers/configuration/smart-placement).
       */
      mode?: 'smart';
    }
  }
}

export interface ScriptListParams {
  /**
   * Identifier.
   */
  account_id: string;
}

export interface ScriptDeleteParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Query param: If set to true, delete will not be stopped by associated service
   * binding, durable object, or other binding. Any of these associated
   * bindings/durable objects will be deleted along with the script.
   */
  force?: boolean;
}

export interface ScriptGetParams {
  /**
   * Identifier.
   */
  account_id: string;
}

Scripts.ScriptsSinglePage = ScriptsSinglePage;
Scripts.Assets = AssetsAPIAssets;
Scripts.Subdomain = Subdomain;
Scripts.Schedules = Schedules;
Scripts.Tail = Tail;
Scripts.Content = Content;
Scripts.Settings = Settings;
Scripts.Deployments = Deployments;
Scripts.Versions = Versions;
Scripts.VersionListResponsesV4PagePagination = VersionListResponsesV4PagePagination;
Scripts.Secrets = Secrets;
Scripts.SecretListResponsesSinglePage = SecretListResponsesSinglePage;
Scripts.ScriptAndVersionSettings = ScriptAndVersionSettings;

export declare namespace Scripts {
  export {
    type Script as Script,
    type ScriptSetting as ScriptSetting,
    type ScriptUpdateResponse as ScriptUpdateResponse,
    type ScriptDeleteResponse as ScriptDeleteResponse,
    type ScriptGetResponse as ScriptGetResponse,
    ScriptsSinglePage as ScriptsSinglePage,
    type ScriptUpdateParams as ScriptUpdateParams,
    type ScriptListParams as ScriptListParams,
    type ScriptDeleteParams as ScriptDeleteParams,
    type ScriptGetParams as ScriptGetParams,
  };

  export { AssetsAPIAssets as Assets };

  export {
    Subdomain as Subdomain,
    type SubdomainCreateResponse as SubdomainCreateResponse,
    type SubdomainDeleteResponse as SubdomainDeleteResponse,
    type SubdomainGetResponse as SubdomainGetResponse,
    type SubdomainCreateParams as SubdomainCreateParams,
    type SubdomainDeleteParams as SubdomainDeleteParams,
    type SubdomainGetParams as SubdomainGetParams,
  };

  export {
    Schedules as Schedules,
    type ScheduleUpdateResponse as ScheduleUpdateResponse,
    type ScheduleGetResponse as ScheduleGetResponse,
    type ScheduleUpdateParams as ScheduleUpdateParams,
    type ScheduleGetParams as ScheduleGetParams,
  };

  export {
    Tail as Tail,
    type ConsumerScript as ConsumerScript,
    type TailCreateResponse as TailCreateResponse,
    type TailDeleteResponse as TailDeleteResponse,
    type TailGetResponse as TailGetResponse,
    type TailCreateParams as TailCreateParams,
    type TailDeleteParams as TailDeleteParams,
    type TailGetParams as TailGetParams,
  };

  export {
    Content as Content,
    type ContentUpdateParams as ContentUpdateParams,
    type ContentGetParams as ContentGetParams,
  };

  export {
    Settings as Settings,
    type SettingEditParams as SettingEditParams,
    type SettingGetParams as SettingGetParams,
  };

  export {
    Deployments as Deployments,
    type Deployment as Deployment,
    type DeploymentCreateResponse as DeploymentCreateResponse,
    type DeploymentGetResponse as DeploymentGetResponse,
    type DeploymentCreateParams as DeploymentCreateParams,
    type DeploymentGetParams as DeploymentGetParams,
  };

  export {
    Versions as Versions,
    type VersionCreateResponse as VersionCreateResponse,
    type VersionListResponse as VersionListResponse,
    type VersionGetResponse as VersionGetResponse,
    VersionListResponsesV4PagePagination as VersionListResponsesV4PagePagination,
    type VersionCreateParams as VersionCreateParams,
    type VersionListParams as VersionListParams,
    type VersionGetParams as VersionGetParams,
  };

  export {
    Secrets as Secrets,
    type SecretUpdateResponse as SecretUpdateResponse,
    type SecretListResponse as SecretListResponse,
    type SecretDeleteResponse as SecretDeleteResponse,
    type SecretGetResponse as SecretGetResponse,
    SecretListResponsesSinglePage as SecretListResponsesSinglePage,
    type SecretUpdateParams as SecretUpdateParams,
    type SecretListParams as SecretListParams,
    type SecretDeleteParams as SecretDeleteParams,
    type SecretGetParams as SecretGetParams,
  };

  export {
    ScriptAndVersionSettings as ScriptAndVersionSettings,
    type ScriptAndVersionSettingEditResponse as ScriptAndVersionSettingEditResponse,
    type ScriptAndVersionSettingGetResponse as ScriptAndVersionSettingGetResponse,
    type ScriptAndVersionSettingEditParams as ScriptAndVersionSettingEditParams,
    type ScriptAndVersionSettingGetParams as ScriptAndVersionSettingGetParams,
  };
}
