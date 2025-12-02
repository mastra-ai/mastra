"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExecutor = exports.HttpMethod = exports.HttpServiceType = void 0;
/* eslint jsdoc/require-jsdoc: off */
const binding_1 = __importDefault(require("./binding"));
const bindingutilities_1 = require("./bindingutilities");
const events = __importStar(require("events"));
/**
 * @internal
 */
var HttpServiceType;
(function (HttpServiceType) {
    HttpServiceType["Management"] = "MGMT";
    HttpServiceType["Views"] = "VIEW";
    HttpServiceType["Query"] = "QUERY";
    HttpServiceType["Search"] = "SEARCH";
    HttpServiceType["Analytics"] = "ANALYTICS";
    HttpServiceType["Eventing"] = "EVENTING";
})(HttpServiceType || (exports.HttpServiceType = HttpServiceType = {}));
/**
 * @internal
 */
var HttpMethod;
(function (HttpMethod) {
    HttpMethod["Get"] = "GET";
    HttpMethod["Post"] = "POST";
    HttpMethod["Put"] = "PUT";
    HttpMethod["Delete"] = "DELETE";
})(HttpMethod || (exports.HttpMethod = HttpMethod = {}));
/**
 * @internal
 */
class HttpExecutor {
    /**
     * @internal
     */
    constructor(conn) {
        this._conn = conn;
    }
    /**
     * @internal
     */
    streamRequest(options) {
        const emitter = new events.EventEmitter();
        let cppHttpType;
        if (options.type === HttpServiceType.Management) {
            cppHttpType = binding_1.default.service_type.management;
        }
        else if (options.type === HttpServiceType.Views) {
            cppHttpType = binding_1.default.service_type.view;
        }
        else if (options.type === HttpServiceType.Query) {
            cppHttpType = binding_1.default.service_type.query;
        }
        else if (options.type === HttpServiceType.Search) {
            cppHttpType = binding_1.default.service_type.search;
        }
        else if (options.type === HttpServiceType.Analytics) {
            cppHttpType = binding_1.default.service_type.analytics;
        }
        else if (options.type === HttpServiceType.Eventing) {
            cppHttpType = binding_1.default.service_type.eventing;
        }
        else {
            throw new Error('unexpected http request type');
        }
        let cppHttpMethod;
        if (options.method === HttpMethod.Get) {
            cppHttpMethod = 'GET';
        }
        else if (options.method === HttpMethod.Post) {
            cppHttpMethod = 'POST';
        }
        else if (options.method === HttpMethod.Put) {
            cppHttpMethod = 'PUT';
        }
        else if (options.method === HttpMethod.Delete) {
            cppHttpMethod = 'DELETE';
        }
        else {
            throw new Error('unexpected http request method');
        }
        const headers = {};
        if (options.contentType) {
            headers['Content-Type'] = options.contentType;
        }
        let body = '';
        if (!options.body) {
            // empty body is acceptable
        }
        else if (options.body instanceof Buffer) {
            body = options.body.toString();
        }
        else if (typeof options.body === 'string') {
            body = options.body;
        }
        else {
            throw new Error('unexpected http body type');
        }
        this._conn.managementFreeform({
            type: cppHttpType,
            method: cppHttpMethod,
            path: options.path,
            headers: headers,
            body: body,
            timeout: options.timeout,
        }, (cppErr, res) => {
            const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
            if (err) {
                emitter.emit('error', err);
                return;
            }
            emitter.emit('meta', {
                statusCode: res.status,
                headers: res.headers,
            });
            emitter.emit('data', Buffer.from(res.body));
            emitter.emit('end');
        });
        return emitter;
    }
    async request(options) {
        return new Promise((resolve, reject) => {
            const emitter = this.streamRequest(options);
            emitter.on('error', (err) => {
                reject(err);
            });
            let dataCache = Buffer.allocUnsafe(0);
            emitter.on('data', (data) => {
                dataCache = Buffer.concat([dataCache, data]);
            });
            let metaCache = null;
            emitter.on('meta', (meta) => {
                metaCache = meta;
            });
            emitter.on('end', () => {
                resolve({
                    requestOptions: options,
                    statusCode: metaCache.statusCode,
                    headers: metaCache.headers,
                    body: dataCache,
                });
            });
        });
    }
}
exports.HttpExecutor = HttpExecutor;
