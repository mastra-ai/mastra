"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Returns the Geohash string representation of one or more position members
     * @param parser - The Redis command parser
     * @param key - Key of the geospatial index
     * @param member - One or more members in the geospatial index
     */
    parseCommand(parser, key, member) {
        parser.push('GEOHASH');
        parser.pushKey(key);
        parser.pushVariadic(member);
    },
    transformReply: undefined
};
//# sourceMappingURL=GEOHASH.js.map