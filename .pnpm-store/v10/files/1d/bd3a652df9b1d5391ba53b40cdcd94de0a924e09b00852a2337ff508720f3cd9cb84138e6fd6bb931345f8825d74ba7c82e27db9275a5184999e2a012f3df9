"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FAILOVER_MODES = void 0;
exports.FAILOVER_MODES = {
    FORCE: 'FORCE',
    TAKEOVER: 'TAKEOVER'
};
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Forces a replica to perform a manual failover of its master
     * @param parser - The Redis command parser
     * @param options - Optional configuration with FORCE or TAKEOVER mode
     */
    parseCommand(parser, options) {
        parser.push('CLUSTER', 'FAILOVER');
        if (options?.mode) {
            parser.push(options.mode);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=CLUSTER_FAILOVER.js.map