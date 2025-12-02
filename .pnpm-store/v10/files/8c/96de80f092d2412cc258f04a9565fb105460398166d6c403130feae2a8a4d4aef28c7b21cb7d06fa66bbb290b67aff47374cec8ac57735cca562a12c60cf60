/*! firebase-admin v13.5.0 */
/*!
 * @license
 * Copyright 2024 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { App } from '../app';
import { ConnectorConfig, ExecuteGraphqlResponse, GraphqlOptions } from './data-connect-api';
export declare class DataConnectService {
    private readonly appInternal;
    private dataConnectInstances;
    constructor(app: App);
    getDataConnect(connectorConfig: ConnectorConfig): DataConnect;
    /**
     * Returns the app associated with this `DataConnectService` instance.
     *
     * @returns The app associated with this `DataConnectService` instance.
     */
    get app(): App;
}
/**
 * The Firebase `DataConnect` service interface.
 */
export declare class DataConnect {
    readonly connectorConfig: ConnectorConfig;
    readonly app: App;
    private readonly client;
    /**
     * Execute an arbitrary GraphQL query or mutation
     *
     * @param query - The GraphQL query or mutation.
     * @param options - Optional {@link GraphqlOptions} when executing a GraphQL query or mutation.
     *
     * @returns A promise that fulfills with a `ExecuteGraphqlResponse`.
     */
    executeGraphql<GraphqlResponse, Variables>(query: string, options?: GraphqlOptions<Variables>): Promise<ExecuteGraphqlResponse<GraphqlResponse>>;
    /**
   * Execute an arbitrary read-only GraphQL query
   *
   * @param query - The GraphQL read-only query.
   * @param options - Optional {@link GraphqlOptions} when executing a read-only GraphQL query.
   *
   * @returns A promise that fulfills with a `ExecuteGraphqlResponse`.
   */
    executeGraphqlRead<GraphqlResponse, Variables>(query: string, options?: GraphqlOptions<Variables>): Promise<ExecuteGraphqlResponse<GraphqlResponse>>;
    /**
     * Insert a single row into the specified table.
     *
     * @param tableName - The name of the table to insert data into.
     * @param variables - The data object to insert. The keys should correspond to the column names.
     * @returns A promise that fulfills with a `ExecuteGraphqlResponse`.
     */
    insert<GraphQlResponse, Variables extends object>(tableName: string, variables: Variables): Promise<ExecuteGraphqlResponse<GraphQlResponse>>;
    /**
     * Insert multiple rows into the specified table.
     *
     * @param tableName - The name of the table to insert data into.
     * @param variables - An array of data objects to insert. Each object's keys should correspond to the column names.
     * @returns A promise that fulfills with a `ExecuteGraphqlResponse`.
     */
    insertMany<GraphQlResponse, Variables extends Array<unknown>>(tableName: string, variables: Variables): Promise<ExecuteGraphqlResponse<GraphQlResponse>>;
    /**
     * Insert a single row into the specified table, or update it if it already exists.
     *
     * @param tableName - The name of the table to upsert data into.
     * @param variables - The data object to upsert. The keys should correspond to the column names.
     * @returns A promise that fulfills with a `ExecuteGraphqlResponse`.
     */
    upsert<GraphQlResponse, Variables extends object>(tableName: string, variables: Variables): Promise<ExecuteGraphqlResponse<GraphQlResponse>>;
    /**
     * Insert multiple rows into the specified table, or update them if they already exist.
     *
     * @param tableName - The name of the table to upsert data into.
     * @param variables - An array of data objects to upsert. Each object's keys should correspond to the column names.
     * @returns A promise that fulfills with a `ExecuteGraphqlResponse`.
     */
    upsertMany<GraphQlResponse, Variables extends Array<unknown>>(tableName: string, variables: Variables): Promise<ExecuteGraphqlResponse<GraphQlResponse>>;
}
