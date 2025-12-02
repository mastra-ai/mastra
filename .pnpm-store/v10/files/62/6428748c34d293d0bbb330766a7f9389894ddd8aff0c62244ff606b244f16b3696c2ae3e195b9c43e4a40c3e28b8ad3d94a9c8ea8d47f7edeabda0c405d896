/*! firebase-admin v13.5.0 */
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataConnect = exports.DataConnectService = void 0;
const data_connect_api_client_internal_1 = require("./data-connect-api-client-internal");
class DataConnectService {
    constructor(app) {
        this.dataConnectInstances = new Map();
        this.appInternal = app;
    }
    getDataConnect(connectorConfig) {
        const id = `${connectorConfig.location}-${connectorConfig.serviceId}`;
        const dc = this.dataConnectInstances.get(id);
        if (typeof dc !== 'undefined') {
            return dc;
        }
        const newInstance = new DataConnect(connectorConfig, this.appInternal);
        this.dataConnectInstances.set(id, newInstance);
        return newInstance;
    }
    /**
     * Returns the app associated with this `DataConnectService` instance.
     *
     * @returns The app associated with this `DataConnectService` instance.
     */
    get app() {
        return this.appInternal;
    }
}
exports.DataConnectService = DataConnectService;
/**
 * The Firebase `DataConnect` service interface.
 */
class DataConnect {
    /**
     * @param connectorConfig - The connector configuration.
     * @param app - The app for this `DataConnect` service.
     * @constructor
     * @internal
     */
    constructor(connectorConfig, app) {
        this.connectorConfig = connectorConfig;
        this.app = app;
        this.client = new data_connect_api_client_internal_1.DataConnectApiClient(connectorConfig, app);
    }
    /**
     * Execute an arbitrary GraphQL query or mutation
     *
     * @param query - The GraphQL query or mutation.
     * @param options - Optional {@link GraphqlOptions} when executing a GraphQL query or mutation.
     *
     * @returns A promise that fulfills with a `ExecuteGraphqlResponse`.
     */
    executeGraphql(query, options) {
        return this.client.executeGraphql(query, options);
    }
    /**
   * Execute an arbitrary read-only GraphQL query
   *
   * @param query - The GraphQL read-only query.
   * @param options - Optional {@link GraphqlOptions} when executing a read-only GraphQL query.
   *
   * @returns A promise that fulfills with a `ExecuteGraphqlResponse`.
   */
    executeGraphqlRead(query, options) {
        return this.client.executeGraphqlRead(query, options);
    }
    /**
     * Insert a single row into the specified table.
     *
     * @param tableName - The name of the table to insert data into.
     * @param variables - The data object to insert. The keys should correspond to the column names.
     * @returns A promise that fulfills with a `ExecuteGraphqlResponse`.
     */
    insert(tableName, variables) {
        return this.client.insert(tableName, variables);
    }
    /**
     * Insert multiple rows into the specified table.
     *
     * @param tableName - The name of the table to insert data into.
     * @param variables - An array of data objects to insert. Each object's keys should correspond to the column names.
     * @returns A promise that fulfills with a `ExecuteGraphqlResponse`.
     */
    insertMany(tableName, variables) {
        return this.client.insertMany(tableName, variables);
    }
    /**
     * Insert a single row into the specified table, or update it if it already exists.
     *
     * @param tableName - The name of the table to upsert data into.
     * @param variables - The data object to upsert. The keys should correspond to the column names.
     * @returns A promise that fulfills with a `ExecuteGraphqlResponse`.
     */
    upsert(tableName, variables) {
        return this.client.upsert(tableName, variables);
    }
    /**
     * Insert multiple rows into the specified table, or update them if they already exist.
     *
     * @param tableName - The name of the table to upsert data into.
     * @param variables - An array of data objects to upsert. Each object's keys should correspond to the column names.
     * @returns A promise that fulfills with a `ExecuteGraphqlResponse`.
     */
    upsertMany(tableName, variables) {
        return this.client.upsertMany(tableName, variables);
    }
}
exports.DataConnect = DataConnect;
