"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Returns an array with details about all Redis commands
     * @param parser - The Redis command parser
     */
    parseCommand(parser) {
        parser.push('COMMAND');
    },
    // TODO: This works, as we don't currently handle any of the items returned as a map
    transformReply(reply) {
        return reply.map(generic_transformers_1.transformCommandReply);
    }
};
//# sourceMappingURL=COMMAND.js.map