"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Gets a RediSearch configuration option value.
     * @param parser - The command parser
     * @param option - The name of the configuration option to retrieve
     */
    parseCommand(parser, option) {
        parser.push('FT.CONFIG', 'GET', option);
    },
    transformReply(reply) {
        const transformedReply = Object.create(null);
        for (const item of reply) {
            const [key, value] = item;
            transformedReply[key.toString()] = value;
        }
        return transformedReply;
    }
};
//# sourceMappingURL=CONFIG_GET.js.map