"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIENT_KILL_FILTERS = void 0;
exports.CLIENT_KILL_FILTERS = {
    ADDRESS: 'ADDR',
    LOCAL_ADDRESS: 'LADDR',
    ID: 'ID',
    TYPE: 'TYPE',
    USER: 'USER',
    SKIP_ME: 'SKIPME',
    MAXAGE: 'MAXAGE'
};
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Closes client connections matching the specified filters
     * @param parser - The Redis command parser
     * @param filters - One or more filters to match client connections to kill
     */
    parseCommand(parser, filters) {
        parser.push('CLIENT', 'KILL');
        if (Array.isArray(filters)) {
            for (const filter of filters) {
                pushFilter(parser, filter);
            }
        }
        else {
            pushFilter(parser, filters);
        }
    },
    transformReply: undefined
};
function pushFilter(parser, filter) {
    if (filter === exports.CLIENT_KILL_FILTERS.SKIP_ME) {
        parser.push('SKIPME');
        return;
    }
    parser.push(filter.filter);
    switch (filter.filter) {
        case exports.CLIENT_KILL_FILTERS.ADDRESS:
            parser.push(filter.address);
            break;
        case exports.CLIENT_KILL_FILTERS.LOCAL_ADDRESS:
            parser.push(filter.localAddress);
            break;
        case exports.CLIENT_KILL_FILTERS.ID:
            parser.push(typeof filter.id === 'number' ?
                filter.id.toString() :
                filter.id);
            break;
        case exports.CLIENT_KILL_FILTERS.TYPE:
            parser.push(filter.type);
            break;
        case exports.CLIENT_KILL_FILTERS.USER:
            parser.push(filter.username);
            break;
        case exports.CLIENT_KILL_FILTERS.SKIP_ME:
            parser.push(filter.skipMe ? 'yes' : 'no');
            break;
        case exports.CLIENT_KILL_FILTERS.MAXAGE:
            parser.push(filter.maxAge.toString());
            break;
    }
}
//# sourceMappingURL=CLIENT_KILL.js.map