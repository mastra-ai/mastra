"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketIoInstrumentation = void 0;
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
const AttributeNames_1 = require("./AttributeNames");
/** @knipignore */
const version_1 = require("./version");
const utils_1 = require("./utils");
const reservedEvents = [
    'connect',
    'connect_error',
    'disconnect',
    'disconnecting',
    'newListener',
    'removeListener',
];
class SocketIoInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, (0, utils_1.normalizeConfig)(config));
    }
    init() {
        const socketInstrumentation = new instrumentation_1.InstrumentationNodeModuleFile('socket.io/dist/socket.js', ['>=3 <5'], (moduleExports, moduleVersion) => {
            var _a, _b, _c, _d;
            if (moduleExports === undefined || moduleExports === null) {
                return moduleExports;
            }
            if (moduleVersion === undefined) {
                return moduleExports;
            }
            if ((0, instrumentation_1.isWrapped)((_b = (_a = moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.Socket) === null || _a === void 0 ? void 0 : _a.prototype) === null || _b === void 0 ? void 0 : _b.on)) {
                this._unwrap(moduleExports.Socket.prototype, 'on');
            }
            this._wrap(moduleExports.Socket.prototype, 'on', this._patchOn(moduleVersion));
            if ((0, instrumentation_1.isWrapped)((_d = (_c = moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.Socket) === null || _c === void 0 ? void 0 : _c.prototype) === null || _d === void 0 ? void 0 : _d.emit)) {
                this._unwrap(moduleExports.Socket.prototype, 'emit');
            }
            this._wrap(moduleExports.Socket.prototype, 'emit', this._patchEmit(moduleVersion));
            return moduleExports;
        }, moduleExports => {
            var _a, _b, _c, _d;
            if ((0, instrumentation_1.isWrapped)((_b = (_a = moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.Socket) === null || _a === void 0 ? void 0 : _a.prototype) === null || _b === void 0 ? void 0 : _b.on)) {
                this._unwrap(moduleExports.Socket.prototype, 'on');
            }
            if ((0, instrumentation_1.isWrapped)((_d = (_c = moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.Socket) === null || _c === void 0 ? void 0 : _c.prototype) === null || _d === void 0 ? void 0 : _d.emit)) {
                this._unwrap(moduleExports.Socket.prototype, 'emit');
            }
            return moduleExports;
        });
        const broadcastOperatorInstrumentation = new instrumentation_1.InstrumentationNodeModuleFile('socket.io/dist/broadcast-operator.js', ['>=4 <5'], (moduleExports, moduleVersion) => {
            var _a, _b;
            if (moduleExports === undefined || moduleExports === null) {
                return moduleExports;
            }
            if (moduleVersion === undefined) {
                return moduleExports;
            }
            if ((0, instrumentation_1.isWrapped)((_b = (_a = moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.BroadcastOperator) === null || _a === void 0 ? void 0 : _a.prototype) === null || _b === void 0 ? void 0 : _b.emit)) {
                this._unwrap(moduleExports.BroadcastOperator.prototype, 'emit');
            }
            this._wrap(moduleExports.BroadcastOperator.prototype, 'emit', this._patchEmit(moduleVersion));
            return moduleExports;
        }, moduleExports => {
            var _a, _b;
            if ((0, instrumentation_1.isWrapped)((_b = (_a = moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.BroadcastOperator) === null || _a === void 0 ? void 0 : _a.prototype) === null || _b === void 0 ? void 0 : _b.emit)) {
                this._unwrap(moduleExports.BroadcastOperator.prototype, 'emit');
            }
            return moduleExports;
        });
        const namespaceInstrumentation = new instrumentation_1.InstrumentationNodeModuleFile('socket.io/dist/namespace.js', ['<4'], (moduleExports, moduleVersion) => {
            var _a, _b;
            if (moduleExports === undefined || moduleExports === null) {
                return moduleExports;
            }
            if (moduleVersion === undefined) {
                return moduleExports;
            }
            if ((0, instrumentation_1.isWrapped)((_b = (_a = moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.Namespace) === null || _a === void 0 ? void 0 : _a.prototype) === null || _b === void 0 ? void 0 : _b.emit)) {
                this._unwrap(moduleExports.Namespace.prototype, 'emit');
            }
            this._wrap(moduleExports.Namespace.prototype, 'emit', this._patchEmit(moduleVersion));
            return moduleExports;
        }, moduleExports => {
            var _a, _b;
            if ((0, instrumentation_1.isWrapped)((_b = (_a = moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.Namespace) === null || _a === void 0 ? void 0 : _a.prototype) === null || _b === void 0 ? void 0 : _b.emit)) {
                this._unwrap(moduleExports.Namespace.prototype, 'emit');
            }
        });
        const socketInstrumentationLegacy = new instrumentation_1.InstrumentationNodeModuleFile('socket.io/lib/socket.js', ['2'], (moduleExports, moduleVersion) => {
            var _a, _b;
            if (moduleExports === undefined || moduleExports === null) {
                return moduleExports;
            }
            if (moduleVersion === undefined) {
                return moduleExports;
            }
            if ((0, instrumentation_1.isWrapped)((_a = moduleExports.prototype) === null || _a === void 0 ? void 0 : _a.on)) {
                this._unwrap(moduleExports.prototype, 'on');
            }
            this._wrap(moduleExports.prototype, 'on', this._patchOn(moduleVersion));
            if ((0, instrumentation_1.isWrapped)((_b = moduleExports.prototype) === null || _b === void 0 ? void 0 : _b.emit)) {
                this._unwrap(moduleExports.prototype, 'emit');
            }
            this._wrap(moduleExports.prototype, 'emit', this._patchEmit(moduleVersion));
            return moduleExports;
        }, moduleExports => {
            var _a, _b;
            if ((0, instrumentation_1.isWrapped)((_a = moduleExports.prototype) === null || _a === void 0 ? void 0 : _a.on)) {
                this._unwrap(moduleExports.prototype, 'on');
            }
            if ((0, instrumentation_1.isWrapped)((_b = moduleExports.prototype) === null || _b === void 0 ? void 0 : _b.emit)) {
                this._unwrap(moduleExports.prototype, 'emit');
            }
            return moduleExports;
        });
        const namespaceInstrumentationLegacy = new instrumentation_1.InstrumentationNodeModuleFile('socket.io/lib/namespace.js', ['2'], (moduleExports, moduleVersion) => {
            var _a;
            if (moduleExports === undefined || moduleExports === null) {
                return moduleExports;
            }
            if (moduleVersion === undefined) {
                return moduleExports;
            }
            if ((0, instrumentation_1.isWrapped)((_a = moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.prototype) === null || _a === void 0 ? void 0 : _a.emit)) {
                this._unwrap(moduleExports.prototype, 'emit');
            }
            this._wrap(moduleExports.prototype, 'emit', this._patchEmit(moduleVersion));
            return moduleExports;
        }, moduleExports => {
            var _a;
            if ((0, instrumentation_1.isWrapped)((_a = moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.prototype) === null || _a === void 0 ? void 0 : _a.emit)) {
                this._unwrap(moduleExports.prototype, 'emit');
            }
        });
        return [
            new instrumentation_1.InstrumentationNodeModuleDefinition('socket.io', ['>=3 <5'], (moduleExports, moduleVersion) => {
                var _a, _b;
                if (moduleExports === undefined || moduleExports === null) {
                    return moduleExports;
                }
                if (moduleVersion === undefined) {
                    return moduleExports;
                }
                if ((0, instrumentation_1.isWrapped)((_b = (_a = moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.Server) === null || _a === void 0 ? void 0 : _a.prototype) === null || _b === void 0 ? void 0 : _b.on)) {
                    this._unwrap(moduleExports.Server.prototype, 'on');
                }
                this._wrap(moduleExports.Server.prototype, 'on', this._patchOn(moduleVersion));
                return moduleExports;
            }, moduleExports => {
                var _a, _b;
                if ((0, instrumentation_1.isWrapped)((_b = (_a = moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.Server) === null || _a === void 0 ? void 0 : _a.prototype) === null || _b === void 0 ? void 0 : _b.on)) {
                    this._unwrap(moduleExports.Server.prototype, 'on');
                }
                return moduleExports;
            }, [
                broadcastOperatorInstrumentation,
                namespaceInstrumentation,
                socketInstrumentation,
            ]),
            new instrumentation_1.InstrumentationNodeModuleDefinition('socket.io', ['2'], (moduleExports, moduleVersion) => {
                var _a;
                if (moduleExports === undefined || moduleExports === null) {
                    return moduleExports;
                }
                if (moduleVersion === undefined) {
                    return moduleExports;
                }
                if ((0, instrumentation_1.isWrapped)((_a = moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.prototype) === null || _a === void 0 ? void 0 : _a.on)) {
                    this._unwrap(moduleExports.prototype, 'on');
                }
                this._wrap(moduleExports.prototype, 'on', this._patchOn(moduleVersion));
                return moduleExports;
            }, (moduleExports, moduleVersion) => {
                var _a;
                if ((0, instrumentation_1.isWrapped)((_a = moduleExports === null || moduleExports === void 0 ? void 0 : moduleExports.prototype) === null || _a === void 0 ? void 0 : _a.on)) {
                    this._unwrap(moduleExports.prototype, 'on');
                }
                return moduleExports;
            }, [namespaceInstrumentationLegacy, socketInstrumentationLegacy]),
        ];
    }
    setConfig(config = {}) {
        return super.setConfig((0, utils_1.normalizeConfig)(config));
    }
    _patchOn(moduleVersion) {
        const self = this;
        return (original) => {
            return function (ev, originalListener) {
                var _a;
                if (!self.getConfig().traceReserved && reservedEvents.includes(ev)) {
                    return original.apply(this, arguments);
                }
                if ((_a = self.getConfig().onIgnoreEventList) === null || _a === void 0 ? void 0 : _a.includes(ev)) {
                    return original.apply(this, arguments);
                }
                const wrappedListener = function (...args) {
                    var _a, _b;
                    const eventName = ev;
                    const namespace = this.name || ((_b = (_a = this.adapter) === null || _a === void 0 ? void 0 : _a.nsp) === null || _b === void 0 ? void 0 : _b.name);
                    const span = self.tracer.startSpan(`${semantic_conventions_1.MESSAGINGOPERATIONVALUES_RECEIVE} ${namespace}`, {
                        kind: api_1.SpanKind.CONSUMER,
                        attributes: {
                            [semantic_conventions_1.SEMATTRS_MESSAGING_SYSTEM]: 'socket.io',
                            [semantic_conventions_1.SEMATTRS_MESSAGING_DESTINATION]: namespace,
                            [semantic_conventions_1.SEMATTRS_MESSAGING_OPERATION]: semantic_conventions_1.MESSAGINGOPERATIONVALUES_RECEIVE,
                            [AttributeNames_1.SocketIoInstrumentationAttributes.SOCKET_IO_EVENT_NAME]: eventName,
                        },
                    });
                    const { onHook } = self.getConfig();
                    if (onHook) {
                        (0, instrumentation_1.safeExecuteInTheMiddle)(() => onHook(span, { moduleVersion, payload: args }), e => {
                            if (e)
                                self._diag.error('onHook error', e);
                        }, true);
                    }
                    return api_1.context.with(api_1.trace.setSpan(api_1.context.active(), span), () => self.endSpan(() => originalListener.apply(this, arguments), span));
                };
                return original.apply(this, [ev, wrappedListener]);
            };
        };
    }
    endSpan(traced, span) {
        try {
            const result = traced();
            if ((0, utils_1.isPromise)(result)) {
                return result.then(value => {
                    span.end();
                    return value;
                }, err => {
                    span.recordException(err);
                    span.setStatus({
                        code: api_1.SpanStatusCode.ERROR,
                        message: err === null || err === void 0 ? void 0 : err.message,
                    });
                    span.end();
                    throw err;
                });
            }
            else {
                span.end();
                return result;
            }
        }
        catch (error) {
            span.recordException(error);
            span.setStatus({ code: api_1.SpanStatusCode.ERROR, message: error === null || error === void 0 ? void 0 : error.message });
            span.end();
            throw error;
        }
    }
    _patchEmit(moduleVersion) {
        const self = this;
        return (original) => {
            return function (ev, ...args) {
                var _a, _b, _c, _d;
                if (!self.getConfig().traceReserved && reservedEvents.includes(ev)) {
                    return original.apply(this, arguments);
                }
                if ((_a = self.getConfig().emitIgnoreEventList) === null || _a === void 0 ? void 0 : _a.includes(ev)) {
                    return original.apply(this, arguments);
                }
                const messagingSystem = 'socket.io';
                const eventName = ev;
                const attributes = {
                    [semantic_conventions_1.SEMATTRS_MESSAGING_SYSTEM]: messagingSystem,
                    [semantic_conventions_1.SEMATTRS_MESSAGING_DESTINATION_KIND]: semantic_conventions_1.MESSAGINGDESTINATIONKINDVALUES_TOPIC,
                    [AttributeNames_1.SocketIoInstrumentationAttributes.SOCKET_IO_EVENT_NAME]: eventName,
                };
                const rooms = (0, utils_1.extractRoomsAttributeValue)(this);
                if (rooms.length) {
                    attributes[AttributeNames_1.SocketIoInstrumentationAttributes.SOCKET_IO_ROOMS] = rooms;
                }
                const namespace = this.name || ((_c = (_b = this.adapter) === null || _b === void 0 ? void 0 : _b.nsp) === null || _c === void 0 ? void 0 : _c.name) || ((_d = this.sockets) === null || _d === void 0 ? void 0 : _d.name);
                if (namespace) {
                    attributes[AttributeNames_1.SocketIoInstrumentationAttributes.SOCKET_IO_NAMESPACE] =
                        namespace;
                    attributes[semantic_conventions_1.SEMATTRS_MESSAGING_DESTINATION] = namespace;
                }
                const span = self.tracer.startSpan(`send ${namespace}`, {
                    kind: api_1.SpanKind.PRODUCER,
                    attributes,
                });
                const { emitHook } = self.getConfig();
                if (emitHook) {
                    (0, instrumentation_1.safeExecuteInTheMiddle)(() => emitHook(span, { moduleVersion, payload: args }), e => {
                        if (e)
                            self._diag.error('emitHook error', e);
                    }, true);
                }
                try {
                    return api_1.context.with(api_1.trace.setSpan(api_1.context.active(), span), () => original.apply(this, arguments));
                }
                catch (error) {
                    span.setStatus({
                        code: api_1.SpanStatusCode.ERROR,
                        message: error.message,
                    });
                    throw error;
                }
                finally {
                    span.end();
                }
            };
        };
    }
}
exports.SocketIoInstrumentation = SocketIoInstrumentation;
//# sourceMappingURL=socket.io.js.map