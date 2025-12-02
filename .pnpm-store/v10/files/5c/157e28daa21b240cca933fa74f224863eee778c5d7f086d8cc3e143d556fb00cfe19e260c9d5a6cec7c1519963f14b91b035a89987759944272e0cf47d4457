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
export class SpeakClient extends AbstractClient {
  public namespace: string = "speak";

  /**
   * Returns a `SpeakRestClient` instance for interacting with the rest speak API.
   */
  public request(source: TextSource, options?: SpeakSchema, endpoint = ":version/speak") {
    const client = new SpeakRestClient(this.options);

    return client.request(source, options, endpoint);
  }

  /**
   * Returns a `SpeakLiveClient` instance for interacting with the live speak API, with the provided TTS options and endpoint.
   * @param {SpeakSchema} [ttsOptions={}] - The TTS options to use for the live speak API.
   * @param {string} [endpoint=":version/speak"] - The endpoint to use for the live speak API.
   * @returns {SpeakLiveClient} - A `SpeakLiveClient` instance for interacting with the live speak API.
   */
  public live(ttsOptions: SpeakSchema = {}, endpoint: string = ":version/speak"): SpeakLiveClient {
    return new SpeakLiveClient(this.options, ttsOptions, endpoint);
  }
}
