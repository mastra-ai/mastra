// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../../resource';
import * as Core from '../../../../../core';
import { SinglePage } from '../../../../../pagination';

export class Bindings extends APIResource {
  /**
   * Fetch script bindings from a script uploaded to a Workers for Platforms
   * namespace.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const bindingGetResponse of client.workersForPlatforms.dispatch.namespaces.scripts.bindings.get(
   *   'my-dispatch-namespace',
   *   'this-is_my_script-01',
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  get(
    dispatchNamespace: string,
    scriptName: string,
    params: BindingGetParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<BindingGetResponsesSinglePage, BindingGetResponse> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/bindings`,
      BindingGetResponsesSinglePage,
      options,
    );
  }
}

export class BindingGetResponsesSinglePage extends SinglePage<BindingGetResponse> {}

/**
 * A binding to allow the Worker to communicate with resources.
 */
export type BindingGetResponse =
  | BindingGetResponse.WorkersBindingKindAI
  | BindingGetResponse.WorkersBindingKindAnalyticsEngine
  | BindingGetResponse.WorkersBindingKindAssets
  | BindingGetResponse.WorkersBindingKindBrowser
  | BindingGetResponse.WorkersBindingKindD1
  | BindingGetResponse.WorkersBindingKindDispatchNamespace
  | BindingGetResponse.WorkersBindingKindDurableObjectNamespace
  | BindingGetResponse.WorkersBindingKindHyperdrive
  | BindingGetResponse.WorkersBindingKindJson
  | BindingGetResponse.WorkersBindingKindKVNamespace
  | BindingGetResponse.WorkersBindingKindMTLSCertificate
  | BindingGetResponse.WorkersBindingKindPlainText
  | BindingGetResponse.WorkersBindingKindPipelines
  | BindingGetResponse.WorkersBindingKindQueue
  | BindingGetResponse.WorkersBindingKindR2Bucket
  | BindingGetResponse.WorkersBindingKindSecretText
  | BindingGetResponse.WorkersBindingKindService
  | BindingGetResponse.WorkersBindingKindTailConsumer
  | BindingGetResponse.WorkersBindingKindVectorize
  | BindingGetResponse.WorkersBindingKindVersionMetadata
  | BindingGetResponse.WorkersBindingKindSecretsStoreSecret
  | BindingGetResponse.WorkersBindingKindSecretKey
  | BindingGetResponse.WorkersBindingKindWorkflow;

export namespace BindingGetResponse {
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

export interface BindingGetParams {
  /**
   * Identifier.
   */
  account_id: string;
}

Bindings.BindingGetResponsesSinglePage = BindingGetResponsesSinglePage;

export declare namespace Bindings {
  export {
    type BindingGetResponse as BindingGetResponse,
    BindingGetResponsesSinglePage as BindingGetResponsesSinglePage,
    type BindingGetParams as BindingGetParams,
  };
}
