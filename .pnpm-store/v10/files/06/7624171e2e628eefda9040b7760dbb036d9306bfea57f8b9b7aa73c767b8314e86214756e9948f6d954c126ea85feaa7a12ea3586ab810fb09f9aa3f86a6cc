import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as SippyAPI from "./sippy.js";
export declare class SippyResource extends APIResource {
    /**
     * Sets configuration for Sippy for an existing R2 bucket.
     *
     * @example
     * ```ts
     * const sippy = await client.r2.buckets.sippy.update(
     *   'example-bucket',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(bucketName: string, params: SippyUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Sippy>;
    /**
     * Disables Sippy on this bucket.
     *
     * @example
     * ```ts
     * const sippy = await client.r2.buckets.sippy.delete(
     *   'example-bucket',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(bucketName: string, params: SippyDeleteParams, options?: Core.RequestOptions): Core.APIPromise<SippyDeleteResponse>;
    /**
     * Gets configuration for Sippy for an existing R2 bucket.
     *
     * @example
     * ```ts
     * const sippy = await client.r2.buckets.sippy.get(
     *   'example-bucket',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(bucketName: string, params: SippyGetParams, options?: Core.RequestOptions): Core.APIPromise<Sippy>;
}
export type Provider = 'r2';
export type ProviderParam = 'r2';
export interface Sippy {
    /**
     * Details about the configured destination bucket.
     */
    destination?: Sippy.Destination;
    /**
     * State of Sippy for this bucket.
     */
    enabled?: boolean;
    /**
     * Details about the configured source bucket.
     */
    source?: Sippy.Source;
}
export declare namespace Sippy {
    /**
     * Details about the configured destination bucket.
     */
    interface Destination {
        /**
         * ID of the Cloudflare API token used when writing objects to this bucket.
         */
        accessKeyId?: string;
        account?: string;
        /**
         * Name of the bucket on the provider.
         */
        bucket?: string;
        provider?: SippyAPI.Provider;
    }
    /**
     * Details about the configured source bucket.
     */
    interface Source {
        /**
         * Name of the bucket on the provider.
         */
        bucket?: string;
        provider?: 'aws' | 'gcs';
        /**
         * Region where the bucket resides (AWS only).
         */
        region?: string | null;
    }
}
export interface SippyDeleteResponse {
    enabled?: false;
}
export type SippyUpdateParams = SippyUpdateParams.R2EnableSippyAws | SippyUpdateParams.R2EnableSippyGcs;
export declare namespace SippyUpdateParams {
    interface R2EnableSippyAws {
        /**
         * Path param: Account ID.
         */
        account_id: string;
        /**
         * Body param: R2 bucket to copy objects to.
         */
        destination?: R2EnableSippyAws.Destination;
        /**
         * Body param: AWS S3 bucket to copy objects from.
         */
        source?: R2EnableSippyAws.Source;
        /**
         * Header param: Jurisdiction where objects in this bucket are guaranteed to be
         * stored.
         */
        jurisdiction?: 'default' | 'eu' | 'fedramp';
    }
    namespace R2EnableSippyAws {
        /**
         * R2 bucket to copy objects to.
         */
        interface Destination {
            /**
             * ID of a Cloudflare API token. This is the value labelled "Access Key ID" when
             * creating an API. token from the
             * [R2 dashboard](https://dash.cloudflare.com/?to=/:account/r2/api-tokens).
             *
             * Sippy will use this token when writing objects to R2, so it is best to scope
             * this token to the bucket you're enabling Sippy for.
             */
            accessKeyId?: string;
            provider?: SippyAPI.ProviderParam;
            /**
             * Value of a Cloudflare API token. This is the value labelled "Secret Access Key"
             * when creating an API. token from the
             * [R2 dashboard](https://dash.cloudflare.com/?to=/:account/r2/api-tokens).
             *
             * Sippy will use this token when writing objects to R2, so it is best to scope
             * this token to the bucket you're enabling Sippy for.
             */
            secretAccessKey?: string;
        }
        /**
         * AWS S3 bucket to copy objects from.
         */
        interface Source {
            /**
             * Access Key ID of an IAM credential (ideally scoped to a single S3 bucket).
             */
            accessKeyId?: string;
            /**
             * Name of the AWS S3 bucket.
             */
            bucket?: string;
            provider?: 'aws';
            /**
             * Name of the AWS availability zone.
             */
            region?: string;
            /**
             * Secret Access Key of an IAM credential (ideally scoped to a single S3 bucket).
             */
            secretAccessKey?: string;
        }
    }
    interface R2EnableSippyGcs {
        /**
         * Path param: Account ID.
         */
        account_id: string;
        /**
         * Body param: R2 bucket to copy objects to.
         */
        destination?: R2EnableSippyGcs.Destination;
        /**
         * Body param: GCS bucket to copy objects from.
         */
        source?: R2EnableSippyGcs.Source;
        /**
         * Header param: Jurisdiction where objects in this bucket are guaranteed to be
         * stored.
         */
        jurisdiction?: 'default' | 'eu' | 'fedramp';
    }
    namespace R2EnableSippyGcs {
        /**
         * R2 bucket to copy objects to.
         */
        interface Destination {
            /**
             * ID of a Cloudflare API token. This is the value labelled "Access Key ID" when
             * creating an API. token from the
             * [R2 dashboard](https://dash.cloudflare.com/?to=/:account/r2/api-tokens).
             *
             * Sippy will use this token when writing objects to R2, so it is best to scope
             * this token to the bucket you're enabling Sippy for.
             */
            accessKeyId?: string;
            provider?: SippyAPI.ProviderParam;
            /**
             * Value of a Cloudflare API token. This is the value labelled "Secret Access Key"
             * when creating an API. token from the
             * [R2 dashboard](https://dash.cloudflare.com/?to=/:account/r2/api-tokens).
             *
             * Sippy will use this token when writing objects to R2, so it is best to scope
             * this token to the bucket you're enabling Sippy for.
             */
            secretAccessKey?: string;
        }
        /**
         * GCS bucket to copy objects from.
         */
        interface Source {
            /**
             * Name of the GCS bucket.
             */
            bucket?: string;
            /**
             * Client email of an IAM credential (ideally scoped to a single GCS bucket).
             */
            clientEmail?: string;
            /**
             * Private Key of an IAM credential (ideally scoped to a single GCS bucket).
             */
            privateKey?: string;
            provider?: 'gcs';
        }
    }
}
export interface SippyDeleteParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Header param: Jurisdiction where objects in this bucket are guaranteed to be
     * stored.
     */
    jurisdiction?: 'default' | 'eu' | 'fedramp';
}
export interface SippyGetParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Header param: Jurisdiction where objects in this bucket are guaranteed to be
     * stored.
     */
    jurisdiction?: 'default' | 'eu' | 'fedramp';
}
export declare namespace SippyResource {
    export { type Provider as Provider, type Sippy as Sippy, type SippyDeleteResponse as SippyDeleteResponse, type SippyUpdateParams as SippyUpdateParams, type SippyDeleteParams as SippyDeleteParams, type SippyGetParams as SippyGetParams, };
}
//# sourceMappingURL=sippy.d.ts.map