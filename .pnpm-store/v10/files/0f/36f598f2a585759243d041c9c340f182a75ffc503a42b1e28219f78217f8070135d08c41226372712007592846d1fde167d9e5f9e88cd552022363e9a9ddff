"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Sets configuration parameters for a specific master.
     * @param parser - The Redis command parser.
     * @param dbname - Name of the master.
     * @param options - Configuration options to set as option-value pairs.
     */
    parseCommand(parser, dbname, options) {
        parser.push('SENTINEL', 'SET', dbname);
        for (const option of options) {
            parser.push(option.option, option.value);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=SENTINEL_SET.js.map