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
exports.NetInstrumentation = void 0;
const api_1 = require("@opentelemetry/api");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const types_1 = require("./types");
const internal_types_1 = require("./internal-types");
const utils_1 = require("./utils");
/** @knipignore */
const version_1 = require("./version");
const tls_1 = require("tls");
class NetInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, config);
    }
    init() {
        return [
            new instrumentation_1.InstrumentationNodeModuleDefinition('net', ['*'], (moduleExports) => {
                if ((0, instrumentation_1.isWrapped)(moduleExports.Socket.prototype.connect)) {
                    this._unwrap(moduleExports.Socket.prototype, 'connect');
                }
                this._wrap(moduleExports.Socket.prototype, 'connect', 
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                this._getPatchedConnect());
                return moduleExports;
            }, (moduleExports) => {
                if (moduleExports === undefined)
                    return;
                this._unwrap(moduleExports.Socket.prototype, 'connect');
            }),
        ];
    }
    _getPatchedConnect() {
        return (original) => {
            const plugin = this;
            return function patchedConnect(...args) {
                const options = (0, utils_1.getNormalizedArgs)(args);
                const span = this instanceof tls_1.TLSSocket
                    ? plugin._startTLSSpan(options, this)
                    : plugin._startSpan(options, this);
                return (0, instrumentation_1.safeExecuteInTheMiddle)(() => original.apply(this, args), error => {
                    if (error !== undefined) {
                        span.setStatus({
                            code: api_1.SpanStatusCode.ERROR,
                            message: error.message,
                        });
                        span.recordException(error);
                        span.end();
                    }
                });
            };
        };
    }
    _startSpan(options, socket) {
        if (!options) {
            return this._startGenericSpan(socket);
        }
        if (options.path) {
            return this._startIpcSpan(options, socket);
        }
        return this._startTcpSpan(options, socket);
    }
    _startTLSSpan(options, socket) {
        const tlsSpan = this.tracer.startSpan('tls.connect');
        const netSpan = api_1.context.with(api_1.trace.setSpan(api_1.context.active(), tlsSpan), () => {
            return this._startSpan(options, socket);
        });
        const otelTlsSpanListener = () => {
            const peerCertificate = socket.getPeerCertificate(true);
            const cipher = socket.getCipher();
            const protocol = socket.getProtocol();
            const attributes = {
                [types_1.TLSAttributes.PROTOCOL]: String(protocol),
                [types_1.TLSAttributes.AUTHORIZED]: String(socket.authorized),
                [types_1.TLSAttributes.CIPHER_NAME]: cipher.name,
                [types_1.TLSAttributes.CIPHER_VERSION]: cipher.version,
                [types_1.TLSAttributes.CERTIFICATE_FINGERPRINT]: peerCertificate.fingerprint,
                [types_1.TLSAttributes.CERTIFICATE_SERIAL_NUMBER]: peerCertificate.serialNumber,
                [types_1.TLSAttributes.CERTIFICATE_VALID_FROM]: peerCertificate.valid_from,
                [types_1.TLSAttributes.CERTIFICATE_VALID_TO]: peerCertificate.valid_to,
                [types_1.TLSAttributes.ALPN_PROTOCOL]: '',
            };
            if (socket.alpnProtocol) {
                attributes[types_1.TLSAttributes.ALPN_PROTOCOL] = socket.alpnProtocol;
            }
            tlsSpan.setAttributes(attributes);
            tlsSpan.end();
        };
        const otelTlsErrorListener = (e) => {
            tlsSpan.setStatus({
                code: api_1.SpanStatusCode.ERROR,
                message: e.message,
            });
            tlsSpan.end();
        };
        /* if we use once and tls.connect() uses a callback this is never executed */
        socket.prependOnceListener(internal_types_1.SocketEvent.SECURE_CONNECT, otelTlsSpanListener);
        socket.once(internal_types_1.SocketEvent.ERROR, otelTlsErrorListener);
        const otelTlsRemoveListeners = () => {
            socket.removeListener(internal_types_1.SocketEvent.SECURE_CONNECT, otelTlsSpanListener);
            socket.removeListener(internal_types_1.SocketEvent.ERROR, otelTlsErrorListener);
            for (const event of SOCKET_EVENTS) {
                socket.removeListener(event, otelTlsRemoveListeners);
            }
        };
        for (const event of [
            internal_types_1.SocketEvent.CLOSE,
            internal_types_1.SocketEvent.ERROR,
            internal_types_1.SocketEvent.SECURE_CONNECT,
        ]) {
            socket.once(event, otelTlsRemoveListeners);
        }
        return netSpan;
    }
    /* It might still be useful to pick up errors due to invalid connect arguments. */
    _startGenericSpan(socket) {
        const span = this.tracer.startSpan('connect');
        registerListeners(socket, span);
        return span;
    }
    _startIpcSpan(options, socket) {
        const span = this.tracer.startSpan('ipc.connect', {
            attributes: {
                [semantic_conventions_1.SEMATTRS_NET_TRANSPORT]: utils_1.IPC_TRANSPORT,
                [semantic_conventions_1.SEMATTRS_NET_PEER_NAME]: options.path,
            },
        });
        registerListeners(socket, span);
        return span;
    }
    _startTcpSpan(options, socket) {
        const span = this.tracer.startSpan('tcp.connect', {
            attributes: {
                [semantic_conventions_1.SEMATTRS_NET_TRANSPORT]: semantic_conventions_1.NETTRANSPORTVALUES_IP_TCP,
                [semantic_conventions_1.SEMATTRS_NET_PEER_NAME]: options.host,
                [semantic_conventions_1.SEMATTRS_NET_PEER_PORT]: options.port,
            },
        });
        registerListeners(socket, span, { hostAttributes: true });
        return span;
    }
}
exports.NetInstrumentation = NetInstrumentation;
const SOCKET_EVENTS = [
    internal_types_1.SocketEvent.CLOSE,
    internal_types_1.SocketEvent.CONNECT,
    internal_types_1.SocketEvent.ERROR,
];
function spanEndHandler(span) {
    return () => {
        span.end();
    };
}
function spanErrorHandler(span) {
    return (e) => {
        span.setStatus({
            code: api_1.SpanStatusCode.ERROR,
            message: e.message,
        });
    };
}
function registerListeners(socket, span, { hostAttributes = false } = {}) {
    const setSpanError = spanErrorHandler(span);
    const setSpanEnd = spanEndHandler(span);
    const setHostAttributes = () => {
        span.setAttributes({
            [semantic_conventions_1.SEMATTRS_NET_PEER_IP]: socket.remoteAddress,
            [semantic_conventions_1.SEMATTRS_NET_HOST_IP]: socket.localAddress,
            [semantic_conventions_1.SEMATTRS_NET_HOST_PORT]: socket.localPort,
        });
    };
    socket.once(internal_types_1.SocketEvent.ERROR, setSpanError);
    if (hostAttributes) {
        socket.once(internal_types_1.SocketEvent.CONNECT, setHostAttributes);
    }
    const removeListeners = () => {
        socket.removeListener(internal_types_1.SocketEvent.ERROR, setSpanError);
        socket.removeListener(internal_types_1.SocketEvent.CONNECT, setHostAttributes);
        for (const event of SOCKET_EVENTS) {
            socket.removeListener(event, setSpanEnd);
            socket.removeListener(event, removeListeners);
        }
    };
    for (const event of SOCKET_EVENTS) {
        socket.once(event, setSpanEnd);
        socket.once(event, removeListeners);
    }
}
//# sourceMappingURL=instrumentation.js.map