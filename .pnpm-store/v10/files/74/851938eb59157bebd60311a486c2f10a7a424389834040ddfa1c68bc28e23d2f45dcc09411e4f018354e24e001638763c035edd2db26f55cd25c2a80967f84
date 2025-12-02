"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoDBInstrumentation = void 0;
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
const api_1 = require("@opentelemetry/api");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const internal_types_1 = require("./internal-types");
/** @knipignore */
const version_1 = require("./version");
const DEFAULT_CONFIG = {
    requireParentSpan: true,
};
/** mongodb instrumentation plugin for OpenTelemetry */
class MongoDBInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, Object.assign(Object.assign({}, DEFAULT_CONFIG), config));
    }
    setConfig(config = {}) {
        super.setConfig(Object.assign(Object.assign({}, DEFAULT_CONFIG), config));
    }
    _updateMetricInstruments() {
        this._connectionsUsage = this.meter.createUpDownCounter('db.client.connections.usage', {
            description: 'The number of connections that are currently in state described by the state attribute.',
            unit: '{connection}',
        });
    }
    init() {
        const { v3PatchConnection: v3PatchConnection, v3UnpatchConnection: v3UnpatchConnection, } = this._getV3ConnectionPatches();
        const { v4PatchConnect, v4UnpatchConnect } = this._getV4ConnectPatches();
        const { v4PatchConnectionCallback, v4PatchConnectionPromise, v4UnpatchConnection, } = this._getV4ConnectionPatches();
        const { v4PatchConnectionPool, v4UnpatchConnectionPool } = this._getV4ConnectionPoolPatches();
        const { v4PatchSessions, v4UnpatchSessions } = this._getV4SessionsPatches();
        return [
            new instrumentation_1.InstrumentationNodeModuleDefinition('mongodb', ['>=3.3.0 <4'], undefined, undefined, [
                new instrumentation_1.InstrumentationNodeModuleFile('mongodb/lib/core/wireprotocol/index.js', ['>=3.3.0 <4'], v3PatchConnection, v3UnpatchConnection),
            ]),
            new instrumentation_1.InstrumentationNodeModuleDefinition('mongodb', ['>=4.0.0 <7'], undefined, undefined, [
                new instrumentation_1.InstrumentationNodeModuleFile('mongodb/lib/cmap/connection.js', ['>=4.0.0 <6.4'], v4PatchConnectionCallback, v4UnpatchConnection),
                new instrumentation_1.InstrumentationNodeModuleFile('mongodb/lib/cmap/connection.js', ['>=6.4.0 <7'], v4PatchConnectionPromise, v4UnpatchConnection),
                new instrumentation_1.InstrumentationNodeModuleFile('mongodb/lib/cmap/connection_pool.js', ['>=4.0.0 <6.4'], v4PatchConnectionPool, v4UnpatchConnectionPool),
                new instrumentation_1.InstrumentationNodeModuleFile('mongodb/lib/cmap/connect.js', ['>=4.0.0 <7'], v4PatchConnect, v4UnpatchConnect),
                new instrumentation_1.InstrumentationNodeModuleFile('mongodb/lib/sessions.js', ['>=4.0.0 <7'], v4PatchSessions, v4UnpatchSessions),
            ]),
        ];
    }
    _getV3ConnectionPatches() {
        return {
            v3PatchConnection: (moduleExports) => {
                // patch insert operation
                if ((0, instrumentation_1.isWrapped)(moduleExports.insert)) {
                    this._unwrap(moduleExports, 'insert');
                }
                this._wrap(moduleExports, 'insert', this._getV3PatchOperation('insert'));
                // patch remove operation
                if ((0, instrumentation_1.isWrapped)(moduleExports.remove)) {
                    this._unwrap(moduleExports, 'remove');
                }
                this._wrap(moduleExports, 'remove', this._getV3PatchOperation('remove'));
                // patch update operation
                if ((0, instrumentation_1.isWrapped)(moduleExports.update)) {
                    this._unwrap(moduleExports, 'update');
                }
                this._wrap(moduleExports, 'update', this._getV3PatchOperation('update'));
                // patch other command
                if ((0, instrumentation_1.isWrapped)(moduleExports.command)) {
                    this._unwrap(moduleExports, 'command');
                }
                this._wrap(moduleExports, 'command', this._getV3PatchCommand());
                // patch query
                if ((0, instrumentation_1.isWrapped)(moduleExports.query)) {
                    this._unwrap(moduleExports, 'query');
                }
                this._wrap(moduleExports, 'query', this._getV3PatchFind());
                // patch get more operation on cursor
                if ((0, instrumentation_1.isWrapped)(moduleExports.getMore)) {
                    this._unwrap(moduleExports, 'getMore');
                }
                this._wrap(moduleExports, 'getMore', this._getV3PatchCursor());
                return moduleExports;
            },
            v3UnpatchConnection: (moduleExports) => {
                if (moduleExports === undefined)
                    return;
                this._unwrap(moduleExports, 'insert');
                this._unwrap(moduleExports, 'remove');
                this._unwrap(moduleExports, 'update');
                this._unwrap(moduleExports, 'command');
                this._unwrap(moduleExports, 'query');
                this._unwrap(moduleExports, 'getMore');
            },
        };
    }
    _getV4SessionsPatches() {
        return {
            v4PatchSessions: (moduleExports) => {
                if ((0, instrumentation_1.isWrapped)(moduleExports.acquire)) {
                    this._unwrap(moduleExports, 'acquire');
                }
                this._wrap(moduleExports.ServerSessionPool.prototype, 'acquire', this._getV4AcquireCommand());
                if ((0, instrumentation_1.isWrapped)(moduleExports.release)) {
                    this._unwrap(moduleExports, 'release');
                }
                this._wrap(moduleExports.ServerSessionPool.prototype, 'release', this._getV4ReleaseCommand());
                return moduleExports;
            },
            v4UnpatchSessions: (moduleExports) => {
                if (moduleExports === undefined)
                    return;
                if ((0, instrumentation_1.isWrapped)(moduleExports.acquire)) {
                    this._unwrap(moduleExports, 'acquire');
                }
                if ((0, instrumentation_1.isWrapped)(moduleExports.release)) {
                    this._unwrap(moduleExports, 'release');
                }
            },
        };
    }
    _getV4AcquireCommand() {
        const instrumentation = this;
        return (original) => {
            return function patchAcquire() {
                const nSessionsBeforeAcquire = this.sessions.length;
                const session = original.call(this);
                const nSessionsAfterAcquire = this.sessions.length;
                if (nSessionsBeforeAcquire === nSessionsAfterAcquire) {
                    //no session in the pool. a new session was created and used
                    instrumentation._connectionsUsage.add(1, {
                        state: 'used',
                        'pool.name': instrumentation._poolName,
                    });
                }
                else if (nSessionsBeforeAcquire - 1 === nSessionsAfterAcquire) {
                    //a session was already in the pool. remove it from the pool and use it.
                    instrumentation._connectionsUsage.add(-1, {
                        state: 'idle',
                        'pool.name': instrumentation._poolName,
                    });
                    instrumentation._connectionsUsage.add(1, {
                        state: 'used',
                        'pool.name': instrumentation._poolName,
                    });
                }
                return session;
            };
        };
    }
    _getV4ReleaseCommand() {
        const instrumentation = this;
        return (original) => {
            return function patchRelease(session) {
                const cmdPromise = original.call(this, session);
                instrumentation._connectionsUsage.add(-1, {
                    state: 'used',
                    'pool.name': instrumentation._poolName,
                });
                instrumentation._connectionsUsage.add(1, {
                    state: 'idle',
                    'pool.name': instrumentation._poolName,
                });
                return cmdPromise;
            };
        };
    }
    _getV4ConnectionPoolPatches() {
        return {
            v4PatchConnectionPool: (moduleExports) => {
                const poolPrototype = moduleExports.ConnectionPool.prototype;
                if ((0, instrumentation_1.isWrapped)(poolPrototype.checkOut)) {
                    this._unwrap(poolPrototype, 'checkOut');
                }
                this._wrap(poolPrototype, 'checkOut', this._getV4ConnectionPoolCheckOut());
                return moduleExports;
            },
            v4UnpatchConnectionPool: (moduleExports) => {
                if (moduleExports === undefined)
                    return;
                this._unwrap(moduleExports.ConnectionPool.prototype, 'checkOut');
            },
        };
    }
    _getV4ConnectPatches() {
        return {
            v4PatchConnect: (moduleExports) => {
                if ((0, instrumentation_1.isWrapped)(moduleExports.connect)) {
                    this._unwrap(moduleExports, 'connect');
                }
                this._wrap(moduleExports, 'connect', this._getV4ConnectCommand());
                return moduleExports;
            },
            v4UnpatchConnect: (moduleExports) => {
                if (moduleExports === undefined)
                    return;
                this._unwrap(moduleExports, 'connect');
            },
        };
    }
    // This patch will become unnecessary once
    // https://jira.mongodb.org/browse/NODE-5639 is done.
    _getV4ConnectionPoolCheckOut() {
        return (original) => {
            return function patchedCheckout(callback) {
                const patchedCallback = api_1.context.bind(api_1.context.active(), callback);
                return original.call(this, patchedCallback);
            };
        };
    }
    _getV4ConnectCommand() {
        const instrumentation = this;
        return (original) => {
            return function patchedConnect(options, callback) {
                // from v6.4 `connect` method only accepts an options param and returns a promise
                // with the connection
                if (original.length === 1) {
                    const result = original.call(this, options);
                    if (result && typeof result.then === 'function') {
                        result.then(() => instrumentation.setPoolName(options), 
                        // this handler is set to pass the lint rules
                        () => undefined);
                    }
                    return result;
                }
                // Earlier versions expects a callback param and return void
                const patchedCallback = function (err, conn) {
                    if (err || !conn) {
                        callback(err, conn);
                        return;
                    }
                    instrumentation.setPoolName(options);
                    callback(err, conn);
                };
                return original.call(this, options, patchedCallback);
            };
        };
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _getV4ConnectionPatches() {
        return {
            v4PatchConnectionCallback: (moduleExports) => {
                // patch insert operation
                if ((0, instrumentation_1.isWrapped)(moduleExports.Connection.prototype.command)) {
                    this._unwrap(moduleExports.Connection.prototype, 'command');
                }
                this._wrap(moduleExports.Connection.prototype, 'command', this._getV4PatchCommandCallback());
                return moduleExports;
            },
            v4PatchConnectionPromise: (moduleExports) => {
                // patch insert operation
                if ((0, instrumentation_1.isWrapped)(moduleExports.Connection.prototype.command)) {
                    this._unwrap(moduleExports.Connection.prototype, 'command');
                }
                this._wrap(moduleExports.Connection.prototype, 'command', this._getV4PatchCommandPromise());
                return moduleExports;
            },
            v4UnpatchConnection: (moduleExports) => {
                if (moduleExports === undefined)
                    return;
                this._unwrap(moduleExports.Connection.prototype, 'command');
            },
        };
    }
    /** Creates spans for common operations */
    _getV3PatchOperation(operationName) {
        const instrumentation = this;
        return (original) => {
            return function patchedServerCommand(server, ns, ops, options, callback) {
                const currentSpan = api_1.trace.getSpan(api_1.context.active());
                const skipInstrumentation = instrumentation._checkSkipInstrumentation(currentSpan);
                const resultHandler = typeof options === 'function' ? options : callback;
                if (skipInstrumentation ||
                    typeof resultHandler !== 'function' ||
                    typeof ops !== 'object') {
                    if (typeof options === 'function') {
                        return original.call(this, server, ns, ops, options);
                    }
                    else {
                        return original.call(this, server, ns, ops, options, callback);
                    }
                }
                const span = instrumentation.tracer.startSpan(`mongodb.${operationName}`, {
                    kind: api_1.SpanKind.CLIENT,
                });
                instrumentation._populateV3Attributes(span, ns, server, 
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ops[0], operationName);
                const patchedCallback = instrumentation._patchEnd(span, resultHandler);
                // handle when options is the callback to send the correct number of args
                if (typeof options === 'function') {
                    return original.call(this, server, ns, ops, patchedCallback);
                }
                else {
                    return original.call(this, server, ns, ops, options, patchedCallback);
                }
            };
        };
    }
    /** Creates spans for command operation */
    _getV3PatchCommand() {
        const instrumentation = this;
        return (original) => {
            return function patchedServerCommand(server, ns, cmd, options, callback) {
                const currentSpan = api_1.trace.getSpan(api_1.context.active());
                const skipInstrumentation = instrumentation._checkSkipInstrumentation(currentSpan);
                const resultHandler = typeof options === 'function' ? options : callback;
                if (skipInstrumentation ||
                    typeof resultHandler !== 'function' ||
                    typeof cmd !== 'object') {
                    if (typeof options === 'function') {
                        return original.call(this, server, ns, cmd, options);
                    }
                    else {
                        return original.call(this, server, ns, cmd, options, callback);
                    }
                }
                const commandType = MongoDBInstrumentation._getCommandType(cmd);
                const type = commandType === internal_types_1.MongodbCommandType.UNKNOWN ? 'command' : commandType;
                const span = instrumentation.tracer.startSpan(`mongodb.${type}`, {
                    kind: api_1.SpanKind.CLIENT,
                });
                const operation = commandType === internal_types_1.MongodbCommandType.UNKNOWN ? undefined : commandType;
                instrumentation._populateV3Attributes(span, ns, server, cmd, operation);
                const patchedCallback = instrumentation._patchEnd(span, resultHandler);
                // handle when options is the callback to send the correct number of args
                if (typeof options === 'function') {
                    return original.call(this, server, ns, cmd, patchedCallback);
                }
                else {
                    return original.call(this, server, ns, cmd, options, patchedCallback);
                }
            };
        };
    }
    /** Creates spans for command operation */
    _getV4PatchCommandCallback() {
        const instrumentation = this;
        return (original) => {
            return function patchedV4ServerCommand(ns, cmd, options, callback) {
                const currentSpan = api_1.trace.getSpan(api_1.context.active());
                const skipInstrumentation = instrumentation._checkSkipInstrumentation(currentSpan);
                const resultHandler = callback;
                const commandType = Object.keys(cmd)[0];
                if (typeof cmd !== 'object' || cmd.ismaster || cmd.hello) {
                    return original.call(this, ns, cmd, options, callback);
                }
                let span = undefined;
                if (!skipInstrumentation) {
                    span = instrumentation.tracer.startSpan(`mongodb.${commandType}`, {
                        kind: api_1.SpanKind.CLIENT,
                    });
                    instrumentation._populateV4Attributes(span, this, ns, cmd, commandType);
                }
                const patchedCallback = instrumentation._patchEnd(span, resultHandler, this.id, commandType);
                return original.call(this, ns, cmd, options, patchedCallback);
            };
        };
    }
    _getV4PatchCommandPromise() {
        const instrumentation = this;
        return (original) => {
            return function patchedV4ServerCommand(...args) {
                const [ns, cmd] = args;
                const currentSpan = api_1.trace.getSpan(api_1.context.active());
                const skipInstrumentation = instrumentation._checkSkipInstrumentation(currentSpan);
                const commandType = Object.keys(cmd)[0];
                const resultHandler = () => undefined;
                if (typeof cmd !== 'object' || cmd.ismaster || cmd.hello) {
                    return original.apply(this, args);
                }
                let span = undefined;
                if (!skipInstrumentation) {
                    span = instrumentation.tracer.startSpan(`mongodb.${commandType}`, {
                        kind: api_1.SpanKind.CLIENT,
                    });
                    instrumentation._populateV4Attributes(span, this, ns, cmd, commandType);
                }
                const patchedCallback = instrumentation._patchEnd(span, resultHandler, this.id, commandType);
                const result = original.apply(this, args);
                result.then((res) => patchedCallback(null, res), (err) => patchedCallback(err));
                return result;
            };
        };
    }
    /** Creates spans for find operation */
    _getV3PatchFind() {
        const instrumentation = this;
        return (original) => {
            return function patchedServerCommand(server, ns, cmd, cursorState, options, callback) {
                const currentSpan = api_1.trace.getSpan(api_1.context.active());
                const skipInstrumentation = instrumentation._checkSkipInstrumentation(currentSpan);
                const resultHandler = typeof options === 'function' ? options : callback;
                if (skipInstrumentation ||
                    typeof resultHandler !== 'function' ||
                    typeof cmd !== 'object') {
                    if (typeof options === 'function') {
                        return original.call(this, server, ns, cmd, cursorState, options);
                    }
                    else {
                        return original.call(this, server, ns, cmd, cursorState, options, callback);
                    }
                }
                const span = instrumentation.tracer.startSpan('mongodb.find', {
                    kind: api_1.SpanKind.CLIENT,
                });
                instrumentation._populateV3Attributes(span, ns, server, cmd, 'find');
                const patchedCallback = instrumentation._patchEnd(span, resultHandler);
                // handle when options is the callback to send the correct number of args
                if (typeof options === 'function') {
                    return original.call(this, server, ns, cmd, cursorState, patchedCallback);
                }
                else {
                    return original.call(this, server, ns, cmd, cursorState, options, patchedCallback);
                }
            };
        };
    }
    /** Creates spans for find operation */
    _getV3PatchCursor() {
        const instrumentation = this;
        return (original) => {
            return function patchedServerCommand(server, ns, cursorState, batchSize, options, callback) {
                const currentSpan = api_1.trace.getSpan(api_1.context.active());
                const skipInstrumentation = instrumentation._checkSkipInstrumentation(currentSpan);
                const resultHandler = typeof options === 'function' ? options : callback;
                if (skipInstrumentation || typeof resultHandler !== 'function') {
                    if (typeof options === 'function') {
                        return original.call(this, server, ns, cursorState, batchSize, options);
                    }
                    else {
                        return original.call(this, server, ns, cursorState, batchSize, options, callback);
                    }
                }
                const span = instrumentation.tracer.startSpan('mongodb.getMore', {
                    kind: api_1.SpanKind.CLIENT,
                });
                instrumentation._populateV3Attributes(span, ns, server, cursorState.cmd, 'getMore');
                const patchedCallback = instrumentation._patchEnd(span, resultHandler);
                // handle when options is the callback to send the correct number of args
                if (typeof options === 'function') {
                    return original.call(this, server, ns, cursorState, batchSize, patchedCallback);
                }
                else {
                    return original.call(this, server, ns, cursorState, batchSize, options, patchedCallback);
                }
            };
        };
    }
    /**
     * Get the mongodb command type from the object.
     * @param command Internal mongodb command object
     */
    static _getCommandType(command) {
        if (command.createIndexes !== undefined) {
            return internal_types_1.MongodbCommandType.CREATE_INDEXES;
        }
        else if (command.findandmodify !== undefined) {
            return internal_types_1.MongodbCommandType.FIND_AND_MODIFY;
        }
        else if (command.ismaster !== undefined) {
            return internal_types_1.MongodbCommandType.IS_MASTER;
        }
        else if (command.count !== undefined) {
            return internal_types_1.MongodbCommandType.COUNT;
        }
        else if (command.aggregate !== undefined) {
            return internal_types_1.MongodbCommandType.AGGREGATE;
        }
        else {
            return internal_types_1.MongodbCommandType.UNKNOWN;
        }
    }
    /**
     * Populate span's attributes by fetching related metadata from the context
     * @param span span to add attributes to
     * @param connectionCtx mongodb internal connection context
     * @param ns mongodb namespace
     * @param command mongodb internal representation of a command
     */
    _populateV4Attributes(span, connectionCtx, ns, command, operation) {
        let host, port;
        if (connectionCtx) {
            const hostParts = typeof connectionCtx.address === 'string'
                ? connectionCtx.address.split(':')
                : '';
            if (hostParts.length === 2) {
                host = hostParts[0];
                port = hostParts[1];
            }
        }
        // capture parameters within the query as well if enhancedDatabaseReporting is enabled.
        let commandObj;
        if ((command === null || command === void 0 ? void 0 : command.documents) && command.documents[0]) {
            commandObj = command.documents[0];
        }
        else if (command === null || command === void 0 ? void 0 : command.cursors) {
            commandObj = command.cursors;
        }
        else {
            commandObj = command;
        }
        this._addAllSpanAttributes(span, ns.db, ns.collection, host, port, commandObj, operation);
    }
    /**
     * Populate span's attributes by fetching related metadata from the context
     * @param span span to add attributes to
     * @param ns mongodb namespace
     * @param topology mongodb internal representation of the network topology
     * @param command mongodb internal representation of a command
     */
    _populateV3Attributes(span, ns, topology, command, operation) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        // add network attributes to determine the remote server
        let host;
        let port;
        if (topology && topology.s) {
            host = (_b = (_a = topology.s.options) === null || _a === void 0 ? void 0 : _a.host) !== null && _b !== void 0 ? _b : topology.s.host;
            port = (_e = ((_d = (_c = topology.s.options) === null || _c === void 0 ? void 0 : _c.port) !== null && _d !== void 0 ? _d : topology.s.port)) === null || _e === void 0 ? void 0 : _e.toString();
            if (host == null || port == null) {
                const address = (_f = topology.description) === null || _f === void 0 ? void 0 : _f.address;
                if (address) {
                    const addressSegments = address.split(':');
                    host = addressSegments[0];
                    port = addressSegments[1];
                }
            }
        }
        // The namespace is a combination of the database name and the name of the
        // collection or index, like so: [database-name].[collection-or-index-name].
        // It could be a string or an instance of MongoDBNamespace, as such we
        // always coerce to a string to extract db and collection.
        const [dbName, dbCollection] = ns.toString().split('.');
        // capture parameters within the query as well if enhancedDatabaseReporting is enabled.
        const commandObj = (_h = (_g = command === null || command === void 0 ? void 0 : command.query) !== null && _g !== void 0 ? _g : command === null || command === void 0 ? void 0 : command.q) !== null && _h !== void 0 ? _h : command;
        this._addAllSpanAttributes(span, dbName, dbCollection, host, port, commandObj, operation);
    }
    _addAllSpanAttributes(span, dbName, dbCollection, host, port, commandObj, operation) {
        // add database related attributes
        span.setAttributes({
            [semantic_conventions_1.SEMATTRS_DB_SYSTEM]: semantic_conventions_1.DBSYSTEMVALUES_MONGODB,
            [semantic_conventions_1.SEMATTRS_DB_NAME]: dbName,
            [semantic_conventions_1.SEMATTRS_DB_MONGODB_COLLECTION]: dbCollection,
            [semantic_conventions_1.SEMATTRS_DB_OPERATION]: operation,
            [semantic_conventions_1.SEMATTRS_DB_CONNECTION_STRING]: `mongodb://${host}:${port}/${dbName}`,
        });
        if (host && port) {
            span.setAttribute(semantic_conventions_1.SEMATTRS_NET_PEER_NAME, host);
            const portNumber = parseInt(port, 10);
            if (!isNaN(portNumber)) {
                span.setAttribute(semantic_conventions_1.SEMATTRS_NET_PEER_PORT, portNumber);
            }
        }
        if (!commandObj)
            return;
        const { dbStatementSerializer: configDbStatementSerializer } = this.getConfig();
        const dbStatementSerializer = typeof configDbStatementSerializer === 'function'
            ? configDbStatementSerializer
            : this._defaultDbStatementSerializer.bind(this);
        (0, instrumentation_1.safeExecuteInTheMiddle)(() => {
            const query = dbStatementSerializer(commandObj);
            span.setAttribute(semantic_conventions_1.SEMATTRS_DB_STATEMENT, query);
        }, err => {
            if (err) {
                this._diag.error('Error running dbStatementSerializer hook', err);
            }
        }, true);
    }
    _defaultDbStatementSerializer(commandObj) {
        const { enhancedDatabaseReporting } = this.getConfig();
        const resultObj = enhancedDatabaseReporting
            ? commandObj
            : this._scrubStatement(commandObj);
        return JSON.stringify(resultObj);
    }
    _scrubStatement(value) {
        if (Array.isArray(value)) {
            return value.map(element => this._scrubStatement(element));
        }
        if (typeof value === 'object' && value !== null) {
            return Object.fromEntries(Object.entries(value).map(([key, element]) => [
                key,
                this._scrubStatement(element),
            ]));
        }
        // A value like string or number, possible contains PII, scrub it
        return '?';
    }
    /**
     * Triggers the response hook in case it is defined.
     * @param span The span to add the results to.
     * @param result The command result
     */
    _handleExecutionResult(span, result) {
        const { responseHook } = this.getConfig();
        if (typeof responseHook === 'function') {
            (0, instrumentation_1.safeExecuteInTheMiddle)(() => {
                responseHook(span, { data: result });
            }, err => {
                if (err) {
                    this._diag.error('Error running response hook', err);
                }
            }, true);
        }
    }
    /**
     * Ends a created span.
     * @param span The created span to end.
     * @param resultHandler A callback function.
     * @param connectionId: The connection ID of the Command response.
     */
    _patchEnd(span, resultHandler, connectionId, commandType) {
        // mongodb is using "tick" when calling a callback, this way the context
        // in final callback (resultHandler) is lost
        const activeContext = api_1.context.active();
        const instrumentation = this;
        return function patchedEnd(...args) {
            const error = args[0];
            if (span) {
                if (error instanceof Error) {
                    span === null || span === void 0 ? void 0 : span.setStatus({
                        code: api_1.SpanStatusCode.ERROR,
                        message: error.message,
                    });
                }
                else {
                    const result = args[1];
                    instrumentation._handleExecutionResult(span, result);
                }
                span.end();
            }
            return api_1.context.with(activeContext, () => {
                if (commandType === 'endSessions') {
                    instrumentation._connectionsUsage.add(-1, {
                        state: 'idle',
                        'pool.name': instrumentation._poolName,
                    });
                }
                return resultHandler.apply(this, args);
            });
        };
    }
    setPoolName(options) {
        var _a, _b;
        const host = (_a = options.hostAddress) === null || _a === void 0 ? void 0 : _a.host;
        const port = (_b = options.hostAddress) === null || _b === void 0 ? void 0 : _b.port;
        const database = options.dbName;
        const poolName = `mongodb://${host}:${port}/${database}`;
        this._poolName = poolName;
    }
    _checkSkipInstrumentation(currentSpan) {
        const requireParentSpan = this.getConfig().requireParentSpan;
        const hasNoParentSpan = currentSpan === undefined;
        return requireParentSpan === true && hasNoParentSpan;
    }
}
exports.MongoDBInstrumentation = MongoDBInstrumentation;
//# sourceMappingURL=instrumentation.js.map