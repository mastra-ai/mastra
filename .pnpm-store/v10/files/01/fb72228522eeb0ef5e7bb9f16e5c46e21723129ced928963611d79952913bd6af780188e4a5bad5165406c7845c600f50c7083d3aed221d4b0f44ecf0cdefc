"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Returns the distance between two members in a geospatial index
     * @param parser - The Redis command parser
     * @param key - Key of the geospatial index
     * @param member1 - First member in the geospatial index
     * @param member2 - Second member in the geospatial index
     * @param unit - Unit of distance (m, km, ft, mi)
     */
    parseCommand(parser, key, member1, member2, unit) {
        parser.push('GEODIST');
        parser.pushKey(key);
        parser.push(member1, member2);
        if (unit) {
            parser.push(unit);
        }
    },
    transformReply(reply) {
        return reply === null ? null : Number(reply);
    }
};
//# sourceMappingURL=GEODIST.js.map