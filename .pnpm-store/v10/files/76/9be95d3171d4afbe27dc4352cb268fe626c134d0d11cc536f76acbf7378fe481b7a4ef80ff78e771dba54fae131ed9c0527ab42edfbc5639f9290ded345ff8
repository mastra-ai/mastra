"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Gets information about a time series
     * @param parser - The command parser
     * @param key - The key name of the time series
     */
    parseCommand(parser, key) {
        parser.push('TS.INFO');
        parser.pushKey(key);
    },
    transformReply: {
        2: (reply, _, typeMapping) => {
            const ret = {};
            for (let i = 0; i < reply.length; i += 2) {
                const key = reply[i].toString();
                switch (key) {
                    case 'totalSamples':
                    case 'memoryUsage':
                    case 'firstTimestamp':
                    case 'lastTimestamp':
                    case 'retentionTime':
                    case 'chunkCount':
                    case 'chunkSize':
                    case 'chunkType':
                    case 'duplicatePolicy':
                    case 'sourceKey':
                    case 'ignoreMaxTimeDiff':
                        ret[key] = reply[i + 1];
                        break;
                    case 'labels':
                        ret[key] = reply[i + 1].map(([name, value]) => ({
                            name,
                            value
                        }));
                        break;
                    case 'rules':
                        ret[key] = reply[i + 1].map(([key, timeBucket, aggregationType]) => ({
                            key,
                            timeBucket,
                            aggregationType
                        }));
                        break;
                    case 'ignoreMaxValDiff':
                        ret[key] = generic_transformers_1.transformDoubleReply[2](reply[27], undefined, typeMapping);
                        break;
                }
            }
            return ret;
        },
        3: undefined
    },
    unstableResp3: true
};
//# sourceMappingURL=INFO.js.map