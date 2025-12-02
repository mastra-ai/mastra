"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the HRANDFIELD command with count parameter and WITHVALUES option
     *
     * @param parser - The command parser
     * @param key - The key of the hash to get random fields from
     * @param count - The number of fields to return (positive: unique fields, negative: may repeat fields)
     * @see https://redis.io/commands/hrandfield/
     */
    parseCommand(parser, key, count) {
        parser.push('HRANDFIELD');
        parser.pushKey(key);
        parser.push(count.toString(), 'WITHVALUES');
    },
    transformReply: {
        2: (rawReply) => {
            const reply = [];
            let i = 0;
            while (i < rawReply.length) {
                reply.push({
                    field: rawReply[i++],
                    value: rawReply[i++]
                });
            }
            return reply;
        },
        3: (reply) => {
            return reply.map(entry => {
                const [field, value] = entry;
                return {
                    field,
                    value
                };
            });
        }
    }
};
//# sourceMappingURL=HRANDFIELD_COUNT_WITHVALUES.js.map