"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClickHouseLogLevel = exports.LogWriter = exports.DefaultLogger = void 0;
class DefaultLogger {
    trace({ module, message, args }) {
        const params = [
            formatMessage({ module, message, level: 'TRACE' }),
        ];
        if (args) {
            params.push('\nArguments:', args);
        }
        console.debug(...params);
    }
    debug({ module, message, args }) {
        const params = [
            formatMessage({ module, message, level: 'DEBUG' }),
        ];
        if (args) {
            params.push('\nArguments:', args);
        }
        console.debug(...params);
    }
    info({ module, message, args }) {
        const params = [
            formatMessage({ module, message, level: 'INFO' }),
        ];
        if (args) {
            params.push('\nArguments:', args);
        }
        console.info(...params);
    }
    warn({ module, message, args, err }) {
        const params = [
            formatMessage({ module, message, level: 'WARN' }),
        ];
        if (args) {
            params.push('\nArguments:', args);
        }
        if (err) {
            params.push('\nCaused by:', err);
        }
        console.warn(...params);
    }
    error({ module, message, args, err }) {
        const params = [
            formatMessage({ module, message, level: 'ERROR' }),
        ];
        if (args) {
            params.push('\nArguments:', args);
        }
        params.push('\nCaused by:', err);
        console.error(...params);
    }
}
exports.DefaultLogger = DefaultLogger;
class LogWriter {
    constructor(logger, module, logLevel) {
        Object.defineProperty(this, "logger", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: logger
        });
        Object.defineProperty(this, "module", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: module
        });
        Object.defineProperty(this, "logLevel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.logLevel = logLevel ?? ClickHouseLogLevel.OFF;
        this.info({
            message: `Log level is set to ${ClickHouseLogLevel[this.logLevel]}`,
        });
    }
    trace(params) {
        if (this.logLevel <= ClickHouseLogLevel.TRACE) {
            this.logger.trace({
                ...params,
                module: params.module ?? this.module,
            });
        }
    }
    debug(params) {
        if (this.logLevel <= ClickHouseLogLevel.DEBUG) {
            this.logger.debug({
                ...params,
                module: params.module ?? this.module,
            });
        }
    }
    info(params) {
        if (this.logLevel <= ClickHouseLogLevel.INFO) {
            this.logger.info({
                ...params,
                module: params.module ?? this.module,
            });
        }
    }
    warn(params) {
        if (this.logLevel <= ClickHouseLogLevel.WARN) {
            this.logger.warn({
                ...params,
                module: params.module ?? this.module,
            });
        }
    }
    error(params) {
        if (this.logLevel <= ClickHouseLogLevel.ERROR) {
            this.logger.error({
                ...params,
                module: params.module ?? this.module,
            });
        }
    }
}
exports.LogWriter = LogWriter;
var ClickHouseLogLevel;
(function (ClickHouseLogLevel) {
    ClickHouseLogLevel[ClickHouseLogLevel["TRACE"] = 0] = "TRACE";
    ClickHouseLogLevel[ClickHouseLogLevel["DEBUG"] = 1] = "DEBUG";
    ClickHouseLogLevel[ClickHouseLogLevel["INFO"] = 2] = "INFO";
    ClickHouseLogLevel[ClickHouseLogLevel["WARN"] = 3] = "WARN";
    ClickHouseLogLevel[ClickHouseLogLevel["ERROR"] = 4] = "ERROR";
    ClickHouseLogLevel[ClickHouseLogLevel["OFF"] = 127] = "OFF";
})(ClickHouseLogLevel || (exports.ClickHouseLogLevel = ClickHouseLogLevel = {}));
function formatMessage({ level, module, message, }) {
    const ts = new Date().toISOString();
    return `[${ts}][${level}][@clickhouse/client][${module}] ${message}`;
}
//# sourceMappingURL=logger.js.map