"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the ROLE command
     *
     * @param parser - The command parser
     * @see https://redis.io/commands/role/
     */
    parseCommand(parser) {
        parser.push('ROLE');
    },
    /**
     * Transforms the ROLE reply into a structured object
     *
     * @param reply - The raw reply from Redis
     * @returns Structured object representing role information
     */
    transformReply(reply) {
        switch (reply[0]) {
            case 'master': {
                const [role, replicationOffest, replicas] = reply;
                return {
                    role,
                    replicationOffest,
                    replicas: replicas.map(replica => {
                        const [host, port, replicationOffest] = replica;
                        return {
                            host,
                            port: Number(port),
                            replicationOffest: Number(replicationOffest)
                        };
                    })
                };
            }
            case 'slave': {
                const [role, masterHost, masterPort, state, dataReceived] = reply;
                return {
                    role,
                    master: {
                        host: masterHost,
                        port: masterPort
                    },
                    state,
                    dataReceived,
                };
            }
            case 'sentinel': {
                const [role, masterNames] = reply;
                return {
                    role,
                    masterNames
                };
            }
        }
    }
};
//# sourceMappingURL=ROLE.js.map