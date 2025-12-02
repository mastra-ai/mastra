"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bloom_1 = require("../bloom");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns width, depth, and total count of items in a Count-Min Sketch
     * @param parser - The command parser
     * @param key - The name of the sketch to get information about
     */
    parseCommand(parser, key) {
        parser.push('CMS.INFO');
        parser.pushKey(key);
    },
    transformReply: {
        2: (reply, _, typeMapping) => {
            return (0, bloom_1.transformInfoV2Reply)(reply, typeMapping);
        },
        3: undefined
    }
};
//# sourceMappingURL=INFO.js.map