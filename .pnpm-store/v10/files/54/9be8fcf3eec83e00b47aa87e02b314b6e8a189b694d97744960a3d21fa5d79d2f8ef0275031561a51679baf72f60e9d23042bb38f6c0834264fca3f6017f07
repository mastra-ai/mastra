"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Sets a RediSearch configuration option value.
     * @param parser - The command parser
     * @param property - The name of the configuration option to set
     * @param value - The value to set for the configuration option
     */
    parseCommand(parser, property, value) {
        parser.push('FT.CONFIG', 'SET', property, value);
    },
    transformReply: undefined
};
//# sourceMappingURL=CONFIG_SET.js.map