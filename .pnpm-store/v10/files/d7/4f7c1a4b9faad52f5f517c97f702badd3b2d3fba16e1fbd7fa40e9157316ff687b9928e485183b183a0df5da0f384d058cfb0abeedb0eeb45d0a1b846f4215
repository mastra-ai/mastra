"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Merges multiple Count-Min Sketches into a single sketch, with optional weights
     * @param parser - The command parser
     * @param destination - The name of the destination sketch
     * @param source - Array of sketch names or array of sketches with weights
     */
    parseCommand(parser, destination, source) {
        parser.push('CMS.MERGE');
        parser.pushKey(destination);
        parser.push(source.length.toString());
        if (isPlainSketches(source)) {
            parser.pushVariadic(source);
        }
        else {
            for (let i = 0; i < source.length; i++) {
                parser.push(source[i].name);
            }
            parser.push('WEIGHTS');
            for (let i = 0; i < source.length; i++) {
                parser.push(source[i].weight.toString());
            }
        }
    },
    transformReply: undefined
};
function isPlainSketches(src) {
    return typeof src[0] === 'string' || src[0] instanceof Buffer;
}
//# sourceMappingURL=MERGE.js.map