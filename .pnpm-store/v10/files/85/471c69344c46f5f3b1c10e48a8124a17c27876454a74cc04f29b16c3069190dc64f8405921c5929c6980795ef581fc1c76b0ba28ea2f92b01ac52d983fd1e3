"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiErrorReply = exports.TimeoutError = exports.BlobError = exports.SimpleError = exports.ErrorReply = exports.ReconnectStrategyError = exports.RootNodesUnavailableError = exports.SocketClosedUnexpectedlyError = exports.DisconnectsClientError = exports.ClientOfflineError = exports.ClientClosedError = exports.SocketTimeoutError = exports.ConnectionTimeoutError = exports.WatchError = exports.AbortError = void 0;
class AbortError extends Error {
    constructor() {
        super('The command was aborted');
    }
}
exports.AbortError = AbortError;
class WatchError extends Error {
    constructor(message = 'One (or more) of the watched keys has been changed') {
        super(message);
    }
}
exports.WatchError = WatchError;
class ConnectionTimeoutError extends Error {
    constructor() {
        super('Connection timeout');
    }
}
exports.ConnectionTimeoutError = ConnectionTimeoutError;
class SocketTimeoutError extends Error {
    constructor(timeout) {
        super(`Socket timeout timeout. Expecting data, but didn't receive any in ${timeout}ms.`);
    }
}
exports.SocketTimeoutError = SocketTimeoutError;
class ClientClosedError extends Error {
    constructor() {
        super('The client is closed');
    }
}
exports.ClientClosedError = ClientClosedError;
class ClientOfflineError extends Error {
    constructor() {
        super('The client is offline');
    }
}
exports.ClientOfflineError = ClientOfflineError;
class DisconnectsClientError extends Error {
    constructor() {
        super('Disconnects client');
    }
}
exports.DisconnectsClientError = DisconnectsClientError;
class SocketClosedUnexpectedlyError extends Error {
    constructor() {
        super('Socket closed unexpectedly');
    }
}
exports.SocketClosedUnexpectedlyError = SocketClosedUnexpectedlyError;
class RootNodesUnavailableError extends Error {
    constructor() {
        super('All the root nodes are unavailable');
    }
}
exports.RootNodesUnavailableError = RootNodesUnavailableError;
class ReconnectStrategyError extends Error {
    originalError;
    socketError;
    constructor(originalError, socketError) {
        super(originalError.message);
        this.originalError = originalError;
        this.socketError = socketError;
    }
}
exports.ReconnectStrategyError = ReconnectStrategyError;
class ErrorReply extends Error {
}
exports.ErrorReply = ErrorReply;
class SimpleError extends ErrorReply {
}
exports.SimpleError = SimpleError;
class BlobError extends ErrorReply {
}
exports.BlobError = BlobError;
class TimeoutError extends Error {
}
exports.TimeoutError = TimeoutError;
class MultiErrorReply extends ErrorReply {
    replies;
    errorIndexes;
    constructor(replies, errorIndexes) {
        super(`${errorIndexes.length} commands failed, see .replies and .errorIndexes for more information`);
        this.replies = replies;
        this.errorIndexes = errorIndexes;
    }
    *errors() {
        for (const index of this.errorIndexes) {
            yield this.replies[index];
        }
    }
}
exports.MultiErrorReply = MultiErrorReply;
//# sourceMappingURL=errors.js.map