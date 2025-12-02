"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the MEMORY STATS command
     *
     * @param parser - The command parser
     * @see https://redis.io/commands/memory-stats/
     */
    parseCommand(parser) {
        parser.push('MEMORY', 'STATS');
    },
    transformReply: {
        2: (rawReply, preserve, typeMapping) => {
            const reply = {};
            let i = 0;
            while (i < rawReply.length) {
                switch (rawReply[i].toString()) {
                    case 'dataset.percentage':
                    case 'peak.percentage':
                    case 'allocator-fragmentation.ratio':
                    case 'allocator-rss.ratio':
                    case 'rss-overhead.ratio':
                    case 'fragmentation':
                        reply[rawReply[i++]] = generic_transformers_1.transformDoubleReply[2](rawReply[i++], preserve, typeMapping);
                        break;
                    default:
                        reply[rawReply[i++]] = rawReply[i++];
                }
            }
            return reply;
        },
        3: undefined
    }
};
//# sourceMappingURL=MEMORY_STATS.js.map