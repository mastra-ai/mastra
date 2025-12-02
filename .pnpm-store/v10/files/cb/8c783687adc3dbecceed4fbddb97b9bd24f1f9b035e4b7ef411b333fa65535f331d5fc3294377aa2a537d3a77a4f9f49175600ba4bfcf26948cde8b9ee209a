"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("./helpers");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns information about a Bloom Filter, including capacity, size, number of filters, items inserted, and expansion rate
     * @param parser - The command parser
     * @param key - The name of the Bloom filter to get information about
     */
    parseCommand(parser, key) {
        parser.push('BF.INFO');
        parser.pushKey(key);
    },
    transformReply: {
        2: (reply, _, typeMapping) => {
            return (0, helpers_1.transformInfoV2Reply)(reply, typeMapping);
        },
        3: undefined
    }
};
//# sourceMappingURL=INFO.js.map