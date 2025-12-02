"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Gets the value of a key and optionally sets its expiration
     * @param parser - The Redis command parser
     * @param key - Key to get value from
     * @param options - Options for setting expiration
     */
    parseCommand(parser, key, options) {
        parser.push('GETEX');
        parser.pushKey(key);
        if ('type' in options) {
            switch (options.type) {
                case 'EX':
                case 'PX':
                    parser.push(options.type, options.value.toString());
                    break;
                case 'EXAT':
                case 'PXAT':
                    parser.push(options.type, (0, generic_transformers_1.transformEXAT)(options.value));
                    break;
                case 'PERSIST':
                    parser.push('PERSIST');
                    break;
            }
        }
        else {
            if ('EX' in options) {
                parser.push('EX', options.EX.toString());
            }
            else if ('PX' in options) {
                parser.push('PX', options.PX.toString());
            }
            else if ('EXAT' in options) {
                parser.push('EXAT', (0, generic_transformers_1.transformEXAT)(options.EXAT));
            }
            else if ('PXAT' in options) {
                parser.push('PXAT', (0, generic_transformers_1.transformPXAT)(options.PXAT));
            }
            else { // PERSIST
                parser.push('PERSIST');
            }
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=GETEX.js.map