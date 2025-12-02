"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Instructs a Sentinel to monitor a new master with the specified parameters.
     * @param parser - The Redis command parser.
     * @param dbname - Name that identifies the master.
     * @param host - Host of the master.
     * @param port - Port of the master.
     * @param quorum - Number of Sentinels that need to agree to trigger a failover.
     */
    parseCommand(parser, dbname, host, port, quorum) {
        parser.push('SENTINEL', 'MONITOR', dbname, host, port, quorum);
    },
    transformReply: undefined
};
//# sourceMappingURL=SENTINEL_MONITOR.js.map