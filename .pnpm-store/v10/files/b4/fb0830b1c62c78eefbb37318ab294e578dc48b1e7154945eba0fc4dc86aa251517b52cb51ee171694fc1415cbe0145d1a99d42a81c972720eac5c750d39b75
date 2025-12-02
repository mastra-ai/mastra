"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Copies the value stored at the source key to the destination key
     * @param parser - The Redis command parser
     * @param source - Source key
     * @param destination - Destination key
     * @param options - Options for the copy operation
     */
    parseCommand(parser, source, destination, options) {
        parser.push('COPY');
        parser.pushKeys([source, destination]);
        if (options?.DB) {
            parser.push('DB', options.DB.toString());
        }
        if (options?.REPLACE) {
            parser.push('REPLACE');
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=COPY.js.map