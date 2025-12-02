"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareConfigWithURL = prepareConfigWithURL;
exports.getConnectionParams = getConnectionParams;
exports.mergeConfigs = mergeConfigs;
exports.createUrl = createUrl;
exports.loadConfigOptionsFromURL = loadConfigOptionsFromURL;
exports.booleanConfigURLValue = booleanConfigURLValue;
exports.numberConfigURLValue = numberConfigURLValue;
exports.enumConfigURLValue = enumConfigURLValue;
const logger_1 = require("./logger");
/**
 * Validates and normalizes the provided "base" config.
 * Warns about deprecated configuration parameters usage.
 * Parses the common URL parameters into the configuration parameters (these are the same for all implementations).
 * Parses implementation-specific URL parameters using the handler provided by that implementation.
 * Merges these parameters with the base config and implementation-specific defaults.
 * Enforces certain defaults in case of deprecated keys or readonly mode.
 */
function prepareConfigWithURL(baseConfigOptions, logger, handleImplURLParams) {
    const baseConfig = { ...baseConfigOptions };
    if (baseConfig.additional_headers !== undefined) {
        logger.warn({
            module: 'Config',
            message: '"additional_headers" is deprecated. Use "http_headers" instead.',
        });
        baseConfig.http_headers = baseConfig.additional_headers;
        delete baseConfig.additional_headers;
    }
    let configURL;
    if (baseConfig.host !== undefined) {
        logger.warn({
            module: 'Config',
            message: '"host" is deprecated. Use "url" instead.',
        });
        configURL = createUrl(baseConfig.host);
        delete baseConfig.host;
    }
    else {
        configURL = createUrl(baseConfig.url);
    }
    const [url, configFromURL] = loadConfigOptionsFromURL(configURL, handleImplURLParams);
    const config = mergeConfigs(baseConfig, configFromURL, logger);
    if (config.pathname !== undefined) {
        url.pathname = config.pathname;
    }
    config.url = url;
    return config;
}
function getConnectionParams(config, logger) {
    let auth;
    if (config.access_token !== undefined) {
        if (config.username !== undefined || config.password !== undefined) {
            throw new Error('Both access token and username/password are provided in the configuration. Please use only one authentication method.');
        }
        auth = { access_token: config.access_token, type: 'JWT' };
    }
    else {
        auth = {
            username: config.username ?? 'default',
            password: config.password ?? '',
            type: 'Credentials',
        };
    }
    return {
        auth,
        url: config.url,
        application_id: config.application,
        request_timeout: config.request_timeout ?? 30000,
        max_open_connections: config.max_open_connections ?? 10,
        compression: {
            decompress_response: config.compression?.response ?? false,
            compress_request: config.compression?.request ?? false,
        },
        database: config.database ?? 'default',
        log_writer: new logger_1.LogWriter(logger, 'Connection', config.log?.level),
        keep_alive: { enabled: config.keep_alive?.enabled ?? true },
        clickhouse_settings: config.clickhouse_settings ?? {},
        http_headers: config.http_headers ?? {},
    };
}
/**
 * Merge two versions of the config: base (hardcoded) from the instance creation and the URL parsed one.
 * URL config takes priority and overrides the base config parameters.
 * If a value is overridden, then a warning will be logged (even if the log level is OFF).
 */
function mergeConfigs(baseConfig, configFromURL, logger) {
    function deepMerge(base, fromURL, path = []) {
        for (const key of Object.keys(fromURL)) {
            if (typeof fromURL[key] === 'object') {
                deepMerge(base, fromURL[key], path.concat(key));
            }
            else {
                let baseAtPath = base;
                for (const key of path) {
                    if (baseAtPath[key] === undefined) {
                        baseAtPath[key] = {};
                    }
                    baseAtPath = baseAtPath[key];
                }
                const baseAtKey = baseAtPath[key];
                if (baseAtKey !== undefined) {
                    const fullPath = path.concat(key).join('.');
                    logger.warn({
                        module: 'Config',
                        message: `"${fullPath}" is overridden by a URL parameter.`,
                    });
                }
                baseAtPath[key] = fromURL[key];
            }
        }
    }
    const config = { ...baseConfig };
    deepMerge(config, configFromURL);
    return config;
}
function createUrl(configURL) {
    let url;
    try {
        if (typeof configURL === 'string' || configURL instanceof URL) {
            url = new URL(configURL);
        }
        else {
            return new URL('http://localhost:8123');
        }
    }
    catch (err) {
        throw new Error('ClickHouse URL is malformed. Expected format: http[s]://[username:password@]hostname:port[/database][?param1=value1&param2=value2]', { cause: err });
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(`ClickHouse URL protocol must be either http or https. Got: ${url.protocol}`);
    }
    return url;
}
/**
 * @param url potentially contains auth, database and URL params to parse the configuration from
 * @param handleExtraURLParams some platform-specific URL params might be unknown by the common package;
 * use this function defined in the implementation to handle them. Logs warnings in case of hardcode overrides.
 */
function loadConfigOptionsFromURL(url, handleExtraURLParams) {
    let config = {};
    // trim is not needed, cause space is not allowed in the URL basic auth and should be encoded as %20
    if (url.username !== '') {
        config.username = decodeURIComponent(url.username);
    }
    if (url.password !== '') {
        config.password = decodeURIComponent(url.password);
    }
    if (url.pathname.trim().length > 1) {
        config.database = url.pathname.slice(1);
    }
    const urlSearchParamsKeys = [...url.searchParams.keys()];
    if (urlSearchParamsKeys.length > 0) {
        const unknownParams = new Set();
        const settingPrefix = 'clickhouse_setting_';
        const settingShortPrefix = 'ch_';
        const httpHeaderPrefix = 'http_header_';
        urlSearchParamsKeys.forEach((key) => {
            let paramWasProcessed = true;
            const value = url.searchParams.get(key);
            if (key.startsWith(settingPrefix)) {
                // clickhouse_settings_*
                const settingKey = key.slice(settingPrefix.length);
                if (config.clickhouse_settings === undefined) {
                    config.clickhouse_settings = {};
                }
                config.clickhouse_settings[settingKey] = value;
            }
            else if (key.startsWith(settingShortPrefix)) {
                // ch_*
                const settingKey = key.slice(settingShortPrefix.length);
                if (config.clickhouse_settings === undefined) {
                    config.clickhouse_settings = {};
                }
                config.clickhouse_settings[settingKey] = value;
            }
            else if (key.startsWith(httpHeaderPrefix)) {
                // http_headers_*
                const headerKey = key.slice(httpHeaderPrefix.length);
                if (config.http_headers === undefined) {
                    config.http_headers = {};
                }
                config.http_headers[headerKey] = value;
            }
            else {
                // static known parameters
                switch (key) {
                    case 'application':
                        config.application = value;
                        break;
                    case 'pathname':
                        config.pathname = value;
                        break;
                    case 'session_id':
                        config.session_id = value;
                        break;
                    case 'request_timeout':
                        config.request_timeout = numberConfigURLValue({
                            key,
                            value,
                            min: 0,
                        });
                        break;
                    case 'max_open_connections':
                        config.max_open_connections = numberConfigURLValue({
                            key,
                            value,
                            min: 1,
                        });
                        break;
                    case 'compression_request':
                        if (config.compression === undefined) {
                            config.compression = {};
                        }
                        config.compression.request = booleanConfigURLValue({ key, value });
                        break;
                    case 'compression_response':
                        if (config.compression === undefined) {
                            config.compression = {};
                        }
                        config.compression.response = booleanConfigURLValue({
                            key,
                            value,
                        });
                        break;
                    case 'log_level':
                        if (config.log === undefined) {
                            config.log = {};
                        }
                        config.log.level = enumConfigURLValue({
                            key,
                            value,
                            enumObject: logger_1.ClickHouseLogLevel,
                        });
                        break;
                    case 'keep_alive_enabled':
                        if (config.keep_alive === undefined) {
                            config.keep_alive = {};
                        }
                        config.keep_alive.enabled = booleanConfigURLValue({ key, value });
                        break;
                    case 'access_token':
                        config.access_token = value;
                        break;
                    default:
                        paramWasProcessed = false;
                        unknownParams.add(key);
                        break;
                }
            }
            if (paramWasProcessed) {
                // so it won't be passed to the impl URL params handler
                url.searchParams.delete(key);
            }
        });
        if (handleExtraURLParams !== null) {
            const res = handleExtraURLParams(config, url);
            config = res.config;
            if (unknownParams.size > 0) {
                res.handled_params.forEach((k) => unknownParams.delete(k));
            }
            if (res.unknown_params.size > 0) {
                res.unknown_params.forEach((k) => unknownParams.add(k));
            }
        }
        if (unknownParams.size > 0) {
            throw new Error(`Unknown URL parameters: ${Array.from(unknownParams).join(', ')}`);
        }
    }
    // clean up the final ClickHouse URL to be used in the connection
    const clickHouseURL = new URL(`${url.protocol}//${url.host}`);
    return [clickHouseURL, config];
}
function booleanConfigURLValue({ key, value, }) {
    const trimmed = value.trim();
    if (trimmed === 'true' || trimmed === '1')
        return true;
    if (trimmed === 'false' || trimmed === '0')
        return false;
    throw new Error(`"${key}" has invalid boolean value: ${trimmed}. Expected one of: 0, 1, true, false.`);
}
function numberConfigURLValue({ key, value, min, max, }) {
    const trimmed = value.trim();
    const number = Number(trimmed);
    if (isNaN(number))
        throw new Error(`"${key}" has invalid numeric value: ${trimmed}`);
    if (min !== undefined && number < min) {
        throw new Error(`"${key}" value ${trimmed} is less than min allowed ${min}`);
    }
    if (max !== undefined && number > max) {
        throw new Error(`"${key}" value ${trimmed} is greater than max allowed ${max}`);
    }
    return number;
}
function enumConfigURLValue({ key, value, enumObject, }) {
    const values = Object.keys(enumObject).filter((item) => isNaN(Number(item)));
    const trimmed = value.trim();
    if (!values.includes(trimmed)) {
        const expected = values.join(', ');
        throw new Error(`"${key}" has invalid value: ${trimmed}. Expected one of: ${expected}.`);
    }
    return enumObject[trimmed];
}
//# sourceMappingURL=config.js.map