"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Starts a coordinated failover between the primary and a replica
     * @param parser - The Redis command parser
     * @param options - Failover options including target host, abort flag, and timeout
     */
    parseCommand(parser, options) {
        parser.push('FAILOVER');
        if (options?.TO) {
            parser.push('TO', options.TO.host, options.TO.port.toString());
            if (options.TO.FORCE) {
                parser.push('FORCE');
            }
        }
        if (options?.ABORT) {
            parser.push('ABORT');
        }
        if (options?.TIMEOUT) {
            parser.push('TIMEOUT', options.TIMEOUT.toString());
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=FAILOVER.js.map