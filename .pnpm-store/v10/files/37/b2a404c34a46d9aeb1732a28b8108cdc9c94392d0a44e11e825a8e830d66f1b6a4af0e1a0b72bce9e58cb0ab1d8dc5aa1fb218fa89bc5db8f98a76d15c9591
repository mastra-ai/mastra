"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Controls server-assisted client side caching for the current connection
     * @param parser - The Redis command parser
     * @param mode - Whether to enable (true) or disable (false) tracking
     * @param options - Optional configuration including REDIRECT, BCAST, PREFIX, OPTIN, OPTOUT, and NOLOOP options
     */
    parseCommand(parser, mode, options) {
        parser.push('CLIENT', 'TRACKING', mode ? 'ON' : 'OFF');
        if (mode) {
            if (options?.REDIRECT) {
                parser.push('REDIRECT', options.REDIRECT.toString());
            }
            if (isBroadcast(options)) {
                parser.push('BCAST');
                if (options?.PREFIX) {
                    if (Array.isArray(options.PREFIX)) {
                        for (const prefix of options.PREFIX) {
                            parser.push('PREFIX', prefix);
                        }
                    }
                    else {
                        parser.push('PREFIX', options.PREFIX);
                    }
                }
            }
            else if (isOptIn(options)) {
                parser.push('OPTIN');
            }
            else if (isOptOut(options)) {
                parser.push('OPTOUT');
            }
            if (options?.NOLOOP) {
                parser.push('NOLOOP');
            }
        }
    },
    transformReply: undefined
};
function isBroadcast(options) {
    return options?.BCAST === true;
}
function isOptIn(options) {
    return options?.OPTIN === true;
}
function isOptOut(options) {
    return options?.OPTOUT === true;
}
//# sourceMappingURL=CLIENT_TRACKING.js.map