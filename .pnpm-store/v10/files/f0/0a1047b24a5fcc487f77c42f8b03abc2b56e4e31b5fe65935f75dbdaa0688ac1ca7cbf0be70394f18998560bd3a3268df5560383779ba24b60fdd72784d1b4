"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GEOSEARCH_1 = require("./GEOSEARCH");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Searches a geospatial index and stores the results in a new sorted set
     * @param parser - The Redis command parser
     * @param destination - Key to store the results
     * @param source - Key of the geospatial index to search
     * @param from - Center point of the search (member name or coordinates)
     * @param by - Search area specification (radius or box dimensions)
     * @param options - Additional search and storage options
     */
    parseCommand(parser, destination, source, from, by, options) {
        parser.push('GEOSEARCHSTORE');
        if (destination !== undefined) {
            parser.pushKey(destination);
        }
        (0, GEOSEARCH_1.parseGeoSearchArguments)(parser, source, from, by, options);
        if (options?.STOREDIST) {
            parser.push('STOREDIST');
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=GEOSEARCHSTORE.js.map