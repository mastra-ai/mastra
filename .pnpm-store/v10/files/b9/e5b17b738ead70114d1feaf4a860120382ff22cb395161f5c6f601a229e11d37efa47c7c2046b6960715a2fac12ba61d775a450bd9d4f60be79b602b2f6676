"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.provideControlledConnection = provideControlledConnection;
const deferred_js_1 = require("./deferred.js");
const object_utils_js_1 = require("./object-utils.js");
async function provideControlledConnection(connectionProvider) {
    const connectionDefer = new deferred_js_1.Deferred();
    const connectionReleaseDefer = new deferred_js_1.Deferred();
    connectionProvider
        .provideConnection(async (connection) => {
        connectionDefer.resolve(connection);
        return await connectionReleaseDefer.promise;
    })
        .catch((ex) => connectionDefer.reject(ex));
    // Create composite of the connection and the release method instead of
    // modifying the connection or creating a new nesting `DatabaseConnection`.
    // This way we don't accidentally override any methods of 3rd party
    // connections and don't return wrapped connections to drivers that
    // expect a certain specific connection class.
    return (0, object_utils_js_1.freeze)({
        connection: await connectionDefer.promise,
        release: connectionReleaseDefer.resolve,
    });
}
