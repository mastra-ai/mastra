"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeakClient = void 0;
const AbstractClient_1 = require("./AbstractClient");
const SpeakLiveClient_1 = require("./SpeakLiveClient");
const SpeakRestClient_1 = require("./SpeakRestClient");
/**
 * The `SpeakClient` class extends the `AbstractClient` class and provides access to the "speak" namespace.
 * It exposes two methods:
 *
 * 1. `request()`: Returns a `SpeakRestClient` instance for interacting with the rest speak API.
 * 2. `live(ttsOptions: SpeakSchema = {}, endpoint = ":version/speak")`: Returns a `SpeakLiveClient` instance for interacting with the live speak API, with the provided TTS options and endpoint.
 */
class SpeakClient extends AbstractClient_1.AbstractClient {
    constructor() {
        super(...arguments);
        this.namespace = "speak";
    }
    /**
     * Returns a `SpeakRestClient` instance for interacting with the rest speak API.
     */
    request(source, options, endpoint = ":version/speak") {
        const client = new SpeakRestClient_1.SpeakRestClient(this.options);
        return client.request(source, options, endpoint);
    }
    /**
     * Returns a `SpeakLiveClient` instance for interacting with the live speak API, with the provided TTS options and endpoint.
     * @param {SpeakSchema} [ttsOptions={}] - The TTS options to use for the live speak API.
     * @param {string} [endpoint=":version/speak"] - The endpoint to use for the live speak API.
     * @returns {SpeakLiveClient} - A `SpeakLiveClient` instance for interacting with the live speak API.
     */
    live(ttsOptions = {}, endpoint = ":version/speak") {
        return new SpeakLiveClient_1.SpeakLiveClient(this.options, ttsOptions, endpoint);
    }
}
exports.SpeakClient = SpeakClient;
//# sourceMappingURL=SpeakClient.js.map