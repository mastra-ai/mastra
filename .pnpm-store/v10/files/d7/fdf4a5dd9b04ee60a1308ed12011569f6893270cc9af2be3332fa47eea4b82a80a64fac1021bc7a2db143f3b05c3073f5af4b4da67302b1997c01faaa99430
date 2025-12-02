import * as pumpify from 'pumpify';
import * as protosTypes from '../protos/protos';
import * as gax from 'google-gax';
export declare class ImprovedStreamingClient {
    /**
     * Performs bidirectional streaming speech recognition: receive results while
     * sending audio. This method is only available via the gRPC API (not REST).
     *
     * @param {object} config The configuration for the stream. This is
     *     appropriately wrapped and sent as the first argument. It should be an
     *     object conforming to the [StreamingRecognitionConfig]{@link StreamingRecognitionConfig}
     *     structure.
     * @param {object} [options] Optional parameters. You can override the default
     *     settings for this call, e.g, timeout, retries, paginations, etc. See
     *     [gax.CallOptions]{@link https://googleapis.github.io/gax-nodejs/global.html#CallOptions}
     *     for the details.
     * @returns {stream} An object stream which is both readable and writable. It
     *     accepts raw audio for the `write()` method, and will emit objects
     *     representing [StreamingRecognizeResponse]{@link StreamingRecognizeResponse}
     *     on the 'data' event asynchronously.
     *
     * @example
     * const speech = require('@google-cloud/speech');
     * const client = new speech.SpeechClient();
     *
     * const stream = client.streamingRecognize({
     *   config: {
     *     encoding: 'LINEAR16',
     *     languageCode: 'en-us',
     *     sampleRateHertz: 44100,
     *   },
     * }).on('data', function(response) {
     *   // doThingsWith(response);
     * });
     * const request = {};
     * // Write request objects.
     * stream.write(request);
     */
    streamingRecognize(streamingConfig?: protosTypes.google.cloud.speech.v1.IStreamingRecognitionConfig | protosTypes.google.cloud.speech.v1p1beta1.IStreamingRecognitionConfig, options?: gax.CallOptions): pumpify;
}
