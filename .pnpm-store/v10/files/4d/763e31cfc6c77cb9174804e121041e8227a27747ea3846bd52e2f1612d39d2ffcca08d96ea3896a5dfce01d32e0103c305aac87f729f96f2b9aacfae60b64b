"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListenClient = void 0;
const AbstractClient_1 = require("./AbstractClient");
const ListenLiveClient_1 = require("./ListenLiveClient");
const ListenRestClient_1 = require("./ListenRestClient");
/**
 * The `ListenClient` class extends the `AbstractClient` class and provides access to the "listen" namespace.
 * It exposes two methods:
 *
 * 1. `prerecorded()`: Returns a `ListenRestClient` instance for interacting with the prerecorded listen API.
 * 2. `live(transcriptionOptions: LiveSchema = {}, endpoint = ":version/listen")`: Returns a `ListenLiveClient` instance for interacting with the live listen API, with the provided transcription options and endpoint.
 */
class ListenClient extends AbstractClient_1.AbstractClient {
    constructor() {
        super(...arguments);
        this.namespace = "listen";
    }
    /**
     * Returns a `ListenRestClient` instance for interacting with the prerecorded listen API.
     */
    get prerecorded() {
        return new ListenRestClient_1.ListenRestClient(this.options);
    }
    /**
     * Returns a `ListenLiveClient` instance for interacting with the live listen API, with the provided transcription options and endpoint.
     * @param {LiveSchema} [transcriptionOptions={}] - The transcription options to use for the live listen API.
     * @param {string} [endpoint=":version/listen"] - The endpoint to use for the live listen API.
     * @returns {ListenLiveClient} - A `ListenLiveClient` instance for interacting with the live listen API.
     */
    live(transcriptionOptions = {}, endpoint = ":version/listen") {
        return new ListenLiveClient_1.ListenLiveClient(this.options, transcriptionOptions, endpoint);
    }
}
exports.ListenClient = ListenClient;
//# sourceMappingURL=ListenClient.js.map