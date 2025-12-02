"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const INFO_1 = __importDefault(require("./INFO"));
exports.default = {
    IS_READ_ONLY: INFO_1.default.IS_READ_ONLY,
    /**
     * Gets debug information about a time series
     * @param parser - The command parser
     * @param key - The key name of the time series
     */
    parseCommand(parser, key) {
        INFO_1.default.parseCommand(parser, key);
        parser.push('DEBUG');
    },
    transformReply: {
        2: (reply, _, typeMapping) => {
            const ret = INFO_1.default.transformReply[2](reply, _, typeMapping);
            for (let i = 0; i < reply.length; i += 2) {
                const key = reply[i].toString();
                switch (key) {
                    case 'keySelfName': {
                        ret[key] = reply[i + 1];
                        break;
                    }
                    case 'Chunks': {
                        ret['chunks'] = reply[i + 1].map(chunk => ({
                            startTimestamp: chunk[1],
                            endTimestamp: chunk[3],
                            samples: chunk[5],
                            size: chunk[7],
                            bytesPerSample: chunk[9]
                        }));
                        break;
                    }
                }
            }
            return ret;
        },
        3: undefined
    },
    unstableResp3: true
};
//# sourceMappingURL=INFO_DEBUG.js.map