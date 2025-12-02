"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Returns the scores associated with the specified members in the sorted set stored at key.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     * @param member - One or more members to get scores for.
     */
    parseCommand(parser, key, member) {
        parser.push('ZMSCORE');
        parser.pushKey(key);
        parser.pushVariadic(member);
    },
    transformReply: {
        2: (reply, preserve, typeMapping) => {
            return reply.map((0, generic_transformers_1.createTransformNullableDoubleReplyResp2Func)(preserve, typeMapping));
        },
        3: undefined
    }
};
//# sourceMappingURL=ZMSCORE.js.map