"use strict";
/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPoolName = exports.arrayStringifyHelper = exports.getSpanName = exports.getDbValues = exports.getDbStatement = exports.getConnectionAttributes = void 0;
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
/**
 * Get an Attributes map from a mysql connection config object
 *
 * @param config ConnectionConfig
 */
function getConnectionAttributes(config) {
    const { host, port, database, user } = getConfig(config);
    const portNumber = parseInt(port, 10);
    if (!isNaN(portNumber)) {
        return {
            [semantic_conventions_1.SEMATTRS_NET_PEER_NAME]: host,
            [semantic_conventions_1.SEMATTRS_NET_PEER_PORT]: portNumber,
            [semantic_conventions_1.SEMATTRS_DB_CONNECTION_STRING]: getJDBCString(host, port, database),
            [semantic_conventions_1.SEMATTRS_DB_NAME]: database,
            [semantic_conventions_1.SEMATTRS_DB_USER]: user,
        };
    }
    return {
        [semantic_conventions_1.SEMATTRS_NET_PEER_NAME]: host,
        [semantic_conventions_1.SEMATTRS_DB_CONNECTION_STRING]: getJDBCString(host, port, database),
        [semantic_conventions_1.SEMATTRS_DB_NAME]: database,
        [semantic_conventions_1.SEMATTRS_DB_USER]: user,
    };
}
exports.getConnectionAttributes = getConnectionAttributes;
function getConfig(config) {
    const { host, port, database, user } = (config && config.connectionConfig) || config || {};
    return { host, port, database, user };
}
function getJDBCString(host, port, database) {
    let jdbcString = `jdbc:mysql://${host || 'localhost'}`;
    if (typeof port === 'number') {
        jdbcString += `:${port}`;
    }
    if (typeof database === 'string') {
        jdbcString += `/${database}`;
    }
    return jdbcString;
}
/**
 * @returns the database statement being executed.
 */
function getDbStatement(query) {
    if (typeof query === 'string') {
        return query;
    }
    else {
        return query.sql;
    }
}
exports.getDbStatement = getDbStatement;
function getDbValues(query, values) {
    if (typeof query === 'string') {
        return arrayStringifyHelper(values);
    }
    else {
        // According to https://github.com/mysqljs/mysql#performing-queries
        // The values argument will override the values in the option object.
        return arrayStringifyHelper(values || query.values);
    }
}
exports.getDbValues = getDbValues;
/**
 * The span name SHOULD be set to a low cardinality value
 * representing the statement executed on the database.
 *
 * @returns SQL statement without variable arguments or SQL verb
 */
function getSpanName(query) {
    const rawQuery = typeof query === 'object' ? query.sql : query;
    // Extract the SQL verb
    const firstSpace = rawQuery === null || rawQuery === void 0 ? void 0 : rawQuery.indexOf(' ');
    if (typeof firstSpace === 'number' && firstSpace !== -1) {
        return rawQuery === null || rawQuery === void 0 ? void 0 : rawQuery.substring(0, firstSpace);
    }
    return rawQuery;
}
exports.getSpanName = getSpanName;
function arrayStringifyHelper(arr) {
    if (arr)
        return `[${arr.toString()}]`;
    return '';
}
exports.arrayStringifyHelper = arrayStringifyHelper;
function getPoolName(pool) {
    const c = pool.config.connectionConfig;
    let poolName = '';
    poolName += c.host ? `host: '${c.host}', ` : '';
    poolName += c.port ? `port: ${c.port}, ` : '';
    poolName += c.database ? `database: '${c.database}', ` : '';
    poolName += c.user ? `user: '${c.user}'` : '';
    if (!c.user) {
        poolName = poolName.substring(0, poolName.length - 2); //omit last comma
    }
    return poolName.trim();
}
exports.getPoolName = getPoolName;
//# sourceMappingURL=utils.js.map