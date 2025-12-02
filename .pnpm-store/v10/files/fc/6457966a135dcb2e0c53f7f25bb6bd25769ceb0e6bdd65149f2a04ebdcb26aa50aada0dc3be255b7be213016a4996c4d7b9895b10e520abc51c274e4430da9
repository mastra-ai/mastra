/**
 * In-memory transport for creating clients and servers that talk to each other within the same process.
 */
export class InMemoryTransport {
    constructor() {
        this._messageQueue = [];
    }
    /**
     * Creates a pair of linked in-memory transports that can communicate with each other. One should be passed to a Client and one to a Server.
     */
    static createLinkedPair() {
        const clientTransport = new InMemoryTransport();
        const serverTransport = new InMemoryTransport();
        clientTransport._otherTransport = serverTransport;
        serverTransport._otherTransport = clientTransport;
        return [clientTransport, serverTransport];
    }
    async start() {
        var _a;
        // Process any messages that were queued before start was called
        while (this._messageQueue.length > 0) {
            const queuedMessage = this._messageQueue.shift();
            (_a = this.onmessage) === null || _a === void 0 ? void 0 : _a.call(this, queuedMessage.message, queuedMessage.extra);
        }
    }
    async close() {
        var _a;
        const other = this._otherTransport;
        this._otherTransport = undefined;
        await (other === null || other === void 0 ? void 0 : other.close());
        (_a = this.onclose) === null || _a === void 0 ? void 0 : _a.call(this);
    }
    /**
     * Sends a message with optional auth info.
     * This is useful for testing authentication scenarios.
     */
    async send(message, options) {
        if (!this._otherTransport) {
            throw new Error('Not connected');
        }
        if (this._otherTransport.onmessage) {
            this._otherTransport.onmessage(message, { authInfo: options === null || options === void 0 ? void 0 : options.authInfo });
        }
        else {
            this._otherTransport._messageQueue.push({ message, extra: { authInfo: options === null || options === void 0 ? void 0 : options.authInfo } });
        }
    }
}
//# sourceMappingURL=inMemory.js.map