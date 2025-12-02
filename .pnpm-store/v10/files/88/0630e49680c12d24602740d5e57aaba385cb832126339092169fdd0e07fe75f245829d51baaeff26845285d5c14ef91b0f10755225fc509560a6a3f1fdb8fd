"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the MIGRATE command
     *
     * @param parser - The command parser
     * @param host - Target Redis instance host
     * @param port - Target Redis instance port
     * @param key - Key or keys to migrate
     * @param destinationDb - Target database index
     * @param timeout - Timeout in milliseconds
     * @param options - Optional parameters including COPY, REPLACE, and AUTH
     * @see https://redis.io/commands/migrate/
     */
    parseCommand(parser, host, port, key, destinationDb, timeout, options) {
        parser.push('MIGRATE', host, port.toString());
        const isKeyArray = Array.isArray(key);
        if (isKeyArray) {
            parser.push('');
        }
        else {
            parser.push(key);
        }
        parser.push(destinationDb.toString(), timeout.toString());
        if (options?.COPY) {
            parser.push('COPY');
        }
        if (options?.REPLACE) {
            parser.push('REPLACE');
        }
        if (options?.AUTH) {
            if (options.AUTH.username) {
                parser.push('AUTH2', options.AUTH.username, options.AUTH.password);
            }
            else {
                parser.push('AUTH', options.AUTH.password);
            }
        }
        if (isKeyArray) {
            parser.push('KEYS');
            parser.pushVariadic(key);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=MIGRATE.js.map