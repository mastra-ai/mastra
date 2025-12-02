import { Cluster } from './cluster';
import { NodeCallback } from './utilities';
import { DeployFunctionOptions, DropFunctionOptions, EventingFunction, EventingState, FunctionsStatusOptions, GetAllFunctionsOptions, GetFunctionOptions, PauseFunctionOptions, ResumeFunctionOptions, UpsertFunctionOptions } from './eventingfunctionmanager';
/**
 * ScopeEventingFunctionManager provides an interface for managing the
 * eventing functions on the scope.
 * Uncommitted: This API is subject to change in the future.
 *
 * @category Management
 */
export declare class ScopeEventingFunctionManager {
    private _cluster;
    private _bucketName;
    private _scopeName;
    /**
     * @internal
     */
    constructor(cluster: Cluster, bucketName: string, scopeName: string);
    /**
     * Creates or updates an eventing function.
     *
     * @param functionDefinition The description of the eventing function to upsert.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    upsertFunction(functionDefinition: EventingFunction, options?: UpsertFunctionOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Deletes an eventing function.
     *
     * @param name The name of the eventing function to delete.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    dropFunction(name: string, options?: DropFunctionOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Fetches all eventing functions.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getAllFunctions(options?: GetAllFunctionsOptions, callback?: NodeCallback<EventingFunction[]>): Promise<EventingFunction[]>;
    /**
     * Fetches a specific eventing function.
     *
     * @param name The name of the eventing function to fetch.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getFunction(name: string, options?: GetFunctionOptions, callback?: NodeCallback<EventingFunction>): Promise<EventingFunction>;
    /**
     * Deploys an eventing function.
     *
     * @param name The name of the eventing function to deploy.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    deployFunction(name: string, options?: DeployFunctionOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Undeploys an eventing function.
     *
     * @param name The name of the eventing function to undeploy.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    undeployFunction(name: string, options?: DeployFunctionOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Pauses an eventing function.
     *
     * @param name The name of the eventing function to pause.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    pauseFunction(name: string, options?: PauseFunctionOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Resumes an eventing function.
     *
     * @param name The name of the eventing function to resume.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    resumeFunction(name: string, options?: ResumeFunctionOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Fetches the status of all eventing functions.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    functionsStatus(options?: FunctionsStatusOptions, callback?: NodeCallback<EventingState>): Promise<EventingState>;
}
