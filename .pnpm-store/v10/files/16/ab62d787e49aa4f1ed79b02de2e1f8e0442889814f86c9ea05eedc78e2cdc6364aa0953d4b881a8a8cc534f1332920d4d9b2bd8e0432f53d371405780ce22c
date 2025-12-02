"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    parseCommand(parser, key, lastId, options) {
        parser.push('XSETID');
        parser.pushKey(key);
        parser.push(lastId);
        if (options?.ENTRIESADDED) {
            parser.push('ENTRIESADDED', options.ENTRIESADDED.toString());
        }
        if (options?.MAXDELETEDID) {
            parser.push('MAXDELETEDID', options.MAXDELETEDID);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=XSETID.js.map