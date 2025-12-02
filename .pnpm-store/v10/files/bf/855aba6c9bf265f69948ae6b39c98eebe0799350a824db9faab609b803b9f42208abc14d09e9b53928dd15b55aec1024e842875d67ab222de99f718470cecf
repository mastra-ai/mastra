import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as SippyAPI from "../buckets/sippy.js";
export declare class ConnectivityPrecheck extends APIResource {
    /**
     * Check whether tokens are valid against the source bucket
     *
     * @example
     * ```ts
     * const response =
     *   await client.r2.superSlurper.connectivityPrecheck.source({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    source(params: ConnectivityPrecheckSourceParams, options?: Core.RequestOptions): Core.APIPromise<ConnectivityPrecheckSourceResponse>;
    /**
     * Check whether tokens are valid against the target bucket
     *
     * @example
     * ```ts
     * const response =
     *   await client.r2.superSlurper.connectivityPrecheck.target({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    target(params: ConnectivityPrecheckTargetParams, options?: Core.RequestOptions): Core.APIPromise<ConnectivityPrecheckTargetResponse>;
}
export interface ConnectivityPrecheckSourceResponse {
    connectivityStatus?: 'success' | 'error';
}
export interface ConnectivityPrecheckTargetResponse {
    connectivityStatus?: 'success' | 'error';
}
export type ConnectivityPrecheckSourceParams = ConnectivityPrecheckSourceParams.R2SlurperS3SourceSchema | ConnectivityPrecheckSourceParams.R2SlurperGcsSourceSchema | ConnectivityPrecheckSourceParams.R2SlurperR2SourceSchema;
export declare namespace ConnectivityPrecheckSourceParams {
    interface R2SlurperS3SourceSchema {
        /**
         * Path param:
         */
        account_id: string;
        /**
         * Body param:
         */
        bucket?: string;
        /**
         * Body param:
         */
        endpoint?: string | null;
        /**
         * Body param:
         */
        secret?: R2SlurperS3SourceSchema.Secret;
        /**
         * Body param:
         */
        vendor?: 's3';
    }
    namespace R2SlurperS3SourceSchema {
        interface Secret {
            accessKeyId?: string;
            secretAccessKey?: string;
        }
    }
    interface R2SlurperGcsSourceSchema {
        /**
         * Path param:
         */
        account_id: string;
        /**
         * Body param:
         */
        bucket?: string;
        /**
         * Body param:
         */
        secret?: R2SlurperGcsSourceSchema.Secret;
        /**
         * Body param:
         */
        vendor?: 'gcs';
    }
    namespace R2SlurperGcsSourceSchema {
        interface Secret {
            clientEmail?: string;
            privateKey?: string;
        }
    }
    interface R2SlurperR2SourceSchema {
        /**
         * Path param:
         */
        account_id: string;
        /**
         * Body param:
         */
        bucket?: string;
        /**
         * Body param:
         */
        jurisdiction?: 'default' | 'eu' | 'fedramp';
        /**
         * Body param:
         */
        secret?: R2SlurperR2SourceSchema.Secret;
        /**
         * Body param:
         */
        vendor?: SippyAPI.ProviderParam;
    }
    namespace R2SlurperR2SourceSchema {
        interface Secret {
            accessKeyId?: string;
            secretAccessKey?: string;
        }
    }
}
export interface ConnectivityPrecheckTargetParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    bucket?: string;
    /**
     * Body param:
     */
    jurisdiction?: 'default' | 'eu' | 'fedramp';
    /**
     * Body param:
     */
    secret?: ConnectivityPrecheckTargetParams.Secret;
    /**
     * Body param:
     */
    vendor?: SippyAPI.ProviderParam;
}
export declare namespace ConnectivityPrecheckTargetParams {
    interface Secret {
        accessKeyId?: string;
        secretAccessKey?: string;
    }
}
export declare namespace ConnectivityPrecheck {
    export { type ConnectivityPrecheckSourceResponse as ConnectivityPrecheckSourceResponse, type ConnectivityPrecheckTargetResponse as ConnectivityPrecheckTargetResponse, type ConnectivityPrecheckSourceParams as ConnectivityPrecheckSourceParams, type ConnectivityPrecheckTargetParams as ConnectivityPrecheckTargetParams, };
}
//# sourceMappingURL=connectivity-precheck.d.ts.map