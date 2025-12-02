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
exports.Transaction = exports.TransactionImpl = exports.TransactionState = void 0;
const errors = __importStar(require("./errors"));
const ifaces_1 = require("./ifaces");
const options_1 = require("./options");
var TransactionState;
(function (TransactionState) {
    TransactionState[TransactionState["ACTIVE"] = 0] = "ACTIVE";
    TransactionState[TransactionState["COMMITTED"] = 1] = "COMMITTED";
    TransactionState[TransactionState["ROLLEDBACK"] = 2] = "ROLLEDBACK";
    TransactionState[TransactionState["FAILED"] = 3] = "FAILED";
})(TransactionState || (exports.TransactionState = TransactionState = {}));
class TransactionImpl {
    _holder;
    _rawConn;
    _state;
    _opInProgress;
    constructor(holder, rawConn) {
        this._holder = holder;
        this._rawConn = rawConn;
        this._state = TransactionState.ACTIVE;
        this._opInProgress = false;
    }
    static async _startTransaction(holder, optimisticRepeatableRead) {
        const rawConn = await holder._getConnection();
        await rawConn.resetState();
        const options = holder.options.transactionOptions;
        const txOptions = [];
        if (options.isolation === options_1.IsolationLevel.RepeatableRead) {
            txOptions.push(`ISOLATION REPEATABLE READ`);
        }
        else if (options.isolation === options_1.IsolationLevel.Serializable) {
            txOptions.push(`ISOLATION SERIALIZABLE`);
        }
        else if (options.isolation === options_1.IsolationLevel.PreferRepeatableRead) {
            if (optimisticRepeatableRead) {
                txOptions.push(`ISOLATION REPEATABLE READ`);
            }
            else {
                txOptions.push(`ISOLATION SERIALIZABLE`);
            }
        }
        else if (options.isolation != null) {
            throw new errors.InterfaceError(`Invalid isolation level: ${options.isolation}`);
        }
        if (options.readonly !== undefined) {
            txOptions.push(options.readonly ? "READ ONLY" : "READ WRITE");
        }
        if (options.deferrable !== undefined) {
            txOptions.push(options.deferrable ? "DEFERRABLE" : "NOT DEFERRABLE");
        }
        await rawConn.fetch(`START TRANSACTION ${txOptions.join(", ")};`, undefined, ifaces_1.OutputFormat.NONE, ifaces_1.Cardinality.NO_RESULT, holder.options, true);
        return new TransactionImpl(holder, rawConn);
    }
    async _waitForConnAbort() {
        await this._rawConn.connAbortWaiter.wait();
        const abortError = this._rawConn.getConnAbortError();
        if (abortError instanceof errors.GelError &&
            abortError.cause instanceof errors.TransactionTimeoutError) {
            throw abortError.cause;
        }
        else {
            throw abortError;
        }
    }
    async _runOp(opname, op, errMessage) {
        if (this._opInProgress) {
            throw new errors.InterfaceError(errMessage ??
                "Another query is in progress. Use the query methods " +
                    "on 'Client' to run queries concurrently.");
        }
        if (this._state !== TransactionState.ACTIVE) {
            throw new errors.InterfaceError(`cannot ${opname}; the transaction is ${this._state === TransactionState.COMMITTED
                ? "already committed"
                : this._state === TransactionState.ROLLEDBACK
                    ? "already rolled back"
                    : "in error state"}`);
        }
        this._opInProgress = true;
        try {
            return await op();
        }
        finally {
            this._opInProgress = false;
        }
    }
    async _runFetchOp(opName, ...args) {
        const { result, warnings } = await this._runOp(opName, () => this._rawConn.fetch(...args));
        if (warnings.length) {
            this._holder.options.warningHandler(warnings);
        }
        return result;
    }
    async _commit() {
        await this._runOp("commit", async () => {
            await this._rawConn.fetch("COMMIT", undefined, ifaces_1.OutputFormat.NONE, ifaces_1.Cardinality.NO_RESULT, this._holder.options, true);
            this._state = TransactionState.COMMITTED;
        }, "A query is still in progress after transaction block has returned.");
    }
    async _rollback() {
        await this._runOp("rollback", async () => {
            await this._rawConn.fetch("ROLLBACK", undefined, ifaces_1.OutputFormat.NONE, ifaces_1.Cardinality.NO_RESULT, this._holder.options, true);
            this._state = TransactionState.ROLLEDBACK;
        }, "A query is still in progress after transaction block has returned.");
    }
}
exports.TransactionImpl = TransactionImpl;
class Transaction {
    impl;
    options;
    constructor(impl, options) {
        this.impl = impl;
        this.options = options;
    }
    withSQLRowMode(mode) {
        return new Transaction(this.impl, this.options.withSQLRowMode(mode));
    }
    async execute(query, args) {
        await this.impl._runFetchOp("execute", query, args, ifaces_1.OutputFormat.NONE, ifaces_1.Cardinality.NO_RESULT, this.options);
    }
    async executeSQL(query, args) {
        await this.impl._runFetchOp("execute", query, args, ifaces_1.OutputFormat.NONE, ifaces_1.Cardinality.NO_RESULT, this.options, false, ifaces_1.Language.SQL);
    }
    async query(query, args) {
        return this.impl._runFetchOp("query", query, args, ifaces_1.OutputFormat.BINARY, ifaces_1.Cardinality.MANY, this.options);
    }
    async querySQL(query, args) {
        return this.impl._runFetchOp("query", query, args, ifaces_1.OutputFormat.BINARY, ifaces_1.Cardinality.MANY, this.options, false, ifaces_1.Language.SQL);
    }
    async queryJSON(query, args) {
        return this.impl._runFetchOp("queryJSON", query, args, ifaces_1.OutputFormat.JSON, ifaces_1.Cardinality.MANY, this.options);
    }
    async querySingle(query, args) {
        return this.impl._runFetchOp("querySingle", query, args, ifaces_1.OutputFormat.BINARY, ifaces_1.Cardinality.AT_MOST_ONE, this.options);
    }
    async querySingleJSON(query, args) {
        return this.impl._runFetchOp("querySingleJSON", query, args, ifaces_1.OutputFormat.JSON, ifaces_1.Cardinality.AT_MOST_ONE, this.options);
    }
    async queryRequired(query, args) {
        return this.impl._runFetchOp("queryRequired", query, args, ifaces_1.OutputFormat.BINARY, ifaces_1.Cardinality.AT_LEAST_ONE, this.options);
    }
    async queryRequiredJSON(query, args) {
        return this.impl._runFetchOp("queryRequiredJSON", query, args, ifaces_1.OutputFormat.JSON, ifaces_1.Cardinality.AT_LEAST_ONE, this.options);
    }
    async queryRequiredSingle(query, args) {
        return this.impl._runFetchOp("queryRequiredSingle", query, args, ifaces_1.OutputFormat.BINARY, ifaces_1.Cardinality.ONE, this.options);
    }
    async queryRequiredSingleJSON(query, args) {
        return this.impl._runFetchOp("queryRequiredSingleJSON", query, args, ifaces_1.OutputFormat.JSON, ifaces_1.Cardinality.ONE, this.options);
    }
}
exports.Transaction = Transaction;
