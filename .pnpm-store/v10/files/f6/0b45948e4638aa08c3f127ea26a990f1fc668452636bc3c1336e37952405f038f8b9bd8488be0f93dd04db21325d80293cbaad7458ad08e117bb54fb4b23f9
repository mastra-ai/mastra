"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Performs arbitrary bitfield integer operations on strings
     * @param parser - The Redis command parser
     * @param key - The key holding the string
     * @param operations - Array of bitfield operations to perform: GET, SET, INCRBY or OVERFLOW
     */
    parseCommand(parser, key, operations) {
        parser.push('BITFIELD');
        parser.pushKey(key);
        for (const options of operations) {
            switch (options.operation) {
                case 'GET':
                    parser.push('GET', options.encoding, options.offset.toString());
                    break;
                case 'SET':
                    parser.push('SET', options.encoding, options.offset.toString(), options.value.toString());
                    break;
                case 'INCRBY':
                    parser.push('INCRBY', options.encoding, options.offset.toString(), options.increment.toString());
                    break;
                case 'OVERFLOW':
                    parser.push('OVERFLOW', options.behavior);
                    break;
            }
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=BITFIELD.js.map