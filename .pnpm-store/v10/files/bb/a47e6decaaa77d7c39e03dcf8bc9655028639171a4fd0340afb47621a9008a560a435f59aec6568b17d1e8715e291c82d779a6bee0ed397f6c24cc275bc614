"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Constructs the SET command
     *
     * @param parser - The command parser
     * @param key - The key to set
     * @param value - The value to set
     * @param options - Additional options for the SET command
     * @see https://redis.io/commands/set/
     */
    parseCommand(parser, key, value, options) {
        parser.push('SET');
        parser.pushKey(key);
        parser.push(typeof value === 'number' ? value.toString() : value);
        if (options?.expiration) {
            if (typeof options.expiration === 'string') {
                parser.push(options.expiration);
            }
            else if (options.expiration.type === 'KEEPTTL') {
                parser.push('KEEPTTL');
            }
            else {
                parser.push(options.expiration.type, options.expiration.value.toString());
            }
        }
        else if (options?.EX !== undefined) {
            parser.push('EX', options.EX.toString());
        }
        else if (options?.PX !== undefined) {
            parser.push('PX', options.PX.toString());
        }
        else if (options?.EXAT !== undefined) {
            parser.push('EXAT', options.EXAT.toString());
        }
        else if (options?.PXAT !== undefined) {
            parser.push('PXAT', options.PXAT.toString());
        }
        else if (options?.KEEPTTL) {
            parser.push('KEEPTTL');
        }
        if (options?.condition) {
            parser.push(options.condition);
        }
        else if (options?.NX) {
            parser.push('NX');
        }
        else if (options?.XX) {
            parser.push('XX');
        }
        if (options?.GET) {
            parser.push('GET');
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=SET.js.map