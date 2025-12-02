import { CallbackUrl } from "../lib/helpers";
import type { AsyncPrerecordedResponse, DeepgramResponse, FileSource, PrerecordedSchema, SyncPrerecordedResponse, UrlSource } from "../lib/types";
import { AbstractRestClient } from "./AbstractRestClient";
/**
 * The `ListenRestClient` class extends the `AbstractRestClient` class and provides methods for transcribing audio from URLs or files using the Deepgram API.
 *
 * The `transcribeUrl` method is used to transcribe audio from a URL synchronously. It takes a `UrlSource` object as the source, an optional `PrerecordedSchema` object as options, and an optional endpoint string. It returns a `DeepgramResponse` object containing the transcription result or an error.
 *
 * The `transcribeFile` method is used to transcribe audio from a file synchronously. It takes a `FileSource` object as the source, an optional `PrerecordedSchema` object as options, and an optional endpoint string. It returns a `DeepgramResponse` object containing the transcription result or an error.
 *
 * The `transcribeUrlCallback` method is used to transcribe audio from a URL asynchronously. It takes a `UrlSource` object as the source, a `CallbackUrl` object as the callback, an optional `PrerecordedSchema` object as options, and an optional endpoint string. It returns a `DeepgramResponse` object containing the transcription result or an error.
 *
 * The `transcribeFileCallback` method is used to transcribe audio from a file asynchronously. It takes a `FileSource` object as the source, a `CallbackUrl` object as the callback, an optional `PrerecordedSchema` object as options, and an optional endpoint string. It returns a `DeepgramResponse` object containing the transcription result or an error.
 */
export declare class ListenRestClient extends AbstractRestClient {
    namespace: string;
    /**
     * Transcribes audio from a URL synchronously.
     *
     * @param source - The URL source object containing the audio URL to transcribe.
     * @param options - An optional `PrerecordedSchema` object containing additional options for the transcription.
     * @param endpoint - An optional endpoint string to use for the transcription request.
     * @returns A `DeepgramResponse` object containing the transcription result or an error.
     */
    transcribeUrl(source: UrlSource, options?: PrerecordedSchema, endpoint?: string): Promise<DeepgramResponse<SyncPrerecordedResponse>>;
    /**
     * Transcribes audio from a file asynchronously.
     *
     * @param source - The file source object containing the audio file to transcribe.
     * @param options - An optional `PrerecordedSchema` object containing additional options for the transcription.
     * @param endpoint - An optional endpoint string to use for the transcription request.
     * @returns A `DeepgramResponse` object containing the transcription result or an error.
     */
    transcribeFile(source: FileSource, options?: PrerecordedSchema, endpoint?: string): Promise<DeepgramResponse<SyncPrerecordedResponse>>;
    /**
     * Transcribes audio from a URL asynchronously.
     *
     * @param source - The URL source object containing the audio file to transcribe.
     * @param callback - The callback URL to receive the transcription result.
     * @param options - An optional `PrerecordedSchema` object containing additional options for the transcription.
     * @param endpoint - An optional endpoint string to use for the transcription request.
     * @returns A `DeepgramResponse` object containing the transcription result or an error.
     */
    transcribeUrlCallback(source: UrlSource, callback: CallbackUrl, options?: PrerecordedSchema, endpoint?: string): Promise<DeepgramResponse<AsyncPrerecordedResponse>>;
    /**
     * Transcribes audio from a file asynchronously.
     *
     * @param source - The file source object containing the audio file to transcribe.
     * @param callback - The callback URL to receive the transcription result.
     * @param options - An optional `PrerecordedSchema` object containing additional options for the transcription.
     * @param endpoint - An optional endpoint string to use for the transcription request.
     * @returns A `DeepgramResponse` object containing the transcription result or an error.
     */
    transcribeFileCallback(source: FileSource, callback: CallbackUrl, options?: PrerecordedSchema, endpoint?: string): Promise<DeepgramResponse<AsyncPrerecordedResponse>>;
}
export { ListenRestClient as PrerecordedClient };
//# sourceMappingURL=ListenRestClient.d.ts.map