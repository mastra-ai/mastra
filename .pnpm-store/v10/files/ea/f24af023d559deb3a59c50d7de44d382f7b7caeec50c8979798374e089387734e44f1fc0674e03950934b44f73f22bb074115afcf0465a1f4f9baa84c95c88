"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("../../commands/generic-transformers");
exports.default = {
    /**
     * Returns a list of Sentinel instances for the specified master.
     * @param parser - The Redis command parser.
     * @param dbname - Name of the master.
     */
    parseCommand(parser, dbname) {
        parser.push('SENTINEL', 'SENTINELS', dbname);
    },
    transformReply: {
        2: (reply, preserve, typeMapping) => {
            const inferred = reply;
            const initial = [];
            return inferred.reduce((sentinels, x) => {
                sentinels.push((0, generic_transformers_1.transformTuplesReply)(x, undefined, typeMapping));
                return sentinels;
            }, initial);
        },
        3: undefined
    }
};
//# sourceMappingURL=SENTINEL_SENTINELS.js.map