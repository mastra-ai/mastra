// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { V4PagePagination, type V4PagePaginationParams } from '../../../pagination';

export class Versions extends APIResource {
  /**
   * Upload a Worker Version without deploying to Cloudflare's network. You can find
   * more about the multipart metadata on our docs:
   * https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/.
   *
   * @example
   * ```ts
   * const version =
   *   await client.workers.scripts.versions.create(
   *     'this-is_my_script-01',
   *     {
   *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *       metadata: { main_module: 'worker.js' },
   *     },
   *   );
   * ```
   */
  create(
    scriptName: string,
    params: VersionCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<VersionCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(
        `/accounts/${account_id}/workers/scripts/${scriptName}/versions`,
        Core.multipartFormRequestOptions({ body, ...options }),
      ) as Core.APIPromise<{ result: VersionCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List of Worker Versions. The first version in the list is the latest version.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const versionListResponse of client.workers.scripts.versions.list(
   *   'this-is_my_script-01',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    scriptName: string,
    params: VersionListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<VersionListResponsesV4PagePagination, VersionListResponse> {
    const { account_id, ...query } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/workers/scripts/${scriptName}/versions`,
      VersionListResponsesV4PagePagination,
      { query, ...options },
    );
  }

  /**
   * Get Version Detail
   *
   * @example
   * ```ts
   * const version = await client.workers.scripts.versions.get(
   *   'this-is_my_script-01',
   *   'bcf48806-b317-4351-9ee7-36e7d557d4de',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * );
   * ```
   */
  get(
    scriptName: string,
    versionId: string,
    params: VersionGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<VersionGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/workers/scripts/${scriptName}/versions/${versionId}`,
        options,
      ) as Core.APIPromise<{ result: VersionGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class VersionListResponsesV4PagePagination extends V4PagePagination<VersionListResponse> {}

export interface VersionCreateResponse {
  resources: VersionCreateResponse.Resources;

  id?: string;

  metadata?: VersionCreateResponse.Metadata;

  number?: number;

  startup_time_ms?: number;
}

export namespace VersionCreateResponse {
  export interface Resources {
    bindings?: Resources.Bindings;

    script?: Resources.Script;

    script_runtime?: Resources.ScriptRuntime;
  }

  export namespace Resources {
    export interface Bindings {
      /**
       * List of bindings attached to a Worker. You can find more about bindings on our
       * docs:
       * https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/#bindings.
       */
      result?: Array<
        | Bindings.WorkersBindingKindAI
        | Bindings.WorkersBindingKindAnalyticsEngine
        | Bindings.WorkersBindingKindAssets
        | Bindings.WorkersBindingKindBrowser
        | Bindings.WorkersBindingKindD1
        | Bindings.WorkersBindingKindDispatchNamespace
        | Bindings.WorkersBindingKindDurableObjectNamespace
        | Bindings.WorkersBindingKindHyperdrive
        | Bindings.WorkersBindingKindJson
        | Bindings.WorkersBindingKindKVNamespace
        | Bindings.WorkersBindingKindMTLSCertificate
        | Bindings.WorkersBindingKindPlainText
        | Bindings.WorkersBindingKindPipelines
        | Bindings.WorkersBindingKindQueue
        | Bindings.WorkersBindingKindR2Bucket
        | Bindings.WorkersBindingKindSecretText
        | Bindings.WorkersBindingKindService
        | Bindings.WorkersBindingKindTailConsumer
        | Bindings.WorkersBindingKindVectorize
        | Bindings.WorkersBindingKindVersionMetadata
        | Bindings.WorkersBindingKindSecretsStoreSecret
        | Bindings.WorkersBindingKindSecretKey
        | Bindings.WorkersBindingKindWorkflow
      >;
    }

    export namespace Bindings {
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
    }

    export interface Script {
      etag?: string;

      handlers?: Array<string>;

      last_deployed_from?: string;

      named_handlers?: Array<Script.NamedHandler>;
    }

    export namespace Script {
      export interface NamedHandler {
        handlers?: Array<string>;

        name?: string;
      }
    }

    export interface ScriptRuntime {
      compatibility_date?: string;

      compatibility_flags?: Array<string>;

      limits?: ScriptRuntime.Limits;

      migration_tag?: string;

      usage_model?: 'bundled' | 'unbound' | 'standard';
    }

    export namespace ScriptRuntime {
      export interface Limits {
        cpu_ms?: number;
      }
    }
  }

  export interface Metadata {
    author_email?: string;

    author_id?: string;

    created_on?: string;

    hasPreview?: boolean;

    modified_on?: string;

    source?:
      | 'unknown'
      | 'api'
      | 'wrangler'
      | 'terraform'
      | 'dash'
      | 'dash_template'
      | 'integration'
      | 'quick_editor'
      | 'playground'
      | 'workersci';
  }
}

export interface VersionListResponse {
  id?: string;

  metadata?: VersionListResponse.Metadata;

  number?: number;
}

export namespace VersionListResponse {
  export interface Metadata {
    author_email?: string;

    author_id?: string;

    created_on?: string;

    hasPreview?: boolean;

    modified_on?: string;

    source?:
      | 'unknown'
      | 'api'
      | 'wrangler'
      | 'terraform'
      | 'dash'
      | 'dash_template'
      | 'integration'
      | 'quick_editor'
      | 'playground'
      | 'workersci';
  }
}

export interface VersionGetResponse {
  resources: VersionGetResponse.Resources;

  id?: string;

  metadata?: VersionGetResponse.Metadata;

  number?: number;
}

export namespace VersionGetResponse {
  export interface Resources {
    bindings?: Resources.Bindings;

    script?: Resources.Script;

    script_runtime?: Resources.ScriptRuntime;
  }

  export namespace Resources {
    export interface Bindings {
      /**
       * List of bindings attached to a Worker. You can find more about bindings on our
       * docs:
       * https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/#bindings.
       */
      result?: Array<
        | Bindings.WorkersBindingKindAI
        | Bindings.WorkersBindingKindAnalyticsEngine
        | Bindings.WorkersBindingKindAssets
        | Bindings.WorkersBindingKindBrowser
        | Bindings.WorkersBindingKindD1
        | Bindings.WorkersBindingKindDispatchNamespace
        | Bindings.WorkersBindingKindDurableObjectNamespace
        | Bindings.WorkersBindingKindHyperdrive
        | Bindings.WorkersBindingKindJson
        | Bindings.WorkersBindingKindKVNamespace
        | Bindings.WorkersBindingKindMTLSCertificate
        | Bindings.WorkersBindingKindPlainText
        | Bindings.WorkersBindingKindPipelines
        | Bindings.WorkersBindingKindQueue
        | Bindings.WorkersBindingKindR2Bucket
        | Bindings.WorkersBindingKindSecretText
        | Bindings.WorkersBindingKindService
        | Bindings.WorkersBindingKindTailConsumer
        | Bindings.WorkersBindingKindVectorize
        | Bindings.WorkersBindingKindVersionMetadata
        | Bindings.WorkersBindingKindSecretsStoreSecret
        | Bindings.WorkersBindingKindSecretKey
        | Bindings.WorkersBindingKindWorkflow
      >;
    }

    export namespace Bindings {
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
    }

    export interface Script {
      etag?: string;

      handlers?: Array<string>;

      last_deployed_from?: string;

      named_handlers?: Array<Script.NamedHandler>;
    }

    export namespace Script {
      export interface NamedHandler {
        handlers?: Array<string>;

        name?: string;
      }
    }

    export interface ScriptRuntime {
      compatibility_date?: string;

      compatibility_flags?: Array<string>;

      limits?: ScriptRuntime.Limits;

      migration_tag?: string;

      usage_model?: 'bundled' | 'unbound' | 'standard';
    }

    export namespace ScriptRuntime {
      export interface Limits {
        cpu_ms?: number;
      }
    }
  }

  export interface Metadata {
    author_email?: string;

    author_id?: string;

    created_on?: string;

    hasPreview?: boolean;

    modified_on?: string;

    source?:
      | 'unknown'
      | 'api'
      | 'wrangler'
      | 'terraform'
      | 'dash'
      | 'dash_template'
      | 'integration'
      | 'quick_editor'
      | 'playground'
      | 'workersci';
  }
}

export interface VersionCreateParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Body param: JSON encoded metadata about the uploaded parts and Worker
   * configuration.
   */
  metadata: VersionCreateParams.Metadata;

  [k: string]: Array<Core.Uploadable> | string | VersionCreateParams.Metadata | undefined;
}

export namespace VersionCreateParams {
  /**
   * JSON encoded metadata about the uploaded parts and Worker configuration.
   */
  export interface Metadata {
    /**
     * Name of the part in the multipart request that contains the main module (e.g.
     * the file exporting a `fetch` handler). Indicates a `module syntax` Worker, which
     * is required for Version Upload.
     */
    main_module: string;

    annotations?: Metadata.Annotations;

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
     * List of binding types to keep from previous_upload.
     */
    keep_bindings?: Array<string>;

    /**
     * Usage model for the Worker invocations.
     */
    usage_model?: 'standard';
  }

  export namespace Metadata {
    export interface Annotations {
      /**
       * Human-readable message about the version. Truncated to 100 bytes.
       */
      'workers/message'?: string;

      /**
       * User-provided identifier for the version.
       */
      'workers/tag'?: string;
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
  }
}

export interface VersionListParams extends V4PagePaginationParams {
  /**
   * Path param: Identifier.
   */
  account_id: string;

  /**
   * Query param: Only return versions that can be used in a deployment. Ignores
   * pagination.
   */
  deployable?: boolean;
}

export interface VersionGetParams {
  /**
   * Identifier.
   */
  account_id: string;
}

Versions.VersionListResponsesV4PagePagination = VersionListResponsesV4PagePagination;

export declare namespace Versions {
  export {
    type VersionCreateResponse as VersionCreateResponse,
    type VersionListResponse as VersionListResponse,
    type VersionGetResponse as VersionGetResponse,
    VersionListResponsesV4PagePagination as VersionListResponsesV4PagePagination,
    type VersionCreateParams as VersionCreateParams,
    type VersionListParams as VersionListParams,
    type VersionGetParams as VersionGetParams,
  };
}
