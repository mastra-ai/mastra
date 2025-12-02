import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as DomainsAPI from "./domains.js";
import { DomainCreateParams, DomainCreateResponse, DomainDeleteParams, DomainDeleteResponse, DomainEditParams, DomainEditResponse, DomainGetParams, DomainGetResponse, DomainListParams, DomainListResponse, DomainListResponsesSinglePage, Domains } from "./domains.js";
import * as DeploymentsAPI from "./deployments/deployments.js";
import { DeploymentCreateParams, DeploymentDeleteParams, DeploymentDeleteResponse, DeploymentGetParams, DeploymentListParams, DeploymentRetryParams, DeploymentRollbackParams, Deployments } from "./deployments/deployments.js";
import { SinglePage } from "../../../pagination.js";
export declare class Projects extends APIResource {
    deployments: DeploymentsAPI.Deployments;
    domains: DomainsAPI.Domains;
    /**
     * Create a new project.
     *
     * @example
     * ```ts
     * const project = await client.pages.projects.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params: ProjectCreateParams, options?: Core.RequestOptions): Core.APIPromise<Project>;
    /**
     * Fetch a list of all user projects.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const deployment of client.pages.projects.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params: ProjectListParams, options?: Core.RequestOptions): Core.PagePromise<DeploymentsSinglePage, Deployment>;
    /**
     * Delete a project by name.
     *
     * @example
     * ```ts
     * const project = await client.pages.projects.delete(
     *   'this-is-my-project-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(projectName: string, params: ProjectDeleteParams, options?: Core.RequestOptions): Core.APIPromise<ProjectDeleteResponse | null>;
    /**
     * Set new attributes for an existing project. Modify environment variables. To
     * delete an environment variable, set the key to null.
     *
     * @example
     * ```ts
     * const project = await client.pages.projects.edit(
     *   'this-is-my-project-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(projectName: string, params: ProjectEditParams, options?: Core.RequestOptions): Core.APIPromise<Project>;
    /**
     * Fetch a project by name.
     *
     * @example
     * ```ts
     * const project = await client.pages.projects.get(
     *   'this-is-my-project-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(projectName: string, params: ProjectGetParams, options?: Core.RequestOptions): Core.APIPromise<Project>;
    /**
     * Purge all cached build artifacts for a Pages project
     *
     * @example
     * ```ts
     * const response =
     *   await client.pages.projects.purgeBuildCache(
     *     'this-is-my-project-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    purgeBuildCache(projectName: string, params: ProjectPurgeBuildCacheParams, options?: Core.RequestOptions): Core.APIPromise<ProjectPurgeBuildCacheResponse | null>;
}
export declare class DeploymentsSinglePage extends SinglePage<Deployment> {
}
export interface Deployment {
    /**
     * Id of the deployment.
     */
    id?: string;
    /**
     * A list of alias URLs pointing to this deployment.
     */
    aliases?: Array<string> | null;
    /**
     * Configs for the project build process.
     */
    build_config?: Deployment.BuildConfig;
    /**
     * When the deployment was created.
     */
    created_on?: string;
    /**
     * Info about what caused the deployment.
     */
    deployment_trigger?: Deployment.DeploymentTrigger;
    /**
     * Environment variables used for builds and Pages Functions.
     */
    env_vars?: {
        [key: string]: Deployment.PagesPlainTextEnvVar | null | Deployment.PagesSecretTextEnvVar | null;
    };
    /**
     * Type of deploy.
     */
    environment?: 'preview' | 'production';
    /**
     * If the deployment has been skipped.
     */
    is_skipped?: boolean;
    /**
     * The status of the deployment.
     */
    latest_stage?: Stage;
    /**
     * When the deployment was last modified.
     */
    modified_on?: string;
    /**
     * Id of the project.
     */
    project_id?: string;
    /**
     * Name of the project.
     */
    project_name?: string;
    /**
     * Short Id (8 character) of the deployment.
     */
    short_id?: string;
    source?: Deployment.Source;
    /**
     * List of past stages.
     */
    stages?: Array<Stage>;
    /**
     * The live URL to view this deployment.
     */
    url?: string;
}
export declare namespace Deployment {
    /**
     * Configs for the project build process.
     */
    interface BuildConfig {
        /**
         * Enable build caching for the project.
         */
        build_caching?: boolean | null;
        /**
         * Command used to build project.
         */
        build_command?: string | null;
        /**
         * Output directory of the build.
         */
        destination_dir?: string | null;
        /**
         * Directory to run the command.
         */
        root_dir?: string | null;
        /**
         * The classifying tag for analytics.
         */
        web_analytics_tag?: string | null;
        /**
         * The auth token for analytics.
         */
        web_analytics_token?: string | null;
    }
    /**
     * Info about what caused the deployment.
     */
    interface DeploymentTrigger {
        /**
         * Additional info about the trigger.
         */
        metadata?: DeploymentTrigger.Metadata;
        /**
         * What caused the deployment.
         */
        type?: 'push' | 'ad_hoc';
    }
    namespace DeploymentTrigger {
        /**
         * Additional info about the trigger.
         */
        interface Metadata {
            /**
             * Where the trigger happened.
             */
            branch?: string;
            /**
             * Hash of the deployment trigger commit.
             */
            commit_hash?: string;
            /**
             * Message of the deployment trigger commit.
             */
            commit_message?: string;
        }
    }
    /**
     * A plaintext environment variable.
     */
    interface PagesPlainTextEnvVar {
        type: 'plain_text';
        /**
         * Environment variable value.
         */
        value: string;
    }
    /**
     * An encrypted environment variable.
     */
    interface PagesSecretTextEnvVar {
        type: 'secret_text';
        /**
         * Secret value.
         */
        value: string;
    }
    interface Source {
        config?: Source.Config;
        type?: string;
    }
    namespace Source {
        interface Config {
            deployments_enabled?: boolean;
            owner?: string;
            path_excludes?: Array<string>;
            path_includes?: Array<string>;
            pr_comments_enabled?: boolean;
            preview_branch_excludes?: Array<string>;
            preview_branch_includes?: Array<string>;
            preview_deployment_setting?: 'all' | 'none' | 'custom';
            production_branch?: string;
            production_deployments_enabled?: boolean;
            repo_name?: string;
        }
    }
}
export interface Project {
    /**
     * Id of the project.
     */
    id?: string;
    /**
     * Configs for the project build process.
     */
    build_config?: Project.BuildConfig;
    /**
     * Most recent deployment to the repo.
     */
    canonical_deployment?: Deployment | null;
    /**
     * When the project was created.
     */
    created_on?: string;
    /**
     * Configs for deployments in a project.
     */
    deployment_configs?: Project.DeploymentConfigs;
    /**
     * A list of associated custom domains for the project.
     */
    domains?: Array<string>;
    /**
     * Most recent deployment to the repo.
     */
    latest_deployment?: Deployment | null;
    /**
     * Name of the project.
     */
    name?: string;
    /**
     * Production branch of the project. Used to identify production deployments.
     */
    production_branch?: string;
    source?: Project.Source;
    /**
     * The Cloudflare subdomain associated with the project.
     */
    subdomain?: string;
}
export declare namespace Project {
    /**
     * Configs for the project build process.
     */
    interface BuildConfig {
        /**
         * Enable build caching for the project.
         */
        build_caching?: boolean | null;
        /**
         * Command used to build project.
         */
        build_command?: string | null;
        /**
         * Output directory of the build.
         */
        destination_dir?: string | null;
        /**
         * Directory to run the command.
         */
        root_dir?: string | null;
        /**
         * The classifying tag for analytics.
         */
        web_analytics_tag?: string | null;
        /**
         * The auth token for analytics.
         */
        web_analytics_token?: string | null;
    }
    /**
     * Configs for deployments in a project.
     */
    interface DeploymentConfigs {
        /**
         * Configs for preview deploys.
         */
        preview?: DeploymentConfigs.Preview;
        /**
         * Configs for production deploys.
         */
        production?: DeploymentConfigs.Production;
    }
    namespace DeploymentConfigs {
        /**
         * Configs for preview deploys.
         */
        interface Preview {
            /**
             * Constellation bindings used for Pages Functions.
             */
            ai_bindings?: {
                [key: string]: Preview.AIBindings | null;
            } | null;
            /**
             * Analytics Engine bindings used for Pages Functions.
             */
            analytics_engine_datasets?: {
                [key: string]: Preview.AnalyticsEngineDatasets | null;
            } | null;
            /**
             * Browser bindings used for Pages Functions.
             */
            browsers?: {
                [key: string]: Preview.Browsers | null;
            } | null;
            /**
             * Compatibility date used for Pages Functions.
             */
            compatibility_date?: string;
            /**
             * Compatibility flags used for Pages Functions.
             */
            compatibility_flags?: Array<string>;
            /**
             * D1 databases used for Pages Functions.
             */
            d1_databases?: {
                [key: string]: Preview.D1Databases | null;
            } | null;
            /**
             * Durable Object namespaces used for Pages Functions.
             */
            durable_object_namespaces?: {
                [key: string]: Preview.DurableObjectNamespaces | null;
            } | null;
            /**
             * Environment variables used for builds and Pages Functions.
             */
            env_vars?: {
                [key: string]: Preview.PagesPlainTextEnvVar | null | Preview.PagesSecretTextEnvVar | null;
            };
            /**
             * Hyperdrive bindings used for Pages Functions.
             */
            hyperdrive_bindings?: {
                [key: string]: Preview.HyperdriveBindings | null;
            } | null;
            /**
             * KV namespaces used for Pages Functions.
             */
            kv_namespaces?: {
                [key: string]: Preview.KVNamespaces | null;
            } | null;
            /**
             * mTLS bindings used for Pages Functions.
             */
            mtls_certificates?: {
                [key: string]: Preview.MTLSCertificates | null;
            } | null;
            /**
             * Placement setting used for Pages Functions.
             */
            placement?: Preview.Placement | null;
            /**
             * Queue Producer bindings used for Pages Functions.
             */
            queue_producers?: {
                [key: string]: Preview.QueueProducers | null;
            } | null;
            /**
             * R2 buckets used for Pages Functions.
             */
            r2_buckets?: {
                [key: string]: Preview.R2Buckets | null;
            } | null;
            /**
             * Services used for Pages Functions.
             */
            services?: {
                [key: string]: Preview.Services | null;
            } | null;
            /**
             * Vectorize bindings used for Pages Functions.
             */
            vectorize_bindings?: {
                [key: string]: Preview.VectorizeBindings | null;
            } | null;
        }
        namespace Preview {
            /**
             * AI binding.
             */
            interface AIBindings {
                project_id?: string;
            }
            /**
             * Analytics Engine binding.
             */
            interface AnalyticsEngineDatasets {
                /**
                 * Name of the dataset.
                 */
                dataset?: string;
            }
            /**
             * Browser binding.
             */
            interface Browsers {
            }
            /**
             * D1 binding.
             */
            interface D1Databases {
                /**
                 * UUID of the D1 database.
                 */
                id?: string;
            }
            /**
             * Durable Object binding.
             */
            interface DurableObjectNamespaces {
                /**
                 * ID of the Durable Object namespace.
                 */
                namespace_id?: string;
            }
            /**
             * A plaintext environment variable.
             */
            interface PagesPlainTextEnvVar {
                type: 'plain_text';
                /**
                 * Environment variable value.
                 */
                value: string;
            }
            /**
             * An encrypted environment variable.
             */
            interface PagesSecretTextEnvVar {
                type: 'secret_text';
                /**
                 * Secret value.
                 */
                value: string;
            }
            /**
             * Hyperdrive binding.
             */
            interface HyperdriveBindings {
                id?: string;
            }
            /**
             * KV namespace binding.
             */
            interface KVNamespaces {
                /**
                 * ID of the KV namespace.
                 */
                namespace_id?: string;
            }
            /**
             * mTLS binding.
             */
            interface MTLSCertificates {
                certificate_id?: string;
            }
            /**
             * Placement setting used for Pages Functions.
             */
            interface Placement {
                /**
                 * Placement mode.
                 */
                mode?: string;
            }
            /**
             * Queue Producer binding.
             */
            interface QueueProducers {
                /**
                 * Name of the Queue.
                 */
                name?: string;
            }
            /**
             * R2 binding.
             */
            interface R2Buckets {
                /**
                 * Jurisdiction of the R2 bucket.
                 */
                jurisdiction?: string | null;
                /**
                 * Name of the R2 bucket.
                 */
                name?: string;
            }
            /**
             * Service binding.
             */
            interface Services {
                /**
                 * The entrypoint to bind to.
                 */
                entrypoint?: string | null;
                /**
                 * The Service environment.
                 */
                environment?: string;
                /**
                 * The Service name.
                 */
                service?: string;
            }
            /**
             * Vectorize binding.
             */
            interface VectorizeBindings {
                index_name?: string;
            }
        }
        /**
         * Configs for production deploys.
         */
        interface Production {
            /**
             * Constellation bindings used for Pages Functions.
             */
            ai_bindings?: {
                [key: string]: Production.AIBindings | null;
            } | null;
            /**
             * Analytics Engine bindings used for Pages Functions.
             */
            analytics_engine_datasets?: {
                [key: string]: Production.AnalyticsEngineDatasets | null;
            } | null;
            /**
             * Browser bindings used for Pages Functions.
             */
            browsers?: {
                [key: string]: Production.Browsers | null;
            } | null;
            /**
             * Compatibility date used for Pages Functions.
             */
            compatibility_date?: string;
            /**
             * Compatibility flags used for Pages Functions.
             */
            compatibility_flags?: Array<string>;
            /**
             * D1 databases used for Pages Functions.
             */
            d1_databases?: {
                [key: string]: Production.D1Databases | null;
            } | null;
            /**
             * Durable Object namespaces used for Pages Functions.
             */
            durable_object_namespaces?: {
                [key: string]: Production.DurableObjectNamespaces | null;
            } | null;
            /**
             * Environment variables used for builds and Pages Functions.
             */
            env_vars?: {
                [key: string]: Production.PagesPlainTextEnvVar | null | Production.PagesSecretTextEnvVar | null;
            };
            /**
             * Hyperdrive bindings used for Pages Functions.
             */
            hyperdrive_bindings?: {
                [key: string]: Production.HyperdriveBindings | null;
            } | null;
            /**
             * KV namespaces used for Pages Functions.
             */
            kv_namespaces?: {
                [key: string]: Production.KVNamespaces | null;
            } | null;
            /**
             * mTLS bindings used for Pages Functions.
             */
            mtls_certificates?: {
                [key: string]: Production.MTLSCertificates | null;
            } | null;
            /**
             * Placement setting used for Pages Functions.
             */
            placement?: Production.Placement | null;
            /**
             * Queue Producer bindings used for Pages Functions.
             */
            queue_producers?: {
                [key: string]: Production.QueueProducers | null;
            } | null;
            /**
             * R2 buckets used for Pages Functions.
             */
            r2_buckets?: {
                [key: string]: Production.R2Buckets | null;
            } | null;
            /**
             * Services used for Pages Functions.
             */
            services?: {
                [key: string]: Production.Services | null;
            } | null;
            /**
             * Vectorize bindings used for Pages Functions.
             */
            vectorize_bindings?: {
                [key: string]: Production.VectorizeBindings | null;
            } | null;
        }
        namespace Production {
            /**
             * AI binding.
             */
            interface AIBindings {
                project_id?: string;
            }
            /**
             * Analytics Engine binding.
             */
            interface AnalyticsEngineDatasets {
                /**
                 * Name of the dataset.
                 */
                dataset?: string;
            }
            /**
             * Browser binding.
             */
            interface Browsers {
            }
            /**
             * D1 binding.
             */
            interface D1Databases {
                /**
                 * UUID of the D1 database.
                 */
                id?: string;
            }
            /**
             * Durable Object binding.
             */
            interface DurableObjectNamespaces {
                /**
                 * ID of the Durable Object namespace.
                 */
                namespace_id?: string;
            }
            /**
             * A plaintext environment variable.
             */
            interface PagesPlainTextEnvVar {
                type: 'plain_text';
                /**
                 * Environment variable value.
                 */
                value: string;
            }
            /**
             * An encrypted environment variable.
             */
            interface PagesSecretTextEnvVar {
                type: 'secret_text';
                /**
                 * Secret value.
                 */
                value: string;
            }
            /**
             * Hyperdrive binding.
             */
            interface HyperdriveBindings {
                id?: string;
            }
            /**
             * KV namespace binding.
             */
            interface KVNamespaces {
                /**
                 * ID of the KV namespace.
                 */
                namespace_id?: string;
            }
            /**
             * mTLS binding.
             */
            interface MTLSCertificates {
                certificate_id?: string;
            }
            /**
             * Placement setting used for Pages Functions.
             */
            interface Placement {
                /**
                 * Placement mode.
                 */
                mode?: string;
            }
            /**
             * Queue Producer binding.
             */
            interface QueueProducers {
                /**
                 * Name of the Queue.
                 */
                name?: string;
            }
            /**
             * R2 binding.
             */
            interface R2Buckets {
                /**
                 * Jurisdiction of the R2 bucket.
                 */
                jurisdiction?: string | null;
                /**
                 * Name of the R2 bucket.
                 */
                name?: string;
            }
            /**
             * Service binding.
             */
            interface Services {
                /**
                 * The entrypoint to bind to.
                 */
                entrypoint?: string | null;
                /**
                 * The Service environment.
                 */
                environment?: string;
                /**
                 * The Service name.
                 */
                service?: string;
            }
            /**
             * Vectorize binding.
             */
            interface VectorizeBindings {
                index_name?: string;
            }
        }
    }
    interface Source {
        config?: Source.Config;
        type?: string;
    }
    namespace Source {
        interface Config {
            deployments_enabled?: boolean;
            owner?: string;
            path_excludes?: Array<string>;
            path_includes?: Array<string>;
            pr_comments_enabled?: boolean;
            preview_branch_excludes?: Array<string>;
            preview_branch_includes?: Array<string>;
            preview_deployment_setting?: 'all' | 'none' | 'custom';
            production_branch?: string;
            production_deployments_enabled?: boolean;
            repo_name?: string;
        }
    }
}
/**
 * The status of the deployment.
 */
export interface Stage {
    /**
     * When the stage ended.
     */
    ended_on?: string | null;
    /**
     * The current build stage.
     */
    name?: 'queued' | 'initialize' | 'clone_repo' | 'build' | 'deploy';
    /**
     * When the stage started.
     */
    started_on?: string | null;
    /**
     * State of the current stage.
     */
    status?: 'success' | 'idle' | 'active' | 'failure' | 'canceled';
}
export type ProjectDeleteResponse = unknown;
export type ProjectPurgeBuildCacheResponse = unknown;
export interface ProjectCreateParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: Configs for the project build process.
     */
    build_config?: ProjectCreateParams.BuildConfig;
    /**
     * Body param: Configs for deployments in a project.
     */
    deployment_configs?: ProjectCreateParams.DeploymentConfigs;
    /**
     * Body param: Name of the project.
     */
    name?: string;
    /**
     * Body param: Production branch of the project. Used to identify production
     * deployments.
     */
    production_branch?: string;
    /**
     * Body param:
     */
    source?: ProjectCreateParams.Source;
}
export declare namespace ProjectCreateParams {
    /**
     * Configs for the project build process.
     */
    interface BuildConfig {
        /**
         * Enable build caching for the project.
         */
        build_caching?: boolean | null;
        /**
         * Command used to build project.
         */
        build_command?: string | null;
        /**
         * Output directory of the build.
         */
        destination_dir?: string | null;
        /**
         * Directory to run the command.
         */
        root_dir?: string | null;
        /**
         * The classifying tag for analytics.
         */
        web_analytics_tag?: string | null;
        /**
         * The auth token for analytics.
         */
        web_analytics_token?: string | null;
    }
    /**
     * Configs for deployments in a project.
     */
    interface DeploymentConfigs {
        /**
         * Configs for preview deploys.
         */
        preview?: DeploymentConfigs.Preview;
        /**
         * Configs for production deploys.
         */
        production?: DeploymentConfigs.Production;
    }
    namespace DeploymentConfigs {
        /**
         * Configs for preview deploys.
         */
        interface Preview {
            /**
             * Constellation bindings used for Pages Functions.
             */
            ai_bindings?: {
                [key: string]: Preview.AIBindings | null;
            } | null;
            /**
             * Analytics Engine bindings used for Pages Functions.
             */
            analytics_engine_datasets?: {
                [key: string]: Preview.AnalyticsEngineDatasets | null;
            } | null;
            /**
             * Browser bindings used for Pages Functions.
             */
            browsers?: {
                [key: string]: Preview.Browsers | null;
            } | null;
            /**
             * Compatibility date used for Pages Functions.
             */
            compatibility_date?: string;
            /**
             * Compatibility flags used for Pages Functions.
             */
            compatibility_flags?: Array<string>;
            /**
             * D1 databases used for Pages Functions.
             */
            d1_databases?: {
                [key: string]: Preview.D1Databases | null;
            } | null;
            /**
             * Durable Object namespaces used for Pages Functions.
             */
            durable_object_namespaces?: {
                [key: string]: Preview.DurableObjectNamespaces | null;
            } | null;
            /**
             * Environment variables used for builds and Pages Functions.
             */
            env_vars?: {
                [key: string]: Preview.PagesPlainTextEnvVar | null | Preview.PagesSecretTextEnvVar | null;
            };
            /**
             * Hyperdrive bindings used for Pages Functions.
             */
            hyperdrive_bindings?: {
                [key: string]: Preview.HyperdriveBindings | null;
            } | null;
            /**
             * KV namespaces used for Pages Functions.
             */
            kv_namespaces?: {
                [key: string]: Preview.KVNamespaces | null;
            } | null;
            /**
             * mTLS bindings used for Pages Functions.
             */
            mtls_certificates?: {
                [key: string]: Preview.MTLSCertificates | null;
            } | null;
            /**
             * Placement setting used for Pages Functions.
             */
            placement?: Preview.Placement | null;
            /**
             * Queue Producer bindings used for Pages Functions.
             */
            queue_producers?: {
                [key: string]: Preview.QueueProducers | null;
            } | null;
            /**
             * R2 buckets used for Pages Functions.
             */
            r2_buckets?: {
                [key: string]: Preview.R2Buckets | null;
            } | null;
            /**
             * Services used for Pages Functions.
             */
            services?: {
                [key: string]: Preview.Services | null;
            } | null;
            /**
             * Vectorize bindings used for Pages Functions.
             */
            vectorize_bindings?: {
                [key: string]: Preview.VectorizeBindings | null;
            } | null;
        }
        namespace Preview {
            /**
             * AI binding.
             */
            interface AIBindings {
                project_id?: string;
            }
            /**
             * Analytics Engine binding.
             */
            interface AnalyticsEngineDatasets {
                /**
                 * Name of the dataset.
                 */
                dataset?: string;
            }
            /**
             * Browser binding.
             */
            interface Browsers {
            }
            /**
             * D1 binding.
             */
            interface D1Databases {
                /**
                 * UUID of the D1 database.
                 */
                id?: string;
            }
            /**
             * Durable Object binding.
             */
            interface DurableObjectNamespaces {
                /**
                 * ID of the Durable Object namespace.
                 */
                namespace_id?: string;
            }
            /**
             * A plaintext environment variable.
             */
            interface PagesPlainTextEnvVar {
                type: 'plain_text';
                /**
                 * Environment variable value.
                 */
                value: string;
            }
            /**
             * An encrypted environment variable.
             */
            interface PagesSecretTextEnvVar {
                type: 'secret_text';
                /**
                 * Secret value.
                 */
                value: string;
            }
            /**
             * Hyperdrive binding.
             */
            interface HyperdriveBindings {
                id?: string;
            }
            /**
             * KV namespace binding.
             */
            interface KVNamespaces {
                /**
                 * ID of the KV namespace.
                 */
                namespace_id?: string;
            }
            /**
             * mTLS binding.
             */
            interface MTLSCertificates {
                certificate_id?: string;
            }
            /**
             * Placement setting used for Pages Functions.
             */
            interface Placement {
                /**
                 * Placement mode.
                 */
                mode?: string;
            }
            /**
             * Queue Producer binding.
             */
            interface QueueProducers {
                /**
                 * Name of the Queue.
                 */
                name?: string;
            }
            /**
             * R2 binding.
             */
            interface R2Buckets {
                /**
                 * Jurisdiction of the R2 bucket.
                 */
                jurisdiction?: string | null;
                /**
                 * Name of the R2 bucket.
                 */
                name?: string;
            }
            /**
             * Service binding.
             */
            interface Services {
                /**
                 * The entrypoint to bind to.
                 */
                entrypoint?: string | null;
                /**
                 * The Service environment.
                 */
                environment?: string;
                /**
                 * The Service name.
                 */
                service?: string;
            }
            /**
             * Vectorize binding.
             */
            interface VectorizeBindings {
                index_name?: string;
            }
        }
        /**
         * Configs for production deploys.
         */
        interface Production {
            /**
             * Constellation bindings used for Pages Functions.
             */
            ai_bindings?: {
                [key: string]: Production.AIBindings | null;
            } | null;
            /**
             * Analytics Engine bindings used for Pages Functions.
             */
            analytics_engine_datasets?: {
                [key: string]: Production.AnalyticsEngineDatasets | null;
            } | null;
            /**
             * Browser bindings used for Pages Functions.
             */
            browsers?: {
                [key: string]: Production.Browsers | null;
            } | null;
            /**
             * Compatibility date used for Pages Functions.
             */
            compatibility_date?: string;
            /**
             * Compatibility flags used for Pages Functions.
             */
            compatibility_flags?: Array<string>;
            /**
             * D1 databases used for Pages Functions.
             */
            d1_databases?: {
                [key: string]: Production.D1Databases | null;
            } | null;
            /**
             * Durable Object namespaces used for Pages Functions.
             */
            durable_object_namespaces?: {
                [key: string]: Production.DurableObjectNamespaces | null;
            } | null;
            /**
             * Environment variables used for builds and Pages Functions.
             */
            env_vars?: {
                [key: string]: Production.PagesPlainTextEnvVar | null | Production.PagesSecretTextEnvVar | null;
            };
            /**
             * Hyperdrive bindings used for Pages Functions.
             */
            hyperdrive_bindings?: {
                [key: string]: Production.HyperdriveBindings | null;
            } | null;
            /**
             * KV namespaces used for Pages Functions.
             */
            kv_namespaces?: {
                [key: string]: Production.KVNamespaces | null;
            } | null;
            /**
             * mTLS bindings used for Pages Functions.
             */
            mtls_certificates?: {
                [key: string]: Production.MTLSCertificates | null;
            } | null;
            /**
             * Placement setting used for Pages Functions.
             */
            placement?: Production.Placement | null;
            /**
             * Queue Producer bindings used for Pages Functions.
             */
            queue_producers?: {
                [key: string]: Production.QueueProducers | null;
            } | null;
            /**
             * R2 buckets used for Pages Functions.
             */
            r2_buckets?: {
                [key: string]: Production.R2Buckets | null;
            } | null;
            /**
             * Services used for Pages Functions.
             */
            services?: {
                [key: string]: Production.Services | null;
            } | null;
            /**
             * Vectorize bindings used for Pages Functions.
             */
            vectorize_bindings?: {
                [key: string]: Production.VectorizeBindings | null;
            } | null;
        }
        namespace Production {
            /**
             * AI binding.
             */
            interface AIBindings {
                project_id?: string;
            }
            /**
             * Analytics Engine binding.
             */
            interface AnalyticsEngineDatasets {
                /**
                 * Name of the dataset.
                 */
                dataset?: string;
            }
            /**
             * Browser binding.
             */
            interface Browsers {
            }
            /**
             * D1 binding.
             */
            interface D1Databases {
                /**
                 * UUID of the D1 database.
                 */
                id?: string;
            }
            /**
             * Durable Object binding.
             */
            interface DurableObjectNamespaces {
                /**
                 * ID of the Durable Object namespace.
                 */
                namespace_id?: string;
            }
            /**
             * A plaintext environment variable.
             */
            interface PagesPlainTextEnvVar {
                type: 'plain_text';
                /**
                 * Environment variable value.
                 */
                value: string;
            }
            /**
             * An encrypted environment variable.
             */
            interface PagesSecretTextEnvVar {
                type: 'secret_text';
                /**
                 * Secret value.
                 */
                value: string;
            }
            /**
             * Hyperdrive binding.
             */
            interface HyperdriveBindings {
                id?: string;
            }
            /**
             * KV namespace binding.
             */
            interface KVNamespaces {
                /**
                 * ID of the KV namespace.
                 */
                namespace_id?: string;
            }
            /**
             * mTLS binding.
             */
            interface MTLSCertificates {
                certificate_id?: string;
            }
            /**
             * Placement setting used for Pages Functions.
             */
            interface Placement {
                /**
                 * Placement mode.
                 */
                mode?: string;
            }
            /**
             * Queue Producer binding.
             */
            interface QueueProducers {
                /**
                 * Name of the Queue.
                 */
                name?: string;
            }
            /**
             * R2 binding.
             */
            interface R2Buckets {
                /**
                 * Jurisdiction of the R2 bucket.
                 */
                jurisdiction?: string | null;
                /**
                 * Name of the R2 bucket.
                 */
                name?: string;
            }
            /**
             * Service binding.
             */
            interface Services {
                /**
                 * The entrypoint to bind to.
                 */
                entrypoint?: string | null;
                /**
                 * The Service environment.
                 */
                environment?: string;
                /**
                 * The Service name.
                 */
                service?: string;
            }
            /**
             * Vectorize binding.
             */
            interface VectorizeBindings {
                index_name?: string;
            }
        }
    }
    interface Source {
        config?: Source.Config;
        type?: string;
    }
    namespace Source {
        interface Config {
            deployments_enabled?: boolean;
            owner?: string;
            path_excludes?: Array<string>;
            path_includes?: Array<string>;
            pr_comments_enabled?: boolean;
            preview_branch_excludes?: Array<string>;
            preview_branch_includes?: Array<string>;
            preview_deployment_setting?: 'all' | 'none' | 'custom';
            production_branch?: string;
            production_deployments_enabled?: boolean;
            repo_name?: string;
        }
    }
}
export interface ProjectListParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface ProjectDeleteParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface ProjectEditParams {
    /**
     * Path param: Identifier
     */
    account_id: string;
    /**
     * Body param: Configs for the project build process.
     */
    build_config?: ProjectEditParams.BuildConfig;
    /**
     * Body param: Configs for deployments in a project.
     */
    deployment_configs?: ProjectEditParams.DeploymentConfigs;
    /**
     * Body param: Name of the project.
     */
    name?: string;
    /**
     * Body param: Production branch of the project. Used to identify production
     * deployments.
     */
    production_branch?: string;
    /**
     * Body param:
     */
    source?: ProjectEditParams.Source;
}
export declare namespace ProjectEditParams {
    /**
     * Configs for the project build process.
     */
    interface BuildConfig {
        /**
         * Enable build caching for the project.
         */
        build_caching?: boolean | null;
        /**
         * Command used to build project.
         */
        build_command?: string | null;
        /**
         * Output directory of the build.
         */
        destination_dir?: string | null;
        /**
         * Directory to run the command.
         */
        root_dir?: string | null;
        /**
         * The classifying tag for analytics.
         */
        web_analytics_tag?: string | null;
        /**
         * The auth token for analytics.
         */
        web_analytics_token?: string | null;
    }
    /**
     * Configs for deployments in a project.
     */
    interface DeploymentConfigs {
        /**
         * Configs for preview deploys.
         */
        preview?: DeploymentConfigs.Preview;
        /**
         * Configs for production deploys.
         */
        production?: DeploymentConfigs.Production;
    }
    namespace DeploymentConfigs {
        /**
         * Configs for preview deploys.
         */
        interface Preview {
            /**
             * Constellation bindings used for Pages Functions.
             */
            ai_bindings?: {
                [key: string]: Preview.AIBindings | null;
            } | null;
            /**
             * Analytics Engine bindings used for Pages Functions.
             */
            analytics_engine_datasets?: {
                [key: string]: Preview.AnalyticsEngineDatasets | null;
            } | null;
            /**
             * Browser bindings used for Pages Functions.
             */
            browsers?: {
                [key: string]: Preview.Browsers | null;
            } | null;
            /**
             * Compatibility date used for Pages Functions.
             */
            compatibility_date?: string;
            /**
             * Compatibility flags used for Pages Functions.
             */
            compatibility_flags?: Array<string>;
            /**
             * D1 databases used for Pages Functions.
             */
            d1_databases?: {
                [key: string]: Preview.D1Databases | null;
            } | null;
            /**
             * Durable Object namespaces used for Pages Functions.
             */
            durable_object_namespaces?: {
                [key: string]: Preview.DurableObjectNamespaces | null;
            } | null;
            /**
             * Environment variables used for builds and Pages Functions.
             */
            env_vars?: {
                [key: string]: Preview.PagesPlainTextEnvVar | null | Preview.PagesSecretTextEnvVar | null;
            };
            /**
             * Hyperdrive bindings used for Pages Functions.
             */
            hyperdrive_bindings?: {
                [key: string]: Preview.HyperdriveBindings | null;
            } | null;
            /**
             * KV namespaces used for Pages Functions.
             */
            kv_namespaces?: {
                [key: string]: Preview.KVNamespaces | null;
            } | null;
            /**
             * mTLS bindings used for Pages Functions.
             */
            mtls_certificates?: {
                [key: string]: Preview.MTLSCertificates | null;
            } | null;
            /**
             * Placement setting used for Pages Functions.
             */
            placement?: Preview.Placement | null;
            /**
             * Queue Producer bindings used for Pages Functions.
             */
            queue_producers?: {
                [key: string]: Preview.QueueProducers | null;
            } | null;
            /**
             * R2 buckets used for Pages Functions.
             */
            r2_buckets?: {
                [key: string]: Preview.R2Buckets | null;
            } | null;
            /**
             * Services used for Pages Functions.
             */
            services?: {
                [key: string]: Preview.Services | null;
            } | null;
            /**
             * Vectorize bindings used for Pages Functions.
             */
            vectorize_bindings?: {
                [key: string]: Preview.VectorizeBindings | null;
            } | null;
        }
        namespace Preview {
            /**
             * AI binding.
             */
            interface AIBindings {
                project_id?: string;
            }
            /**
             * Analytics Engine binding.
             */
            interface AnalyticsEngineDatasets {
                /**
                 * Name of the dataset.
                 */
                dataset?: string;
            }
            /**
             * Browser binding.
             */
            interface Browsers {
            }
            /**
             * D1 binding.
             */
            interface D1Databases {
                /**
                 * UUID of the D1 database.
                 */
                id?: string;
            }
            /**
             * Durable Object binding.
             */
            interface DurableObjectNamespaces {
                /**
                 * ID of the Durable Object namespace.
                 */
                namespace_id?: string;
            }
            /**
             * A plaintext environment variable.
             */
            interface PagesPlainTextEnvVar {
                type: 'plain_text';
                /**
                 * Environment variable value.
                 */
                value: string;
            }
            /**
             * An encrypted environment variable.
             */
            interface PagesSecretTextEnvVar {
                type: 'secret_text';
                /**
                 * Secret value.
                 */
                value: string;
            }
            /**
             * Hyperdrive binding.
             */
            interface HyperdriveBindings {
                id?: string;
            }
            /**
             * KV namespace binding.
             */
            interface KVNamespaces {
                /**
                 * ID of the KV namespace.
                 */
                namespace_id?: string;
            }
            /**
             * mTLS binding.
             */
            interface MTLSCertificates {
                certificate_id?: string;
            }
            /**
             * Placement setting used for Pages Functions.
             */
            interface Placement {
                /**
                 * Placement mode.
                 */
                mode?: string;
            }
            /**
             * Queue Producer binding.
             */
            interface QueueProducers {
                /**
                 * Name of the Queue.
                 */
                name?: string;
            }
            /**
             * R2 binding.
             */
            interface R2Buckets {
                /**
                 * Jurisdiction of the R2 bucket.
                 */
                jurisdiction?: string | null;
                /**
                 * Name of the R2 bucket.
                 */
                name?: string;
            }
            /**
             * Service binding.
             */
            interface Services {
                /**
                 * The entrypoint to bind to.
                 */
                entrypoint?: string | null;
                /**
                 * The Service environment.
                 */
                environment?: string;
                /**
                 * The Service name.
                 */
                service?: string;
            }
            /**
             * Vectorize binding.
             */
            interface VectorizeBindings {
                index_name?: string;
            }
        }
        /**
         * Configs for production deploys.
         */
        interface Production {
            /**
             * Constellation bindings used for Pages Functions.
             */
            ai_bindings?: {
                [key: string]: Production.AIBindings | null;
            } | null;
            /**
             * Analytics Engine bindings used for Pages Functions.
             */
            analytics_engine_datasets?: {
                [key: string]: Production.AnalyticsEngineDatasets | null;
            } | null;
            /**
             * Browser bindings used for Pages Functions.
             */
            browsers?: {
                [key: string]: Production.Browsers | null;
            } | null;
            /**
             * Compatibility date used for Pages Functions.
             */
            compatibility_date?: string;
            /**
             * Compatibility flags used for Pages Functions.
             */
            compatibility_flags?: Array<string>;
            /**
             * D1 databases used for Pages Functions.
             */
            d1_databases?: {
                [key: string]: Production.D1Databases | null;
            } | null;
            /**
             * Durable Object namespaces used for Pages Functions.
             */
            durable_object_namespaces?: {
                [key: string]: Production.DurableObjectNamespaces | null;
            } | null;
            /**
             * Environment variables used for builds and Pages Functions.
             */
            env_vars?: {
                [key: string]: Production.PagesPlainTextEnvVar | null | Production.PagesSecretTextEnvVar | null;
            };
            /**
             * Hyperdrive bindings used for Pages Functions.
             */
            hyperdrive_bindings?: {
                [key: string]: Production.HyperdriveBindings | null;
            } | null;
            /**
             * KV namespaces used for Pages Functions.
             */
            kv_namespaces?: {
                [key: string]: Production.KVNamespaces | null;
            } | null;
            /**
             * mTLS bindings used for Pages Functions.
             */
            mtls_certificates?: {
                [key: string]: Production.MTLSCertificates | null;
            } | null;
            /**
             * Placement setting used for Pages Functions.
             */
            placement?: Production.Placement | null;
            /**
             * Queue Producer bindings used for Pages Functions.
             */
            queue_producers?: {
                [key: string]: Production.QueueProducers | null;
            } | null;
            /**
             * R2 buckets used for Pages Functions.
             */
            r2_buckets?: {
                [key: string]: Production.R2Buckets | null;
            } | null;
            /**
             * Services used for Pages Functions.
             */
            services?: {
                [key: string]: Production.Services | null;
            } | null;
            /**
             * Vectorize bindings used for Pages Functions.
             */
            vectorize_bindings?: {
                [key: string]: Production.VectorizeBindings | null;
            } | null;
        }
        namespace Production {
            /**
             * AI binding.
             */
            interface AIBindings {
                project_id?: string;
            }
            /**
             * Analytics Engine binding.
             */
            interface AnalyticsEngineDatasets {
                /**
                 * Name of the dataset.
                 */
                dataset?: string;
            }
            /**
             * Browser binding.
             */
            interface Browsers {
            }
            /**
             * D1 binding.
             */
            interface D1Databases {
                /**
                 * UUID of the D1 database.
                 */
                id?: string;
            }
            /**
             * Durable Object binding.
             */
            interface DurableObjectNamespaces {
                /**
                 * ID of the Durable Object namespace.
                 */
                namespace_id?: string;
            }
            /**
             * A plaintext environment variable.
             */
            interface PagesPlainTextEnvVar {
                type: 'plain_text';
                /**
                 * Environment variable value.
                 */
                value: string;
            }
            /**
             * An encrypted environment variable.
             */
            interface PagesSecretTextEnvVar {
                type: 'secret_text';
                /**
                 * Secret value.
                 */
                value: string;
            }
            /**
             * Hyperdrive binding.
             */
            interface HyperdriveBindings {
                id?: string;
            }
            /**
             * KV namespace binding.
             */
            interface KVNamespaces {
                /**
                 * ID of the KV namespace.
                 */
                namespace_id?: string;
            }
            /**
             * mTLS binding.
             */
            interface MTLSCertificates {
                certificate_id?: string;
            }
            /**
             * Placement setting used for Pages Functions.
             */
            interface Placement {
                /**
                 * Placement mode.
                 */
                mode?: string;
            }
            /**
             * Queue Producer binding.
             */
            interface QueueProducers {
                /**
                 * Name of the Queue.
                 */
                name?: string;
            }
            /**
             * R2 binding.
             */
            interface R2Buckets {
                /**
                 * Jurisdiction of the R2 bucket.
                 */
                jurisdiction?: string | null;
                /**
                 * Name of the R2 bucket.
                 */
                name?: string;
            }
            /**
             * Service binding.
             */
            interface Services {
                /**
                 * The entrypoint to bind to.
                 */
                entrypoint?: string | null;
                /**
                 * The Service environment.
                 */
                environment?: string;
                /**
                 * The Service name.
                 */
                service?: string;
            }
            /**
             * Vectorize binding.
             */
            interface VectorizeBindings {
                index_name?: string;
            }
        }
    }
    interface Source {
        config?: Source.Config;
        type?: string;
    }
    namespace Source {
        interface Config {
            deployments_enabled?: boolean;
            owner?: string;
            path_excludes?: Array<string>;
            path_includes?: Array<string>;
            pr_comments_enabled?: boolean;
            preview_branch_excludes?: Array<string>;
            preview_branch_includes?: Array<string>;
            preview_deployment_setting?: 'all' | 'none' | 'custom';
            production_branch?: string;
            production_deployments_enabled?: boolean;
            repo_name?: string;
        }
    }
}
export interface ProjectGetParams {
    /**
     * Identifier
     */
    account_id: string;
}
export interface ProjectPurgeBuildCacheParams {
    /**
     * Identifier
     */
    account_id: string;
}
export declare namespace Projects {
    export { type Deployment as Deployment, type Project as Project, type Stage as Stage, type ProjectDeleteResponse as ProjectDeleteResponse, type ProjectPurgeBuildCacheResponse as ProjectPurgeBuildCacheResponse, DeploymentsSinglePage as DeploymentsSinglePage, type ProjectCreateParams as ProjectCreateParams, type ProjectListParams as ProjectListParams, type ProjectDeleteParams as ProjectDeleteParams, type ProjectEditParams as ProjectEditParams, type ProjectGetParams as ProjectGetParams, type ProjectPurgeBuildCacheParams as ProjectPurgeBuildCacheParams, };
    export { Deployments as Deployments, type DeploymentDeleteResponse as DeploymentDeleteResponse, type DeploymentCreateParams as DeploymentCreateParams, type DeploymentListParams as DeploymentListParams, type DeploymentDeleteParams as DeploymentDeleteParams, type DeploymentGetParams as DeploymentGetParams, type DeploymentRetryParams as DeploymentRetryParams, type DeploymentRollbackParams as DeploymentRollbackParams, };
    export { Domains as Domains, type DomainCreateResponse as DomainCreateResponse, type DomainListResponse as DomainListResponse, type DomainDeleteResponse as DomainDeleteResponse, type DomainEditResponse as DomainEditResponse, type DomainGetResponse as DomainGetResponse, DomainListResponsesSinglePage as DomainListResponsesSinglePage, type DomainCreateParams as DomainCreateParams, type DomainListParams as DomainListParams, type DomainDeleteParams as DomainDeleteParams, type DomainEditParams as DomainEditParams, type DomainGetParams as DomainGetParams, };
}
//# sourceMappingURL=projects.d.ts.map