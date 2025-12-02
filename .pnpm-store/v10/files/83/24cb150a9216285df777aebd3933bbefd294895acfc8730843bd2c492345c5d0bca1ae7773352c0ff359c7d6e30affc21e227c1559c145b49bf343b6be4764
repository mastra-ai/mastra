"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Returns the longitude and latitude of one or more members in a geospatial index
     * @param parser - The Redis command parser
     * @param key - Key of the geospatial index
     * @param member - One or more members in the geospatial index
     */
    parseCommand(parser, key, member) {
        parser.push('GEOPOS');
        parser.pushKey(key);
        parser.pushVariadic(member);
    },
    transformReply(reply) {
        return reply.map(item => {
            const unwrapped = item;
            return unwrapped === null ? null : {
                longitude: unwrapped[0],
                latitude: unwrapped[1]
            };
        });
    }
};
//# sourceMappingURL=GEOPOS.js.map