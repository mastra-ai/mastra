"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Options = exports.TransactionOptions = exports.RetryOptions = exports.logWarnings = exports.throwWarnings = exports.RetryCondition = exports.IsolationLevel = void 0;
exports.defaultBackoff = defaultBackoff;
const errors = __importStar(require("./errors/index"));
const buffer_1 = require("./primitives/buffer");
const record_1 = require("./codecs/record");
const context_1 = require("./codecs/context");
function defaultBackoff(attempt) {
    return 2 ** attempt * 100 + Math.random() * 100;
}
var IsolationLevel;
(function (IsolationLevel) {
    IsolationLevel["Serializable"] = "Serializable";
    IsolationLevel["RepeatableRead"] = "RepeatableRead";
    IsolationLevel["PreferRepeatableRead"] = "PreferRepeatableRead";
})(IsolationLevel || (exports.IsolationLevel = IsolationLevel = {}));
var RetryCondition;
(function (RetryCondition) {
    RetryCondition[RetryCondition["TransactionConflict"] = 0] = "TransactionConflict";
    RetryCondition[RetryCondition["NetworkError"] = 1] = "NetworkError";
})(RetryCondition || (exports.RetryCondition = RetryCondition = {}));
class RetryRule {
    attempts;
    backoff;
    constructor(attempts, backoff) {
        this.attempts = attempts;
        this.backoff = backoff;
    }
}
const throwWarnings = (warnings) => {
    throw new AggregateError(warnings, formatWarnings(warnings));
};
exports.throwWarnings = throwWarnings;
const logWarnings = (warnings) => {
    const merged = new Error(formatWarnings(warnings));
    console.warn(Object.assign(merged, { name: "" }));
};
exports.logWarnings = logWarnings;
const formatWarnings = (warnings) => `warnings occurred while running query:\n${warnings.map((warn) => warn.message).join("\n")}`;
class RetryOptions {
    default;
    overrides;
    constructor(attempts = 3, backoff = defaultBackoff) {
        this.default = new RetryRule(attempts, backoff);
        this.overrides = new Map();
    }
    withRule(condition, attempts, backoff) {
        const def = this.default;
        const overrides = new Map(this.overrides);
        overrides.set(condition, new RetryRule(attempts ?? def.attempts, backoff ?? def.backoff));
        const result = Object.create(RetryOptions.prototype);
        result.default = def;
        result.overrides = overrides;
        return result;
    }
    getRuleForException(err) {
        let result;
        if (err instanceof errors.TransactionConflictError) {
            result = this.overrides.get(RetryCondition.TransactionConflict);
        }
        else if (err instanceof errors.ClientError) {
            result = this.overrides.get(RetryCondition.NetworkError);
        }
        return result ?? this.default;
    }
    static defaults() {
        return _retryOptionsDefault;
    }
}
exports.RetryOptions = RetryOptions;
const _retryOptionsDefault = new RetryOptions();
class TransactionOptions {
    isolation;
    readonly;
    deferrable;
    constructor({ isolation, readonly, deferrable, } = {}) {
        this.isolation = isolation;
        this.readonly = readonly;
        this.deferrable = deferrable;
    }
    isDefault() {
        return (this.isolation === undefined &&
            this.readonly === undefined &&
            this.deferrable === undefined);
    }
    static defaults() {
        return _defaultTransactionOptions;
    }
}
exports.TransactionOptions = TransactionOptions;
const _defaultTransactionOptions = new TransactionOptions();
const TAG_ANNOTATION_KEY = "tag";
class Options {
    static schemaVersion = 0;
    module;
    moduleAliases;
    config;
    globals;
    retryOptions;
    transactionOptions;
    codecs;
    warningHandler;
    annotations = new Map();
    cachedCodecContext = null;
    cachedCodecContextVer = -1;
    get tag() {
        return this.annotations.get(TAG_ANNOTATION_KEY) ?? null;
    }
    static signalSchemaChange() {
        this.schemaVersion += 1;
    }
    constructor({ retryOptions = RetryOptions.defaults(), transactionOptions = TransactionOptions.defaults(), warningHandler = exports.logWarnings, module = "default", moduleAliases = {}, config = {}, globals = {}, codecs = {}, } = {}) {
        this.retryOptions = retryOptions;
        this.transactionOptions = transactionOptions;
        this.warningHandler = warningHandler;
        this.module = module;
        this.moduleAliases = new Map(Object.entries(moduleAliases));
        this.config = new Map(Object.entries(config));
        this.globals = new Map(Object.entries(globals));
        this.codecs = new Map(Object.entries(codecs));
    }
    makeCodecContext() {
        if (this.codecs.size === 0) {
            return context_1.NOOP_CODEC_CONTEXT;
        }
        if (this.cachedCodecContextVer === Options.schemaVersion) {
            return this.cachedCodecContext;
        }
        const ctx = new context_1.CodecContext(this.codecs);
        this.cachedCodecContext = ctx;
        this.cachedCodecContextVer = Options.schemaVersion;
        return ctx;
    }
    _cloneWith(mergeOptions) {
        const clone = Object.create(Options.prototype);
        clone.annotations = this.annotations;
        clone.retryOptions = mergeOptions.retryOptions ?? this.retryOptions;
        clone.transactionOptions =
            mergeOptions.transactionOptions ?? this.transactionOptions;
        clone.warningHandler = mergeOptions.warningHandler ?? this.warningHandler;
        if (mergeOptions.config != null) {
            clone.config = new Map([
                ...this.config,
                ...Object.entries(mergeOptions.config),
            ]);
        }
        else {
            clone.config = this.config;
        }
        if (mergeOptions.globals != null) {
            clone.globals = new Map([
                ...this.globals,
                ...Object.entries(mergeOptions.globals),
            ]);
        }
        else {
            clone.globals = this.globals;
        }
        if (mergeOptions.moduleAliases != null) {
            clone.moduleAliases = new Map([
                ...this.moduleAliases,
                ...Object.entries(mergeOptions.moduleAliases),
            ]);
        }
        else {
            clone.moduleAliases = this.moduleAliases;
        }
        if (mergeOptions.codecs != null) {
            clone.codecs = new Map([
                ...this.codecs,
                ...Object.entries(mergeOptions.codecs),
            ]);
        }
        else {
            clone.codecs = this.codecs;
            clone.cachedCodecContext = this.cachedCodecContext;
            clone.cachedCodecContextVer = this.cachedCodecContextVer;
        }
        if (mergeOptions._dropSQLRowCodec && clone.codecs.has("_private_sql_row")) {
            if (clone.codecs === this.codecs) {
                clone.codecs = new Map(clone.codecs);
                clone.cachedCodecContext = null;
                clone.cachedCodecContextVer = -1;
            }
            clone.codecs.delete("_private_sql_row");
        }
        clone.module = mergeOptions.module ?? this.module;
        return clone;
    }
    _serialise() {
        const state = {};
        if (this.module !== "default") {
            state.module = this.module;
        }
        if (this.moduleAliases.size) {
            state.aliases = Array.from(this.moduleAliases.entries());
        }
        if (this.config.size) {
            state.config = Object.fromEntries(this.config.entries());
        }
        if (this.globals.size) {
            const globs = {};
            for (const [key, val] of this.globals.entries()) {
                globs[key.includes("::") ? key : `${this.module}::${key}`] = val;
            }
            state.globals = globs;
        }
        return state;
    }
    withModuleAliases({ module, ...aliases }) {
        return this._cloneWith({
            module: module ?? this.module,
            moduleAliases: aliases,
        });
    }
    withConfig(config) {
        return this._cloneWith({ config });
    }
    withCodecs(codecs) {
        return this._cloneWith({ codecs });
    }
    withSQLRowMode(mode) {
        if (mode === "object") {
            return this._cloneWith({ _dropSQLRowCodec: true });
        }
        else if (mode === "array") {
            return this._cloneWith({ codecs: record_1.SQLRowModeArray });
        }
        else {
            throw new errors.InterfaceError(`invalid mode=${mode}`);
        }
    }
    withGlobals(globals) {
        return this._cloneWith({
            globals: { ...this.globals, ...globals },
        });
    }
    withQueryTag(tag) {
        const annos = new Map(this.annotations);
        if (tag != null) {
            if (tag.startsWith("edgedb/")) {
                throw new errors.InterfaceError("reserved tag: edgedb/*");
            }
            if (tag.startsWith("gel/")) {
                throw new errors.InterfaceError("reserved tag: gel/*");
            }
            if (buffer_1.utf8Encoder.encode(tag).length > 128) {
                throw new errors.InterfaceError("tag too long (> 128 bytes)");
            }
            annos.set(TAG_ANNOTATION_KEY, tag);
        }
        else {
            annos.delete(TAG_ANNOTATION_KEY);
        }
        const clone = this._cloneWith({});
        clone.annotations = annos;
        return clone;
    }
    withTransactionOptions(opt) {
        return this._cloneWith({
            transactionOptions: opt instanceof TransactionOptions ? opt : new TransactionOptions(opt),
        });
    }
    withRetryOptions(opt) {
        return this._cloneWith({
            retryOptions: opt instanceof RetryOptions
                ? opt
                : new RetryOptions(opt.attempts, opt.backoff),
        });
    }
    withWarningHandler(handler) {
        return this._cloneWith({ warningHandler: handler });
    }
    isDefaultSession() {
        return (this.config.size === 0 &&
            this.globals.size === 0 &&
            this.moduleAliases.size === 0 &&
            this.module === "default" &&
            this.transactionOptions.isDefault());
    }
    static defaults() {
        return _defaultOptions;
    }
}
exports.Options = Options;
const _defaultOptions = new Options();
