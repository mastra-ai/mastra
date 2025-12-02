"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatQuerySettings = formatQuerySettings;
const settings_1 = require("../settings");
function formatQuerySettings(value) {
    if (typeof value === 'boolean')
        return value ? '1' : '0';
    if (typeof value === 'number')
        return String(value);
    if (typeof value === 'string')
        return value;
    // ClickHouse requires a specific, non-JSON format for passing maps
    // as a setting value - single quotes instead of double
    // Example: {'system.numbers':'number != 3'}
    if (value instanceof settings_1.SettingsMap) {
        return value.toString();
    }
    throw new Error(`Unsupported value in query settings: [${value}].`);
}
//# sourceMappingURL=format_query_settings.js.map