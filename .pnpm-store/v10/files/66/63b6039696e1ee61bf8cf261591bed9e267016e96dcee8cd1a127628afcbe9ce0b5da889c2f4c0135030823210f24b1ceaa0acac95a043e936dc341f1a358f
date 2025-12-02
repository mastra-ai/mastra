"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Resets a Redis Cluster node, clearing all information and returning it to a brand new state
     * @param parser - The Redis command parser
     * @param options - Options for the reset operation
     */
    parseCommand(parser, options) {
        parser.push('CLUSTER', 'RESET');
        if (options?.mode) {
            parser.push(options.mode);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=CLUSTER_RESET.js.map