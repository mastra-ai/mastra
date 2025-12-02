"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserAgent = getUserAgent;
const runtime_1 = require("./runtime");
/**
 * Generate a user agent string like
 * ```
 * clickhouse-js/0.0.11 (lv:nodejs/19.0.4; os:linux)
 * ```
 * or
 * ```
 * MyApplicationName clickhouse-js/0.0.11 (lv:nodejs/19.0.4; os:linux)
 * ```
 */
function getUserAgent(application_id) {
    const defaultUserAgent = `clickhouse-js/${runtime_1.Runtime.package} (lv:nodejs/${runtime_1.Runtime.node}; os:${runtime_1.Runtime.os})`;
    return application_id
        ? `${application_id} ${defaultUserAgent}`
        : defaultUserAgent;
}
//# sourceMappingURL=user_agent.js.map