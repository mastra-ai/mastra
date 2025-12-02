"use strict";
/*
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImprovedStreamingClient = void 0;
const common = require("@google-cloud/common");
const pumpify = require("pumpify");
const streamEvents = require("stream-events");
const stream_1 = require("stream");
class ImprovedStreamingClient {
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
    streamingRecognize(streamingConfig, options) {
        options = options || {};
        streamingConfig = streamingConfig || {};
        // Format the audio content as input request for pipeline
        const recognizeStream = streamEvents(new pumpify.obj());
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const requestStream = this
            ._streamingRecognize(options)
            .on('error', (err) => {
            recognizeStream.destroy(err);
        })
            .on('response', (response) => {
            recognizeStream.emit('response', response);
        });
        // Attach the events to the request stream, but only do so
        // when the first write (of data) comes in.
        //
        // This also means that the sending of the initial request (with the
        // config) is delayed until we get the first burst of data.
        recognizeStream.once('writing', () => {
            // The first message should contain the streaming config.
            requestStream.write({ streamingConfig });
            // Set up appropriate piping between the stream returned by
            // the underlying API method and the one that we return.
            recognizeStream.setPipeline([
                // Format the user's input.
                // This entails that the user sends raw audio; it is wrapped in
                // the appropriate request structure.
                new stream_1.PassThrough({
                    objectMode: true,
                    transform: (audioContent, _, next) => {
                        if (audioContent !== undefined) {
                            next(undefined, { audioContent });
                            return;
                        }
                        next();
                    },
                }),
                requestStream,
                new stream_1.PassThrough({
                    objectMode: true,
                    transform: (response, enc, next) => {
                        if (response.error) {
                            next(new common.util.ApiError(response.error));
                            return;
                        }
                        next(undefined, response);
                    },
                }),
            ]);
        });
        return recognizeStream;
    }
}
exports.ImprovedStreamingClient = ImprovedStreamingClient;
//# sourceMappingURL=helpers.js.map