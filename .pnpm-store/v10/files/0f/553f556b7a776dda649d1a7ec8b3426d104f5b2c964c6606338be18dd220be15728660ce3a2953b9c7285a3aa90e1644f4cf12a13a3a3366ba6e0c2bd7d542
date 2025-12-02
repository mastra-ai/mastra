"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Returns ACL security events log entries
     * @param parser - The Redis command parser
     * @param count - Optional maximum number of entries to return
     */
    parseCommand(parser, count) {
        parser.push('ACL', 'LOG');
        if (count != undefined) {
            parser.push(count.toString());
        }
    },
    transformReply: {
        2: (reply, preserve, typeMapping) => {
            return reply.map(item => {
                const inferred = item;
                return {
                    count: inferred[1],
                    reason: inferred[3],
                    context: inferred[5],
                    object: inferred[7],
                    username: inferred[9],
                    'age-seconds': generic_transformers_1.transformDoubleReply[2](inferred[11], preserve, typeMapping),
                    'client-info': inferred[13],
                    'entry-id': inferred[15],
                    'timestamp-created': inferred[17],
                    'timestamp-last-updated': inferred[19]
                };
            });
        },
        3: undefined
    }
};
//# sourceMappingURL=ACL_LOG.js.map