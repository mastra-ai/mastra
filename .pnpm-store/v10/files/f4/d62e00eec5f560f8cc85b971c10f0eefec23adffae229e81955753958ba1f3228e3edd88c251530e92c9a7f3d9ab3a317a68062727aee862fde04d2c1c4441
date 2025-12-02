import { DeepgramError, DeepgramUnknownError } from "../lib/errors";
import { isTextSource } from "../lib/helpers";
import { SpeakSchema, TextSource } from "../lib/types";
import { AbstractRestClient } from "./AbstractRestClient";

/**
 * Provides a client for interacting with the Deepgram Text-to-Speech API.
 */
export class SpeakRestClient extends AbstractRestClient {
  public namespace: string = "speak";
  public result: undefined | Response;

  /**
   * Sends a request to the Deepgram Text-to-Speech API to generate audio from the provided text source.
   *
   * @param source - The text source to be converted to audio.
   * @param options - Optional configuration options for the text-to-speech request.
   * @param endpoint - The API endpoint to use for the request. Defaults to ":version/speak".
   * @returns A promise that resolves to the SpeakRestClient instance, which can be used to retrieve the response headers and body.
   * @throws {DeepgramError} If the text source type is unknown.
   * @throws {DeepgramUnknownError} If the request was made before a previous request completed.
   * @see https://developers.deepgram.com/reference/text-to-speech-api
   */
  async request(
    source: TextSource,
    options?: SpeakSchema,
    endpoint = ":version/speak"
  ): Promise<SpeakRestClient> {
    let body;

    if (isTextSource(source)) {
      body = JSON.stringify(source);
    } else {
      throw new DeepgramError("Unknown transcription source type");
    }

    const requestUrl = this.getRequestUrl(
      endpoint,
      {},
      { ...{ model: "aura-asteria-en" }, ...options }
    );
    this.result = await this.post(requestUrl, body, {
      headers: { Accept: "audio/*", "Content-Type": "application/json" },
    });

    return this;
  }

  /**
   * Retrieves the response body as a readable stream.
   *
   * @returns A promise that resolves to the response body as a readable stream, or `null` if no request has been made yet.
   * @throws {DeepgramUnknownError} If a request has not been made yet.
   */
  async getStream(): Promise<ReadableStream<Uint8Array> | null> {
    if (!this.result)
      throw new DeepgramUnknownError("Tried to get stream before making request", "");

    return this.result.body;
  }

  /**
   * Retrieves the response headers from the previous request.
   *
   * @returns A promise that resolves to the response headers, or throws a `DeepgramUnknownError` if no request has been made yet.
   */
  async getHeaders(): Promise<Headers> {
    if (!this.result)
      throw new DeepgramUnknownError("Tried to get headers before making request", "");

    return this.result.headers;
  }
}
