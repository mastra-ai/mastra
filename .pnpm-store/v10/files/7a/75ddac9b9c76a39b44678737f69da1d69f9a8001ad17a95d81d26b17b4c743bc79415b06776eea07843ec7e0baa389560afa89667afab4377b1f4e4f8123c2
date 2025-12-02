import { AbstractClient } from "./AbstractClient";
import { SpeakLiveClient } from "./SpeakLiveClient";
import { SpeakRestClient } from "./SpeakRestClient";
/**
 * The `SpeakClient` class extends the `AbstractClient` class and provides access to the "speak" namespace.
 * It exposes two methods:
 *
 * 1. `request()`: Returns a `SpeakRestClient` instance for interacting with the rest speak API.
 * 2. `live(ttsOptions: SpeakSchema = {}, endpoint = ":version/speak")`: Returns a `SpeakLiveClient` instance for interacting with the live speak API, with the provided TTS options and endpoint.
 */
export class SpeakClient extends AbstractClient {
    constructor() {
        super(...arguments);
        this.namespace = "speak";
    }
    /**
     * Returns a `SpeakRestClient` instance for interacting with the rest speak API.
     */
    request(source, options, endpoint = ":version/speak") {
        const client = new SpeakRestClient(this.options);
        return client.request(source, options, endpoint);
    }
    /**
     * Returns a `SpeakLiveClient` instance for interacting with the live speak API, with the provided TTS options and endpoint.
     * @param {SpeakSchema} [ttsOptions={}] - The TTS options to use for the live speak API.
     * @param {string} [endpoint=":version/speak"] - The endpoint to use for the live speak API.
     * @returns {SpeakLiveClient} - A `SpeakLiveClient` instance for interacting with the live speak API.
     */
    live(ttsOptions = {}, endpoint = ":version/speak") {
        return new SpeakLiveClient(this.options, ttsOptions, endpoint);
    }
}
//# sourceMappingURL=SpeakClient.js.map