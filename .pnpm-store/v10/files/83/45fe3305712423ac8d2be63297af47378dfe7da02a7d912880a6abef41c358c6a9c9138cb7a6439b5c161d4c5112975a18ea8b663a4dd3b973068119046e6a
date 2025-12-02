"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClient = createClient;
exports.createHttpClient = createHttpClient;
const baseClient_1 = require("./baseClient");
const conUtils_server_1 = require("./conUtils.server");
const options_1 = require("./options");
const rawConn_1 = require("./rawConn");
const fetchConn_1 = require("./fetchConn");
const httpScram_1 = require("./httpScram");
const cryptoUtils_1 = __importDefault(require("./cryptoUtils"));
class ClientPool extends baseClient_1.BaseClientPool {
    isStateless = false;
    _connectWithTimeout = rawConn_1.RawConnection.connectWithTimeout.bind(rawConn_1.RawConnection);
}
function createClient(options) {
    return new baseClient_1.Client(new ClientPool(conUtils_server_1.parseConnectArguments, typeof options === "string" ? { dsn: options } : options ?? {}), options_1.Options.defaults());
}
const httpSCRAMAuth = (0, httpScram_1.getHTTPSCRAMAuth)(cryptoUtils_1.default);
class FetchClientPool extends baseClient_1.BaseClientPool {
    isStateless = true;
    _connectWithTimeout = fetchConn_1.FetchConnection.createConnectWithTimeout(httpSCRAMAuth);
}
function createHttpClient(options) {
    return new baseClient_1.Client(new FetchClientPool(conUtils_server_1.parseConnectArguments, typeof options === "string" ? { dsn: options } : options ?? {}), options_1.Options.defaults());
}
