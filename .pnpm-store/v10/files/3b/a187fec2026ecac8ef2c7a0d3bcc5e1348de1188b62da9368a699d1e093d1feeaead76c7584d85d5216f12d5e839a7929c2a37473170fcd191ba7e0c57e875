"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GEO_REPLY_WITH = void 0;
const GEOSEARCH_1 = __importDefault(require("./GEOSEARCH"));
exports.GEO_REPLY_WITH = {
    DISTANCE: 'WITHDIST',
    HASH: 'WITHHASH',
    COORDINATES: 'WITHCOORD'
};
exports.default = {
    IS_READ_ONLY: GEOSEARCH_1.default.IS_READ_ONLY,
    /**
     * Queries members inside an area of a geospatial index with additional information
     * @param parser - The Redis command parser
     * @param key - Key of the geospatial index
     * @param from - Center point of the search (member name or coordinates)
     * @param by - Search area specification (radius or box dimensions)
     * @param replyWith - Information to include with each returned member
     * @param options - Additional search options
     */
    parseCommand(parser, key, from, by, replyWith, options) {
        GEOSEARCH_1.default.parseCommand(parser, key, from, by, options);
        parser.push(...replyWith);
        parser.preserve = replyWith;
    },
    transformReply(reply, replyWith) {
        const replyWithSet = new Set(replyWith);
        let index = 0;
        const distanceIndex = replyWithSet.has(exports.GEO_REPLY_WITH.DISTANCE) && ++index, hashIndex = replyWithSet.has(exports.GEO_REPLY_WITH.HASH) && ++index, coordinatesIndex = replyWithSet.has(exports.GEO_REPLY_WITH.COORDINATES) && ++index;
        return reply.map(raw => {
            const unwrapped = raw;
            const item = {
                member: unwrapped[0]
            };
            if (distanceIndex) {
                item.distance = unwrapped[distanceIndex];
            }
            if (hashIndex) {
                item.hash = unwrapped[hashIndex];
            }
            if (coordinatesIndex) {
                const [longitude, latitude] = unwrapped[coordinatesIndex];
                item.coordinates = {
                    longitude,
                    latitude
                };
            }
            return item;
        });
    }
};
//# sourceMappingURL=GEOSEARCH_WITH.js.map