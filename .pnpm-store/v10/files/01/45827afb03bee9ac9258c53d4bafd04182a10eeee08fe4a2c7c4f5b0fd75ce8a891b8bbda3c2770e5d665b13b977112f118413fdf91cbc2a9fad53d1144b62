"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Advances the cluster config epoch
     * @param parser - The Redis command parser
     */
    parseCommand(parser) {
        parser.push('CLUSTER', 'BUMPEPOCH');
    },
    transformReply: undefined
};
//# sourceMappingURL=CLUSTER_BUMPEPOCH.js.map