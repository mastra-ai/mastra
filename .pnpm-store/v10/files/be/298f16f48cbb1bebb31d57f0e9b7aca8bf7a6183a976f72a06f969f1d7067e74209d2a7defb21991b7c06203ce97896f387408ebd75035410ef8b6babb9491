import { AbstractClient } from "./AbstractClient";
import { SpeakLiveClient } from "./SpeakLiveClient";
import { SpeakRestClient } from "./SpeakRestClient";
import { SpeakSchema } from "../lib/types";
import { TextSource } from "../lib/types";
/**
 * The `SpeakClient` class extends the `AbstractClient` class and provides access to the "speak" namespace.
 * It exposes two methods:
 *
 * 1. `request()`: Returns a `SpeakRestClient` instance for interacting with the rest speak API.
 * 2. `live(ttsOptions: SpeakSchema = {}, endpoint = ":version/speak")`: Returns a `SpeakLiveClient` instance for interacting with the live speak API, with the provided TTS options and endpoint.
 */
export declare class SpeakClient extends AbstractClient {
    namespace: string;
    /**
     * Returns a `SpeakRestClient` instance for interacting with the rest speak API.
     */
    request(source: TextSource, options?: SpeakSchema, endpoint?: string): Promise<SpeakRestClient>;
    /**
     * Returns a `SpeakLiveClient` instance for interacting with the live speak API, with the provided TTS options and endpoint.
     * @param {SpeakSchema} [ttsOptions={}] - The TTS options to use for the live speak API.
     * @param {string} [endpoint=":version/speak"] - The endpoint to use for the live speak API.
     * @returns {SpeakLiveClient} - A `SpeakLiveClient` instance for interacting with the live speak API.
     */
    live(ttsOptions?: SpeakSchema, endpoint?: string): SpeakLiveClient;
}
//# sourceMappingURL=SpeakClient.d.ts.map