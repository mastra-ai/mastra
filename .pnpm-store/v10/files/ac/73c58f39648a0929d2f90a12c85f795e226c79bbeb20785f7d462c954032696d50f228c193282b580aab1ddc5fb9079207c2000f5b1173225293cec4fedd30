"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Adds geospatial items to the specified key
     * @param parser - The Redis command parser
     * @param key - Key to add the geospatial items to
     * @param toAdd - Geospatial member(s) to add
     * @param options - Options for the GEOADD command
     */
    parseCommand(parser, key, toAdd, options) {
        parser.push('GEOADD');
        parser.pushKey(key);
        if (options?.condition) {
            parser.push(options.condition);
        }
        else if (options?.NX) {
            parser.push('NX');
        }
        else if (options?.XX) {
            parser.push('XX');
        }
        if (options?.CH) {
            parser.push('CH');
        }
        if (Array.isArray(toAdd)) {
            for (const member of toAdd) {
                pushMember(parser, member);
            }
        }
        else {
            pushMember(parser, toAdd);
        }
    },
    transformReply: undefined
};
function pushMember(parser, { longitude, latitude, member }) {
    parser.push(longitude.toString(), latitude.toString(), member);
}
//# sourceMappingURL=GEOADD.js.map