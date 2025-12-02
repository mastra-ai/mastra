"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGeoSearchOptions = exports.parseGeoSearchArguments = void 0;
function parseGeoSearchArguments(parser, key, from, by, options) {
    parser.pushKey(key);
    if (typeof from === 'string' || from instanceof Buffer) {
        parser.push('FROMMEMBER', from);
    }
    else {
        parser.push('FROMLONLAT', from.longitude.toString(), from.latitude.toString());
    }
    if ('radius' in by) {
        parser.push('BYRADIUS', by.radius.toString(), by.unit);
    }
    else {
        parser.push('BYBOX', by.width.toString(), by.height.toString(), by.unit);
    }
    parseGeoSearchOptions(parser, options);
}
exports.parseGeoSearchArguments = parseGeoSearchArguments;
function parseGeoSearchOptions(parser, options) {
    if (options?.SORT) {
        parser.push(options.SORT);
    }
    if (options?.COUNT) {
        if (typeof options.COUNT === 'number') {
            parser.push('COUNT', options.COUNT.toString());
        }
        else {
            parser.push('COUNT', options.COUNT.value.toString());
            if (options.COUNT.ANY) {
                parser.push('ANY');
            }
        }
    }
}
exports.parseGeoSearchOptions = parseGeoSearchOptions;
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Queries members inside an area of a geospatial index
     * @param parser - The Redis command parser
     * @param key - Key of the geospatial index
     * @param from - Center point of the search (member name or coordinates)
     * @param by - Search area specification (radius or box dimensions)
     * @param options - Additional search options
     */
    parseCommand(parser, key, from, by, options) {
        parser.push('GEOSEARCH');
        parseGeoSearchArguments(parser, key, from, by, options);
    },
    transformReply: undefined
};
//# sourceMappingURL=GEOSEARCH.js.map