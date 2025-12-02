"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Log = exports.LOG_LEVELS = void 0;
const object_utils_js_1 = require("./object-utils.js");
exports.LOG_LEVELS = (0, object_utils_js_1.freeze)(['query', 'error']);
class Log {
    #levels;
    #logger;
    constructor(config) {
        if ((0, object_utils_js_1.isFunction)(config)) {
            this.#logger = config;
            this.#levels = (0, object_utils_js_1.freeze)({
                query: true,
                error: true,
            });
        }
        else {
            this.#logger = defaultLogger;
            this.#levels = (0, object_utils_js_1.freeze)({
                query: config.includes('query'),
                error: config.includes('error'),
            });
        }
    }
    isLevelEnabled(level) {
        return this.#levels[level];
    }
    async query(getEvent) {
        if (this.#levels.query) {
            await this.#logger(getEvent());
        }
    }
    async error(getEvent) {
        if (this.#levels.error) {
            await this.#logger(getEvent());
        }
    }
}
exports.Log = Log;
function defaultLogger(event) {
    if (event.level === 'query') {
        const prefix = `kysely:query:${event.isStream ? 'stream:' : ''}`;
        console.log(`${prefix} ${event.query.sql}`);
        console.log(`${prefix} duration: ${event.queryDurationMillis.toFixed(1)}ms`);
    }
    else if (event.level === 'error') {
        if (event.error instanceof Error) {
            console.error(`kysely:error: ${event.error.stack ?? event.error.message}`);
        }
        else {
            console.error(`kysely:error: ${JSON.stringify({
                error: event.error,
                query: event.query.sql,
                queryDurationMillis: event.queryDurationMillis,
            })}`);
        }
    }
}
