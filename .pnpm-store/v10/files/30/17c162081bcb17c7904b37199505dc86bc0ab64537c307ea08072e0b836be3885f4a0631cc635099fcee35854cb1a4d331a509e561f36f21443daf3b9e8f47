"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Initialize a Count-Min Sketch using width and depth parameters
     * @param parser - The command parser
     * @param key - The name of the sketch
     * @param width - Number of counters in each array (must be a multiple of 2)
     * @param depth - Number of counter arrays (determines accuracy of estimates)
     */
    parseCommand(parser, key, width, depth) {
        parser.push('CMS.INITBYDIM');
        parser.pushKey(key);
        parser.push(width.toString(), depth.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=INITBYDIM.js.map