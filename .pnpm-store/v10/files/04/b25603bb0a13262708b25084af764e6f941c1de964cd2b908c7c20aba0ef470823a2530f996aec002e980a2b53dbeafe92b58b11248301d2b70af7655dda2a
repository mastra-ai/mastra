"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONNECTION_STATE = exports.SOCKET_STATES = exports.DEFAULT_OPTIONS = exports.DEFAULT_AGENT_OPTIONS = exports.DEFAULT_GLOBAL_OPTIONS = exports.DEFAULT_AGENT_URL = exports.DEFAULT_URL = exports.DEFAULT_HEADERS = void 0;
const helpers_1 = require("./helpers");
const runtime_1 = require("./runtime");
const version_1 = require("./version");
const getAgent = () => {
    if ((0, runtime_1.isNode)()) {
        return `node/${runtime_1.NODE_VERSION}`;
    }
    else if ((0, runtime_1.isBun)()) {
        return `bun/${runtime_1.BUN_VERSION}`;
    }
    else if ((0, runtime_1.isBrowser)()) {
        return `javascript ${runtime_1.BROWSER_AGENT}`;
    }
    else {
        return `unknown`;
    }
};
exports.DEFAULT_HEADERS = {
    "Content-Type": `application/json`,
    "X-Client-Info": `@deepgram/sdk; ${(0, runtime_1.isBrowser)() ? "browser" : "server"}; v${version_1.version}`,
    "User-Agent": `@deepgram/sdk/${version_1.version} ${getAgent()}`,
};
exports.DEFAULT_URL = "https://api.deepgram.com";
exports.DEFAULT_AGENT_URL = "wss://agent.deepgram.com";
exports.DEFAULT_GLOBAL_OPTIONS = {
    fetch: { options: { url: exports.DEFAULT_URL, headers: exports.DEFAULT_HEADERS } },
    websocket: {
        options: { url: (0, helpers_1.convertProtocolToWs)(exports.DEFAULT_URL), _nodeOnlyHeaders: exports.DEFAULT_HEADERS },
    },
};
exports.DEFAULT_AGENT_OPTIONS = {
    fetch: { options: { url: exports.DEFAULT_URL, headers: exports.DEFAULT_HEADERS } },
    websocket: {
        options: { url: exports.DEFAULT_AGENT_URL, _nodeOnlyHeaders: exports.DEFAULT_HEADERS },
    },
};
exports.DEFAULT_OPTIONS = {
    global: exports.DEFAULT_GLOBAL_OPTIONS,
    agent: exports.DEFAULT_AGENT_OPTIONS,
};
var SOCKET_STATES;
(function (SOCKET_STATES) {
    SOCKET_STATES[SOCKET_STATES["connecting"] = 0] = "connecting";
    SOCKET_STATES[SOCKET_STATES["open"] = 1] = "open";
    SOCKET_STATES[SOCKET_STATES["closing"] = 2] = "closing";
    SOCKET_STATES[SOCKET_STATES["closed"] = 3] = "closed";
})(SOCKET_STATES = exports.SOCKET_STATES || (exports.SOCKET_STATES = {}));
var CONNECTION_STATE;
(function (CONNECTION_STATE) {
    CONNECTION_STATE["Connecting"] = "connecting";
    CONNECTION_STATE["Open"] = "open";
    CONNECTION_STATE["Closing"] = "closing";
    CONNECTION_STATE["Closed"] = "closed";
})(CONNECTION_STATE = exports.CONNECTION_STATE || (exports.CONNECTION_STATE = {}));
//# sourceMappingURL=constants.js.map