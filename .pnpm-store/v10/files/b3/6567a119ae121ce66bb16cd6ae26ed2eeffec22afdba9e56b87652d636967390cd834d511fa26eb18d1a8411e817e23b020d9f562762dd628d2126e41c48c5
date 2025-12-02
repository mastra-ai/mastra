"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformInfoV2Reply = void 0;
const client_1 = require("@redis/client");
function transformInfoV2Reply(reply, typeMapping) {
    const mapType = typeMapping ? typeMapping[client_1.RESP_TYPES.MAP] : undefined;
    switch (mapType) {
        case Array: {
            return reply;
        }
        case Map: {
            const ret = new Map();
            for (let i = 0; i < reply.length; i += 2) {
                ret.set(reply[i].toString(), reply[i + 1]);
            }
            return ret;
        }
        default: {
            const ret = Object.create(null);
            for (let i = 0; i < reply.length; i += 2) {
                ret[reply[i].toString()] = reply[i + 1];
            }
            return ret;
        }
    }
}
exports.transformInfoV2Reply = transformInfoV2Reply;
//# sourceMappingURL=helpers.js.map