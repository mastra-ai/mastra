// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import type {protobuf as $protobuf} from "google-gax";
import Long = require("long");
/** Namespace google. */
export namespace google {

    /** Namespace cloud. */
    namespace cloud {

        /** Namespace texttospeech. */
        namespace texttospeech {

            /** Namespace v1. */
            namespace v1 {

                /** Represents a TextToSpeech */
                class TextToSpeech extends $protobuf.rpc.Service {

                    /**
                     * Constructs a new TextToSpeech service.
                     * @param rpcImpl RPC implementation
                     * @param [requestDelimited=false] Whether requests are length-delimited
                     * @param [responseDelimited=false] Whether responses are length-delimited
                     */
                    constructor(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean);

                    /**
                     * Creates new TextToSpeech service using the specified rpc implementation.
                     * @param rpcImpl RPC implementation
                     * @param [requestDelimited=false] Whether requests are length-delimited
                     * @param [responseDelimited=false] Whether responses are length-delimited
                     * @returns RPC service. Useful where requests and/or responses are streamed.
                     */
                    public static create(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean): TextToSpeech;

                    /**
                     * Calls ListVoices.
                     * @param request ListVoicesRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and ListVoicesResponse
                     */
                    public listVoices(request: google.cloud.texttospeech.v1.IListVoicesRequest, callback: google.cloud.texttospeech.v1.TextToSpeech.ListVoicesCallback): void;

                    /**
                     * Calls ListVoices.
                     * @param request ListVoicesRequest message or plain object
                     * @returns Promise
                     */
                    public listVoices(request: google.cloud.texttospeech.v1.IListVoicesRequest): Promise<google.cloud.texttospeech.v1.ListVoicesResponse>;

                    /**
                     * Calls SynthesizeSpeech.
                     * @param request SynthesizeSpeechRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and SynthesizeSpeechResponse
                     */
                    public synthesizeSpeech(request: google.cloud.texttospeech.v1.ISynthesizeSpeechRequest, callback: google.cloud.texttospeech.v1.TextToSpeech.SynthesizeSpeechCallback): void;

                    /**
                     * Calls SynthesizeSpeech.
                     * @param request SynthesizeSpeechRequest message or plain object
                     * @returns Promise
                     */
                    public synthesizeSpeech(request: google.cloud.texttospeech.v1.ISynthesizeSpeechRequest): Promise<google.cloud.texttospeech.v1.SynthesizeSpeechResponse>;

                    /**
                     * Calls StreamingSynthesize.
                     * @param request StreamingSynthesizeRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and StreamingSynthesizeResponse
                     */
                    public streamingSynthesize(request: google.cloud.texttospeech.v1.IStreamingSynthesizeRequest, callback: google.cloud.texttospeech.v1.TextToSpeech.StreamingSynthesizeCallback): void;

                    /**
                     * Calls StreamingSynthesize.
                     * @param request StreamingSynthesizeRequest message or plain object
                     * @returns Promise
                     */
                    public streamingSynthesize(request: google.cloud.texttospeech.v1.IStreamingSynthesizeRequest): Promise<google.cloud.texttospeech.v1.StreamingSynthesizeResponse>;
                }

                namespace TextToSpeech {

                    /**
                     * Callback as used by {@link google.cloud.texttospeech.v1.TextToSpeech|listVoices}.
                     * @param error Error, if any
                     * @param [response] ListVoicesResponse
                     */
                    type ListVoicesCallback = (error: (Error|null), response?: google.cloud.texttospeech.v1.ListVoicesResponse) => void;

                    /**
                     * Callback as used by {@link google.cloud.texttospeech.v1.TextToSpeech|synthesizeSpeech}.
                     * @param error Error, if any
                     * @param [response] SynthesizeSpeechResponse
                     */
                    type SynthesizeSpeechCallback = (error: (Error|null), response?: google.cloud.texttospeech.v1.SynthesizeSpeechResponse) => void;

                    /**
                     * Callback as used by {@link google.cloud.texttospeech.v1.TextToSpeech|streamingSynthesize}.
                     * @param error Error, if any
                     * @param [response] StreamingSynthesizeResponse
                     */
                    type StreamingSynthesizeCallback = (error: (Error|null), response?: google.cloud.texttospeech.v1.StreamingSynthesizeResponse) => void;
                }

                /** SsmlVoiceGender enum. */
                enum SsmlVoiceGender {
                    SSML_VOICE_GENDER_UNSPECIFIED = 0,
                    MALE = 1,
                    FEMALE = 2,
                    NEUTRAL = 3
                }

                /** AudioEncoding enum. */
                enum AudioEncoding {
                    AUDIO_ENCODING_UNSPECIFIED = 0,
                    LINEAR16 = 1,
                    MP3 = 2,
                    OGG_OPUS = 3,
                    MULAW = 5,
                    ALAW = 6,
                    PCM = 7,
                    M4A = 8
                }

                /** Properties of a ListVoicesRequest. */
                interface IListVoicesRequest {

                    /** ListVoicesRequest languageCode */
                    languageCode?: (string|null);
                }

                /** Represents a ListVoicesRequest. */
                class ListVoicesRequest implements IListVoicesRequest {

                    /**
                     * Constructs a new ListVoicesRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.IListVoicesRequest);

                    /** ListVoicesRequest languageCode. */
                    public languageCode: string;

                    /**
                     * Creates a new ListVoicesRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListVoicesRequest instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.IListVoicesRequest): google.cloud.texttospeech.v1.ListVoicesRequest;

                    /**
                     * Encodes the specified ListVoicesRequest message. Does not implicitly {@link google.cloud.texttospeech.v1.ListVoicesRequest.verify|verify} messages.
                     * @param message ListVoicesRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.IListVoicesRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListVoicesRequest message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.ListVoicesRequest.verify|verify} messages.
                     * @param message ListVoicesRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.IListVoicesRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListVoicesRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListVoicesRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.ListVoicesRequest;

                    /**
                     * Decodes a ListVoicesRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListVoicesRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.ListVoicesRequest;

                    /**
                     * Verifies a ListVoicesRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListVoicesRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListVoicesRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.ListVoicesRequest;

                    /**
                     * Creates a plain object from a ListVoicesRequest message. Also converts values to other types if specified.
                     * @param message ListVoicesRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.ListVoicesRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListVoicesRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListVoicesRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListVoicesResponse. */
                interface IListVoicesResponse {

                    /** ListVoicesResponse voices */
                    voices?: (google.cloud.texttospeech.v1.IVoice[]|null);
                }

                /** Represents a ListVoicesResponse. */
                class ListVoicesResponse implements IListVoicesResponse {

                    /**
                     * Constructs a new ListVoicesResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.IListVoicesResponse);

                    /** ListVoicesResponse voices. */
                    public voices: google.cloud.texttospeech.v1.IVoice[];

                    /**
                     * Creates a new ListVoicesResponse instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListVoicesResponse instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.IListVoicesResponse): google.cloud.texttospeech.v1.ListVoicesResponse;

                    /**
                     * Encodes the specified ListVoicesResponse message. Does not implicitly {@link google.cloud.texttospeech.v1.ListVoicesResponse.verify|verify} messages.
                     * @param message ListVoicesResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.IListVoicesResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListVoicesResponse message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.ListVoicesResponse.verify|verify} messages.
                     * @param message ListVoicesResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.IListVoicesResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListVoicesResponse message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListVoicesResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.ListVoicesResponse;

                    /**
                     * Decodes a ListVoicesResponse message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListVoicesResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.ListVoicesResponse;

                    /**
                     * Verifies a ListVoicesResponse message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListVoicesResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListVoicesResponse
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.ListVoicesResponse;

                    /**
                     * Creates a plain object from a ListVoicesResponse message. Also converts values to other types if specified.
                     * @param message ListVoicesResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.ListVoicesResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListVoicesResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListVoicesResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Voice. */
                interface IVoice {

                    /** Voice languageCodes */
                    languageCodes?: (string[]|null);

                    /** Voice name */
                    name?: (string|null);

                    /** Voice ssmlGender */
                    ssmlGender?: (google.cloud.texttospeech.v1.SsmlVoiceGender|keyof typeof google.cloud.texttospeech.v1.SsmlVoiceGender|null);

                    /** Voice naturalSampleRateHertz */
                    naturalSampleRateHertz?: (number|null);
                }

                /** Represents a Voice. */
                class Voice implements IVoice {

                    /**
                     * Constructs a new Voice.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.IVoice);

                    /** Voice languageCodes. */
                    public languageCodes: string[];

                    /** Voice name. */
                    public name: string;

                    /** Voice ssmlGender. */
                    public ssmlGender: (google.cloud.texttospeech.v1.SsmlVoiceGender|keyof typeof google.cloud.texttospeech.v1.SsmlVoiceGender);

                    /** Voice naturalSampleRateHertz. */
                    public naturalSampleRateHertz: number;

                    /**
                     * Creates a new Voice instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Voice instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.IVoice): google.cloud.texttospeech.v1.Voice;

                    /**
                     * Encodes the specified Voice message. Does not implicitly {@link google.cloud.texttospeech.v1.Voice.verify|verify} messages.
                     * @param message Voice message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.IVoice, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Voice message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.Voice.verify|verify} messages.
                     * @param message Voice message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.IVoice, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Voice message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Voice
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.Voice;

                    /**
                     * Decodes a Voice message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Voice
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.Voice;

                    /**
                     * Verifies a Voice message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Voice message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Voice
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.Voice;

                    /**
                     * Creates a plain object from a Voice message. Also converts values to other types if specified.
                     * @param message Voice
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.Voice, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Voice to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Voice
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AdvancedVoiceOptions. */
                interface IAdvancedVoiceOptions {

                    /** AdvancedVoiceOptions lowLatencyJourneySynthesis */
                    lowLatencyJourneySynthesis?: (boolean|null);
                }

                /** Represents an AdvancedVoiceOptions. */
                class AdvancedVoiceOptions implements IAdvancedVoiceOptions {

                    /**
                     * Constructs a new AdvancedVoiceOptions.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.IAdvancedVoiceOptions);

                    /** AdvancedVoiceOptions lowLatencyJourneySynthesis. */
                    public lowLatencyJourneySynthesis?: (boolean|null);

                    /**
                     * Creates a new AdvancedVoiceOptions instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AdvancedVoiceOptions instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.IAdvancedVoiceOptions): google.cloud.texttospeech.v1.AdvancedVoiceOptions;

                    /**
                     * Encodes the specified AdvancedVoiceOptions message. Does not implicitly {@link google.cloud.texttospeech.v1.AdvancedVoiceOptions.verify|verify} messages.
                     * @param message AdvancedVoiceOptions message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.IAdvancedVoiceOptions, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AdvancedVoiceOptions message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.AdvancedVoiceOptions.verify|verify} messages.
                     * @param message AdvancedVoiceOptions message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.IAdvancedVoiceOptions, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AdvancedVoiceOptions message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AdvancedVoiceOptions
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.AdvancedVoiceOptions;

                    /**
                     * Decodes an AdvancedVoiceOptions message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AdvancedVoiceOptions
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.AdvancedVoiceOptions;

                    /**
                     * Verifies an AdvancedVoiceOptions message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AdvancedVoiceOptions message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AdvancedVoiceOptions
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.AdvancedVoiceOptions;

                    /**
                     * Creates a plain object from an AdvancedVoiceOptions message. Also converts values to other types if specified.
                     * @param message AdvancedVoiceOptions
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.AdvancedVoiceOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AdvancedVoiceOptions to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AdvancedVoiceOptions
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SynthesizeSpeechRequest. */
                interface ISynthesizeSpeechRequest {

                    /** SynthesizeSpeechRequest input */
                    input?: (google.cloud.texttospeech.v1.ISynthesisInput|null);

                    /** SynthesizeSpeechRequest voice */
                    voice?: (google.cloud.texttospeech.v1.IVoiceSelectionParams|null);

                    /** SynthesizeSpeechRequest audioConfig */
                    audioConfig?: (google.cloud.texttospeech.v1.IAudioConfig|null);

                    /** SynthesizeSpeechRequest advancedVoiceOptions */
                    advancedVoiceOptions?: (google.cloud.texttospeech.v1.IAdvancedVoiceOptions|null);
                }

                /** Represents a SynthesizeSpeechRequest. */
                class SynthesizeSpeechRequest implements ISynthesizeSpeechRequest {

                    /**
                     * Constructs a new SynthesizeSpeechRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.ISynthesizeSpeechRequest);

                    /** SynthesizeSpeechRequest input. */
                    public input?: (google.cloud.texttospeech.v1.ISynthesisInput|null);

                    /** SynthesizeSpeechRequest voice. */
                    public voice?: (google.cloud.texttospeech.v1.IVoiceSelectionParams|null);

                    /** SynthesizeSpeechRequest audioConfig. */
                    public audioConfig?: (google.cloud.texttospeech.v1.IAudioConfig|null);

                    /** SynthesizeSpeechRequest advancedVoiceOptions. */
                    public advancedVoiceOptions?: (google.cloud.texttospeech.v1.IAdvancedVoiceOptions|null);

                    /**
                     * Creates a new SynthesizeSpeechRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SynthesizeSpeechRequest instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.ISynthesizeSpeechRequest): google.cloud.texttospeech.v1.SynthesizeSpeechRequest;

                    /**
                     * Encodes the specified SynthesizeSpeechRequest message. Does not implicitly {@link google.cloud.texttospeech.v1.SynthesizeSpeechRequest.verify|verify} messages.
                     * @param message SynthesizeSpeechRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.ISynthesizeSpeechRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SynthesizeSpeechRequest message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.SynthesizeSpeechRequest.verify|verify} messages.
                     * @param message SynthesizeSpeechRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.ISynthesizeSpeechRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SynthesizeSpeechRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SynthesizeSpeechRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.SynthesizeSpeechRequest;

                    /**
                     * Decodes a SynthesizeSpeechRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SynthesizeSpeechRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.SynthesizeSpeechRequest;

                    /**
                     * Verifies a SynthesizeSpeechRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SynthesizeSpeechRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SynthesizeSpeechRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.SynthesizeSpeechRequest;

                    /**
                     * Creates a plain object from a SynthesizeSpeechRequest message. Also converts values to other types if specified.
                     * @param message SynthesizeSpeechRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.SynthesizeSpeechRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SynthesizeSpeechRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SynthesizeSpeechRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CustomPronunciationParams. */
                interface ICustomPronunciationParams {

                    /** CustomPronunciationParams phrase */
                    phrase?: (string|null);

                    /** CustomPronunciationParams phoneticEncoding */
                    phoneticEncoding?: (google.cloud.texttospeech.v1.CustomPronunciationParams.PhoneticEncoding|keyof typeof google.cloud.texttospeech.v1.CustomPronunciationParams.PhoneticEncoding|null);

                    /** CustomPronunciationParams pronunciation */
                    pronunciation?: (string|null);
                }

                /** Represents a CustomPronunciationParams. */
                class CustomPronunciationParams implements ICustomPronunciationParams {

                    /**
                     * Constructs a new CustomPronunciationParams.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.ICustomPronunciationParams);

                    /** CustomPronunciationParams phrase. */
                    public phrase?: (string|null);

                    /** CustomPronunciationParams phoneticEncoding. */
                    public phoneticEncoding?: (google.cloud.texttospeech.v1.CustomPronunciationParams.PhoneticEncoding|keyof typeof google.cloud.texttospeech.v1.CustomPronunciationParams.PhoneticEncoding|null);

                    /** CustomPronunciationParams pronunciation. */
                    public pronunciation?: (string|null);

                    /**
                     * Creates a new CustomPronunciationParams instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CustomPronunciationParams instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.ICustomPronunciationParams): google.cloud.texttospeech.v1.CustomPronunciationParams;

                    /**
                     * Encodes the specified CustomPronunciationParams message. Does not implicitly {@link google.cloud.texttospeech.v1.CustomPronunciationParams.verify|verify} messages.
                     * @param message CustomPronunciationParams message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.ICustomPronunciationParams, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CustomPronunciationParams message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.CustomPronunciationParams.verify|verify} messages.
                     * @param message CustomPronunciationParams message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.ICustomPronunciationParams, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CustomPronunciationParams message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CustomPronunciationParams
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.CustomPronunciationParams;

                    /**
                     * Decodes a CustomPronunciationParams message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CustomPronunciationParams
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.CustomPronunciationParams;

                    /**
                     * Verifies a CustomPronunciationParams message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CustomPronunciationParams message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CustomPronunciationParams
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.CustomPronunciationParams;

                    /**
                     * Creates a plain object from a CustomPronunciationParams message. Also converts values to other types if specified.
                     * @param message CustomPronunciationParams
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.CustomPronunciationParams, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CustomPronunciationParams to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CustomPronunciationParams
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                namespace CustomPronunciationParams {

                    /** PhoneticEncoding enum. */
                    enum PhoneticEncoding {
                        PHONETIC_ENCODING_UNSPECIFIED = 0,
                        PHONETIC_ENCODING_IPA = 1,
                        PHONETIC_ENCODING_X_SAMPA = 2,
                        PHONETIC_ENCODING_JAPANESE_YOMIGANA = 3,
                        PHONETIC_ENCODING_PINYIN = 4
                    }
                }

                /** Properties of a CustomPronunciations. */
                interface ICustomPronunciations {

                    /** CustomPronunciations pronunciations */
                    pronunciations?: (google.cloud.texttospeech.v1.ICustomPronunciationParams[]|null);
                }

                /** Represents a CustomPronunciations. */
                class CustomPronunciations implements ICustomPronunciations {

                    /**
                     * Constructs a new CustomPronunciations.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.ICustomPronunciations);

                    /** CustomPronunciations pronunciations. */
                    public pronunciations: google.cloud.texttospeech.v1.ICustomPronunciationParams[];

                    /**
                     * Creates a new CustomPronunciations instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CustomPronunciations instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.ICustomPronunciations): google.cloud.texttospeech.v1.CustomPronunciations;

                    /**
                     * Encodes the specified CustomPronunciations message. Does not implicitly {@link google.cloud.texttospeech.v1.CustomPronunciations.verify|verify} messages.
                     * @param message CustomPronunciations message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.ICustomPronunciations, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CustomPronunciations message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.CustomPronunciations.verify|verify} messages.
                     * @param message CustomPronunciations message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.ICustomPronunciations, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CustomPronunciations message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CustomPronunciations
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.CustomPronunciations;

                    /**
                     * Decodes a CustomPronunciations message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CustomPronunciations
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.CustomPronunciations;

                    /**
                     * Verifies a CustomPronunciations message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CustomPronunciations message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CustomPronunciations
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.CustomPronunciations;

                    /**
                     * Creates a plain object from a CustomPronunciations message. Also converts values to other types if specified.
                     * @param message CustomPronunciations
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.CustomPronunciations, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CustomPronunciations to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CustomPronunciations
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a MultiSpeakerMarkup. */
                interface IMultiSpeakerMarkup {

                    /** MultiSpeakerMarkup turns */
                    turns?: (google.cloud.texttospeech.v1.MultiSpeakerMarkup.ITurn[]|null);
                }

                /** Represents a MultiSpeakerMarkup. */
                class MultiSpeakerMarkup implements IMultiSpeakerMarkup {

                    /**
                     * Constructs a new MultiSpeakerMarkup.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.IMultiSpeakerMarkup);

                    /** MultiSpeakerMarkup turns. */
                    public turns: google.cloud.texttospeech.v1.MultiSpeakerMarkup.ITurn[];

                    /**
                     * Creates a new MultiSpeakerMarkup instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns MultiSpeakerMarkup instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.IMultiSpeakerMarkup): google.cloud.texttospeech.v1.MultiSpeakerMarkup;

                    /**
                     * Encodes the specified MultiSpeakerMarkup message. Does not implicitly {@link google.cloud.texttospeech.v1.MultiSpeakerMarkup.verify|verify} messages.
                     * @param message MultiSpeakerMarkup message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.IMultiSpeakerMarkup, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified MultiSpeakerMarkup message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.MultiSpeakerMarkup.verify|verify} messages.
                     * @param message MultiSpeakerMarkup message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.IMultiSpeakerMarkup, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a MultiSpeakerMarkup message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns MultiSpeakerMarkup
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.MultiSpeakerMarkup;

                    /**
                     * Decodes a MultiSpeakerMarkup message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns MultiSpeakerMarkup
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.MultiSpeakerMarkup;

                    /**
                     * Verifies a MultiSpeakerMarkup message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a MultiSpeakerMarkup message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns MultiSpeakerMarkup
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.MultiSpeakerMarkup;

                    /**
                     * Creates a plain object from a MultiSpeakerMarkup message. Also converts values to other types if specified.
                     * @param message MultiSpeakerMarkup
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.MultiSpeakerMarkup, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this MultiSpeakerMarkup to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for MultiSpeakerMarkup
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                namespace MultiSpeakerMarkup {

                    /** Properties of a Turn. */
                    interface ITurn {

                        /** Turn speaker */
                        speaker?: (string|null);

                        /** Turn text */
                        text?: (string|null);
                    }

                    /** Represents a Turn. */
                    class Turn implements ITurn {

                        /**
                         * Constructs a new Turn.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: google.cloud.texttospeech.v1.MultiSpeakerMarkup.ITurn);

                        /** Turn speaker. */
                        public speaker: string;

                        /** Turn text. */
                        public text: string;

                        /**
                         * Creates a new Turn instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns Turn instance
                         */
                        public static create(properties?: google.cloud.texttospeech.v1.MultiSpeakerMarkup.ITurn): google.cloud.texttospeech.v1.MultiSpeakerMarkup.Turn;

                        /**
                         * Encodes the specified Turn message. Does not implicitly {@link google.cloud.texttospeech.v1.MultiSpeakerMarkup.Turn.verify|verify} messages.
                         * @param message Turn message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: google.cloud.texttospeech.v1.MultiSpeakerMarkup.ITurn, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified Turn message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.MultiSpeakerMarkup.Turn.verify|verify} messages.
                         * @param message Turn message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: google.cloud.texttospeech.v1.MultiSpeakerMarkup.ITurn, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a Turn message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns Turn
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.MultiSpeakerMarkup.Turn;

                        /**
                         * Decodes a Turn message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns Turn
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.MultiSpeakerMarkup.Turn;

                        /**
                         * Verifies a Turn message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a Turn message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns Turn
                         */
                        public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.MultiSpeakerMarkup.Turn;

                        /**
                         * Creates a plain object from a Turn message. Also converts values to other types if specified.
                         * @param message Turn
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: google.cloud.texttospeech.v1.MultiSpeakerMarkup.Turn, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this Turn to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for Turn
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }
                }

                /** Properties of a MultispeakerPrebuiltVoice. */
                interface IMultispeakerPrebuiltVoice {

                    /** MultispeakerPrebuiltVoice speakerAlias */
                    speakerAlias?: (string|null);

                    /** MultispeakerPrebuiltVoice speakerId */
                    speakerId?: (string|null);
                }

                /** Represents a MultispeakerPrebuiltVoice. */
                class MultispeakerPrebuiltVoice implements IMultispeakerPrebuiltVoice {

                    /**
                     * Constructs a new MultispeakerPrebuiltVoice.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.IMultispeakerPrebuiltVoice);

                    /** MultispeakerPrebuiltVoice speakerAlias. */
                    public speakerAlias: string;

                    /** MultispeakerPrebuiltVoice speakerId. */
                    public speakerId: string;

                    /**
                     * Creates a new MultispeakerPrebuiltVoice instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns MultispeakerPrebuiltVoice instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.IMultispeakerPrebuiltVoice): google.cloud.texttospeech.v1.MultispeakerPrebuiltVoice;

                    /**
                     * Encodes the specified MultispeakerPrebuiltVoice message. Does not implicitly {@link google.cloud.texttospeech.v1.MultispeakerPrebuiltVoice.verify|verify} messages.
                     * @param message MultispeakerPrebuiltVoice message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.IMultispeakerPrebuiltVoice, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified MultispeakerPrebuiltVoice message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.MultispeakerPrebuiltVoice.verify|verify} messages.
                     * @param message MultispeakerPrebuiltVoice message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.IMultispeakerPrebuiltVoice, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a MultispeakerPrebuiltVoice message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns MultispeakerPrebuiltVoice
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.MultispeakerPrebuiltVoice;

                    /**
                     * Decodes a MultispeakerPrebuiltVoice message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns MultispeakerPrebuiltVoice
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.MultispeakerPrebuiltVoice;

                    /**
                     * Verifies a MultispeakerPrebuiltVoice message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a MultispeakerPrebuiltVoice message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns MultispeakerPrebuiltVoice
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.MultispeakerPrebuiltVoice;

                    /**
                     * Creates a plain object from a MultispeakerPrebuiltVoice message. Also converts values to other types if specified.
                     * @param message MultispeakerPrebuiltVoice
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.MultispeakerPrebuiltVoice, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this MultispeakerPrebuiltVoice to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for MultispeakerPrebuiltVoice
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a MultiSpeakerVoiceConfig. */
                interface IMultiSpeakerVoiceConfig {

                    /** MultiSpeakerVoiceConfig speakerVoiceConfigs */
                    speakerVoiceConfigs?: (google.cloud.texttospeech.v1.IMultispeakerPrebuiltVoice[]|null);
                }

                /** Represents a MultiSpeakerVoiceConfig. */
                class MultiSpeakerVoiceConfig implements IMultiSpeakerVoiceConfig {

                    /**
                     * Constructs a new MultiSpeakerVoiceConfig.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.IMultiSpeakerVoiceConfig);

                    /** MultiSpeakerVoiceConfig speakerVoiceConfigs. */
                    public speakerVoiceConfigs: google.cloud.texttospeech.v1.IMultispeakerPrebuiltVoice[];

                    /**
                     * Creates a new MultiSpeakerVoiceConfig instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns MultiSpeakerVoiceConfig instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.IMultiSpeakerVoiceConfig): google.cloud.texttospeech.v1.MultiSpeakerVoiceConfig;

                    /**
                     * Encodes the specified MultiSpeakerVoiceConfig message. Does not implicitly {@link google.cloud.texttospeech.v1.MultiSpeakerVoiceConfig.verify|verify} messages.
                     * @param message MultiSpeakerVoiceConfig message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.IMultiSpeakerVoiceConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified MultiSpeakerVoiceConfig message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.MultiSpeakerVoiceConfig.verify|verify} messages.
                     * @param message MultiSpeakerVoiceConfig message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.IMultiSpeakerVoiceConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a MultiSpeakerVoiceConfig message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns MultiSpeakerVoiceConfig
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.MultiSpeakerVoiceConfig;

                    /**
                     * Decodes a MultiSpeakerVoiceConfig message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns MultiSpeakerVoiceConfig
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.MultiSpeakerVoiceConfig;

                    /**
                     * Verifies a MultiSpeakerVoiceConfig message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a MultiSpeakerVoiceConfig message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns MultiSpeakerVoiceConfig
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.MultiSpeakerVoiceConfig;

                    /**
                     * Creates a plain object from a MultiSpeakerVoiceConfig message. Also converts values to other types if specified.
                     * @param message MultiSpeakerVoiceConfig
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.MultiSpeakerVoiceConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this MultiSpeakerVoiceConfig to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for MultiSpeakerVoiceConfig
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SynthesisInput. */
                interface ISynthesisInput {

                    /** SynthesisInput text */
                    text?: (string|null);

                    /** SynthesisInput markup */
                    markup?: (string|null);

                    /** SynthesisInput ssml */
                    ssml?: (string|null);

                    /** SynthesisInput multiSpeakerMarkup */
                    multiSpeakerMarkup?: (google.cloud.texttospeech.v1.IMultiSpeakerMarkup|null);

                    /** SynthesisInput prompt */
                    prompt?: (string|null);

                    /** SynthesisInput customPronunciations */
                    customPronunciations?: (google.cloud.texttospeech.v1.ICustomPronunciations|null);
                }

                /** Represents a SynthesisInput. */
                class SynthesisInput implements ISynthesisInput {

                    /**
                     * Constructs a new SynthesisInput.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.ISynthesisInput);

                    /** SynthesisInput text. */
                    public text?: (string|null);

                    /** SynthesisInput markup. */
                    public markup?: (string|null);

                    /** SynthesisInput ssml. */
                    public ssml?: (string|null);

                    /** SynthesisInput multiSpeakerMarkup. */
                    public multiSpeakerMarkup?: (google.cloud.texttospeech.v1.IMultiSpeakerMarkup|null);

                    /** SynthesisInput prompt. */
                    public prompt?: (string|null);

                    /** SynthesisInput customPronunciations. */
                    public customPronunciations?: (google.cloud.texttospeech.v1.ICustomPronunciations|null);

                    /** SynthesisInput inputSource. */
                    public inputSource?: ("text"|"markup"|"ssml"|"multiSpeakerMarkup");

                    /**
                     * Creates a new SynthesisInput instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SynthesisInput instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.ISynthesisInput): google.cloud.texttospeech.v1.SynthesisInput;

                    /**
                     * Encodes the specified SynthesisInput message. Does not implicitly {@link google.cloud.texttospeech.v1.SynthesisInput.verify|verify} messages.
                     * @param message SynthesisInput message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.ISynthesisInput, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SynthesisInput message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.SynthesisInput.verify|verify} messages.
                     * @param message SynthesisInput message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.ISynthesisInput, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SynthesisInput message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SynthesisInput
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.SynthesisInput;

                    /**
                     * Decodes a SynthesisInput message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SynthesisInput
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.SynthesisInput;

                    /**
                     * Verifies a SynthesisInput message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SynthesisInput message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SynthesisInput
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.SynthesisInput;

                    /**
                     * Creates a plain object from a SynthesisInput message. Also converts values to other types if specified.
                     * @param message SynthesisInput
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.SynthesisInput, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SynthesisInput to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SynthesisInput
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a VoiceSelectionParams. */
                interface IVoiceSelectionParams {

                    /** VoiceSelectionParams languageCode */
                    languageCode?: (string|null);

                    /** VoiceSelectionParams name */
                    name?: (string|null);

                    /** VoiceSelectionParams ssmlGender */
                    ssmlGender?: (google.cloud.texttospeech.v1.SsmlVoiceGender|keyof typeof google.cloud.texttospeech.v1.SsmlVoiceGender|null);

                    /** VoiceSelectionParams customVoice */
                    customVoice?: (google.cloud.texttospeech.v1.ICustomVoiceParams|null);

                    /** VoiceSelectionParams voiceClone */
                    voiceClone?: (google.cloud.texttospeech.v1.IVoiceCloneParams|null);

                    /** VoiceSelectionParams modelName */
                    modelName?: (string|null);

                    /** VoiceSelectionParams multiSpeakerVoiceConfig */
                    multiSpeakerVoiceConfig?: (google.cloud.texttospeech.v1.IMultiSpeakerVoiceConfig|null);
                }

                /** Represents a VoiceSelectionParams. */
                class VoiceSelectionParams implements IVoiceSelectionParams {

                    /**
                     * Constructs a new VoiceSelectionParams.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.IVoiceSelectionParams);

                    /** VoiceSelectionParams languageCode. */
                    public languageCode: string;

                    /** VoiceSelectionParams name. */
                    public name: string;

                    /** VoiceSelectionParams ssmlGender. */
                    public ssmlGender: (google.cloud.texttospeech.v1.SsmlVoiceGender|keyof typeof google.cloud.texttospeech.v1.SsmlVoiceGender);

                    /** VoiceSelectionParams customVoice. */
                    public customVoice?: (google.cloud.texttospeech.v1.ICustomVoiceParams|null);

                    /** VoiceSelectionParams voiceClone. */
                    public voiceClone?: (google.cloud.texttospeech.v1.IVoiceCloneParams|null);

                    /** VoiceSelectionParams modelName. */
                    public modelName: string;

                    /** VoiceSelectionParams multiSpeakerVoiceConfig. */
                    public multiSpeakerVoiceConfig?: (google.cloud.texttospeech.v1.IMultiSpeakerVoiceConfig|null);

                    /**
                     * Creates a new VoiceSelectionParams instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns VoiceSelectionParams instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.IVoiceSelectionParams): google.cloud.texttospeech.v1.VoiceSelectionParams;

                    /**
                     * Encodes the specified VoiceSelectionParams message. Does not implicitly {@link google.cloud.texttospeech.v1.VoiceSelectionParams.verify|verify} messages.
                     * @param message VoiceSelectionParams message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.IVoiceSelectionParams, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified VoiceSelectionParams message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.VoiceSelectionParams.verify|verify} messages.
                     * @param message VoiceSelectionParams message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.IVoiceSelectionParams, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a VoiceSelectionParams message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns VoiceSelectionParams
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.VoiceSelectionParams;

                    /**
                     * Decodes a VoiceSelectionParams message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns VoiceSelectionParams
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.VoiceSelectionParams;

                    /**
                     * Verifies a VoiceSelectionParams message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a VoiceSelectionParams message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns VoiceSelectionParams
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.VoiceSelectionParams;

                    /**
                     * Creates a plain object from a VoiceSelectionParams message. Also converts values to other types if specified.
                     * @param message VoiceSelectionParams
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.VoiceSelectionParams, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this VoiceSelectionParams to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for VoiceSelectionParams
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AudioConfig. */
                interface IAudioConfig {

                    /** AudioConfig audioEncoding */
                    audioEncoding?: (google.cloud.texttospeech.v1.AudioEncoding|keyof typeof google.cloud.texttospeech.v1.AudioEncoding|null);

                    /** AudioConfig speakingRate */
                    speakingRate?: (number|null);

                    /** AudioConfig pitch */
                    pitch?: (number|null);

                    /** AudioConfig volumeGainDb */
                    volumeGainDb?: (number|null);

                    /** AudioConfig sampleRateHertz */
                    sampleRateHertz?: (number|null);

                    /** AudioConfig effectsProfileId */
                    effectsProfileId?: (string[]|null);
                }

                /** Represents an AudioConfig. */
                class AudioConfig implements IAudioConfig {

                    /**
                     * Constructs a new AudioConfig.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.IAudioConfig);

                    /** AudioConfig audioEncoding. */
                    public audioEncoding: (google.cloud.texttospeech.v1.AudioEncoding|keyof typeof google.cloud.texttospeech.v1.AudioEncoding);

                    /** AudioConfig speakingRate. */
                    public speakingRate: number;

                    /** AudioConfig pitch. */
                    public pitch: number;

                    /** AudioConfig volumeGainDb. */
                    public volumeGainDb: number;

                    /** AudioConfig sampleRateHertz. */
                    public sampleRateHertz: number;

                    /** AudioConfig effectsProfileId. */
                    public effectsProfileId: string[];

                    /**
                     * Creates a new AudioConfig instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AudioConfig instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.IAudioConfig): google.cloud.texttospeech.v1.AudioConfig;

                    /**
                     * Encodes the specified AudioConfig message. Does not implicitly {@link google.cloud.texttospeech.v1.AudioConfig.verify|verify} messages.
                     * @param message AudioConfig message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.IAudioConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AudioConfig message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.AudioConfig.verify|verify} messages.
                     * @param message AudioConfig message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.IAudioConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AudioConfig message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AudioConfig
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.AudioConfig;

                    /**
                     * Decodes an AudioConfig message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AudioConfig
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.AudioConfig;

                    /**
                     * Verifies an AudioConfig message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AudioConfig message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AudioConfig
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.AudioConfig;

                    /**
                     * Creates a plain object from an AudioConfig message. Also converts values to other types if specified.
                     * @param message AudioConfig
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.AudioConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AudioConfig to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AudioConfig
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CustomVoiceParams. */
                interface ICustomVoiceParams {

                    /** CustomVoiceParams model */
                    model?: (string|null);

                    /** CustomVoiceParams reportedUsage */
                    reportedUsage?: (google.cloud.texttospeech.v1.CustomVoiceParams.ReportedUsage|keyof typeof google.cloud.texttospeech.v1.CustomVoiceParams.ReportedUsage|null);
                }

                /** Represents a CustomVoiceParams. */
                class CustomVoiceParams implements ICustomVoiceParams {

                    /**
                     * Constructs a new CustomVoiceParams.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.ICustomVoiceParams);

                    /** CustomVoiceParams model. */
                    public model: string;

                    /** CustomVoiceParams reportedUsage. */
                    public reportedUsage: (google.cloud.texttospeech.v1.CustomVoiceParams.ReportedUsage|keyof typeof google.cloud.texttospeech.v1.CustomVoiceParams.ReportedUsage);

                    /**
                     * Creates a new CustomVoiceParams instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CustomVoiceParams instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.ICustomVoiceParams): google.cloud.texttospeech.v1.CustomVoiceParams;

                    /**
                     * Encodes the specified CustomVoiceParams message. Does not implicitly {@link google.cloud.texttospeech.v1.CustomVoiceParams.verify|verify} messages.
                     * @param message CustomVoiceParams message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.ICustomVoiceParams, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CustomVoiceParams message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.CustomVoiceParams.verify|verify} messages.
                     * @param message CustomVoiceParams message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.ICustomVoiceParams, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CustomVoiceParams message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CustomVoiceParams
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.CustomVoiceParams;

                    /**
                     * Decodes a CustomVoiceParams message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CustomVoiceParams
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.CustomVoiceParams;

                    /**
                     * Verifies a CustomVoiceParams message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CustomVoiceParams message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CustomVoiceParams
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.CustomVoiceParams;

                    /**
                     * Creates a plain object from a CustomVoiceParams message. Also converts values to other types if specified.
                     * @param message CustomVoiceParams
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.CustomVoiceParams, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CustomVoiceParams to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CustomVoiceParams
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                namespace CustomVoiceParams {

                    /** ReportedUsage enum. */
                    enum ReportedUsage {
                        REPORTED_USAGE_UNSPECIFIED = 0,
                        REALTIME = 1,
                        OFFLINE = 2
                    }
                }

                /** Properties of a VoiceCloneParams. */
                interface IVoiceCloneParams {

                    /** VoiceCloneParams voiceCloningKey */
                    voiceCloningKey?: (string|null);
                }

                /** Represents a VoiceCloneParams. */
                class VoiceCloneParams implements IVoiceCloneParams {

                    /**
                     * Constructs a new VoiceCloneParams.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.IVoiceCloneParams);

                    /** VoiceCloneParams voiceCloningKey. */
                    public voiceCloningKey: string;

                    /**
                     * Creates a new VoiceCloneParams instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns VoiceCloneParams instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.IVoiceCloneParams): google.cloud.texttospeech.v1.VoiceCloneParams;

                    /**
                     * Encodes the specified VoiceCloneParams message. Does not implicitly {@link google.cloud.texttospeech.v1.VoiceCloneParams.verify|verify} messages.
                     * @param message VoiceCloneParams message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.IVoiceCloneParams, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified VoiceCloneParams message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.VoiceCloneParams.verify|verify} messages.
                     * @param message VoiceCloneParams message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.IVoiceCloneParams, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a VoiceCloneParams message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns VoiceCloneParams
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.VoiceCloneParams;

                    /**
                     * Decodes a VoiceCloneParams message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns VoiceCloneParams
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.VoiceCloneParams;

                    /**
                     * Verifies a VoiceCloneParams message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a VoiceCloneParams message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns VoiceCloneParams
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.VoiceCloneParams;

                    /**
                     * Creates a plain object from a VoiceCloneParams message. Also converts values to other types if specified.
                     * @param message VoiceCloneParams
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.VoiceCloneParams, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this VoiceCloneParams to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for VoiceCloneParams
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SynthesizeSpeechResponse. */
                interface ISynthesizeSpeechResponse {

                    /** SynthesizeSpeechResponse audioContent */
                    audioContent?: (Uint8Array|Buffer|string|null);
                }

                /** Represents a SynthesizeSpeechResponse. */
                class SynthesizeSpeechResponse implements ISynthesizeSpeechResponse {

                    /**
                     * Constructs a new SynthesizeSpeechResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.ISynthesizeSpeechResponse);

                    /** SynthesizeSpeechResponse audioContent. */
                    public audioContent: (Uint8Array|Buffer|string);

                    /**
                     * Creates a new SynthesizeSpeechResponse instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SynthesizeSpeechResponse instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.ISynthesizeSpeechResponse): google.cloud.texttospeech.v1.SynthesizeSpeechResponse;

                    /**
                     * Encodes the specified SynthesizeSpeechResponse message. Does not implicitly {@link google.cloud.texttospeech.v1.SynthesizeSpeechResponse.verify|verify} messages.
                     * @param message SynthesizeSpeechResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.ISynthesizeSpeechResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SynthesizeSpeechResponse message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.SynthesizeSpeechResponse.verify|verify} messages.
                     * @param message SynthesizeSpeechResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.ISynthesizeSpeechResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SynthesizeSpeechResponse message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SynthesizeSpeechResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.SynthesizeSpeechResponse;

                    /**
                     * Decodes a SynthesizeSpeechResponse message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SynthesizeSpeechResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.SynthesizeSpeechResponse;

                    /**
                     * Verifies a SynthesizeSpeechResponse message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SynthesizeSpeechResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SynthesizeSpeechResponse
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.SynthesizeSpeechResponse;

                    /**
                     * Creates a plain object from a SynthesizeSpeechResponse message. Also converts values to other types if specified.
                     * @param message SynthesizeSpeechResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.SynthesizeSpeechResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SynthesizeSpeechResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SynthesizeSpeechResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a StreamingAudioConfig. */
                interface IStreamingAudioConfig {

                    /** StreamingAudioConfig audioEncoding */
                    audioEncoding?: (google.cloud.texttospeech.v1.AudioEncoding|keyof typeof google.cloud.texttospeech.v1.AudioEncoding|null);

                    /** StreamingAudioConfig sampleRateHertz */
                    sampleRateHertz?: (number|null);

                    /** StreamingAudioConfig speakingRate */
                    speakingRate?: (number|null);
                }

                /** Represents a StreamingAudioConfig. */
                class StreamingAudioConfig implements IStreamingAudioConfig {

                    /**
                     * Constructs a new StreamingAudioConfig.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.IStreamingAudioConfig);

                    /** StreamingAudioConfig audioEncoding. */
                    public audioEncoding: (google.cloud.texttospeech.v1.AudioEncoding|keyof typeof google.cloud.texttospeech.v1.AudioEncoding);

                    /** StreamingAudioConfig sampleRateHertz. */
                    public sampleRateHertz: number;

                    /** StreamingAudioConfig speakingRate. */
                    public speakingRate: number;

                    /**
                     * Creates a new StreamingAudioConfig instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns StreamingAudioConfig instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.IStreamingAudioConfig): google.cloud.texttospeech.v1.StreamingAudioConfig;

                    /**
                     * Encodes the specified StreamingAudioConfig message. Does not implicitly {@link google.cloud.texttospeech.v1.StreamingAudioConfig.verify|verify} messages.
                     * @param message StreamingAudioConfig message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.IStreamingAudioConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified StreamingAudioConfig message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.StreamingAudioConfig.verify|verify} messages.
                     * @param message StreamingAudioConfig message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.IStreamingAudioConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a StreamingAudioConfig message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns StreamingAudioConfig
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.StreamingAudioConfig;

                    /**
                     * Decodes a StreamingAudioConfig message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns StreamingAudioConfig
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.StreamingAudioConfig;

                    /**
                     * Verifies a StreamingAudioConfig message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a StreamingAudioConfig message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns StreamingAudioConfig
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.StreamingAudioConfig;

                    /**
                     * Creates a plain object from a StreamingAudioConfig message. Also converts values to other types if specified.
                     * @param message StreamingAudioConfig
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.StreamingAudioConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this StreamingAudioConfig to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for StreamingAudioConfig
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a StreamingSynthesizeConfig. */
                interface IStreamingSynthesizeConfig {

                    /** StreamingSynthesizeConfig voice */
                    voice?: (google.cloud.texttospeech.v1.IVoiceSelectionParams|null);

                    /** StreamingSynthesizeConfig streamingAudioConfig */
                    streamingAudioConfig?: (google.cloud.texttospeech.v1.IStreamingAudioConfig|null);

                    /** StreamingSynthesizeConfig customPronunciations */
                    customPronunciations?: (google.cloud.texttospeech.v1.ICustomPronunciations|null);
                }

                /** Represents a StreamingSynthesizeConfig. */
                class StreamingSynthesizeConfig implements IStreamingSynthesizeConfig {

                    /**
                     * Constructs a new StreamingSynthesizeConfig.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.IStreamingSynthesizeConfig);

                    /** StreamingSynthesizeConfig voice. */
                    public voice?: (google.cloud.texttospeech.v1.IVoiceSelectionParams|null);

                    /** StreamingSynthesizeConfig streamingAudioConfig. */
                    public streamingAudioConfig?: (google.cloud.texttospeech.v1.IStreamingAudioConfig|null);

                    /** StreamingSynthesizeConfig customPronunciations. */
                    public customPronunciations?: (google.cloud.texttospeech.v1.ICustomPronunciations|null);

                    /**
                     * Creates a new StreamingSynthesizeConfig instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns StreamingSynthesizeConfig instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.IStreamingSynthesizeConfig): google.cloud.texttospeech.v1.StreamingSynthesizeConfig;

                    /**
                     * Encodes the specified StreamingSynthesizeConfig message. Does not implicitly {@link google.cloud.texttospeech.v1.StreamingSynthesizeConfig.verify|verify} messages.
                     * @param message StreamingSynthesizeConfig message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.IStreamingSynthesizeConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified StreamingSynthesizeConfig message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.StreamingSynthesizeConfig.verify|verify} messages.
                     * @param message StreamingSynthesizeConfig message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.IStreamingSynthesizeConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a StreamingSynthesizeConfig message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns StreamingSynthesizeConfig
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.StreamingSynthesizeConfig;

                    /**
                     * Decodes a StreamingSynthesizeConfig message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns StreamingSynthesizeConfig
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.StreamingSynthesizeConfig;

                    /**
                     * Verifies a StreamingSynthesizeConfig message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a StreamingSynthesizeConfig message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns StreamingSynthesizeConfig
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.StreamingSynthesizeConfig;

                    /**
                     * Creates a plain object from a StreamingSynthesizeConfig message. Also converts values to other types if specified.
                     * @param message StreamingSynthesizeConfig
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.StreamingSynthesizeConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this StreamingSynthesizeConfig to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for StreamingSynthesizeConfig
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a StreamingSynthesisInput. */
                interface IStreamingSynthesisInput {

                    /** StreamingSynthesisInput text */
                    text?: (string|null);

                    /** StreamingSynthesisInput markup */
                    markup?: (string|null);

                    /** StreamingSynthesisInput multiSpeakerMarkup */
                    multiSpeakerMarkup?: (google.cloud.texttospeech.v1.IMultiSpeakerMarkup|null);

                    /** StreamingSynthesisInput prompt */
                    prompt?: (string|null);
                }

                /** Represents a StreamingSynthesisInput. */
                class StreamingSynthesisInput implements IStreamingSynthesisInput {

                    /**
                     * Constructs a new StreamingSynthesisInput.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.IStreamingSynthesisInput);

                    /** StreamingSynthesisInput text. */
                    public text?: (string|null);

                    /** StreamingSynthesisInput markup. */
                    public markup?: (string|null);

                    /** StreamingSynthesisInput multiSpeakerMarkup. */
                    public multiSpeakerMarkup?: (google.cloud.texttospeech.v1.IMultiSpeakerMarkup|null);

                    /** StreamingSynthesisInput prompt. */
                    public prompt?: (string|null);

                    /** StreamingSynthesisInput inputSource. */
                    public inputSource?: ("text"|"markup"|"multiSpeakerMarkup");

                    /**
                     * Creates a new StreamingSynthesisInput instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns StreamingSynthesisInput instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.IStreamingSynthesisInput): google.cloud.texttospeech.v1.StreamingSynthesisInput;

                    /**
                     * Encodes the specified StreamingSynthesisInput message. Does not implicitly {@link google.cloud.texttospeech.v1.StreamingSynthesisInput.verify|verify} messages.
                     * @param message StreamingSynthesisInput message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.IStreamingSynthesisInput, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified StreamingSynthesisInput message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.StreamingSynthesisInput.verify|verify} messages.
                     * @param message StreamingSynthesisInput message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.IStreamingSynthesisInput, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a StreamingSynthesisInput message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns StreamingSynthesisInput
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.StreamingSynthesisInput;

                    /**
                     * Decodes a StreamingSynthesisInput message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns StreamingSynthesisInput
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.StreamingSynthesisInput;

                    /**
                     * Verifies a StreamingSynthesisInput message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a StreamingSynthesisInput message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns StreamingSynthesisInput
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.StreamingSynthesisInput;

                    /**
                     * Creates a plain object from a StreamingSynthesisInput message. Also converts values to other types if specified.
                     * @param message StreamingSynthesisInput
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.StreamingSynthesisInput, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this StreamingSynthesisInput to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for StreamingSynthesisInput
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a StreamingSynthesizeRequest. */
                interface IStreamingSynthesizeRequest {

                    /** StreamingSynthesizeRequest streamingConfig */
                    streamingConfig?: (google.cloud.texttospeech.v1.IStreamingSynthesizeConfig|null);

                    /** StreamingSynthesizeRequest input */
                    input?: (google.cloud.texttospeech.v1.IStreamingSynthesisInput|null);
                }

                /** Represents a StreamingSynthesizeRequest. */
                class StreamingSynthesizeRequest implements IStreamingSynthesizeRequest {

                    /**
                     * Constructs a new StreamingSynthesizeRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.IStreamingSynthesizeRequest);

                    /** StreamingSynthesizeRequest streamingConfig. */
                    public streamingConfig?: (google.cloud.texttospeech.v1.IStreamingSynthesizeConfig|null);

                    /** StreamingSynthesizeRequest input. */
                    public input?: (google.cloud.texttospeech.v1.IStreamingSynthesisInput|null);

                    /** StreamingSynthesizeRequest streamingRequest. */
                    public streamingRequest?: ("streamingConfig"|"input");

                    /**
                     * Creates a new StreamingSynthesizeRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns StreamingSynthesizeRequest instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.IStreamingSynthesizeRequest): google.cloud.texttospeech.v1.StreamingSynthesizeRequest;

                    /**
                     * Encodes the specified StreamingSynthesizeRequest message. Does not implicitly {@link google.cloud.texttospeech.v1.StreamingSynthesizeRequest.verify|verify} messages.
                     * @param message StreamingSynthesizeRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.IStreamingSynthesizeRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified StreamingSynthesizeRequest message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.StreamingSynthesizeRequest.verify|verify} messages.
                     * @param message StreamingSynthesizeRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.IStreamingSynthesizeRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a StreamingSynthesizeRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns StreamingSynthesizeRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.StreamingSynthesizeRequest;

                    /**
                     * Decodes a StreamingSynthesizeRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns StreamingSynthesizeRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.StreamingSynthesizeRequest;

                    /**
                     * Verifies a StreamingSynthesizeRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a StreamingSynthesizeRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns StreamingSynthesizeRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.StreamingSynthesizeRequest;

                    /**
                     * Creates a plain object from a StreamingSynthesizeRequest message. Also converts values to other types if specified.
                     * @param message StreamingSynthesizeRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.StreamingSynthesizeRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this StreamingSynthesizeRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for StreamingSynthesizeRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a StreamingSynthesizeResponse. */
                interface IStreamingSynthesizeResponse {

                    /** StreamingSynthesizeResponse audioContent */
                    audioContent?: (Uint8Array|Buffer|string|null);
                }

                /** Represents a StreamingSynthesizeResponse. */
                class StreamingSynthesizeResponse implements IStreamingSynthesizeResponse {

                    /**
                     * Constructs a new StreamingSynthesizeResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.IStreamingSynthesizeResponse);

                    /** StreamingSynthesizeResponse audioContent. */
                    public audioContent: (Uint8Array|Buffer|string);

                    /**
                     * Creates a new StreamingSynthesizeResponse instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns StreamingSynthesizeResponse instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.IStreamingSynthesizeResponse): google.cloud.texttospeech.v1.StreamingSynthesizeResponse;

                    /**
                     * Encodes the specified StreamingSynthesizeResponse message. Does not implicitly {@link google.cloud.texttospeech.v1.StreamingSynthesizeResponse.verify|verify} messages.
                     * @param message StreamingSynthesizeResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.IStreamingSynthesizeResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified StreamingSynthesizeResponse message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.StreamingSynthesizeResponse.verify|verify} messages.
                     * @param message StreamingSynthesizeResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.IStreamingSynthesizeResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a StreamingSynthesizeResponse message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns StreamingSynthesizeResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.StreamingSynthesizeResponse;

                    /**
                     * Decodes a StreamingSynthesizeResponse message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns StreamingSynthesizeResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.StreamingSynthesizeResponse;

                    /**
                     * Verifies a StreamingSynthesizeResponse message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a StreamingSynthesizeResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns StreamingSynthesizeResponse
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.StreamingSynthesizeResponse;

                    /**
                     * Creates a plain object from a StreamingSynthesizeResponse message. Also converts values to other types if specified.
                     * @param message StreamingSynthesizeResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.StreamingSynthesizeResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this StreamingSynthesizeResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for StreamingSynthesizeResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Represents a TextToSpeechLongAudioSynthesize */
                class TextToSpeechLongAudioSynthesize extends $protobuf.rpc.Service {

                    /**
                     * Constructs a new TextToSpeechLongAudioSynthesize service.
                     * @param rpcImpl RPC implementation
                     * @param [requestDelimited=false] Whether requests are length-delimited
                     * @param [responseDelimited=false] Whether responses are length-delimited
                     */
                    constructor(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean);

                    /**
                     * Creates new TextToSpeechLongAudioSynthesize service using the specified rpc implementation.
                     * @param rpcImpl RPC implementation
                     * @param [requestDelimited=false] Whether requests are length-delimited
                     * @param [responseDelimited=false] Whether responses are length-delimited
                     * @returns RPC service. Useful where requests and/or responses are streamed.
                     */
                    public static create(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean): TextToSpeechLongAudioSynthesize;

                    /**
                     * Calls SynthesizeLongAudio.
                     * @param request SynthesizeLongAudioRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Operation
                     */
                    public synthesizeLongAudio(request: google.cloud.texttospeech.v1.ISynthesizeLongAudioRequest, callback: google.cloud.texttospeech.v1.TextToSpeechLongAudioSynthesize.SynthesizeLongAudioCallback): void;

                    /**
                     * Calls SynthesizeLongAudio.
                     * @param request SynthesizeLongAudioRequest message or plain object
                     * @returns Promise
                     */
                    public synthesizeLongAudio(request: google.cloud.texttospeech.v1.ISynthesizeLongAudioRequest): Promise<google.longrunning.Operation>;
                }

                namespace TextToSpeechLongAudioSynthesize {

                    /**
                     * Callback as used by {@link google.cloud.texttospeech.v1.TextToSpeechLongAudioSynthesize|synthesizeLongAudio}.
                     * @param error Error, if any
                     * @param [response] Operation
                     */
                    type SynthesizeLongAudioCallback = (error: (Error|null), response?: google.longrunning.Operation) => void;
                }

                /** Properties of a SynthesizeLongAudioRequest. */
                interface ISynthesizeLongAudioRequest {

                    /** SynthesizeLongAudioRequest parent */
                    parent?: (string|null);

                    /** SynthesizeLongAudioRequest input */
                    input?: (google.cloud.texttospeech.v1.ISynthesisInput|null);

                    /** SynthesizeLongAudioRequest audioConfig */
                    audioConfig?: (google.cloud.texttospeech.v1.IAudioConfig|null);

                    /** SynthesizeLongAudioRequest outputGcsUri */
                    outputGcsUri?: (string|null);

                    /** SynthesizeLongAudioRequest voice */
                    voice?: (google.cloud.texttospeech.v1.IVoiceSelectionParams|null);
                }

                /** Represents a SynthesizeLongAudioRequest. */
                class SynthesizeLongAudioRequest implements ISynthesizeLongAudioRequest {

                    /**
                     * Constructs a new SynthesizeLongAudioRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.ISynthesizeLongAudioRequest);

                    /** SynthesizeLongAudioRequest parent. */
                    public parent: string;

                    /** SynthesizeLongAudioRequest input. */
                    public input?: (google.cloud.texttospeech.v1.ISynthesisInput|null);

                    /** SynthesizeLongAudioRequest audioConfig. */
                    public audioConfig?: (google.cloud.texttospeech.v1.IAudioConfig|null);

                    /** SynthesizeLongAudioRequest outputGcsUri. */
                    public outputGcsUri: string;

                    /** SynthesizeLongAudioRequest voice. */
                    public voice?: (google.cloud.texttospeech.v1.IVoiceSelectionParams|null);

                    /**
                     * Creates a new SynthesizeLongAudioRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SynthesizeLongAudioRequest instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.ISynthesizeLongAudioRequest): google.cloud.texttospeech.v1.SynthesizeLongAudioRequest;

                    /**
                     * Encodes the specified SynthesizeLongAudioRequest message. Does not implicitly {@link google.cloud.texttospeech.v1.SynthesizeLongAudioRequest.verify|verify} messages.
                     * @param message SynthesizeLongAudioRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.ISynthesizeLongAudioRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SynthesizeLongAudioRequest message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.SynthesizeLongAudioRequest.verify|verify} messages.
                     * @param message SynthesizeLongAudioRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.ISynthesizeLongAudioRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SynthesizeLongAudioRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SynthesizeLongAudioRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.SynthesizeLongAudioRequest;

                    /**
                     * Decodes a SynthesizeLongAudioRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SynthesizeLongAudioRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.SynthesizeLongAudioRequest;

                    /**
                     * Verifies a SynthesizeLongAudioRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SynthesizeLongAudioRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SynthesizeLongAudioRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.SynthesizeLongAudioRequest;

                    /**
                     * Creates a plain object from a SynthesizeLongAudioRequest message. Also converts values to other types if specified.
                     * @param message SynthesizeLongAudioRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.SynthesizeLongAudioRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SynthesizeLongAudioRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SynthesizeLongAudioRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SynthesizeLongAudioResponse. */
                interface ISynthesizeLongAudioResponse {
                }

                /** Represents a SynthesizeLongAudioResponse. */
                class SynthesizeLongAudioResponse implements ISynthesizeLongAudioResponse {

                    /**
                     * Constructs a new SynthesizeLongAudioResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.ISynthesizeLongAudioResponse);

                    /**
                     * Creates a new SynthesizeLongAudioResponse instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SynthesizeLongAudioResponse instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.ISynthesizeLongAudioResponse): google.cloud.texttospeech.v1.SynthesizeLongAudioResponse;

                    /**
                     * Encodes the specified SynthesizeLongAudioResponse message. Does not implicitly {@link google.cloud.texttospeech.v1.SynthesizeLongAudioResponse.verify|verify} messages.
                     * @param message SynthesizeLongAudioResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.ISynthesizeLongAudioResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SynthesizeLongAudioResponse message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.SynthesizeLongAudioResponse.verify|verify} messages.
                     * @param message SynthesizeLongAudioResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.ISynthesizeLongAudioResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SynthesizeLongAudioResponse message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SynthesizeLongAudioResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.SynthesizeLongAudioResponse;

                    /**
                     * Decodes a SynthesizeLongAudioResponse message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SynthesizeLongAudioResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.SynthesizeLongAudioResponse;

                    /**
                     * Verifies a SynthesizeLongAudioResponse message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SynthesizeLongAudioResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SynthesizeLongAudioResponse
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.SynthesizeLongAudioResponse;

                    /**
                     * Creates a plain object from a SynthesizeLongAudioResponse message. Also converts values to other types if specified.
                     * @param message SynthesizeLongAudioResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.SynthesizeLongAudioResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SynthesizeLongAudioResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SynthesizeLongAudioResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SynthesizeLongAudioMetadata. */
                interface ISynthesizeLongAudioMetadata {

                    /** SynthesizeLongAudioMetadata startTime */
                    startTime?: (google.protobuf.ITimestamp|null);

                    /** SynthesizeLongAudioMetadata lastUpdateTime */
                    lastUpdateTime?: (google.protobuf.ITimestamp|null);

                    /** SynthesizeLongAudioMetadata progressPercentage */
                    progressPercentage?: (number|null);
                }

                /** Represents a SynthesizeLongAudioMetadata. */
                class SynthesizeLongAudioMetadata implements ISynthesizeLongAudioMetadata {

                    /**
                     * Constructs a new SynthesizeLongAudioMetadata.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1.ISynthesizeLongAudioMetadata);

                    /** SynthesizeLongAudioMetadata startTime. */
                    public startTime?: (google.protobuf.ITimestamp|null);

                    /** SynthesizeLongAudioMetadata lastUpdateTime. */
                    public lastUpdateTime?: (google.protobuf.ITimestamp|null);

                    /** SynthesizeLongAudioMetadata progressPercentage. */
                    public progressPercentage: number;

                    /**
                     * Creates a new SynthesizeLongAudioMetadata instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SynthesizeLongAudioMetadata instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1.ISynthesizeLongAudioMetadata): google.cloud.texttospeech.v1.SynthesizeLongAudioMetadata;

                    /**
                     * Encodes the specified SynthesizeLongAudioMetadata message. Does not implicitly {@link google.cloud.texttospeech.v1.SynthesizeLongAudioMetadata.verify|verify} messages.
                     * @param message SynthesizeLongAudioMetadata message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1.ISynthesizeLongAudioMetadata, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SynthesizeLongAudioMetadata message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1.SynthesizeLongAudioMetadata.verify|verify} messages.
                     * @param message SynthesizeLongAudioMetadata message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1.ISynthesizeLongAudioMetadata, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SynthesizeLongAudioMetadata message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SynthesizeLongAudioMetadata
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1.SynthesizeLongAudioMetadata;

                    /**
                     * Decodes a SynthesizeLongAudioMetadata message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SynthesizeLongAudioMetadata
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1.SynthesizeLongAudioMetadata;

                    /**
                     * Verifies a SynthesizeLongAudioMetadata message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SynthesizeLongAudioMetadata message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SynthesizeLongAudioMetadata
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1.SynthesizeLongAudioMetadata;

                    /**
                     * Creates a plain object from a SynthesizeLongAudioMetadata message. Also converts values to other types if specified.
                     * @param message SynthesizeLongAudioMetadata
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1.SynthesizeLongAudioMetadata, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SynthesizeLongAudioMetadata to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SynthesizeLongAudioMetadata
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }
            }

            /** Namespace v1beta1. */
            namespace v1beta1 {

                /** Represents a TextToSpeech */
                class TextToSpeech extends $protobuf.rpc.Service {

                    /**
                     * Constructs a new TextToSpeech service.
                     * @param rpcImpl RPC implementation
                     * @param [requestDelimited=false] Whether requests are length-delimited
                     * @param [responseDelimited=false] Whether responses are length-delimited
                     */
                    constructor(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean);

                    /**
                     * Creates new TextToSpeech service using the specified rpc implementation.
                     * @param rpcImpl RPC implementation
                     * @param [requestDelimited=false] Whether requests are length-delimited
                     * @param [responseDelimited=false] Whether responses are length-delimited
                     * @returns RPC service. Useful where requests and/or responses are streamed.
                     */
                    public static create(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean): TextToSpeech;

                    /**
                     * Calls ListVoices.
                     * @param request ListVoicesRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and ListVoicesResponse
                     */
                    public listVoices(request: google.cloud.texttospeech.v1beta1.IListVoicesRequest, callback: google.cloud.texttospeech.v1beta1.TextToSpeech.ListVoicesCallback): void;

                    /**
                     * Calls ListVoices.
                     * @param request ListVoicesRequest message or plain object
                     * @returns Promise
                     */
                    public listVoices(request: google.cloud.texttospeech.v1beta1.IListVoicesRequest): Promise<google.cloud.texttospeech.v1beta1.ListVoicesResponse>;

                    /**
                     * Calls SynthesizeSpeech.
                     * @param request SynthesizeSpeechRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and SynthesizeSpeechResponse
                     */
                    public synthesizeSpeech(request: google.cloud.texttospeech.v1beta1.ISynthesizeSpeechRequest, callback: google.cloud.texttospeech.v1beta1.TextToSpeech.SynthesizeSpeechCallback): void;

                    /**
                     * Calls SynthesizeSpeech.
                     * @param request SynthesizeSpeechRequest message or plain object
                     * @returns Promise
                     */
                    public synthesizeSpeech(request: google.cloud.texttospeech.v1beta1.ISynthesizeSpeechRequest): Promise<google.cloud.texttospeech.v1beta1.SynthesizeSpeechResponse>;

                    /**
                     * Calls StreamingSynthesize.
                     * @param request StreamingSynthesizeRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and StreamingSynthesizeResponse
                     */
                    public streamingSynthesize(request: google.cloud.texttospeech.v1beta1.IStreamingSynthesizeRequest, callback: google.cloud.texttospeech.v1beta1.TextToSpeech.StreamingSynthesizeCallback): void;

                    /**
                     * Calls StreamingSynthesize.
                     * @param request StreamingSynthesizeRequest message or plain object
                     * @returns Promise
                     */
                    public streamingSynthesize(request: google.cloud.texttospeech.v1beta1.IStreamingSynthesizeRequest): Promise<google.cloud.texttospeech.v1beta1.StreamingSynthesizeResponse>;
                }

                namespace TextToSpeech {

                    /**
                     * Callback as used by {@link google.cloud.texttospeech.v1beta1.TextToSpeech|listVoices}.
                     * @param error Error, if any
                     * @param [response] ListVoicesResponse
                     */
                    type ListVoicesCallback = (error: (Error|null), response?: google.cloud.texttospeech.v1beta1.ListVoicesResponse) => void;

                    /**
                     * Callback as used by {@link google.cloud.texttospeech.v1beta1.TextToSpeech|synthesizeSpeech}.
                     * @param error Error, if any
                     * @param [response] SynthesizeSpeechResponse
                     */
                    type SynthesizeSpeechCallback = (error: (Error|null), response?: google.cloud.texttospeech.v1beta1.SynthesizeSpeechResponse) => void;

                    /**
                     * Callback as used by {@link google.cloud.texttospeech.v1beta1.TextToSpeech|streamingSynthesize}.
                     * @param error Error, if any
                     * @param [response] StreamingSynthesizeResponse
                     */
                    type StreamingSynthesizeCallback = (error: (Error|null), response?: google.cloud.texttospeech.v1beta1.StreamingSynthesizeResponse) => void;
                }

                /** SsmlVoiceGender enum. */
                enum SsmlVoiceGender {
                    SSML_VOICE_GENDER_UNSPECIFIED = 0,
                    MALE = 1,
                    FEMALE = 2,
                    NEUTRAL = 3
                }

                /** AudioEncoding enum. */
                enum AudioEncoding {
                    AUDIO_ENCODING_UNSPECIFIED = 0,
                    LINEAR16 = 1,
                    MP3 = 2,
                    MP3_64_KBPS = 4,
                    OGG_OPUS = 3,
                    MULAW = 5,
                    ALAW = 6,
                    PCM = 7,
                    M4A = 8
                }

                /** Properties of a ListVoicesRequest. */
                interface IListVoicesRequest {

                    /** ListVoicesRequest languageCode */
                    languageCode?: (string|null);
                }

                /** Represents a ListVoicesRequest. */
                class ListVoicesRequest implements IListVoicesRequest {

                    /**
                     * Constructs a new ListVoicesRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.IListVoicesRequest);

                    /** ListVoicesRequest languageCode. */
                    public languageCode: string;

                    /**
                     * Creates a new ListVoicesRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListVoicesRequest instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.IListVoicesRequest): google.cloud.texttospeech.v1beta1.ListVoicesRequest;

                    /**
                     * Encodes the specified ListVoicesRequest message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.ListVoicesRequest.verify|verify} messages.
                     * @param message ListVoicesRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.IListVoicesRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListVoicesRequest message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.ListVoicesRequest.verify|verify} messages.
                     * @param message ListVoicesRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.IListVoicesRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListVoicesRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListVoicesRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.ListVoicesRequest;

                    /**
                     * Decodes a ListVoicesRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListVoicesRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.ListVoicesRequest;

                    /**
                     * Verifies a ListVoicesRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListVoicesRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListVoicesRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.ListVoicesRequest;

                    /**
                     * Creates a plain object from a ListVoicesRequest message. Also converts values to other types if specified.
                     * @param message ListVoicesRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.ListVoicesRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListVoicesRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListVoicesRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListVoicesResponse. */
                interface IListVoicesResponse {

                    /** ListVoicesResponse voices */
                    voices?: (google.cloud.texttospeech.v1beta1.IVoice[]|null);
                }

                /** Represents a ListVoicesResponse. */
                class ListVoicesResponse implements IListVoicesResponse {

                    /**
                     * Constructs a new ListVoicesResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.IListVoicesResponse);

                    /** ListVoicesResponse voices. */
                    public voices: google.cloud.texttospeech.v1beta1.IVoice[];

                    /**
                     * Creates a new ListVoicesResponse instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListVoicesResponse instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.IListVoicesResponse): google.cloud.texttospeech.v1beta1.ListVoicesResponse;

                    /**
                     * Encodes the specified ListVoicesResponse message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.ListVoicesResponse.verify|verify} messages.
                     * @param message ListVoicesResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.IListVoicesResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListVoicesResponse message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.ListVoicesResponse.verify|verify} messages.
                     * @param message ListVoicesResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.IListVoicesResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListVoicesResponse message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListVoicesResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.ListVoicesResponse;

                    /**
                     * Decodes a ListVoicesResponse message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListVoicesResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.ListVoicesResponse;

                    /**
                     * Verifies a ListVoicesResponse message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListVoicesResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListVoicesResponse
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.ListVoicesResponse;

                    /**
                     * Creates a plain object from a ListVoicesResponse message. Also converts values to other types if specified.
                     * @param message ListVoicesResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.ListVoicesResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListVoicesResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListVoicesResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Voice. */
                interface IVoice {

                    /** Voice languageCodes */
                    languageCodes?: (string[]|null);

                    /** Voice name */
                    name?: (string|null);

                    /** Voice ssmlGender */
                    ssmlGender?: (google.cloud.texttospeech.v1beta1.SsmlVoiceGender|keyof typeof google.cloud.texttospeech.v1beta1.SsmlVoiceGender|null);

                    /** Voice naturalSampleRateHertz */
                    naturalSampleRateHertz?: (number|null);
                }

                /** Represents a Voice. */
                class Voice implements IVoice {

                    /**
                     * Constructs a new Voice.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.IVoice);

                    /** Voice languageCodes. */
                    public languageCodes: string[];

                    /** Voice name. */
                    public name: string;

                    /** Voice ssmlGender. */
                    public ssmlGender: (google.cloud.texttospeech.v1beta1.SsmlVoiceGender|keyof typeof google.cloud.texttospeech.v1beta1.SsmlVoiceGender);

                    /** Voice naturalSampleRateHertz. */
                    public naturalSampleRateHertz: number;

                    /**
                     * Creates a new Voice instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Voice instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.IVoice): google.cloud.texttospeech.v1beta1.Voice;

                    /**
                     * Encodes the specified Voice message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.Voice.verify|verify} messages.
                     * @param message Voice message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.IVoice, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Voice message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.Voice.verify|verify} messages.
                     * @param message Voice message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.IVoice, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Voice message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Voice
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.Voice;

                    /**
                     * Decodes a Voice message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Voice
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.Voice;

                    /**
                     * Verifies a Voice message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Voice message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Voice
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.Voice;

                    /**
                     * Creates a plain object from a Voice message. Also converts values to other types if specified.
                     * @param message Voice
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.Voice, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Voice to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Voice
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AdvancedVoiceOptions. */
                interface IAdvancedVoiceOptions {

                    /** AdvancedVoiceOptions lowLatencyJourneySynthesis */
                    lowLatencyJourneySynthesis?: (boolean|null);
                }

                /** Represents an AdvancedVoiceOptions. */
                class AdvancedVoiceOptions implements IAdvancedVoiceOptions {

                    /**
                     * Constructs a new AdvancedVoiceOptions.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.IAdvancedVoiceOptions);

                    /** AdvancedVoiceOptions lowLatencyJourneySynthesis. */
                    public lowLatencyJourneySynthesis?: (boolean|null);

                    /**
                     * Creates a new AdvancedVoiceOptions instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AdvancedVoiceOptions instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.IAdvancedVoiceOptions): google.cloud.texttospeech.v1beta1.AdvancedVoiceOptions;

                    /**
                     * Encodes the specified AdvancedVoiceOptions message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.AdvancedVoiceOptions.verify|verify} messages.
                     * @param message AdvancedVoiceOptions message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.IAdvancedVoiceOptions, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AdvancedVoiceOptions message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.AdvancedVoiceOptions.verify|verify} messages.
                     * @param message AdvancedVoiceOptions message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.IAdvancedVoiceOptions, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AdvancedVoiceOptions message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AdvancedVoiceOptions
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.AdvancedVoiceOptions;

                    /**
                     * Decodes an AdvancedVoiceOptions message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AdvancedVoiceOptions
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.AdvancedVoiceOptions;

                    /**
                     * Verifies an AdvancedVoiceOptions message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AdvancedVoiceOptions message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AdvancedVoiceOptions
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.AdvancedVoiceOptions;

                    /**
                     * Creates a plain object from an AdvancedVoiceOptions message. Also converts values to other types if specified.
                     * @param message AdvancedVoiceOptions
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.AdvancedVoiceOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AdvancedVoiceOptions to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AdvancedVoiceOptions
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SynthesizeSpeechRequest. */
                interface ISynthesizeSpeechRequest {

                    /** SynthesizeSpeechRequest input */
                    input?: (google.cloud.texttospeech.v1beta1.ISynthesisInput|null);

                    /** SynthesizeSpeechRequest voice */
                    voice?: (google.cloud.texttospeech.v1beta1.IVoiceSelectionParams|null);

                    /** SynthesizeSpeechRequest audioConfig */
                    audioConfig?: (google.cloud.texttospeech.v1beta1.IAudioConfig|null);

                    /** SynthesizeSpeechRequest enableTimePointing */
                    enableTimePointing?: (google.cloud.texttospeech.v1beta1.SynthesizeSpeechRequest.TimepointType[]|null);

                    /** SynthesizeSpeechRequest advancedVoiceOptions */
                    advancedVoiceOptions?: (google.cloud.texttospeech.v1beta1.IAdvancedVoiceOptions|null);
                }

                /** Represents a SynthesizeSpeechRequest. */
                class SynthesizeSpeechRequest implements ISynthesizeSpeechRequest {

                    /**
                     * Constructs a new SynthesizeSpeechRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.ISynthesizeSpeechRequest);

                    /** SynthesizeSpeechRequest input. */
                    public input?: (google.cloud.texttospeech.v1beta1.ISynthesisInput|null);

                    /** SynthesizeSpeechRequest voice. */
                    public voice?: (google.cloud.texttospeech.v1beta1.IVoiceSelectionParams|null);

                    /** SynthesizeSpeechRequest audioConfig. */
                    public audioConfig?: (google.cloud.texttospeech.v1beta1.IAudioConfig|null);

                    /** SynthesizeSpeechRequest enableTimePointing. */
                    public enableTimePointing: google.cloud.texttospeech.v1beta1.SynthesizeSpeechRequest.TimepointType[];

                    /** SynthesizeSpeechRequest advancedVoiceOptions. */
                    public advancedVoiceOptions?: (google.cloud.texttospeech.v1beta1.IAdvancedVoiceOptions|null);

                    /**
                     * Creates a new SynthesizeSpeechRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SynthesizeSpeechRequest instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.ISynthesizeSpeechRequest): google.cloud.texttospeech.v1beta1.SynthesizeSpeechRequest;

                    /**
                     * Encodes the specified SynthesizeSpeechRequest message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.SynthesizeSpeechRequest.verify|verify} messages.
                     * @param message SynthesizeSpeechRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.ISynthesizeSpeechRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SynthesizeSpeechRequest message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.SynthesizeSpeechRequest.verify|verify} messages.
                     * @param message SynthesizeSpeechRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.ISynthesizeSpeechRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SynthesizeSpeechRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SynthesizeSpeechRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.SynthesizeSpeechRequest;

                    /**
                     * Decodes a SynthesizeSpeechRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SynthesizeSpeechRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.SynthesizeSpeechRequest;

                    /**
                     * Verifies a SynthesizeSpeechRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SynthesizeSpeechRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SynthesizeSpeechRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.SynthesizeSpeechRequest;

                    /**
                     * Creates a plain object from a SynthesizeSpeechRequest message. Also converts values to other types if specified.
                     * @param message SynthesizeSpeechRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.SynthesizeSpeechRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SynthesizeSpeechRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SynthesizeSpeechRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                namespace SynthesizeSpeechRequest {

                    /** TimepointType enum. */
                    enum TimepointType {
                        TIMEPOINT_TYPE_UNSPECIFIED = 0,
                        SSML_MARK = 1
                    }
                }

                /** Properties of a CustomPronunciationParams. */
                interface ICustomPronunciationParams {

                    /** CustomPronunciationParams phrase */
                    phrase?: (string|null);

                    /** CustomPronunciationParams phoneticEncoding */
                    phoneticEncoding?: (google.cloud.texttospeech.v1beta1.CustomPronunciationParams.PhoneticEncoding|keyof typeof google.cloud.texttospeech.v1beta1.CustomPronunciationParams.PhoneticEncoding|null);

                    /** CustomPronunciationParams pronunciation */
                    pronunciation?: (string|null);
                }

                /** Represents a CustomPronunciationParams. */
                class CustomPronunciationParams implements ICustomPronunciationParams {

                    /**
                     * Constructs a new CustomPronunciationParams.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.ICustomPronunciationParams);

                    /** CustomPronunciationParams phrase. */
                    public phrase?: (string|null);

                    /** CustomPronunciationParams phoneticEncoding. */
                    public phoneticEncoding?: (google.cloud.texttospeech.v1beta1.CustomPronunciationParams.PhoneticEncoding|keyof typeof google.cloud.texttospeech.v1beta1.CustomPronunciationParams.PhoneticEncoding|null);

                    /** CustomPronunciationParams pronunciation. */
                    public pronunciation?: (string|null);

                    /**
                     * Creates a new CustomPronunciationParams instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CustomPronunciationParams instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.ICustomPronunciationParams): google.cloud.texttospeech.v1beta1.CustomPronunciationParams;

                    /**
                     * Encodes the specified CustomPronunciationParams message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.CustomPronunciationParams.verify|verify} messages.
                     * @param message CustomPronunciationParams message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.ICustomPronunciationParams, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CustomPronunciationParams message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.CustomPronunciationParams.verify|verify} messages.
                     * @param message CustomPronunciationParams message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.ICustomPronunciationParams, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CustomPronunciationParams message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CustomPronunciationParams
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.CustomPronunciationParams;

                    /**
                     * Decodes a CustomPronunciationParams message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CustomPronunciationParams
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.CustomPronunciationParams;

                    /**
                     * Verifies a CustomPronunciationParams message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CustomPronunciationParams message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CustomPronunciationParams
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.CustomPronunciationParams;

                    /**
                     * Creates a plain object from a CustomPronunciationParams message. Also converts values to other types if specified.
                     * @param message CustomPronunciationParams
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.CustomPronunciationParams, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CustomPronunciationParams to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CustomPronunciationParams
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                namespace CustomPronunciationParams {

                    /** PhoneticEncoding enum. */
                    enum PhoneticEncoding {
                        PHONETIC_ENCODING_UNSPECIFIED = 0,
                        PHONETIC_ENCODING_IPA = 1,
                        PHONETIC_ENCODING_X_SAMPA = 2,
                        PHONETIC_ENCODING_JAPANESE_YOMIGANA = 3,
                        PHONETIC_ENCODING_PINYIN = 4
                    }
                }

                /** Properties of a CustomPronunciations. */
                interface ICustomPronunciations {

                    /** CustomPronunciations pronunciations */
                    pronunciations?: (google.cloud.texttospeech.v1beta1.ICustomPronunciationParams[]|null);
                }

                /** Represents a CustomPronunciations. */
                class CustomPronunciations implements ICustomPronunciations {

                    /**
                     * Constructs a new CustomPronunciations.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.ICustomPronunciations);

                    /** CustomPronunciations pronunciations. */
                    public pronunciations: google.cloud.texttospeech.v1beta1.ICustomPronunciationParams[];

                    /**
                     * Creates a new CustomPronunciations instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CustomPronunciations instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.ICustomPronunciations): google.cloud.texttospeech.v1beta1.CustomPronunciations;

                    /**
                     * Encodes the specified CustomPronunciations message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.CustomPronunciations.verify|verify} messages.
                     * @param message CustomPronunciations message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.ICustomPronunciations, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CustomPronunciations message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.CustomPronunciations.verify|verify} messages.
                     * @param message CustomPronunciations message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.ICustomPronunciations, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CustomPronunciations message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CustomPronunciations
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.CustomPronunciations;

                    /**
                     * Decodes a CustomPronunciations message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CustomPronunciations
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.CustomPronunciations;

                    /**
                     * Verifies a CustomPronunciations message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CustomPronunciations message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CustomPronunciations
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.CustomPronunciations;

                    /**
                     * Creates a plain object from a CustomPronunciations message. Also converts values to other types if specified.
                     * @param message CustomPronunciations
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.CustomPronunciations, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CustomPronunciations to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CustomPronunciations
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a MultiSpeakerMarkup. */
                interface IMultiSpeakerMarkup {

                    /** MultiSpeakerMarkup turns */
                    turns?: (google.cloud.texttospeech.v1beta1.MultiSpeakerMarkup.ITurn[]|null);
                }

                /** Represents a MultiSpeakerMarkup. */
                class MultiSpeakerMarkup implements IMultiSpeakerMarkup {

                    /**
                     * Constructs a new MultiSpeakerMarkup.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.IMultiSpeakerMarkup);

                    /** MultiSpeakerMarkup turns. */
                    public turns: google.cloud.texttospeech.v1beta1.MultiSpeakerMarkup.ITurn[];

                    /**
                     * Creates a new MultiSpeakerMarkup instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns MultiSpeakerMarkup instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.IMultiSpeakerMarkup): google.cloud.texttospeech.v1beta1.MultiSpeakerMarkup;

                    /**
                     * Encodes the specified MultiSpeakerMarkup message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.MultiSpeakerMarkup.verify|verify} messages.
                     * @param message MultiSpeakerMarkup message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.IMultiSpeakerMarkup, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified MultiSpeakerMarkup message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.MultiSpeakerMarkup.verify|verify} messages.
                     * @param message MultiSpeakerMarkup message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.IMultiSpeakerMarkup, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a MultiSpeakerMarkup message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns MultiSpeakerMarkup
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.MultiSpeakerMarkup;

                    /**
                     * Decodes a MultiSpeakerMarkup message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns MultiSpeakerMarkup
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.MultiSpeakerMarkup;

                    /**
                     * Verifies a MultiSpeakerMarkup message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a MultiSpeakerMarkup message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns MultiSpeakerMarkup
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.MultiSpeakerMarkup;

                    /**
                     * Creates a plain object from a MultiSpeakerMarkup message. Also converts values to other types if specified.
                     * @param message MultiSpeakerMarkup
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.MultiSpeakerMarkup, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this MultiSpeakerMarkup to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for MultiSpeakerMarkup
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                namespace MultiSpeakerMarkup {

                    /** Properties of a Turn. */
                    interface ITurn {

                        /** Turn speaker */
                        speaker?: (string|null);

                        /** Turn text */
                        text?: (string|null);
                    }

                    /** Represents a Turn. */
                    class Turn implements ITurn {

                        /**
                         * Constructs a new Turn.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: google.cloud.texttospeech.v1beta1.MultiSpeakerMarkup.ITurn);

                        /** Turn speaker. */
                        public speaker: string;

                        /** Turn text. */
                        public text: string;

                        /**
                         * Creates a new Turn instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns Turn instance
                         */
                        public static create(properties?: google.cloud.texttospeech.v1beta1.MultiSpeakerMarkup.ITurn): google.cloud.texttospeech.v1beta1.MultiSpeakerMarkup.Turn;

                        /**
                         * Encodes the specified Turn message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.MultiSpeakerMarkup.Turn.verify|verify} messages.
                         * @param message Turn message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: google.cloud.texttospeech.v1beta1.MultiSpeakerMarkup.ITurn, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified Turn message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.MultiSpeakerMarkup.Turn.verify|verify} messages.
                         * @param message Turn message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.MultiSpeakerMarkup.ITurn, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a Turn message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns Turn
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.MultiSpeakerMarkup.Turn;

                        /**
                         * Decodes a Turn message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns Turn
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.MultiSpeakerMarkup.Turn;

                        /**
                         * Verifies a Turn message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a Turn message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns Turn
                         */
                        public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.MultiSpeakerMarkup.Turn;

                        /**
                         * Creates a plain object from a Turn message. Also converts values to other types if specified.
                         * @param message Turn
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: google.cloud.texttospeech.v1beta1.MultiSpeakerMarkup.Turn, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this Turn to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for Turn
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }
                }

                /** Properties of a MultispeakerPrebuiltVoice. */
                interface IMultispeakerPrebuiltVoice {

                    /** MultispeakerPrebuiltVoice speakerAlias */
                    speakerAlias?: (string|null);

                    /** MultispeakerPrebuiltVoice speakerId */
                    speakerId?: (string|null);
                }

                /** Represents a MultispeakerPrebuiltVoice. */
                class MultispeakerPrebuiltVoice implements IMultispeakerPrebuiltVoice {

                    /**
                     * Constructs a new MultispeakerPrebuiltVoice.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.IMultispeakerPrebuiltVoice);

                    /** MultispeakerPrebuiltVoice speakerAlias. */
                    public speakerAlias: string;

                    /** MultispeakerPrebuiltVoice speakerId. */
                    public speakerId: string;

                    /**
                     * Creates a new MultispeakerPrebuiltVoice instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns MultispeakerPrebuiltVoice instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.IMultispeakerPrebuiltVoice): google.cloud.texttospeech.v1beta1.MultispeakerPrebuiltVoice;

                    /**
                     * Encodes the specified MultispeakerPrebuiltVoice message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.MultispeakerPrebuiltVoice.verify|verify} messages.
                     * @param message MultispeakerPrebuiltVoice message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.IMultispeakerPrebuiltVoice, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified MultispeakerPrebuiltVoice message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.MultispeakerPrebuiltVoice.verify|verify} messages.
                     * @param message MultispeakerPrebuiltVoice message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.IMultispeakerPrebuiltVoice, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a MultispeakerPrebuiltVoice message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns MultispeakerPrebuiltVoice
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.MultispeakerPrebuiltVoice;

                    /**
                     * Decodes a MultispeakerPrebuiltVoice message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns MultispeakerPrebuiltVoice
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.MultispeakerPrebuiltVoice;

                    /**
                     * Verifies a MultispeakerPrebuiltVoice message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a MultispeakerPrebuiltVoice message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns MultispeakerPrebuiltVoice
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.MultispeakerPrebuiltVoice;

                    /**
                     * Creates a plain object from a MultispeakerPrebuiltVoice message. Also converts values to other types if specified.
                     * @param message MultispeakerPrebuiltVoice
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.MultispeakerPrebuiltVoice, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this MultispeakerPrebuiltVoice to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for MultispeakerPrebuiltVoice
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a MultiSpeakerVoiceConfig. */
                interface IMultiSpeakerVoiceConfig {

                    /** MultiSpeakerVoiceConfig speakerVoiceConfigs */
                    speakerVoiceConfigs?: (google.cloud.texttospeech.v1beta1.IMultispeakerPrebuiltVoice[]|null);
                }

                /** Represents a MultiSpeakerVoiceConfig. */
                class MultiSpeakerVoiceConfig implements IMultiSpeakerVoiceConfig {

                    /**
                     * Constructs a new MultiSpeakerVoiceConfig.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.IMultiSpeakerVoiceConfig);

                    /** MultiSpeakerVoiceConfig speakerVoiceConfigs. */
                    public speakerVoiceConfigs: google.cloud.texttospeech.v1beta1.IMultispeakerPrebuiltVoice[];

                    /**
                     * Creates a new MultiSpeakerVoiceConfig instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns MultiSpeakerVoiceConfig instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.IMultiSpeakerVoiceConfig): google.cloud.texttospeech.v1beta1.MultiSpeakerVoiceConfig;

                    /**
                     * Encodes the specified MultiSpeakerVoiceConfig message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.MultiSpeakerVoiceConfig.verify|verify} messages.
                     * @param message MultiSpeakerVoiceConfig message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.IMultiSpeakerVoiceConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified MultiSpeakerVoiceConfig message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.MultiSpeakerVoiceConfig.verify|verify} messages.
                     * @param message MultiSpeakerVoiceConfig message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.IMultiSpeakerVoiceConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a MultiSpeakerVoiceConfig message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns MultiSpeakerVoiceConfig
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.MultiSpeakerVoiceConfig;

                    /**
                     * Decodes a MultiSpeakerVoiceConfig message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns MultiSpeakerVoiceConfig
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.MultiSpeakerVoiceConfig;

                    /**
                     * Verifies a MultiSpeakerVoiceConfig message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a MultiSpeakerVoiceConfig message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns MultiSpeakerVoiceConfig
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.MultiSpeakerVoiceConfig;

                    /**
                     * Creates a plain object from a MultiSpeakerVoiceConfig message. Also converts values to other types if specified.
                     * @param message MultiSpeakerVoiceConfig
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.MultiSpeakerVoiceConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this MultiSpeakerVoiceConfig to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for MultiSpeakerVoiceConfig
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SynthesisInput. */
                interface ISynthesisInput {

                    /** SynthesisInput text */
                    text?: (string|null);

                    /** SynthesisInput markup */
                    markup?: (string|null);

                    /** SynthesisInput ssml */
                    ssml?: (string|null);

                    /** SynthesisInput multiSpeakerMarkup */
                    multiSpeakerMarkup?: (google.cloud.texttospeech.v1beta1.IMultiSpeakerMarkup|null);

                    /** SynthesisInput prompt */
                    prompt?: (string|null);

                    /** SynthesisInput customPronunciations */
                    customPronunciations?: (google.cloud.texttospeech.v1beta1.ICustomPronunciations|null);
                }

                /** Represents a SynthesisInput. */
                class SynthesisInput implements ISynthesisInput {

                    /**
                     * Constructs a new SynthesisInput.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.ISynthesisInput);

                    /** SynthesisInput text. */
                    public text?: (string|null);

                    /** SynthesisInput markup. */
                    public markup?: (string|null);

                    /** SynthesisInput ssml. */
                    public ssml?: (string|null);

                    /** SynthesisInput multiSpeakerMarkup. */
                    public multiSpeakerMarkup?: (google.cloud.texttospeech.v1beta1.IMultiSpeakerMarkup|null);

                    /** SynthesisInput prompt. */
                    public prompt?: (string|null);

                    /** SynthesisInput customPronunciations. */
                    public customPronunciations?: (google.cloud.texttospeech.v1beta1.ICustomPronunciations|null);

                    /** SynthesisInput inputSource. */
                    public inputSource?: ("text"|"markup"|"ssml"|"multiSpeakerMarkup");

                    /**
                     * Creates a new SynthesisInput instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SynthesisInput instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.ISynthesisInput): google.cloud.texttospeech.v1beta1.SynthesisInput;

                    /**
                     * Encodes the specified SynthesisInput message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.SynthesisInput.verify|verify} messages.
                     * @param message SynthesisInput message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.ISynthesisInput, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SynthesisInput message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.SynthesisInput.verify|verify} messages.
                     * @param message SynthesisInput message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.ISynthesisInput, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SynthesisInput message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SynthesisInput
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.SynthesisInput;

                    /**
                     * Decodes a SynthesisInput message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SynthesisInput
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.SynthesisInput;

                    /**
                     * Verifies a SynthesisInput message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SynthesisInput message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SynthesisInput
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.SynthesisInput;

                    /**
                     * Creates a plain object from a SynthesisInput message. Also converts values to other types if specified.
                     * @param message SynthesisInput
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.SynthesisInput, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SynthesisInput to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SynthesisInput
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a VoiceSelectionParams. */
                interface IVoiceSelectionParams {

                    /** VoiceSelectionParams languageCode */
                    languageCode?: (string|null);

                    /** VoiceSelectionParams name */
                    name?: (string|null);

                    /** VoiceSelectionParams ssmlGender */
                    ssmlGender?: (google.cloud.texttospeech.v1beta1.SsmlVoiceGender|keyof typeof google.cloud.texttospeech.v1beta1.SsmlVoiceGender|null);

                    /** VoiceSelectionParams customVoice */
                    customVoice?: (google.cloud.texttospeech.v1beta1.ICustomVoiceParams|null);

                    /** VoiceSelectionParams voiceClone */
                    voiceClone?: (google.cloud.texttospeech.v1beta1.IVoiceCloneParams|null);

                    /** VoiceSelectionParams modelName */
                    modelName?: (string|null);

                    /** VoiceSelectionParams multiSpeakerVoiceConfig */
                    multiSpeakerVoiceConfig?: (google.cloud.texttospeech.v1beta1.IMultiSpeakerVoiceConfig|null);
                }

                /** Represents a VoiceSelectionParams. */
                class VoiceSelectionParams implements IVoiceSelectionParams {

                    /**
                     * Constructs a new VoiceSelectionParams.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.IVoiceSelectionParams);

                    /** VoiceSelectionParams languageCode. */
                    public languageCode: string;

                    /** VoiceSelectionParams name. */
                    public name: string;

                    /** VoiceSelectionParams ssmlGender. */
                    public ssmlGender: (google.cloud.texttospeech.v1beta1.SsmlVoiceGender|keyof typeof google.cloud.texttospeech.v1beta1.SsmlVoiceGender);

                    /** VoiceSelectionParams customVoice. */
                    public customVoice?: (google.cloud.texttospeech.v1beta1.ICustomVoiceParams|null);

                    /** VoiceSelectionParams voiceClone. */
                    public voiceClone?: (google.cloud.texttospeech.v1beta1.IVoiceCloneParams|null);

                    /** VoiceSelectionParams modelName. */
                    public modelName: string;

                    /** VoiceSelectionParams multiSpeakerVoiceConfig. */
                    public multiSpeakerVoiceConfig?: (google.cloud.texttospeech.v1beta1.IMultiSpeakerVoiceConfig|null);

                    /**
                     * Creates a new VoiceSelectionParams instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns VoiceSelectionParams instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.IVoiceSelectionParams): google.cloud.texttospeech.v1beta1.VoiceSelectionParams;

                    /**
                     * Encodes the specified VoiceSelectionParams message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.VoiceSelectionParams.verify|verify} messages.
                     * @param message VoiceSelectionParams message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.IVoiceSelectionParams, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified VoiceSelectionParams message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.VoiceSelectionParams.verify|verify} messages.
                     * @param message VoiceSelectionParams message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.IVoiceSelectionParams, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a VoiceSelectionParams message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns VoiceSelectionParams
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.VoiceSelectionParams;

                    /**
                     * Decodes a VoiceSelectionParams message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns VoiceSelectionParams
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.VoiceSelectionParams;

                    /**
                     * Verifies a VoiceSelectionParams message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a VoiceSelectionParams message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns VoiceSelectionParams
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.VoiceSelectionParams;

                    /**
                     * Creates a plain object from a VoiceSelectionParams message. Also converts values to other types if specified.
                     * @param message VoiceSelectionParams
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.VoiceSelectionParams, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this VoiceSelectionParams to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for VoiceSelectionParams
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AudioConfig. */
                interface IAudioConfig {

                    /** AudioConfig audioEncoding */
                    audioEncoding?: (google.cloud.texttospeech.v1beta1.AudioEncoding|keyof typeof google.cloud.texttospeech.v1beta1.AudioEncoding|null);

                    /** AudioConfig speakingRate */
                    speakingRate?: (number|null);

                    /** AudioConfig pitch */
                    pitch?: (number|null);

                    /** AudioConfig volumeGainDb */
                    volumeGainDb?: (number|null);

                    /** AudioConfig sampleRateHertz */
                    sampleRateHertz?: (number|null);

                    /** AudioConfig effectsProfileId */
                    effectsProfileId?: (string[]|null);
                }

                /** Represents an AudioConfig. */
                class AudioConfig implements IAudioConfig {

                    /**
                     * Constructs a new AudioConfig.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.IAudioConfig);

                    /** AudioConfig audioEncoding. */
                    public audioEncoding: (google.cloud.texttospeech.v1beta1.AudioEncoding|keyof typeof google.cloud.texttospeech.v1beta1.AudioEncoding);

                    /** AudioConfig speakingRate. */
                    public speakingRate: number;

                    /** AudioConfig pitch. */
                    public pitch: number;

                    /** AudioConfig volumeGainDb. */
                    public volumeGainDb: number;

                    /** AudioConfig sampleRateHertz. */
                    public sampleRateHertz: number;

                    /** AudioConfig effectsProfileId. */
                    public effectsProfileId: string[];

                    /**
                     * Creates a new AudioConfig instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AudioConfig instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.IAudioConfig): google.cloud.texttospeech.v1beta1.AudioConfig;

                    /**
                     * Encodes the specified AudioConfig message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.AudioConfig.verify|verify} messages.
                     * @param message AudioConfig message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.IAudioConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AudioConfig message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.AudioConfig.verify|verify} messages.
                     * @param message AudioConfig message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.IAudioConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AudioConfig message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AudioConfig
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.AudioConfig;

                    /**
                     * Decodes an AudioConfig message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AudioConfig
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.AudioConfig;

                    /**
                     * Verifies an AudioConfig message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AudioConfig message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AudioConfig
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.AudioConfig;

                    /**
                     * Creates a plain object from an AudioConfig message. Also converts values to other types if specified.
                     * @param message AudioConfig
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.AudioConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AudioConfig to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AudioConfig
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CustomVoiceParams. */
                interface ICustomVoiceParams {

                    /** CustomVoiceParams model */
                    model?: (string|null);

                    /** CustomVoiceParams reportedUsage */
                    reportedUsage?: (google.cloud.texttospeech.v1beta1.CustomVoiceParams.ReportedUsage|keyof typeof google.cloud.texttospeech.v1beta1.CustomVoiceParams.ReportedUsage|null);
                }

                /** Represents a CustomVoiceParams. */
                class CustomVoiceParams implements ICustomVoiceParams {

                    /**
                     * Constructs a new CustomVoiceParams.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.ICustomVoiceParams);

                    /** CustomVoiceParams model. */
                    public model: string;

                    /** CustomVoiceParams reportedUsage. */
                    public reportedUsage: (google.cloud.texttospeech.v1beta1.CustomVoiceParams.ReportedUsage|keyof typeof google.cloud.texttospeech.v1beta1.CustomVoiceParams.ReportedUsage);

                    /**
                     * Creates a new CustomVoiceParams instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CustomVoiceParams instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.ICustomVoiceParams): google.cloud.texttospeech.v1beta1.CustomVoiceParams;

                    /**
                     * Encodes the specified CustomVoiceParams message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.CustomVoiceParams.verify|verify} messages.
                     * @param message CustomVoiceParams message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.ICustomVoiceParams, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CustomVoiceParams message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.CustomVoiceParams.verify|verify} messages.
                     * @param message CustomVoiceParams message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.ICustomVoiceParams, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CustomVoiceParams message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CustomVoiceParams
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.CustomVoiceParams;

                    /**
                     * Decodes a CustomVoiceParams message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CustomVoiceParams
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.CustomVoiceParams;

                    /**
                     * Verifies a CustomVoiceParams message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CustomVoiceParams message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CustomVoiceParams
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.CustomVoiceParams;

                    /**
                     * Creates a plain object from a CustomVoiceParams message. Also converts values to other types if specified.
                     * @param message CustomVoiceParams
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.CustomVoiceParams, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CustomVoiceParams to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CustomVoiceParams
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                namespace CustomVoiceParams {

                    /** ReportedUsage enum. */
                    enum ReportedUsage {
                        REPORTED_USAGE_UNSPECIFIED = 0,
                        REALTIME = 1,
                        OFFLINE = 2
                    }
                }

                /** Properties of a VoiceCloneParams. */
                interface IVoiceCloneParams {

                    /** VoiceCloneParams voiceCloningKey */
                    voiceCloningKey?: (string|null);
                }

                /** Represents a VoiceCloneParams. */
                class VoiceCloneParams implements IVoiceCloneParams {

                    /**
                     * Constructs a new VoiceCloneParams.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.IVoiceCloneParams);

                    /** VoiceCloneParams voiceCloningKey. */
                    public voiceCloningKey: string;

                    /**
                     * Creates a new VoiceCloneParams instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns VoiceCloneParams instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.IVoiceCloneParams): google.cloud.texttospeech.v1beta1.VoiceCloneParams;

                    /**
                     * Encodes the specified VoiceCloneParams message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.VoiceCloneParams.verify|verify} messages.
                     * @param message VoiceCloneParams message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.IVoiceCloneParams, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified VoiceCloneParams message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.VoiceCloneParams.verify|verify} messages.
                     * @param message VoiceCloneParams message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.IVoiceCloneParams, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a VoiceCloneParams message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns VoiceCloneParams
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.VoiceCloneParams;

                    /**
                     * Decodes a VoiceCloneParams message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns VoiceCloneParams
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.VoiceCloneParams;

                    /**
                     * Verifies a VoiceCloneParams message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a VoiceCloneParams message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns VoiceCloneParams
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.VoiceCloneParams;

                    /**
                     * Creates a plain object from a VoiceCloneParams message. Also converts values to other types if specified.
                     * @param message VoiceCloneParams
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.VoiceCloneParams, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this VoiceCloneParams to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for VoiceCloneParams
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SynthesizeSpeechResponse. */
                interface ISynthesizeSpeechResponse {

                    /** SynthesizeSpeechResponse audioContent */
                    audioContent?: (Uint8Array|Buffer|string|null);

                    /** SynthesizeSpeechResponse timepoints */
                    timepoints?: (google.cloud.texttospeech.v1beta1.ITimepoint[]|null);

                    /** SynthesizeSpeechResponse audioConfig */
                    audioConfig?: (google.cloud.texttospeech.v1beta1.IAudioConfig|null);
                }

                /** Represents a SynthesizeSpeechResponse. */
                class SynthesizeSpeechResponse implements ISynthesizeSpeechResponse {

                    /**
                     * Constructs a new SynthesizeSpeechResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.ISynthesizeSpeechResponse);

                    /** SynthesizeSpeechResponse audioContent. */
                    public audioContent: (Uint8Array|Buffer|string);

                    /** SynthesizeSpeechResponse timepoints. */
                    public timepoints: google.cloud.texttospeech.v1beta1.ITimepoint[];

                    /** SynthesizeSpeechResponse audioConfig. */
                    public audioConfig?: (google.cloud.texttospeech.v1beta1.IAudioConfig|null);

                    /**
                     * Creates a new SynthesizeSpeechResponse instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SynthesizeSpeechResponse instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.ISynthesizeSpeechResponse): google.cloud.texttospeech.v1beta1.SynthesizeSpeechResponse;

                    /**
                     * Encodes the specified SynthesizeSpeechResponse message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.SynthesizeSpeechResponse.verify|verify} messages.
                     * @param message SynthesizeSpeechResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.ISynthesizeSpeechResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SynthesizeSpeechResponse message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.SynthesizeSpeechResponse.verify|verify} messages.
                     * @param message SynthesizeSpeechResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.ISynthesizeSpeechResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SynthesizeSpeechResponse message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SynthesizeSpeechResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.SynthesizeSpeechResponse;

                    /**
                     * Decodes a SynthesizeSpeechResponse message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SynthesizeSpeechResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.SynthesizeSpeechResponse;

                    /**
                     * Verifies a SynthesizeSpeechResponse message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SynthesizeSpeechResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SynthesizeSpeechResponse
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.SynthesizeSpeechResponse;

                    /**
                     * Creates a plain object from a SynthesizeSpeechResponse message. Also converts values to other types if specified.
                     * @param message SynthesizeSpeechResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.SynthesizeSpeechResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SynthesizeSpeechResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SynthesizeSpeechResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Timepoint. */
                interface ITimepoint {

                    /** Timepoint markName */
                    markName?: (string|null);

                    /** Timepoint timeSeconds */
                    timeSeconds?: (number|null);
                }

                /** Represents a Timepoint. */
                class Timepoint implements ITimepoint {

                    /**
                     * Constructs a new Timepoint.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.ITimepoint);

                    /** Timepoint markName. */
                    public markName: string;

                    /** Timepoint timeSeconds. */
                    public timeSeconds: number;

                    /**
                     * Creates a new Timepoint instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Timepoint instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.ITimepoint): google.cloud.texttospeech.v1beta1.Timepoint;

                    /**
                     * Encodes the specified Timepoint message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.Timepoint.verify|verify} messages.
                     * @param message Timepoint message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.ITimepoint, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Timepoint message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.Timepoint.verify|verify} messages.
                     * @param message Timepoint message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.ITimepoint, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Timepoint message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Timepoint
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.Timepoint;

                    /**
                     * Decodes a Timepoint message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Timepoint
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.Timepoint;

                    /**
                     * Verifies a Timepoint message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Timepoint message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Timepoint
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.Timepoint;

                    /**
                     * Creates a plain object from a Timepoint message. Also converts values to other types if specified.
                     * @param message Timepoint
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.Timepoint, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Timepoint to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Timepoint
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a StreamingAudioConfig. */
                interface IStreamingAudioConfig {

                    /** StreamingAudioConfig audioEncoding */
                    audioEncoding?: (google.cloud.texttospeech.v1beta1.AudioEncoding|keyof typeof google.cloud.texttospeech.v1beta1.AudioEncoding|null);

                    /** StreamingAudioConfig sampleRateHertz */
                    sampleRateHertz?: (number|null);

                    /** StreamingAudioConfig speakingRate */
                    speakingRate?: (number|null);
                }

                /** Represents a StreamingAudioConfig. */
                class StreamingAudioConfig implements IStreamingAudioConfig {

                    /**
                     * Constructs a new StreamingAudioConfig.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.IStreamingAudioConfig);

                    /** StreamingAudioConfig audioEncoding. */
                    public audioEncoding: (google.cloud.texttospeech.v1beta1.AudioEncoding|keyof typeof google.cloud.texttospeech.v1beta1.AudioEncoding);

                    /** StreamingAudioConfig sampleRateHertz. */
                    public sampleRateHertz: number;

                    /** StreamingAudioConfig speakingRate. */
                    public speakingRate: number;

                    /**
                     * Creates a new StreamingAudioConfig instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns StreamingAudioConfig instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.IStreamingAudioConfig): google.cloud.texttospeech.v1beta1.StreamingAudioConfig;

                    /**
                     * Encodes the specified StreamingAudioConfig message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.StreamingAudioConfig.verify|verify} messages.
                     * @param message StreamingAudioConfig message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.IStreamingAudioConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified StreamingAudioConfig message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.StreamingAudioConfig.verify|verify} messages.
                     * @param message StreamingAudioConfig message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.IStreamingAudioConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a StreamingAudioConfig message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns StreamingAudioConfig
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.StreamingAudioConfig;

                    /**
                     * Decodes a StreamingAudioConfig message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns StreamingAudioConfig
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.StreamingAudioConfig;

                    /**
                     * Verifies a StreamingAudioConfig message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a StreamingAudioConfig message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns StreamingAudioConfig
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.StreamingAudioConfig;

                    /**
                     * Creates a plain object from a StreamingAudioConfig message. Also converts values to other types if specified.
                     * @param message StreamingAudioConfig
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.StreamingAudioConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this StreamingAudioConfig to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for StreamingAudioConfig
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a StreamingSynthesizeConfig. */
                interface IStreamingSynthesizeConfig {

                    /** StreamingSynthesizeConfig voice */
                    voice?: (google.cloud.texttospeech.v1beta1.IVoiceSelectionParams|null);

                    /** StreamingSynthesizeConfig streamingAudioConfig */
                    streamingAudioConfig?: (google.cloud.texttospeech.v1beta1.IStreamingAudioConfig|null);

                    /** StreamingSynthesizeConfig customPronunciations */
                    customPronunciations?: (google.cloud.texttospeech.v1beta1.ICustomPronunciations|null);
                }

                /** Represents a StreamingSynthesizeConfig. */
                class StreamingSynthesizeConfig implements IStreamingSynthesizeConfig {

                    /**
                     * Constructs a new StreamingSynthesizeConfig.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.IStreamingSynthesizeConfig);

                    /** StreamingSynthesizeConfig voice. */
                    public voice?: (google.cloud.texttospeech.v1beta1.IVoiceSelectionParams|null);

                    /** StreamingSynthesizeConfig streamingAudioConfig. */
                    public streamingAudioConfig?: (google.cloud.texttospeech.v1beta1.IStreamingAudioConfig|null);

                    /** StreamingSynthesizeConfig customPronunciations. */
                    public customPronunciations?: (google.cloud.texttospeech.v1beta1.ICustomPronunciations|null);

                    /**
                     * Creates a new StreamingSynthesizeConfig instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns StreamingSynthesizeConfig instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.IStreamingSynthesizeConfig): google.cloud.texttospeech.v1beta1.StreamingSynthesizeConfig;

                    /**
                     * Encodes the specified StreamingSynthesizeConfig message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.StreamingSynthesizeConfig.verify|verify} messages.
                     * @param message StreamingSynthesizeConfig message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.IStreamingSynthesizeConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified StreamingSynthesizeConfig message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.StreamingSynthesizeConfig.verify|verify} messages.
                     * @param message StreamingSynthesizeConfig message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.IStreamingSynthesizeConfig, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a StreamingSynthesizeConfig message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns StreamingSynthesizeConfig
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.StreamingSynthesizeConfig;

                    /**
                     * Decodes a StreamingSynthesizeConfig message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns StreamingSynthesizeConfig
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.StreamingSynthesizeConfig;

                    /**
                     * Verifies a StreamingSynthesizeConfig message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a StreamingSynthesizeConfig message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns StreamingSynthesizeConfig
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.StreamingSynthesizeConfig;

                    /**
                     * Creates a plain object from a StreamingSynthesizeConfig message. Also converts values to other types if specified.
                     * @param message StreamingSynthesizeConfig
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.StreamingSynthesizeConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this StreamingSynthesizeConfig to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for StreamingSynthesizeConfig
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a StreamingSynthesisInput. */
                interface IStreamingSynthesisInput {

                    /** StreamingSynthesisInput text */
                    text?: (string|null);

                    /** StreamingSynthesisInput markup */
                    markup?: (string|null);

                    /** StreamingSynthesisInput multiSpeakerMarkup */
                    multiSpeakerMarkup?: (google.cloud.texttospeech.v1beta1.IMultiSpeakerMarkup|null);

                    /** StreamingSynthesisInput prompt */
                    prompt?: (string|null);
                }

                /** Represents a StreamingSynthesisInput. */
                class StreamingSynthesisInput implements IStreamingSynthesisInput {

                    /**
                     * Constructs a new StreamingSynthesisInput.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.IStreamingSynthesisInput);

                    /** StreamingSynthesisInput text. */
                    public text?: (string|null);

                    /** StreamingSynthesisInput markup. */
                    public markup?: (string|null);

                    /** StreamingSynthesisInput multiSpeakerMarkup. */
                    public multiSpeakerMarkup?: (google.cloud.texttospeech.v1beta1.IMultiSpeakerMarkup|null);

                    /** StreamingSynthesisInput prompt. */
                    public prompt?: (string|null);

                    /** StreamingSynthesisInput inputSource. */
                    public inputSource?: ("text"|"markup"|"multiSpeakerMarkup");

                    /**
                     * Creates a new StreamingSynthesisInput instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns StreamingSynthesisInput instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.IStreamingSynthesisInput): google.cloud.texttospeech.v1beta1.StreamingSynthesisInput;

                    /**
                     * Encodes the specified StreamingSynthesisInput message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.StreamingSynthesisInput.verify|verify} messages.
                     * @param message StreamingSynthesisInput message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.IStreamingSynthesisInput, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified StreamingSynthesisInput message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.StreamingSynthesisInput.verify|verify} messages.
                     * @param message StreamingSynthesisInput message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.IStreamingSynthesisInput, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a StreamingSynthesisInput message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns StreamingSynthesisInput
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.StreamingSynthesisInput;

                    /**
                     * Decodes a StreamingSynthesisInput message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns StreamingSynthesisInput
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.StreamingSynthesisInput;

                    /**
                     * Verifies a StreamingSynthesisInput message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a StreamingSynthesisInput message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns StreamingSynthesisInput
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.StreamingSynthesisInput;

                    /**
                     * Creates a plain object from a StreamingSynthesisInput message. Also converts values to other types if specified.
                     * @param message StreamingSynthesisInput
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.StreamingSynthesisInput, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this StreamingSynthesisInput to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for StreamingSynthesisInput
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a StreamingSynthesizeRequest. */
                interface IStreamingSynthesizeRequest {

                    /** StreamingSynthesizeRequest streamingConfig */
                    streamingConfig?: (google.cloud.texttospeech.v1beta1.IStreamingSynthesizeConfig|null);

                    /** StreamingSynthesizeRequest input */
                    input?: (google.cloud.texttospeech.v1beta1.IStreamingSynthesisInput|null);
                }

                /** Represents a StreamingSynthesizeRequest. */
                class StreamingSynthesizeRequest implements IStreamingSynthesizeRequest {

                    /**
                     * Constructs a new StreamingSynthesizeRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.IStreamingSynthesizeRequest);

                    /** StreamingSynthesizeRequest streamingConfig. */
                    public streamingConfig?: (google.cloud.texttospeech.v1beta1.IStreamingSynthesizeConfig|null);

                    /** StreamingSynthesizeRequest input. */
                    public input?: (google.cloud.texttospeech.v1beta1.IStreamingSynthesisInput|null);

                    /** StreamingSynthesizeRequest streamingRequest. */
                    public streamingRequest?: ("streamingConfig"|"input");

                    /**
                     * Creates a new StreamingSynthesizeRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns StreamingSynthesizeRequest instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.IStreamingSynthesizeRequest): google.cloud.texttospeech.v1beta1.StreamingSynthesizeRequest;

                    /**
                     * Encodes the specified StreamingSynthesizeRequest message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.StreamingSynthesizeRequest.verify|verify} messages.
                     * @param message StreamingSynthesizeRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.IStreamingSynthesizeRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified StreamingSynthesizeRequest message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.StreamingSynthesizeRequest.verify|verify} messages.
                     * @param message StreamingSynthesizeRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.IStreamingSynthesizeRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a StreamingSynthesizeRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns StreamingSynthesizeRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.StreamingSynthesizeRequest;

                    /**
                     * Decodes a StreamingSynthesizeRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns StreamingSynthesizeRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.StreamingSynthesizeRequest;

                    /**
                     * Verifies a StreamingSynthesizeRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a StreamingSynthesizeRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns StreamingSynthesizeRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.StreamingSynthesizeRequest;

                    /**
                     * Creates a plain object from a StreamingSynthesizeRequest message. Also converts values to other types if specified.
                     * @param message StreamingSynthesizeRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.StreamingSynthesizeRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this StreamingSynthesizeRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for StreamingSynthesizeRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a StreamingSynthesizeResponse. */
                interface IStreamingSynthesizeResponse {

                    /** StreamingSynthesizeResponse audioContent */
                    audioContent?: (Uint8Array|Buffer|string|null);
                }

                /** Represents a StreamingSynthesizeResponse. */
                class StreamingSynthesizeResponse implements IStreamingSynthesizeResponse {

                    /**
                     * Constructs a new StreamingSynthesizeResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.IStreamingSynthesizeResponse);

                    /** StreamingSynthesizeResponse audioContent. */
                    public audioContent: (Uint8Array|Buffer|string);

                    /**
                     * Creates a new StreamingSynthesizeResponse instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns StreamingSynthesizeResponse instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.IStreamingSynthesizeResponse): google.cloud.texttospeech.v1beta1.StreamingSynthesizeResponse;

                    /**
                     * Encodes the specified StreamingSynthesizeResponse message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.StreamingSynthesizeResponse.verify|verify} messages.
                     * @param message StreamingSynthesizeResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.IStreamingSynthesizeResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified StreamingSynthesizeResponse message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.StreamingSynthesizeResponse.verify|verify} messages.
                     * @param message StreamingSynthesizeResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.IStreamingSynthesizeResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a StreamingSynthesizeResponse message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns StreamingSynthesizeResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.StreamingSynthesizeResponse;

                    /**
                     * Decodes a StreamingSynthesizeResponse message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns StreamingSynthesizeResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.StreamingSynthesizeResponse;

                    /**
                     * Verifies a StreamingSynthesizeResponse message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a StreamingSynthesizeResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns StreamingSynthesizeResponse
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.StreamingSynthesizeResponse;

                    /**
                     * Creates a plain object from a StreamingSynthesizeResponse message. Also converts values to other types if specified.
                     * @param message StreamingSynthesizeResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.StreamingSynthesizeResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this StreamingSynthesizeResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for StreamingSynthesizeResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Represents a TextToSpeechLongAudioSynthesize */
                class TextToSpeechLongAudioSynthesize extends $protobuf.rpc.Service {

                    /**
                     * Constructs a new TextToSpeechLongAudioSynthesize service.
                     * @param rpcImpl RPC implementation
                     * @param [requestDelimited=false] Whether requests are length-delimited
                     * @param [responseDelimited=false] Whether responses are length-delimited
                     */
                    constructor(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean);

                    /**
                     * Creates new TextToSpeechLongAudioSynthesize service using the specified rpc implementation.
                     * @param rpcImpl RPC implementation
                     * @param [requestDelimited=false] Whether requests are length-delimited
                     * @param [responseDelimited=false] Whether responses are length-delimited
                     * @returns RPC service. Useful where requests and/or responses are streamed.
                     */
                    public static create(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean): TextToSpeechLongAudioSynthesize;

                    /**
                     * Calls SynthesizeLongAudio.
                     * @param request SynthesizeLongAudioRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Operation
                     */
                    public synthesizeLongAudio(request: google.cloud.texttospeech.v1beta1.ISynthesizeLongAudioRequest, callback: google.cloud.texttospeech.v1beta1.TextToSpeechLongAudioSynthesize.SynthesizeLongAudioCallback): void;

                    /**
                     * Calls SynthesizeLongAudio.
                     * @param request SynthesizeLongAudioRequest message or plain object
                     * @returns Promise
                     */
                    public synthesizeLongAudio(request: google.cloud.texttospeech.v1beta1.ISynthesizeLongAudioRequest): Promise<google.longrunning.Operation>;
                }

                namespace TextToSpeechLongAudioSynthesize {

                    /**
                     * Callback as used by {@link google.cloud.texttospeech.v1beta1.TextToSpeechLongAudioSynthesize|synthesizeLongAudio}.
                     * @param error Error, if any
                     * @param [response] Operation
                     */
                    type SynthesizeLongAudioCallback = (error: (Error|null), response?: google.longrunning.Operation) => void;
                }

                /** Properties of a SynthesizeLongAudioRequest. */
                interface ISynthesizeLongAudioRequest {

                    /** SynthesizeLongAudioRequest parent */
                    parent?: (string|null);

                    /** SynthesizeLongAudioRequest input */
                    input?: (google.cloud.texttospeech.v1beta1.ISynthesisInput|null);

                    /** SynthesizeLongAudioRequest audioConfig */
                    audioConfig?: (google.cloud.texttospeech.v1beta1.IAudioConfig|null);

                    /** SynthesizeLongAudioRequest outputGcsUri */
                    outputGcsUri?: (string|null);

                    /** SynthesizeLongAudioRequest voice */
                    voice?: (google.cloud.texttospeech.v1beta1.IVoiceSelectionParams|null);
                }

                /** Represents a SynthesizeLongAudioRequest. */
                class SynthesizeLongAudioRequest implements ISynthesizeLongAudioRequest {

                    /**
                     * Constructs a new SynthesizeLongAudioRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.ISynthesizeLongAudioRequest);

                    /** SynthesizeLongAudioRequest parent. */
                    public parent: string;

                    /** SynthesizeLongAudioRequest input. */
                    public input?: (google.cloud.texttospeech.v1beta1.ISynthesisInput|null);

                    /** SynthesizeLongAudioRequest audioConfig. */
                    public audioConfig?: (google.cloud.texttospeech.v1beta1.IAudioConfig|null);

                    /** SynthesizeLongAudioRequest outputGcsUri. */
                    public outputGcsUri: string;

                    /** SynthesizeLongAudioRequest voice. */
                    public voice?: (google.cloud.texttospeech.v1beta1.IVoiceSelectionParams|null);

                    /**
                     * Creates a new SynthesizeLongAudioRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SynthesizeLongAudioRequest instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.ISynthesizeLongAudioRequest): google.cloud.texttospeech.v1beta1.SynthesizeLongAudioRequest;

                    /**
                     * Encodes the specified SynthesizeLongAudioRequest message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.SynthesizeLongAudioRequest.verify|verify} messages.
                     * @param message SynthesizeLongAudioRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.ISynthesizeLongAudioRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SynthesizeLongAudioRequest message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.SynthesizeLongAudioRequest.verify|verify} messages.
                     * @param message SynthesizeLongAudioRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.ISynthesizeLongAudioRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SynthesizeLongAudioRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SynthesizeLongAudioRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.SynthesizeLongAudioRequest;

                    /**
                     * Decodes a SynthesizeLongAudioRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SynthesizeLongAudioRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.SynthesizeLongAudioRequest;

                    /**
                     * Verifies a SynthesizeLongAudioRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SynthesizeLongAudioRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SynthesizeLongAudioRequest
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.SynthesizeLongAudioRequest;

                    /**
                     * Creates a plain object from a SynthesizeLongAudioRequest message. Also converts values to other types if specified.
                     * @param message SynthesizeLongAudioRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.SynthesizeLongAudioRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SynthesizeLongAudioRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SynthesizeLongAudioRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SynthesizeLongAudioResponse. */
                interface ISynthesizeLongAudioResponse {
                }

                /** Represents a SynthesizeLongAudioResponse. */
                class SynthesizeLongAudioResponse implements ISynthesizeLongAudioResponse {

                    /**
                     * Constructs a new SynthesizeLongAudioResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.ISynthesizeLongAudioResponse);

                    /**
                     * Creates a new SynthesizeLongAudioResponse instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SynthesizeLongAudioResponse instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.ISynthesizeLongAudioResponse): google.cloud.texttospeech.v1beta1.SynthesizeLongAudioResponse;

                    /**
                     * Encodes the specified SynthesizeLongAudioResponse message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.SynthesizeLongAudioResponse.verify|verify} messages.
                     * @param message SynthesizeLongAudioResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.ISynthesizeLongAudioResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SynthesizeLongAudioResponse message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.SynthesizeLongAudioResponse.verify|verify} messages.
                     * @param message SynthesizeLongAudioResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.ISynthesizeLongAudioResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SynthesizeLongAudioResponse message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SynthesizeLongAudioResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.SynthesizeLongAudioResponse;

                    /**
                     * Decodes a SynthesizeLongAudioResponse message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SynthesizeLongAudioResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.SynthesizeLongAudioResponse;

                    /**
                     * Verifies a SynthesizeLongAudioResponse message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SynthesizeLongAudioResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SynthesizeLongAudioResponse
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.SynthesizeLongAudioResponse;

                    /**
                     * Creates a plain object from a SynthesizeLongAudioResponse message. Also converts values to other types if specified.
                     * @param message SynthesizeLongAudioResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.SynthesizeLongAudioResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SynthesizeLongAudioResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SynthesizeLongAudioResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SynthesizeLongAudioMetadata. */
                interface ISynthesizeLongAudioMetadata {

                    /** SynthesizeLongAudioMetadata startTime */
                    startTime?: (google.protobuf.ITimestamp|null);

                    /** SynthesizeLongAudioMetadata lastUpdateTime */
                    lastUpdateTime?: (google.protobuf.ITimestamp|null);

                    /** SynthesizeLongAudioMetadata progressPercentage */
                    progressPercentage?: (number|null);
                }

                /** Represents a SynthesizeLongAudioMetadata. */
                class SynthesizeLongAudioMetadata implements ISynthesizeLongAudioMetadata {

                    /**
                     * Constructs a new SynthesizeLongAudioMetadata.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: google.cloud.texttospeech.v1beta1.ISynthesizeLongAudioMetadata);

                    /** SynthesizeLongAudioMetadata startTime. */
                    public startTime?: (google.protobuf.ITimestamp|null);

                    /** SynthesizeLongAudioMetadata lastUpdateTime. */
                    public lastUpdateTime?: (google.protobuf.ITimestamp|null);

                    /** SynthesizeLongAudioMetadata progressPercentage. */
                    public progressPercentage: number;

                    /**
                     * Creates a new SynthesizeLongAudioMetadata instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SynthesizeLongAudioMetadata instance
                     */
                    public static create(properties?: google.cloud.texttospeech.v1beta1.ISynthesizeLongAudioMetadata): google.cloud.texttospeech.v1beta1.SynthesizeLongAudioMetadata;

                    /**
                     * Encodes the specified SynthesizeLongAudioMetadata message. Does not implicitly {@link google.cloud.texttospeech.v1beta1.SynthesizeLongAudioMetadata.verify|verify} messages.
                     * @param message SynthesizeLongAudioMetadata message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: google.cloud.texttospeech.v1beta1.ISynthesizeLongAudioMetadata, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SynthesizeLongAudioMetadata message, length delimited. Does not implicitly {@link google.cloud.texttospeech.v1beta1.SynthesizeLongAudioMetadata.verify|verify} messages.
                     * @param message SynthesizeLongAudioMetadata message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: google.cloud.texttospeech.v1beta1.ISynthesizeLongAudioMetadata, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SynthesizeLongAudioMetadata message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SynthesizeLongAudioMetadata
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.cloud.texttospeech.v1beta1.SynthesizeLongAudioMetadata;

                    /**
                     * Decodes a SynthesizeLongAudioMetadata message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SynthesizeLongAudioMetadata
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.cloud.texttospeech.v1beta1.SynthesizeLongAudioMetadata;

                    /**
                     * Verifies a SynthesizeLongAudioMetadata message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SynthesizeLongAudioMetadata message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SynthesizeLongAudioMetadata
                     */
                    public static fromObject(object: { [k: string]: any }): google.cloud.texttospeech.v1beta1.SynthesizeLongAudioMetadata;

                    /**
                     * Creates a plain object from a SynthesizeLongAudioMetadata message. Also converts values to other types if specified.
                     * @param message SynthesizeLongAudioMetadata
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: google.cloud.texttospeech.v1beta1.SynthesizeLongAudioMetadata, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SynthesizeLongAudioMetadata to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SynthesizeLongAudioMetadata
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }
            }
        }
    }

    /** Namespace api. */
    namespace api {

        /** Properties of a Http. */
        interface IHttp {

            /** Http rules */
            rules?: (google.api.IHttpRule[]|null);

            /** Http fullyDecodeReservedExpansion */
            fullyDecodeReservedExpansion?: (boolean|null);
        }

        /** Represents a Http. */
        class Http implements IHttp {

            /**
             * Constructs a new Http.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IHttp);

            /** Http rules. */
            public rules: google.api.IHttpRule[];

            /** Http fullyDecodeReservedExpansion. */
            public fullyDecodeReservedExpansion: boolean;

            /**
             * Creates a new Http instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Http instance
             */
            public static create(properties?: google.api.IHttp): google.api.Http;

            /**
             * Encodes the specified Http message. Does not implicitly {@link google.api.Http.verify|verify} messages.
             * @param message Http message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.api.IHttp, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Http message, length delimited. Does not implicitly {@link google.api.Http.verify|verify} messages.
             * @param message Http message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.api.IHttp, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Http message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Http
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.api.Http;

            /**
             * Decodes a Http message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Http
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.api.Http;

            /**
             * Verifies a Http message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a Http message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Http
             */
            public static fromObject(object: { [k: string]: any }): google.api.Http;

            /**
             * Creates a plain object from a Http message. Also converts values to other types if specified.
             * @param message Http
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.Http, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Http to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Http
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a HttpRule. */
        interface IHttpRule {

            /** HttpRule selector */
            selector?: (string|null);

            /** HttpRule get */
            get?: (string|null);

            /** HttpRule put */
            put?: (string|null);

            /** HttpRule post */
            post?: (string|null);

            /** HttpRule delete */
            "delete"?: (string|null);

            /** HttpRule patch */
            patch?: (string|null);

            /** HttpRule custom */
            custom?: (google.api.ICustomHttpPattern|null);

            /** HttpRule body */
            body?: (string|null);

            /** HttpRule responseBody */
            responseBody?: (string|null);

            /** HttpRule additionalBindings */
            additionalBindings?: (google.api.IHttpRule[]|null);
        }

        /** Represents a HttpRule. */
        class HttpRule implements IHttpRule {

            /**
             * Constructs a new HttpRule.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IHttpRule);

            /** HttpRule selector. */
            public selector: string;

            /** HttpRule get. */
            public get?: (string|null);

            /** HttpRule put. */
            public put?: (string|null);

            /** HttpRule post. */
            public post?: (string|null);

            /** HttpRule delete. */
            public delete?: (string|null);

            /** HttpRule patch. */
            public patch?: (string|null);

            /** HttpRule custom. */
            public custom?: (google.api.ICustomHttpPattern|null);

            /** HttpRule body. */
            public body: string;

            /** HttpRule responseBody. */
            public responseBody: string;

            /** HttpRule additionalBindings. */
            public additionalBindings: google.api.IHttpRule[];

            /** HttpRule pattern. */
            public pattern?: ("get"|"put"|"post"|"delete"|"patch"|"custom");

            /**
             * Creates a new HttpRule instance using the specified properties.
             * @param [properties] Properties to set
             * @returns HttpRule instance
             */
            public static create(properties?: google.api.IHttpRule): google.api.HttpRule;

            /**
             * Encodes the specified HttpRule message. Does not implicitly {@link google.api.HttpRule.verify|verify} messages.
             * @param message HttpRule message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.api.IHttpRule, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified HttpRule message, length delimited. Does not implicitly {@link google.api.HttpRule.verify|verify} messages.
             * @param message HttpRule message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.api.IHttpRule, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a HttpRule message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns HttpRule
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.api.HttpRule;

            /**
             * Decodes a HttpRule message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns HttpRule
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.api.HttpRule;

            /**
             * Verifies a HttpRule message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a HttpRule message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns HttpRule
             */
            public static fromObject(object: { [k: string]: any }): google.api.HttpRule;

            /**
             * Creates a plain object from a HttpRule message. Also converts values to other types if specified.
             * @param message HttpRule
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.HttpRule, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this HttpRule to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for HttpRule
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a CustomHttpPattern. */
        interface ICustomHttpPattern {

            /** CustomHttpPattern kind */
            kind?: (string|null);

            /** CustomHttpPattern path */
            path?: (string|null);
        }

        /** Represents a CustomHttpPattern. */
        class CustomHttpPattern implements ICustomHttpPattern {

            /**
             * Constructs a new CustomHttpPattern.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.ICustomHttpPattern);

            /** CustomHttpPattern kind. */
            public kind: string;

            /** CustomHttpPattern path. */
            public path: string;

            /**
             * Creates a new CustomHttpPattern instance using the specified properties.
             * @param [properties] Properties to set
             * @returns CustomHttpPattern instance
             */
            public static create(properties?: google.api.ICustomHttpPattern): google.api.CustomHttpPattern;

            /**
             * Encodes the specified CustomHttpPattern message. Does not implicitly {@link google.api.CustomHttpPattern.verify|verify} messages.
             * @param message CustomHttpPattern message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.api.ICustomHttpPattern, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified CustomHttpPattern message, length delimited. Does not implicitly {@link google.api.CustomHttpPattern.verify|verify} messages.
             * @param message CustomHttpPattern message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.api.ICustomHttpPattern, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a CustomHttpPattern message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns CustomHttpPattern
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.api.CustomHttpPattern;

            /**
             * Decodes a CustomHttpPattern message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns CustomHttpPattern
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.api.CustomHttpPattern;

            /**
             * Verifies a CustomHttpPattern message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a CustomHttpPattern message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns CustomHttpPattern
             */
            public static fromObject(object: { [k: string]: any }): google.api.CustomHttpPattern;

            /**
             * Creates a plain object from a CustomHttpPattern message. Also converts values to other types if specified.
             * @param message CustomHttpPattern
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.CustomHttpPattern, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this CustomHttpPattern to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for CustomHttpPattern
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a CommonLanguageSettings. */
        interface ICommonLanguageSettings {

            /** CommonLanguageSettings referenceDocsUri */
            referenceDocsUri?: (string|null);

            /** CommonLanguageSettings destinations */
            destinations?: (google.api.ClientLibraryDestination[]|null);
        }

        /** Represents a CommonLanguageSettings. */
        class CommonLanguageSettings implements ICommonLanguageSettings {

            /**
             * Constructs a new CommonLanguageSettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.ICommonLanguageSettings);

            /** CommonLanguageSettings referenceDocsUri. */
            public referenceDocsUri: string;

            /** CommonLanguageSettings destinations. */
            public destinations: google.api.ClientLibraryDestination[];

            /**
             * Creates a new CommonLanguageSettings instance using the specified properties.
             * @param [properties] Properties to set
             * @returns CommonLanguageSettings instance
             */
            public static create(properties?: google.api.ICommonLanguageSettings): google.api.CommonLanguageSettings;

            /**
             * Encodes the specified CommonLanguageSettings message. Does not implicitly {@link google.api.CommonLanguageSettings.verify|verify} messages.
             * @param message CommonLanguageSettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.api.ICommonLanguageSettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified CommonLanguageSettings message, length delimited. Does not implicitly {@link google.api.CommonLanguageSettings.verify|verify} messages.
             * @param message CommonLanguageSettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.api.ICommonLanguageSettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a CommonLanguageSettings message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns CommonLanguageSettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.api.CommonLanguageSettings;

            /**
             * Decodes a CommonLanguageSettings message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns CommonLanguageSettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.api.CommonLanguageSettings;

            /**
             * Verifies a CommonLanguageSettings message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a CommonLanguageSettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns CommonLanguageSettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.CommonLanguageSettings;

            /**
             * Creates a plain object from a CommonLanguageSettings message. Also converts values to other types if specified.
             * @param message CommonLanguageSettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.CommonLanguageSettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this CommonLanguageSettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for CommonLanguageSettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a ClientLibrarySettings. */
        interface IClientLibrarySettings {

            /** ClientLibrarySettings version */
            version?: (string|null);

            /** ClientLibrarySettings launchStage */
            launchStage?: (google.api.LaunchStage|keyof typeof google.api.LaunchStage|null);

            /** ClientLibrarySettings restNumericEnums */
            restNumericEnums?: (boolean|null);

            /** ClientLibrarySettings javaSettings */
            javaSettings?: (google.api.IJavaSettings|null);

            /** ClientLibrarySettings cppSettings */
            cppSettings?: (google.api.ICppSettings|null);

            /** ClientLibrarySettings phpSettings */
            phpSettings?: (google.api.IPhpSettings|null);

            /** ClientLibrarySettings pythonSettings */
            pythonSettings?: (google.api.IPythonSettings|null);

            /** ClientLibrarySettings nodeSettings */
            nodeSettings?: (google.api.INodeSettings|null);

            /** ClientLibrarySettings dotnetSettings */
            dotnetSettings?: (google.api.IDotnetSettings|null);

            /** ClientLibrarySettings rubySettings */
            rubySettings?: (google.api.IRubySettings|null);

            /** ClientLibrarySettings goSettings */
            goSettings?: (google.api.IGoSettings|null);
        }

        /** Represents a ClientLibrarySettings. */
        class ClientLibrarySettings implements IClientLibrarySettings {

            /**
             * Constructs a new ClientLibrarySettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IClientLibrarySettings);

            /** ClientLibrarySettings version. */
            public version: string;

            /** ClientLibrarySettings launchStage. */
            public launchStage: (google.api.LaunchStage|keyof typeof google.api.LaunchStage);

            /** ClientLibrarySettings restNumericEnums. */
            public restNumericEnums: boolean;

            /** ClientLibrarySettings javaSettings. */
            public javaSettings?: (google.api.IJavaSettings|null);

            /** ClientLibrarySettings cppSettings. */
            public cppSettings?: (google.api.ICppSettings|null);

            /** ClientLibrarySettings phpSettings. */
            public phpSettings?: (google.api.IPhpSettings|null);

            /** ClientLibrarySettings pythonSettings. */
            public pythonSettings?: (google.api.IPythonSettings|null);

            /** ClientLibrarySettings nodeSettings. */
            public nodeSettings?: (google.api.INodeSettings|null);

            /** ClientLibrarySettings dotnetSettings. */
            public dotnetSettings?: (google.api.IDotnetSettings|null);

            /** ClientLibrarySettings rubySettings. */
            public rubySettings?: (google.api.IRubySettings|null);

            /** ClientLibrarySettings goSettings. */
            public goSettings?: (google.api.IGoSettings|null);

            /**
             * Creates a new ClientLibrarySettings instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ClientLibrarySettings instance
             */
            public static create(properties?: google.api.IClientLibrarySettings): google.api.ClientLibrarySettings;

            /**
             * Encodes the specified ClientLibrarySettings message. Does not implicitly {@link google.api.ClientLibrarySettings.verify|verify} messages.
             * @param message ClientLibrarySettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.api.IClientLibrarySettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified ClientLibrarySettings message, length delimited. Does not implicitly {@link google.api.ClientLibrarySettings.verify|verify} messages.
             * @param message ClientLibrarySettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.api.IClientLibrarySettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ClientLibrarySettings message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns ClientLibrarySettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.api.ClientLibrarySettings;

            /**
             * Decodes a ClientLibrarySettings message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns ClientLibrarySettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.api.ClientLibrarySettings;

            /**
             * Verifies a ClientLibrarySettings message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a ClientLibrarySettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ClientLibrarySettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.ClientLibrarySettings;

            /**
             * Creates a plain object from a ClientLibrarySettings message. Also converts values to other types if specified.
             * @param message ClientLibrarySettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.ClientLibrarySettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ClientLibrarySettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ClientLibrarySettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a Publishing. */
        interface IPublishing {

            /** Publishing methodSettings */
            methodSettings?: (google.api.IMethodSettings[]|null);

            /** Publishing newIssueUri */
            newIssueUri?: (string|null);

            /** Publishing documentationUri */
            documentationUri?: (string|null);

            /** Publishing apiShortName */
            apiShortName?: (string|null);

            /** Publishing githubLabel */
            githubLabel?: (string|null);

            /** Publishing codeownerGithubTeams */
            codeownerGithubTeams?: (string[]|null);

            /** Publishing docTagPrefix */
            docTagPrefix?: (string|null);

            /** Publishing organization */
            organization?: (google.api.ClientLibraryOrganization|keyof typeof google.api.ClientLibraryOrganization|null);

            /** Publishing librarySettings */
            librarySettings?: (google.api.IClientLibrarySettings[]|null);

            /** Publishing protoReferenceDocumentationUri */
            protoReferenceDocumentationUri?: (string|null);

            /** Publishing restReferenceDocumentationUri */
            restReferenceDocumentationUri?: (string|null);
        }

        /** Represents a Publishing. */
        class Publishing implements IPublishing {

            /**
             * Constructs a new Publishing.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IPublishing);

            /** Publishing methodSettings. */
            public methodSettings: google.api.IMethodSettings[];

            /** Publishing newIssueUri. */
            public newIssueUri: string;

            /** Publishing documentationUri. */
            public documentationUri: string;

            /** Publishing apiShortName. */
            public apiShortName: string;

            /** Publishing githubLabel. */
            public githubLabel: string;

            /** Publishing codeownerGithubTeams. */
            public codeownerGithubTeams: string[];

            /** Publishing docTagPrefix. */
            public docTagPrefix: string;

            /** Publishing organization. */
            public organization: (google.api.ClientLibraryOrganization|keyof typeof google.api.ClientLibraryOrganization);

            /** Publishing librarySettings. */
            public librarySettings: google.api.IClientLibrarySettings[];

            /** Publishing protoReferenceDocumentationUri. */
            public protoReferenceDocumentationUri: string;

            /** Publishing restReferenceDocumentationUri. */
            public restReferenceDocumentationUri: string;

            /**
             * Creates a new Publishing instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Publishing instance
             */
            public static create(properties?: google.api.IPublishing): google.api.Publishing;

            /**
             * Encodes the specified Publishing message. Does not implicitly {@link google.api.Publishing.verify|verify} messages.
             * @param message Publishing message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.api.IPublishing, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Publishing message, length delimited. Does not implicitly {@link google.api.Publishing.verify|verify} messages.
             * @param message Publishing message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.api.IPublishing, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Publishing message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Publishing
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.api.Publishing;

            /**
             * Decodes a Publishing message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Publishing
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.api.Publishing;

            /**
             * Verifies a Publishing message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a Publishing message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Publishing
             */
            public static fromObject(object: { [k: string]: any }): google.api.Publishing;

            /**
             * Creates a plain object from a Publishing message. Also converts values to other types if specified.
             * @param message Publishing
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.Publishing, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Publishing to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Publishing
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a JavaSettings. */
        interface IJavaSettings {

            /** JavaSettings libraryPackage */
            libraryPackage?: (string|null);

            /** JavaSettings serviceClassNames */
            serviceClassNames?: ({ [k: string]: string }|null);

            /** JavaSettings common */
            common?: (google.api.ICommonLanguageSettings|null);
        }

        /** Represents a JavaSettings. */
        class JavaSettings implements IJavaSettings {

            /**
             * Constructs a new JavaSettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IJavaSettings);

            /** JavaSettings libraryPackage. */
            public libraryPackage: string;

            /** JavaSettings serviceClassNames. */
            public serviceClassNames: { [k: string]: string };

            /** JavaSettings common. */
            public common?: (google.api.ICommonLanguageSettings|null);

            /**
             * Creates a new JavaSettings instance using the specified properties.
             * @param [properties] Properties to set
             * @returns JavaSettings instance
             */
            public static create(properties?: google.api.IJavaSettings): google.api.JavaSettings;

            /**
             * Encodes the specified JavaSettings message. Does not implicitly {@link google.api.JavaSettings.verify|verify} messages.
             * @param message JavaSettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.api.IJavaSettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified JavaSettings message, length delimited. Does not implicitly {@link google.api.JavaSettings.verify|verify} messages.
             * @param message JavaSettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.api.IJavaSettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a JavaSettings message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns JavaSettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.api.JavaSettings;

            /**
             * Decodes a JavaSettings message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns JavaSettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.api.JavaSettings;

            /**
             * Verifies a JavaSettings message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a JavaSettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns JavaSettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.JavaSettings;

            /**
             * Creates a plain object from a JavaSettings message. Also converts values to other types if specified.
             * @param message JavaSettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.JavaSettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this JavaSettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for JavaSettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a CppSettings. */
        interface ICppSettings {

            /** CppSettings common */
            common?: (google.api.ICommonLanguageSettings|null);
        }

        /** Represents a CppSettings. */
        class CppSettings implements ICppSettings {

            /**
             * Constructs a new CppSettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.ICppSettings);

            /** CppSettings common. */
            public common?: (google.api.ICommonLanguageSettings|null);

            /**
             * Creates a new CppSettings instance using the specified properties.
             * @param [properties] Properties to set
             * @returns CppSettings instance
             */
            public static create(properties?: google.api.ICppSettings): google.api.CppSettings;

            /**
             * Encodes the specified CppSettings message. Does not implicitly {@link google.api.CppSettings.verify|verify} messages.
             * @param message CppSettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.api.ICppSettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified CppSettings message, length delimited. Does not implicitly {@link google.api.CppSettings.verify|verify} messages.
             * @param message CppSettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.api.ICppSettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a CppSettings message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns CppSettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.api.CppSettings;

            /**
             * Decodes a CppSettings message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns CppSettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.api.CppSettings;

            /**
             * Verifies a CppSettings message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a CppSettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns CppSettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.CppSettings;

            /**
             * Creates a plain object from a CppSettings message. Also converts values to other types if specified.
             * @param message CppSettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.CppSettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this CppSettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for CppSettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a PhpSettings. */
        interface IPhpSettings {

            /** PhpSettings common */
            common?: (google.api.ICommonLanguageSettings|null);
        }

        /** Represents a PhpSettings. */
        class PhpSettings implements IPhpSettings {

            /**
             * Constructs a new PhpSettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IPhpSettings);

            /** PhpSettings common. */
            public common?: (google.api.ICommonLanguageSettings|null);

            /**
             * Creates a new PhpSettings instance using the specified properties.
             * @param [properties] Properties to set
             * @returns PhpSettings instance
             */
            public static create(properties?: google.api.IPhpSettings): google.api.PhpSettings;

            /**
             * Encodes the specified PhpSettings message. Does not implicitly {@link google.api.PhpSettings.verify|verify} messages.
             * @param message PhpSettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.api.IPhpSettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified PhpSettings message, length delimited. Does not implicitly {@link google.api.PhpSettings.verify|verify} messages.
             * @param message PhpSettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.api.IPhpSettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a PhpSettings message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns PhpSettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.api.PhpSettings;

            /**
             * Decodes a PhpSettings message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns PhpSettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.api.PhpSettings;

            /**
             * Verifies a PhpSettings message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a PhpSettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns PhpSettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.PhpSettings;

            /**
             * Creates a plain object from a PhpSettings message. Also converts values to other types if specified.
             * @param message PhpSettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.PhpSettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this PhpSettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for PhpSettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a PythonSettings. */
        interface IPythonSettings {

            /** PythonSettings common */
            common?: (google.api.ICommonLanguageSettings|null);
        }

        /** Represents a PythonSettings. */
        class PythonSettings implements IPythonSettings {

            /**
             * Constructs a new PythonSettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IPythonSettings);

            /** PythonSettings common. */
            public common?: (google.api.ICommonLanguageSettings|null);

            /**
             * Creates a new PythonSettings instance using the specified properties.
             * @param [properties] Properties to set
             * @returns PythonSettings instance
             */
            public static create(properties?: google.api.IPythonSettings): google.api.PythonSettings;

            /**
             * Encodes the specified PythonSettings message. Does not implicitly {@link google.api.PythonSettings.verify|verify} messages.
             * @param message PythonSettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.api.IPythonSettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified PythonSettings message, length delimited. Does not implicitly {@link google.api.PythonSettings.verify|verify} messages.
             * @param message PythonSettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.api.IPythonSettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a PythonSettings message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns PythonSettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.api.PythonSettings;

            /**
             * Decodes a PythonSettings message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns PythonSettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.api.PythonSettings;

            /**
             * Verifies a PythonSettings message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a PythonSettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns PythonSettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.PythonSettings;

            /**
             * Creates a plain object from a PythonSettings message. Also converts values to other types if specified.
             * @param message PythonSettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.PythonSettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this PythonSettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for PythonSettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a NodeSettings. */
        interface INodeSettings {

            /** NodeSettings common */
            common?: (google.api.ICommonLanguageSettings|null);
        }

        /** Represents a NodeSettings. */
        class NodeSettings implements INodeSettings {

            /**
             * Constructs a new NodeSettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.INodeSettings);

            /** NodeSettings common. */
            public common?: (google.api.ICommonLanguageSettings|null);

            /**
             * Creates a new NodeSettings instance using the specified properties.
             * @param [properties] Properties to set
             * @returns NodeSettings instance
             */
            public static create(properties?: google.api.INodeSettings): google.api.NodeSettings;

            /**
             * Encodes the specified NodeSettings message. Does not implicitly {@link google.api.NodeSettings.verify|verify} messages.
             * @param message NodeSettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.api.INodeSettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified NodeSettings message, length delimited. Does not implicitly {@link google.api.NodeSettings.verify|verify} messages.
             * @param message NodeSettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.api.INodeSettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a NodeSettings message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns NodeSettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.api.NodeSettings;

            /**
             * Decodes a NodeSettings message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns NodeSettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.api.NodeSettings;

            /**
             * Verifies a NodeSettings message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a NodeSettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns NodeSettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.NodeSettings;

            /**
             * Creates a plain object from a NodeSettings message. Also converts values to other types if specified.
             * @param message NodeSettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.NodeSettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this NodeSettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for NodeSettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a DotnetSettings. */
        interface IDotnetSettings {

            /** DotnetSettings common */
            common?: (google.api.ICommonLanguageSettings|null);

            /** DotnetSettings renamedServices */
            renamedServices?: ({ [k: string]: string }|null);

            /** DotnetSettings renamedResources */
            renamedResources?: ({ [k: string]: string }|null);

            /** DotnetSettings ignoredResources */
            ignoredResources?: (string[]|null);

            /** DotnetSettings forcedNamespaceAliases */
            forcedNamespaceAliases?: (string[]|null);

            /** DotnetSettings handwrittenSignatures */
            handwrittenSignatures?: (string[]|null);
        }

        /** Represents a DotnetSettings. */
        class DotnetSettings implements IDotnetSettings {

            /**
             * Constructs a new DotnetSettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IDotnetSettings);

            /** DotnetSettings common. */
            public common?: (google.api.ICommonLanguageSettings|null);

            /** DotnetSettings renamedServices. */
            public renamedServices: { [k: string]: string };

            /** DotnetSettings renamedResources. */
            public renamedResources: { [k: string]: string };

            /** DotnetSettings ignoredResources. */
            public ignoredResources: string[];

            /** DotnetSettings forcedNamespaceAliases. */
            public forcedNamespaceAliases: string[];

            /** DotnetSettings handwrittenSignatures. */
            public handwrittenSignatures: string[];

            /**
             * Creates a new DotnetSettings instance using the specified properties.
             * @param [properties] Properties to set
             * @returns DotnetSettings instance
             */
            public static create(properties?: google.api.IDotnetSettings): google.api.DotnetSettings;

            /**
             * Encodes the specified DotnetSettings message. Does not implicitly {@link google.api.DotnetSettings.verify|verify} messages.
             * @param message DotnetSettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.api.IDotnetSettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified DotnetSettings message, length delimited. Does not implicitly {@link google.api.DotnetSettings.verify|verify} messages.
             * @param message DotnetSettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.api.IDotnetSettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a DotnetSettings message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns DotnetSettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.api.DotnetSettings;

            /**
             * Decodes a DotnetSettings message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns DotnetSettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.api.DotnetSettings;

            /**
             * Verifies a DotnetSettings message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a DotnetSettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns DotnetSettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.DotnetSettings;

            /**
             * Creates a plain object from a DotnetSettings message. Also converts values to other types if specified.
             * @param message DotnetSettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.DotnetSettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this DotnetSettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for DotnetSettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a RubySettings. */
        interface IRubySettings {

            /** RubySettings common */
            common?: (google.api.ICommonLanguageSettings|null);
        }

        /** Represents a RubySettings. */
        class RubySettings implements IRubySettings {

            /**
             * Constructs a new RubySettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IRubySettings);

            /** RubySettings common. */
            public common?: (google.api.ICommonLanguageSettings|null);

            /**
             * Creates a new RubySettings instance using the specified properties.
             * @param [properties] Properties to set
             * @returns RubySettings instance
             */
            public static create(properties?: google.api.IRubySettings): google.api.RubySettings;

            /**
             * Encodes the specified RubySettings message. Does not implicitly {@link google.api.RubySettings.verify|verify} messages.
             * @param message RubySettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.api.IRubySettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified RubySettings message, length delimited. Does not implicitly {@link google.api.RubySettings.verify|verify} messages.
             * @param message RubySettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.api.IRubySettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a RubySettings message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns RubySettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.api.RubySettings;

            /**
             * Decodes a RubySettings message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns RubySettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.api.RubySettings;

            /**
             * Verifies a RubySettings message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a RubySettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns RubySettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.RubySettings;

            /**
             * Creates a plain object from a RubySettings message. Also converts values to other types if specified.
             * @param message RubySettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.RubySettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this RubySettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for RubySettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a GoSettings. */
        interface IGoSettings {

            /** GoSettings common */
            common?: (google.api.ICommonLanguageSettings|null);
        }

        /** Represents a GoSettings. */
        class GoSettings implements IGoSettings {

            /**
             * Constructs a new GoSettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IGoSettings);

            /** GoSettings common. */
            public common?: (google.api.ICommonLanguageSettings|null);

            /**
             * Creates a new GoSettings instance using the specified properties.
             * @param [properties] Properties to set
             * @returns GoSettings instance
             */
            public static create(properties?: google.api.IGoSettings): google.api.GoSettings;

            /**
             * Encodes the specified GoSettings message. Does not implicitly {@link google.api.GoSettings.verify|verify} messages.
             * @param message GoSettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.api.IGoSettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified GoSettings message, length delimited. Does not implicitly {@link google.api.GoSettings.verify|verify} messages.
             * @param message GoSettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.api.IGoSettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a GoSettings message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns GoSettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.api.GoSettings;

            /**
             * Decodes a GoSettings message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns GoSettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.api.GoSettings;

            /**
             * Verifies a GoSettings message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a GoSettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns GoSettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.GoSettings;

            /**
             * Creates a plain object from a GoSettings message. Also converts values to other types if specified.
             * @param message GoSettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.GoSettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this GoSettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for GoSettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a MethodSettings. */
        interface IMethodSettings {

            /** MethodSettings selector */
            selector?: (string|null);

            /** MethodSettings longRunning */
            longRunning?: (google.api.MethodSettings.ILongRunning|null);

            /** MethodSettings autoPopulatedFields */
            autoPopulatedFields?: (string[]|null);
        }

        /** Represents a MethodSettings. */
        class MethodSettings implements IMethodSettings {

            /**
             * Constructs a new MethodSettings.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IMethodSettings);

            /** MethodSettings selector. */
            public selector: string;

            /** MethodSettings longRunning. */
            public longRunning?: (google.api.MethodSettings.ILongRunning|null);

            /** MethodSettings autoPopulatedFields. */
            public autoPopulatedFields: string[];

            /**
             * Creates a new MethodSettings instance using the specified properties.
             * @param [properties] Properties to set
             * @returns MethodSettings instance
             */
            public static create(properties?: google.api.IMethodSettings): google.api.MethodSettings;

            /**
             * Encodes the specified MethodSettings message. Does not implicitly {@link google.api.MethodSettings.verify|verify} messages.
             * @param message MethodSettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.api.IMethodSettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified MethodSettings message, length delimited. Does not implicitly {@link google.api.MethodSettings.verify|verify} messages.
             * @param message MethodSettings message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.api.IMethodSettings, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a MethodSettings message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns MethodSettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.api.MethodSettings;

            /**
             * Decodes a MethodSettings message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns MethodSettings
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.api.MethodSettings;

            /**
             * Verifies a MethodSettings message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a MethodSettings message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns MethodSettings
             */
            public static fromObject(object: { [k: string]: any }): google.api.MethodSettings;

            /**
             * Creates a plain object from a MethodSettings message. Also converts values to other types if specified.
             * @param message MethodSettings
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.MethodSettings, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this MethodSettings to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for MethodSettings
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace MethodSettings {

            /** Properties of a LongRunning. */
            interface ILongRunning {

                /** LongRunning initialPollDelay */
                initialPollDelay?: (google.protobuf.IDuration|null);

                /** LongRunning pollDelayMultiplier */
                pollDelayMultiplier?: (number|null);

                /** LongRunning maxPollDelay */
                maxPollDelay?: (google.protobuf.IDuration|null);

                /** LongRunning totalPollTimeout */
                totalPollTimeout?: (google.protobuf.IDuration|null);
            }

            /** Represents a LongRunning. */
            class LongRunning implements ILongRunning {

                /**
                 * Constructs a new LongRunning.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: google.api.MethodSettings.ILongRunning);

                /** LongRunning initialPollDelay. */
                public initialPollDelay?: (google.protobuf.IDuration|null);

                /** LongRunning pollDelayMultiplier. */
                public pollDelayMultiplier: number;

                /** LongRunning maxPollDelay. */
                public maxPollDelay?: (google.protobuf.IDuration|null);

                /** LongRunning totalPollTimeout. */
                public totalPollTimeout?: (google.protobuf.IDuration|null);

                /**
                 * Creates a new LongRunning instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns LongRunning instance
                 */
                public static create(properties?: google.api.MethodSettings.ILongRunning): google.api.MethodSettings.LongRunning;

                /**
                 * Encodes the specified LongRunning message. Does not implicitly {@link google.api.MethodSettings.LongRunning.verify|verify} messages.
                 * @param message LongRunning message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encode(message: google.api.MethodSettings.ILongRunning, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Encodes the specified LongRunning message, length delimited. Does not implicitly {@link google.api.MethodSettings.LongRunning.verify|verify} messages.
                 * @param message LongRunning message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encodeDelimited(message: google.api.MethodSettings.ILongRunning, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a LongRunning message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns LongRunning
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.api.MethodSettings.LongRunning;

                /**
                 * Decodes a LongRunning message from the specified reader or buffer, length delimited.
                 * @param reader Reader or buffer to decode from
                 * @returns LongRunning
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.api.MethodSettings.LongRunning;

                /**
                 * Verifies a LongRunning message.
                 * @param message Plain object to verify
                 * @returns `null` if valid, otherwise the reason why it is not
                 */
                public static verify(message: { [k: string]: any }): (string|null);

                /**
                 * Creates a LongRunning message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns LongRunning
                 */
                public static fromObject(object: { [k: string]: any }): google.api.MethodSettings.LongRunning;

                /**
                 * Creates a plain object from a LongRunning message. Also converts values to other types if specified.
                 * @param message LongRunning
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: google.api.MethodSettings.LongRunning, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this LongRunning to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for LongRunning
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }
        }

        /** ClientLibraryOrganization enum. */
        enum ClientLibraryOrganization {
            CLIENT_LIBRARY_ORGANIZATION_UNSPECIFIED = 0,
            CLOUD = 1,
            ADS = 2,
            PHOTOS = 3,
            STREET_VIEW = 4,
            SHOPPING = 5,
            GEO = 6,
            GENERATIVE_AI = 7
        }

        /** ClientLibraryDestination enum. */
        enum ClientLibraryDestination {
            CLIENT_LIBRARY_DESTINATION_UNSPECIFIED = 0,
            GITHUB = 10,
            PACKAGE_MANAGER = 20
        }

        /** LaunchStage enum. */
        enum LaunchStage {
            LAUNCH_STAGE_UNSPECIFIED = 0,
            UNIMPLEMENTED = 6,
            PRELAUNCH = 7,
            EARLY_ACCESS = 1,
            ALPHA = 2,
            BETA = 3,
            GA = 4,
            DEPRECATED = 5
        }

        /** FieldBehavior enum. */
        enum FieldBehavior {
            FIELD_BEHAVIOR_UNSPECIFIED = 0,
            OPTIONAL = 1,
            REQUIRED = 2,
            OUTPUT_ONLY = 3,
            INPUT_ONLY = 4,
            IMMUTABLE = 5,
            UNORDERED_LIST = 6,
            NON_EMPTY_DEFAULT = 7,
            IDENTIFIER = 8
        }

        /** Properties of a ResourceDescriptor. */
        interface IResourceDescriptor {

            /** ResourceDescriptor type */
            type?: (string|null);

            /** ResourceDescriptor pattern */
            pattern?: (string[]|null);

            /** ResourceDescriptor nameField */
            nameField?: (string|null);

            /** ResourceDescriptor history */
            history?: (google.api.ResourceDescriptor.History|keyof typeof google.api.ResourceDescriptor.History|null);

            /** ResourceDescriptor plural */
            plural?: (string|null);

            /** ResourceDescriptor singular */
            singular?: (string|null);

            /** ResourceDescriptor style */
            style?: (google.api.ResourceDescriptor.Style[]|null);
        }

        /** Represents a ResourceDescriptor. */
        class ResourceDescriptor implements IResourceDescriptor {

            /**
             * Constructs a new ResourceDescriptor.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IResourceDescriptor);

            /** ResourceDescriptor type. */
            public type: string;

            /** ResourceDescriptor pattern. */
            public pattern: string[];

            /** ResourceDescriptor nameField. */
            public nameField: string;

            /** ResourceDescriptor history. */
            public history: (google.api.ResourceDescriptor.History|keyof typeof google.api.ResourceDescriptor.History);

            /** ResourceDescriptor plural. */
            public plural: string;

            /** ResourceDescriptor singular. */
            public singular: string;

            /** ResourceDescriptor style. */
            public style: google.api.ResourceDescriptor.Style[];

            /**
             * Creates a new ResourceDescriptor instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ResourceDescriptor instance
             */
            public static create(properties?: google.api.IResourceDescriptor): google.api.ResourceDescriptor;

            /**
             * Encodes the specified ResourceDescriptor message. Does not implicitly {@link google.api.ResourceDescriptor.verify|verify} messages.
             * @param message ResourceDescriptor message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.api.IResourceDescriptor, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified ResourceDescriptor message, length delimited. Does not implicitly {@link google.api.ResourceDescriptor.verify|verify} messages.
             * @param message ResourceDescriptor message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.api.IResourceDescriptor, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ResourceDescriptor message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns ResourceDescriptor
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.api.ResourceDescriptor;

            /**
             * Decodes a ResourceDescriptor message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns ResourceDescriptor
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.api.ResourceDescriptor;

            /**
             * Verifies a ResourceDescriptor message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a ResourceDescriptor message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ResourceDescriptor
             */
            public static fromObject(object: { [k: string]: any }): google.api.ResourceDescriptor;

            /**
             * Creates a plain object from a ResourceDescriptor message. Also converts values to other types if specified.
             * @param message ResourceDescriptor
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.ResourceDescriptor, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ResourceDescriptor to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ResourceDescriptor
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace ResourceDescriptor {

            /** History enum. */
            enum History {
                HISTORY_UNSPECIFIED = 0,
                ORIGINALLY_SINGLE_PATTERN = 1,
                FUTURE_MULTI_PATTERN = 2
            }

            /** Style enum. */
            enum Style {
                STYLE_UNSPECIFIED = 0,
                DECLARATIVE_FRIENDLY = 1
            }
        }

        /** Properties of a ResourceReference. */
        interface IResourceReference {

            /** ResourceReference type */
            type?: (string|null);

            /** ResourceReference childType */
            childType?: (string|null);
        }

        /** Represents a ResourceReference. */
        class ResourceReference implements IResourceReference {

            /**
             * Constructs a new ResourceReference.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.api.IResourceReference);

            /** ResourceReference type. */
            public type: string;

            /** ResourceReference childType. */
            public childType: string;

            /**
             * Creates a new ResourceReference instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ResourceReference instance
             */
            public static create(properties?: google.api.IResourceReference): google.api.ResourceReference;

            /**
             * Encodes the specified ResourceReference message. Does not implicitly {@link google.api.ResourceReference.verify|verify} messages.
             * @param message ResourceReference message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.api.IResourceReference, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified ResourceReference message, length delimited. Does not implicitly {@link google.api.ResourceReference.verify|verify} messages.
             * @param message ResourceReference message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.api.IResourceReference, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ResourceReference message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns ResourceReference
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.api.ResourceReference;

            /**
             * Decodes a ResourceReference message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns ResourceReference
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.api.ResourceReference;

            /**
             * Verifies a ResourceReference message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a ResourceReference message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ResourceReference
             */
            public static fromObject(object: { [k: string]: any }): google.api.ResourceReference;

            /**
             * Creates a plain object from a ResourceReference message. Also converts values to other types if specified.
             * @param message ResourceReference
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.api.ResourceReference, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ResourceReference to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ResourceReference
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }

    /** Namespace protobuf. */
    namespace protobuf {

        /** Properties of a FileDescriptorSet. */
        interface IFileDescriptorSet {

            /** FileDescriptorSet file */
            file?: (google.protobuf.IFileDescriptorProto[]|null);
        }

        /** Represents a FileDescriptorSet. */
        class FileDescriptorSet implements IFileDescriptorSet {

            /**
             * Constructs a new FileDescriptorSet.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IFileDescriptorSet);

            /** FileDescriptorSet file. */
            public file: google.protobuf.IFileDescriptorProto[];

            /**
             * Creates a new FileDescriptorSet instance using the specified properties.
             * @param [properties] Properties to set
             * @returns FileDescriptorSet instance
             */
            public static create(properties?: google.protobuf.IFileDescriptorSet): google.protobuf.FileDescriptorSet;

            /**
             * Encodes the specified FileDescriptorSet message. Does not implicitly {@link google.protobuf.FileDescriptorSet.verify|verify} messages.
             * @param message FileDescriptorSet message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IFileDescriptorSet, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified FileDescriptorSet message, length delimited. Does not implicitly {@link google.protobuf.FileDescriptorSet.verify|verify} messages.
             * @param message FileDescriptorSet message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IFileDescriptorSet, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a FileDescriptorSet message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns FileDescriptorSet
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.FileDescriptorSet;

            /**
             * Decodes a FileDescriptorSet message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns FileDescriptorSet
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.FileDescriptorSet;

            /**
             * Verifies a FileDescriptorSet message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a FileDescriptorSet message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns FileDescriptorSet
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.FileDescriptorSet;

            /**
             * Creates a plain object from a FileDescriptorSet message. Also converts values to other types if specified.
             * @param message FileDescriptorSet
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.FileDescriptorSet, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this FileDescriptorSet to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for FileDescriptorSet
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Edition enum. */
        enum Edition {
            EDITION_UNKNOWN = 0,
            EDITION_PROTO2 = 998,
            EDITION_PROTO3 = 999,
            EDITION_2023 = 1000,
            EDITION_2024 = 1001,
            EDITION_1_TEST_ONLY = 1,
            EDITION_2_TEST_ONLY = 2,
            EDITION_99997_TEST_ONLY = 99997,
            EDITION_99998_TEST_ONLY = 99998,
            EDITION_99999_TEST_ONLY = 99999,
            EDITION_MAX = 2147483647
        }

        /** Properties of a FileDescriptorProto. */
        interface IFileDescriptorProto {

            /** FileDescriptorProto name */
            name?: (string|null);

            /** FileDescriptorProto package */
            "package"?: (string|null);

            /** FileDescriptorProto dependency */
            dependency?: (string[]|null);

            /** FileDescriptorProto publicDependency */
            publicDependency?: (number[]|null);

            /** FileDescriptorProto weakDependency */
            weakDependency?: (number[]|null);

            /** FileDescriptorProto messageType */
            messageType?: (google.protobuf.IDescriptorProto[]|null);

            /** FileDescriptorProto enumType */
            enumType?: (google.protobuf.IEnumDescriptorProto[]|null);

            /** FileDescriptorProto service */
            service?: (google.protobuf.IServiceDescriptorProto[]|null);

            /** FileDescriptorProto extension */
            extension?: (google.protobuf.IFieldDescriptorProto[]|null);

            /** FileDescriptorProto options */
            options?: (google.protobuf.IFileOptions|null);

            /** FileDescriptorProto sourceCodeInfo */
            sourceCodeInfo?: (google.protobuf.ISourceCodeInfo|null);

            /** FileDescriptorProto syntax */
            syntax?: (string|null);

            /** FileDescriptorProto edition */
            edition?: (google.protobuf.Edition|keyof typeof google.protobuf.Edition|null);
        }

        /** Represents a FileDescriptorProto. */
        class FileDescriptorProto implements IFileDescriptorProto {

            /**
             * Constructs a new FileDescriptorProto.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IFileDescriptorProto);

            /** FileDescriptorProto name. */
            public name: string;

            /** FileDescriptorProto package. */
            public package: string;

            /** FileDescriptorProto dependency. */
            public dependency: string[];

            /** FileDescriptorProto publicDependency. */
            public publicDependency: number[];

            /** FileDescriptorProto weakDependency. */
            public weakDependency: number[];

            /** FileDescriptorProto messageType. */
            public messageType: google.protobuf.IDescriptorProto[];

            /** FileDescriptorProto enumType. */
            public enumType: google.protobuf.IEnumDescriptorProto[];

            /** FileDescriptorProto service. */
            public service: google.protobuf.IServiceDescriptorProto[];

            /** FileDescriptorProto extension. */
            public extension: google.protobuf.IFieldDescriptorProto[];

            /** FileDescriptorProto options. */
            public options?: (google.protobuf.IFileOptions|null);

            /** FileDescriptorProto sourceCodeInfo. */
            public sourceCodeInfo?: (google.protobuf.ISourceCodeInfo|null);

            /** FileDescriptorProto syntax. */
            public syntax: string;

            /** FileDescriptorProto edition. */
            public edition: (google.protobuf.Edition|keyof typeof google.protobuf.Edition);

            /**
             * Creates a new FileDescriptorProto instance using the specified properties.
             * @param [properties] Properties to set
             * @returns FileDescriptorProto instance
             */
            public static create(properties?: google.protobuf.IFileDescriptorProto): google.protobuf.FileDescriptorProto;

            /**
             * Encodes the specified FileDescriptorProto message. Does not implicitly {@link google.protobuf.FileDescriptorProto.verify|verify} messages.
             * @param message FileDescriptorProto message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IFileDescriptorProto, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified FileDescriptorProto message, length delimited. Does not implicitly {@link google.protobuf.FileDescriptorProto.verify|verify} messages.
             * @param message FileDescriptorProto message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IFileDescriptorProto, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a FileDescriptorProto message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns FileDescriptorProto
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.FileDescriptorProto;

            /**
             * Decodes a FileDescriptorProto message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns FileDescriptorProto
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.FileDescriptorProto;

            /**
             * Verifies a FileDescriptorProto message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a FileDescriptorProto message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns FileDescriptorProto
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.FileDescriptorProto;

            /**
             * Creates a plain object from a FileDescriptorProto message. Also converts values to other types if specified.
             * @param message FileDescriptorProto
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.FileDescriptorProto, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this FileDescriptorProto to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for FileDescriptorProto
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a DescriptorProto. */
        interface IDescriptorProto {

            /** DescriptorProto name */
            name?: (string|null);

            /** DescriptorProto field */
            field?: (google.protobuf.IFieldDescriptorProto[]|null);

            /** DescriptorProto extension */
            extension?: (google.protobuf.IFieldDescriptorProto[]|null);

            /** DescriptorProto nestedType */
            nestedType?: (google.protobuf.IDescriptorProto[]|null);

            /** DescriptorProto enumType */
            enumType?: (google.protobuf.IEnumDescriptorProto[]|null);

            /** DescriptorProto extensionRange */
            extensionRange?: (google.protobuf.DescriptorProto.IExtensionRange[]|null);

            /** DescriptorProto oneofDecl */
            oneofDecl?: (google.protobuf.IOneofDescriptorProto[]|null);

            /** DescriptorProto options */
            options?: (google.protobuf.IMessageOptions|null);

            /** DescriptorProto reservedRange */
            reservedRange?: (google.protobuf.DescriptorProto.IReservedRange[]|null);

            /** DescriptorProto reservedName */
            reservedName?: (string[]|null);
        }

        /** Represents a DescriptorProto. */
        class DescriptorProto implements IDescriptorProto {

            /**
             * Constructs a new DescriptorProto.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IDescriptorProto);

            /** DescriptorProto name. */
            public name: string;

            /** DescriptorProto field. */
            public field: google.protobuf.IFieldDescriptorProto[];

            /** DescriptorProto extension. */
            public extension: google.protobuf.IFieldDescriptorProto[];

            /** DescriptorProto nestedType. */
            public nestedType: google.protobuf.IDescriptorProto[];

            /** DescriptorProto enumType. */
            public enumType: google.protobuf.IEnumDescriptorProto[];

            /** DescriptorProto extensionRange. */
            public extensionRange: google.protobuf.DescriptorProto.IExtensionRange[];

            /** DescriptorProto oneofDecl. */
            public oneofDecl: google.protobuf.IOneofDescriptorProto[];

            /** DescriptorProto options. */
            public options?: (google.protobuf.IMessageOptions|null);

            /** DescriptorProto reservedRange. */
            public reservedRange: google.protobuf.DescriptorProto.IReservedRange[];

            /** DescriptorProto reservedName. */
            public reservedName: string[];

            /**
             * Creates a new DescriptorProto instance using the specified properties.
             * @param [properties] Properties to set
             * @returns DescriptorProto instance
             */
            public static create(properties?: google.protobuf.IDescriptorProto): google.protobuf.DescriptorProto;

            /**
             * Encodes the specified DescriptorProto message. Does not implicitly {@link google.protobuf.DescriptorProto.verify|verify} messages.
             * @param message DescriptorProto message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IDescriptorProto, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified DescriptorProto message, length delimited. Does not implicitly {@link google.protobuf.DescriptorProto.verify|verify} messages.
             * @param message DescriptorProto message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IDescriptorProto, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a DescriptorProto message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns DescriptorProto
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.DescriptorProto;

            /**
             * Decodes a DescriptorProto message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns DescriptorProto
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.DescriptorProto;

            /**
             * Verifies a DescriptorProto message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a DescriptorProto message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns DescriptorProto
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.DescriptorProto;

            /**
             * Creates a plain object from a DescriptorProto message. Also converts values to other types if specified.
             * @param message DescriptorProto
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.DescriptorProto, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this DescriptorProto to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for DescriptorProto
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace DescriptorProto {

            /** Properties of an ExtensionRange. */
            interface IExtensionRange {

                /** ExtensionRange start */
                start?: (number|null);

                /** ExtensionRange end */
                end?: (number|null);

                /** ExtensionRange options */
                options?: (google.protobuf.IExtensionRangeOptions|null);
            }

            /** Represents an ExtensionRange. */
            class ExtensionRange implements IExtensionRange {

                /**
                 * Constructs a new ExtensionRange.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: google.protobuf.DescriptorProto.IExtensionRange);

                /** ExtensionRange start. */
                public start: number;

                /** ExtensionRange end. */
                public end: number;

                /** ExtensionRange options. */
                public options?: (google.protobuf.IExtensionRangeOptions|null);

                /**
                 * Creates a new ExtensionRange instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns ExtensionRange instance
                 */
                public static create(properties?: google.protobuf.DescriptorProto.IExtensionRange): google.protobuf.DescriptorProto.ExtensionRange;

                /**
                 * Encodes the specified ExtensionRange message. Does not implicitly {@link google.protobuf.DescriptorProto.ExtensionRange.verify|verify} messages.
                 * @param message ExtensionRange message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encode(message: google.protobuf.DescriptorProto.IExtensionRange, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Encodes the specified ExtensionRange message, length delimited. Does not implicitly {@link google.protobuf.DescriptorProto.ExtensionRange.verify|verify} messages.
                 * @param message ExtensionRange message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encodeDelimited(message: google.protobuf.DescriptorProto.IExtensionRange, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes an ExtensionRange message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns ExtensionRange
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.DescriptorProto.ExtensionRange;

                /**
                 * Decodes an ExtensionRange message from the specified reader or buffer, length delimited.
                 * @param reader Reader or buffer to decode from
                 * @returns ExtensionRange
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.DescriptorProto.ExtensionRange;

                /**
                 * Verifies an ExtensionRange message.
                 * @param message Plain object to verify
                 * @returns `null` if valid, otherwise the reason why it is not
                 */
                public static verify(message: { [k: string]: any }): (string|null);

                /**
                 * Creates an ExtensionRange message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns ExtensionRange
                 */
                public static fromObject(object: { [k: string]: any }): google.protobuf.DescriptorProto.ExtensionRange;

                /**
                 * Creates a plain object from an ExtensionRange message. Also converts values to other types if specified.
                 * @param message ExtensionRange
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: google.protobuf.DescriptorProto.ExtensionRange, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this ExtensionRange to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for ExtensionRange
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            /** Properties of a ReservedRange. */
            interface IReservedRange {

                /** ReservedRange start */
                start?: (number|null);

                /** ReservedRange end */
                end?: (number|null);
            }

            /** Represents a ReservedRange. */
            class ReservedRange implements IReservedRange {

                /**
                 * Constructs a new ReservedRange.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: google.protobuf.DescriptorProto.IReservedRange);

                /** ReservedRange start. */
                public start: number;

                /** ReservedRange end. */
                public end: number;

                /**
                 * Creates a new ReservedRange instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns ReservedRange instance
                 */
                public static create(properties?: google.protobuf.DescriptorProto.IReservedRange): google.protobuf.DescriptorProto.ReservedRange;

                /**
                 * Encodes the specified ReservedRange message. Does not implicitly {@link google.protobuf.DescriptorProto.ReservedRange.verify|verify} messages.
                 * @param message ReservedRange message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encode(message: google.protobuf.DescriptorProto.IReservedRange, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Encodes the specified ReservedRange message, length delimited. Does not implicitly {@link google.protobuf.DescriptorProto.ReservedRange.verify|verify} messages.
                 * @param message ReservedRange message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encodeDelimited(message: google.protobuf.DescriptorProto.IReservedRange, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a ReservedRange message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns ReservedRange
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.DescriptorProto.ReservedRange;

                /**
                 * Decodes a ReservedRange message from the specified reader or buffer, length delimited.
                 * @param reader Reader or buffer to decode from
                 * @returns ReservedRange
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.DescriptorProto.ReservedRange;

                /**
                 * Verifies a ReservedRange message.
                 * @param message Plain object to verify
                 * @returns `null` if valid, otherwise the reason why it is not
                 */
                public static verify(message: { [k: string]: any }): (string|null);

                /**
                 * Creates a ReservedRange message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns ReservedRange
                 */
                public static fromObject(object: { [k: string]: any }): google.protobuf.DescriptorProto.ReservedRange;

                /**
                 * Creates a plain object from a ReservedRange message. Also converts values to other types if specified.
                 * @param message ReservedRange
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: google.protobuf.DescriptorProto.ReservedRange, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this ReservedRange to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for ReservedRange
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }
        }

        /** Properties of an ExtensionRangeOptions. */
        interface IExtensionRangeOptions {

            /** ExtensionRangeOptions uninterpretedOption */
            uninterpretedOption?: (google.protobuf.IUninterpretedOption[]|null);

            /** ExtensionRangeOptions declaration */
            declaration?: (google.protobuf.ExtensionRangeOptions.IDeclaration[]|null);

            /** ExtensionRangeOptions features */
            features?: (google.protobuf.IFeatureSet|null);

            /** ExtensionRangeOptions verification */
            verification?: (google.protobuf.ExtensionRangeOptions.VerificationState|keyof typeof google.protobuf.ExtensionRangeOptions.VerificationState|null);
        }

        /** Represents an ExtensionRangeOptions. */
        class ExtensionRangeOptions implements IExtensionRangeOptions {

            /**
             * Constructs a new ExtensionRangeOptions.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IExtensionRangeOptions);

            /** ExtensionRangeOptions uninterpretedOption. */
            public uninterpretedOption: google.protobuf.IUninterpretedOption[];

            /** ExtensionRangeOptions declaration. */
            public declaration: google.protobuf.ExtensionRangeOptions.IDeclaration[];

            /** ExtensionRangeOptions features. */
            public features?: (google.protobuf.IFeatureSet|null);

            /** ExtensionRangeOptions verification. */
            public verification: (google.protobuf.ExtensionRangeOptions.VerificationState|keyof typeof google.protobuf.ExtensionRangeOptions.VerificationState);

            /**
             * Creates a new ExtensionRangeOptions instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ExtensionRangeOptions instance
             */
            public static create(properties?: google.protobuf.IExtensionRangeOptions): google.protobuf.ExtensionRangeOptions;

            /**
             * Encodes the specified ExtensionRangeOptions message. Does not implicitly {@link google.protobuf.ExtensionRangeOptions.verify|verify} messages.
             * @param message ExtensionRangeOptions message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IExtensionRangeOptions, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified ExtensionRangeOptions message, length delimited. Does not implicitly {@link google.protobuf.ExtensionRangeOptions.verify|verify} messages.
             * @param message ExtensionRangeOptions message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IExtensionRangeOptions, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an ExtensionRangeOptions message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns ExtensionRangeOptions
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.ExtensionRangeOptions;

            /**
             * Decodes an ExtensionRangeOptions message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns ExtensionRangeOptions
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.ExtensionRangeOptions;

            /**
             * Verifies an ExtensionRangeOptions message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates an ExtensionRangeOptions message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ExtensionRangeOptions
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.ExtensionRangeOptions;

            /**
             * Creates a plain object from an ExtensionRangeOptions message. Also converts values to other types if specified.
             * @param message ExtensionRangeOptions
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.ExtensionRangeOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ExtensionRangeOptions to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ExtensionRangeOptions
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace ExtensionRangeOptions {

            /** Properties of a Declaration. */
            interface IDeclaration {

                /** Declaration number */
                number?: (number|null);

                /** Declaration fullName */
                fullName?: (string|null);

                /** Declaration type */
                type?: (string|null);

                /** Declaration reserved */
                reserved?: (boolean|null);

                /** Declaration repeated */
                repeated?: (boolean|null);
            }

            /** Represents a Declaration. */
            class Declaration implements IDeclaration {

                /**
                 * Constructs a new Declaration.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: google.protobuf.ExtensionRangeOptions.IDeclaration);

                /** Declaration number. */
                public number: number;

                /** Declaration fullName. */
                public fullName: string;

                /** Declaration type. */
                public type: string;

                /** Declaration reserved. */
                public reserved: boolean;

                /** Declaration repeated. */
                public repeated: boolean;

                /**
                 * Creates a new Declaration instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Declaration instance
                 */
                public static create(properties?: google.protobuf.ExtensionRangeOptions.IDeclaration): google.protobuf.ExtensionRangeOptions.Declaration;

                /**
                 * Encodes the specified Declaration message. Does not implicitly {@link google.protobuf.ExtensionRangeOptions.Declaration.verify|verify} messages.
                 * @param message Declaration message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encode(message: google.protobuf.ExtensionRangeOptions.IDeclaration, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Encodes the specified Declaration message, length delimited. Does not implicitly {@link google.protobuf.ExtensionRangeOptions.Declaration.verify|verify} messages.
                 * @param message Declaration message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encodeDelimited(message: google.protobuf.ExtensionRangeOptions.IDeclaration, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Declaration message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns Declaration
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.ExtensionRangeOptions.Declaration;

                /**
                 * Decodes a Declaration message from the specified reader or buffer, length delimited.
                 * @param reader Reader or buffer to decode from
                 * @returns Declaration
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.ExtensionRangeOptions.Declaration;

                /**
                 * Verifies a Declaration message.
                 * @param message Plain object to verify
                 * @returns `null` if valid, otherwise the reason why it is not
                 */
                public static verify(message: { [k: string]: any }): (string|null);

                /**
                 * Creates a Declaration message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns Declaration
                 */
                public static fromObject(object: { [k: string]: any }): google.protobuf.ExtensionRangeOptions.Declaration;

                /**
                 * Creates a plain object from a Declaration message. Also converts values to other types if specified.
                 * @param message Declaration
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: google.protobuf.ExtensionRangeOptions.Declaration, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this Declaration to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for Declaration
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            /** VerificationState enum. */
            enum VerificationState {
                DECLARATION = 0,
                UNVERIFIED = 1
            }
        }

        /** Properties of a FieldDescriptorProto. */
        interface IFieldDescriptorProto {

            /** FieldDescriptorProto name */
            name?: (string|null);

            /** FieldDescriptorProto number */
            number?: (number|null);

            /** FieldDescriptorProto label */
            label?: (google.protobuf.FieldDescriptorProto.Label|keyof typeof google.protobuf.FieldDescriptorProto.Label|null);

            /** FieldDescriptorProto type */
            type?: (google.protobuf.FieldDescriptorProto.Type|keyof typeof google.protobuf.FieldDescriptorProto.Type|null);

            /** FieldDescriptorProto typeName */
            typeName?: (string|null);

            /** FieldDescriptorProto extendee */
            extendee?: (string|null);

            /** FieldDescriptorProto defaultValue */
            defaultValue?: (string|null);

            /** FieldDescriptorProto oneofIndex */
            oneofIndex?: (number|null);

            /** FieldDescriptorProto jsonName */
            jsonName?: (string|null);

            /** FieldDescriptorProto options */
            options?: (google.protobuf.IFieldOptions|null);

            /** FieldDescriptorProto proto3Optional */
            proto3Optional?: (boolean|null);
        }

        /** Represents a FieldDescriptorProto. */
        class FieldDescriptorProto implements IFieldDescriptorProto {

            /**
             * Constructs a new FieldDescriptorProto.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IFieldDescriptorProto);

            /** FieldDescriptorProto name. */
            public name: string;

            /** FieldDescriptorProto number. */
            public number: number;

            /** FieldDescriptorProto label. */
            public label: (google.protobuf.FieldDescriptorProto.Label|keyof typeof google.protobuf.FieldDescriptorProto.Label);

            /** FieldDescriptorProto type. */
            public type: (google.protobuf.FieldDescriptorProto.Type|keyof typeof google.protobuf.FieldDescriptorProto.Type);

            /** FieldDescriptorProto typeName. */
            public typeName: string;

            /** FieldDescriptorProto extendee. */
            public extendee: string;

            /** FieldDescriptorProto defaultValue. */
            public defaultValue: string;

            /** FieldDescriptorProto oneofIndex. */
            public oneofIndex: number;

            /** FieldDescriptorProto jsonName. */
            public jsonName: string;

            /** FieldDescriptorProto options. */
            public options?: (google.protobuf.IFieldOptions|null);

            /** FieldDescriptorProto proto3Optional. */
            public proto3Optional: boolean;

            /**
             * Creates a new FieldDescriptorProto instance using the specified properties.
             * @param [properties] Properties to set
             * @returns FieldDescriptorProto instance
             */
            public static create(properties?: google.protobuf.IFieldDescriptorProto): google.protobuf.FieldDescriptorProto;

            /**
             * Encodes the specified FieldDescriptorProto message. Does not implicitly {@link google.protobuf.FieldDescriptorProto.verify|verify} messages.
             * @param message FieldDescriptorProto message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IFieldDescriptorProto, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified FieldDescriptorProto message, length delimited. Does not implicitly {@link google.protobuf.FieldDescriptorProto.verify|verify} messages.
             * @param message FieldDescriptorProto message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IFieldDescriptorProto, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a FieldDescriptorProto message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns FieldDescriptorProto
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.FieldDescriptorProto;

            /**
             * Decodes a FieldDescriptorProto message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns FieldDescriptorProto
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.FieldDescriptorProto;

            /**
             * Verifies a FieldDescriptorProto message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a FieldDescriptorProto message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns FieldDescriptorProto
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.FieldDescriptorProto;

            /**
             * Creates a plain object from a FieldDescriptorProto message. Also converts values to other types if specified.
             * @param message FieldDescriptorProto
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.FieldDescriptorProto, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this FieldDescriptorProto to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for FieldDescriptorProto
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace FieldDescriptorProto {

            /** Type enum. */
            enum Type {
                TYPE_DOUBLE = 1,
                TYPE_FLOAT = 2,
                TYPE_INT64 = 3,
                TYPE_UINT64 = 4,
                TYPE_INT32 = 5,
                TYPE_FIXED64 = 6,
                TYPE_FIXED32 = 7,
                TYPE_BOOL = 8,
                TYPE_STRING = 9,
                TYPE_GROUP = 10,
                TYPE_MESSAGE = 11,
                TYPE_BYTES = 12,
                TYPE_UINT32 = 13,
                TYPE_ENUM = 14,
                TYPE_SFIXED32 = 15,
                TYPE_SFIXED64 = 16,
                TYPE_SINT32 = 17,
                TYPE_SINT64 = 18
            }

            /** Label enum. */
            enum Label {
                LABEL_OPTIONAL = 1,
                LABEL_REPEATED = 3,
                LABEL_REQUIRED = 2
            }
        }

        /** Properties of an OneofDescriptorProto. */
        interface IOneofDescriptorProto {

            /** OneofDescriptorProto name */
            name?: (string|null);

            /** OneofDescriptorProto options */
            options?: (google.protobuf.IOneofOptions|null);
        }

        /** Represents an OneofDescriptorProto. */
        class OneofDescriptorProto implements IOneofDescriptorProto {

            /**
             * Constructs a new OneofDescriptorProto.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IOneofDescriptorProto);

            /** OneofDescriptorProto name. */
            public name: string;

            /** OneofDescriptorProto options. */
            public options?: (google.protobuf.IOneofOptions|null);

            /**
             * Creates a new OneofDescriptorProto instance using the specified properties.
             * @param [properties] Properties to set
             * @returns OneofDescriptorProto instance
             */
            public static create(properties?: google.protobuf.IOneofDescriptorProto): google.protobuf.OneofDescriptorProto;

            /**
             * Encodes the specified OneofDescriptorProto message. Does not implicitly {@link google.protobuf.OneofDescriptorProto.verify|verify} messages.
             * @param message OneofDescriptorProto message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IOneofDescriptorProto, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified OneofDescriptorProto message, length delimited. Does not implicitly {@link google.protobuf.OneofDescriptorProto.verify|verify} messages.
             * @param message OneofDescriptorProto message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IOneofDescriptorProto, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an OneofDescriptorProto message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns OneofDescriptorProto
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.OneofDescriptorProto;

            /**
             * Decodes an OneofDescriptorProto message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns OneofDescriptorProto
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.OneofDescriptorProto;

            /**
             * Verifies an OneofDescriptorProto message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates an OneofDescriptorProto message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns OneofDescriptorProto
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.OneofDescriptorProto;

            /**
             * Creates a plain object from an OneofDescriptorProto message. Also converts values to other types if specified.
             * @param message OneofDescriptorProto
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.OneofDescriptorProto, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this OneofDescriptorProto to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for OneofDescriptorProto
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of an EnumDescriptorProto. */
        interface IEnumDescriptorProto {

            /** EnumDescriptorProto name */
            name?: (string|null);

            /** EnumDescriptorProto value */
            value?: (google.protobuf.IEnumValueDescriptorProto[]|null);

            /** EnumDescriptorProto options */
            options?: (google.protobuf.IEnumOptions|null);

            /** EnumDescriptorProto reservedRange */
            reservedRange?: (google.protobuf.EnumDescriptorProto.IEnumReservedRange[]|null);

            /** EnumDescriptorProto reservedName */
            reservedName?: (string[]|null);
        }

        /** Represents an EnumDescriptorProto. */
        class EnumDescriptorProto implements IEnumDescriptorProto {

            /**
             * Constructs a new EnumDescriptorProto.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IEnumDescriptorProto);

            /** EnumDescriptorProto name. */
            public name: string;

            /** EnumDescriptorProto value. */
            public value: google.protobuf.IEnumValueDescriptorProto[];

            /** EnumDescriptorProto options. */
            public options?: (google.protobuf.IEnumOptions|null);

            /** EnumDescriptorProto reservedRange. */
            public reservedRange: google.protobuf.EnumDescriptorProto.IEnumReservedRange[];

            /** EnumDescriptorProto reservedName. */
            public reservedName: string[];

            /**
             * Creates a new EnumDescriptorProto instance using the specified properties.
             * @param [properties] Properties to set
             * @returns EnumDescriptorProto instance
             */
            public static create(properties?: google.protobuf.IEnumDescriptorProto): google.protobuf.EnumDescriptorProto;

            /**
             * Encodes the specified EnumDescriptorProto message. Does not implicitly {@link google.protobuf.EnumDescriptorProto.verify|verify} messages.
             * @param message EnumDescriptorProto message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IEnumDescriptorProto, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified EnumDescriptorProto message, length delimited. Does not implicitly {@link google.protobuf.EnumDescriptorProto.verify|verify} messages.
             * @param message EnumDescriptorProto message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IEnumDescriptorProto, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an EnumDescriptorProto message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns EnumDescriptorProto
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.EnumDescriptorProto;

            /**
             * Decodes an EnumDescriptorProto message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns EnumDescriptorProto
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.EnumDescriptorProto;

            /**
             * Verifies an EnumDescriptorProto message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates an EnumDescriptorProto message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns EnumDescriptorProto
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.EnumDescriptorProto;

            /**
             * Creates a plain object from an EnumDescriptorProto message. Also converts values to other types if specified.
             * @param message EnumDescriptorProto
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.EnumDescriptorProto, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this EnumDescriptorProto to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for EnumDescriptorProto
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace EnumDescriptorProto {

            /** Properties of an EnumReservedRange. */
            interface IEnumReservedRange {

                /** EnumReservedRange start */
                start?: (number|null);

                /** EnumReservedRange end */
                end?: (number|null);
            }

            /** Represents an EnumReservedRange. */
            class EnumReservedRange implements IEnumReservedRange {

                /**
                 * Constructs a new EnumReservedRange.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: google.protobuf.EnumDescriptorProto.IEnumReservedRange);

                /** EnumReservedRange start. */
                public start: number;

                /** EnumReservedRange end. */
                public end: number;

                /**
                 * Creates a new EnumReservedRange instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns EnumReservedRange instance
                 */
                public static create(properties?: google.protobuf.EnumDescriptorProto.IEnumReservedRange): google.protobuf.EnumDescriptorProto.EnumReservedRange;

                /**
                 * Encodes the specified EnumReservedRange message. Does not implicitly {@link google.protobuf.EnumDescriptorProto.EnumReservedRange.verify|verify} messages.
                 * @param message EnumReservedRange message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encode(message: google.protobuf.EnumDescriptorProto.IEnumReservedRange, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Encodes the specified EnumReservedRange message, length delimited. Does not implicitly {@link google.protobuf.EnumDescriptorProto.EnumReservedRange.verify|verify} messages.
                 * @param message EnumReservedRange message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encodeDelimited(message: google.protobuf.EnumDescriptorProto.IEnumReservedRange, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes an EnumReservedRange message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns EnumReservedRange
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.EnumDescriptorProto.EnumReservedRange;

                /**
                 * Decodes an EnumReservedRange message from the specified reader or buffer, length delimited.
                 * @param reader Reader or buffer to decode from
                 * @returns EnumReservedRange
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.EnumDescriptorProto.EnumReservedRange;

                /**
                 * Verifies an EnumReservedRange message.
                 * @param message Plain object to verify
                 * @returns `null` if valid, otherwise the reason why it is not
                 */
                public static verify(message: { [k: string]: any }): (string|null);

                /**
                 * Creates an EnumReservedRange message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns EnumReservedRange
                 */
                public static fromObject(object: { [k: string]: any }): google.protobuf.EnumDescriptorProto.EnumReservedRange;

                /**
                 * Creates a plain object from an EnumReservedRange message. Also converts values to other types if specified.
                 * @param message EnumReservedRange
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: google.protobuf.EnumDescriptorProto.EnumReservedRange, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this EnumReservedRange to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for EnumReservedRange
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }
        }

        /** Properties of an EnumValueDescriptorProto. */
        interface IEnumValueDescriptorProto {

            /** EnumValueDescriptorProto name */
            name?: (string|null);

            /** EnumValueDescriptorProto number */
            number?: (number|null);

            /** EnumValueDescriptorProto options */
            options?: (google.protobuf.IEnumValueOptions|null);
        }

        /** Represents an EnumValueDescriptorProto. */
        class EnumValueDescriptorProto implements IEnumValueDescriptorProto {

            /**
             * Constructs a new EnumValueDescriptorProto.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IEnumValueDescriptorProto);

            /** EnumValueDescriptorProto name. */
            public name: string;

            /** EnumValueDescriptorProto number. */
            public number: number;

            /** EnumValueDescriptorProto options. */
            public options?: (google.protobuf.IEnumValueOptions|null);

            /**
             * Creates a new EnumValueDescriptorProto instance using the specified properties.
             * @param [properties] Properties to set
             * @returns EnumValueDescriptorProto instance
             */
            public static create(properties?: google.protobuf.IEnumValueDescriptorProto): google.protobuf.EnumValueDescriptorProto;

            /**
             * Encodes the specified EnumValueDescriptorProto message. Does not implicitly {@link google.protobuf.EnumValueDescriptorProto.verify|verify} messages.
             * @param message EnumValueDescriptorProto message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IEnumValueDescriptorProto, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified EnumValueDescriptorProto message, length delimited. Does not implicitly {@link google.protobuf.EnumValueDescriptorProto.verify|verify} messages.
             * @param message EnumValueDescriptorProto message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IEnumValueDescriptorProto, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an EnumValueDescriptorProto message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns EnumValueDescriptorProto
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.EnumValueDescriptorProto;

            /**
             * Decodes an EnumValueDescriptorProto message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns EnumValueDescriptorProto
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.EnumValueDescriptorProto;

            /**
             * Verifies an EnumValueDescriptorProto message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates an EnumValueDescriptorProto message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns EnumValueDescriptorProto
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.EnumValueDescriptorProto;

            /**
             * Creates a plain object from an EnumValueDescriptorProto message. Also converts values to other types if specified.
             * @param message EnumValueDescriptorProto
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.EnumValueDescriptorProto, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this EnumValueDescriptorProto to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for EnumValueDescriptorProto
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a ServiceDescriptorProto. */
        interface IServiceDescriptorProto {

            /** ServiceDescriptorProto name */
            name?: (string|null);

            /** ServiceDescriptorProto method */
            method?: (google.protobuf.IMethodDescriptorProto[]|null);

            /** ServiceDescriptorProto options */
            options?: (google.protobuf.IServiceOptions|null);
        }

        /** Represents a ServiceDescriptorProto. */
        class ServiceDescriptorProto implements IServiceDescriptorProto {

            /**
             * Constructs a new ServiceDescriptorProto.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IServiceDescriptorProto);

            /** ServiceDescriptorProto name. */
            public name: string;

            /** ServiceDescriptorProto method. */
            public method: google.protobuf.IMethodDescriptorProto[];

            /** ServiceDescriptorProto options. */
            public options?: (google.protobuf.IServiceOptions|null);

            /**
             * Creates a new ServiceDescriptorProto instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ServiceDescriptorProto instance
             */
            public static create(properties?: google.protobuf.IServiceDescriptorProto): google.protobuf.ServiceDescriptorProto;

            /**
             * Encodes the specified ServiceDescriptorProto message. Does not implicitly {@link google.protobuf.ServiceDescriptorProto.verify|verify} messages.
             * @param message ServiceDescriptorProto message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IServiceDescriptorProto, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified ServiceDescriptorProto message, length delimited. Does not implicitly {@link google.protobuf.ServiceDescriptorProto.verify|verify} messages.
             * @param message ServiceDescriptorProto message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IServiceDescriptorProto, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ServiceDescriptorProto message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns ServiceDescriptorProto
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.ServiceDescriptorProto;

            /**
             * Decodes a ServiceDescriptorProto message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns ServiceDescriptorProto
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.ServiceDescriptorProto;

            /**
             * Verifies a ServiceDescriptorProto message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a ServiceDescriptorProto message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ServiceDescriptorProto
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.ServiceDescriptorProto;

            /**
             * Creates a plain object from a ServiceDescriptorProto message. Also converts values to other types if specified.
             * @param message ServiceDescriptorProto
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.ServiceDescriptorProto, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ServiceDescriptorProto to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ServiceDescriptorProto
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a MethodDescriptorProto. */
        interface IMethodDescriptorProto {

            /** MethodDescriptorProto name */
            name?: (string|null);

            /** MethodDescriptorProto inputType */
            inputType?: (string|null);

            /** MethodDescriptorProto outputType */
            outputType?: (string|null);

            /** MethodDescriptorProto options */
            options?: (google.protobuf.IMethodOptions|null);

            /** MethodDescriptorProto clientStreaming */
            clientStreaming?: (boolean|null);

            /** MethodDescriptorProto serverStreaming */
            serverStreaming?: (boolean|null);
        }

        /** Represents a MethodDescriptorProto. */
        class MethodDescriptorProto implements IMethodDescriptorProto {

            /**
             * Constructs a new MethodDescriptorProto.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IMethodDescriptorProto);

            /** MethodDescriptorProto name. */
            public name: string;

            /** MethodDescriptorProto inputType. */
            public inputType: string;

            /** MethodDescriptorProto outputType. */
            public outputType: string;

            /** MethodDescriptorProto options. */
            public options?: (google.protobuf.IMethodOptions|null);

            /** MethodDescriptorProto clientStreaming. */
            public clientStreaming: boolean;

            /** MethodDescriptorProto serverStreaming. */
            public serverStreaming: boolean;

            /**
             * Creates a new MethodDescriptorProto instance using the specified properties.
             * @param [properties] Properties to set
             * @returns MethodDescriptorProto instance
             */
            public static create(properties?: google.protobuf.IMethodDescriptorProto): google.protobuf.MethodDescriptorProto;

            /**
             * Encodes the specified MethodDescriptorProto message. Does not implicitly {@link google.protobuf.MethodDescriptorProto.verify|verify} messages.
             * @param message MethodDescriptorProto message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IMethodDescriptorProto, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified MethodDescriptorProto message, length delimited. Does not implicitly {@link google.protobuf.MethodDescriptorProto.verify|verify} messages.
             * @param message MethodDescriptorProto message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IMethodDescriptorProto, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a MethodDescriptorProto message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns MethodDescriptorProto
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.MethodDescriptorProto;

            /**
             * Decodes a MethodDescriptorProto message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns MethodDescriptorProto
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.MethodDescriptorProto;

            /**
             * Verifies a MethodDescriptorProto message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a MethodDescriptorProto message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns MethodDescriptorProto
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.MethodDescriptorProto;

            /**
             * Creates a plain object from a MethodDescriptorProto message. Also converts values to other types if specified.
             * @param message MethodDescriptorProto
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.MethodDescriptorProto, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this MethodDescriptorProto to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for MethodDescriptorProto
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a FileOptions. */
        interface IFileOptions {

            /** FileOptions javaPackage */
            javaPackage?: (string|null);

            /** FileOptions javaOuterClassname */
            javaOuterClassname?: (string|null);

            /** FileOptions javaMultipleFiles */
            javaMultipleFiles?: (boolean|null);

            /** FileOptions javaGenerateEqualsAndHash */
            javaGenerateEqualsAndHash?: (boolean|null);

            /** FileOptions javaStringCheckUtf8 */
            javaStringCheckUtf8?: (boolean|null);

            /** FileOptions optimizeFor */
            optimizeFor?: (google.protobuf.FileOptions.OptimizeMode|keyof typeof google.protobuf.FileOptions.OptimizeMode|null);

            /** FileOptions goPackage */
            goPackage?: (string|null);

            /** FileOptions ccGenericServices */
            ccGenericServices?: (boolean|null);

            /** FileOptions javaGenericServices */
            javaGenericServices?: (boolean|null);

            /** FileOptions pyGenericServices */
            pyGenericServices?: (boolean|null);

            /** FileOptions deprecated */
            deprecated?: (boolean|null);

            /** FileOptions ccEnableArenas */
            ccEnableArenas?: (boolean|null);

            /** FileOptions objcClassPrefix */
            objcClassPrefix?: (string|null);

            /** FileOptions csharpNamespace */
            csharpNamespace?: (string|null);

            /** FileOptions swiftPrefix */
            swiftPrefix?: (string|null);

            /** FileOptions phpClassPrefix */
            phpClassPrefix?: (string|null);

            /** FileOptions phpNamespace */
            phpNamespace?: (string|null);

            /** FileOptions phpMetadataNamespace */
            phpMetadataNamespace?: (string|null);

            /** FileOptions rubyPackage */
            rubyPackage?: (string|null);

            /** FileOptions features */
            features?: (google.protobuf.IFeatureSet|null);

            /** FileOptions uninterpretedOption */
            uninterpretedOption?: (google.protobuf.IUninterpretedOption[]|null);

            /** FileOptions .google.api.resourceDefinition */
            ".google.api.resourceDefinition"?: (google.api.IResourceDescriptor[]|null);
        }

        /** Represents a FileOptions. */
        class FileOptions implements IFileOptions {

            /**
             * Constructs a new FileOptions.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IFileOptions);

            /** FileOptions javaPackage. */
            public javaPackage: string;

            /** FileOptions javaOuterClassname. */
            public javaOuterClassname: string;

            /** FileOptions javaMultipleFiles. */
            public javaMultipleFiles: boolean;

            /** FileOptions javaGenerateEqualsAndHash. */
            public javaGenerateEqualsAndHash: boolean;

            /** FileOptions javaStringCheckUtf8. */
            public javaStringCheckUtf8: boolean;

            /** FileOptions optimizeFor. */
            public optimizeFor: (google.protobuf.FileOptions.OptimizeMode|keyof typeof google.protobuf.FileOptions.OptimizeMode);

            /** FileOptions goPackage. */
            public goPackage: string;

            /** FileOptions ccGenericServices. */
            public ccGenericServices: boolean;

            /** FileOptions javaGenericServices. */
            public javaGenericServices: boolean;

            /** FileOptions pyGenericServices. */
            public pyGenericServices: boolean;

            /** FileOptions deprecated. */
            public deprecated: boolean;

            /** FileOptions ccEnableArenas. */
            public ccEnableArenas: boolean;

            /** FileOptions objcClassPrefix. */
            public objcClassPrefix: string;

            /** FileOptions csharpNamespace. */
            public csharpNamespace: string;

            /** FileOptions swiftPrefix. */
            public swiftPrefix: string;

            /** FileOptions phpClassPrefix. */
            public phpClassPrefix: string;

            /** FileOptions phpNamespace. */
            public phpNamespace: string;

            /** FileOptions phpMetadataNamespace. */
            public phpMetadataNamespace: string;

            /** FileOptions rubyPackage. */
            public rubyPackage: string;

            /** FileOptions features. */
            public features?: (google.protobuf.IFeatureSet|null);

            /** FileOptions uninterpretedOption. */
            public uninterpretedOption: google.protobuf.IUninterpretedOption[];

            /**
             * Creates a new FileOptions instance using the specified properties.
             * @param [properties] Properties to set
             * @returns FileOptions instance
             */
            public static create(properties?: google.protobuf.IFileOptions): google.protobuf.FileOptions;

            /**
             * Encodes the specified FileOptions message. Does not implicitly {@link google.protobuf.FileOptions.verify|verify} messages.
             * @param message FileOptions message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IFileOptions, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified FileOptions message, length delimited. Does not implicitly {@link google.protobuf.FileOptions.verify|verify} messages.
             * @param message FileOptions message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IFileOptions, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a FileOptions message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns FileOptions
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.FileOptions;

            /**
             * Decodes a FileOptions message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns FileOptions
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.FileOptions;

            /**
             * Verifies a FileOptions message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a FileOptions message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns FileOptions
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.FileOptions;

            /**
             * Creates a plain object from a FileOptions message. Also converts values to other types if specified.
             * @param message FileOptions
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.FileOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this FileOptions to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for FileOptions
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace FileOptions {

            /** OptimizeMode enum. */
            enum OptimizeMode {
                SPEED = 1,
                CODE_SIZE = 2,
                LITE_RUNTIME = 3
            }
        }

        /** Properties of a MessageOptions. */
        interface IMessageOptions {

            /** MessageOptions messageSetWireFormat */
            messageSetWireFormat?: (boolean|null);

            /** MessageOptions noStandardDescriptorAccessor */
            noStandardDescriptorAccessor?: (boolean|null);

            /** MessageOptions deprecated */
            deprecated?: (boolean|null);

            /** MessageOptions mapEntry */
            mapEntry?: (boolean|null);

            /** MessageOptions deprecatedLegacyJsonFieldConflicts */
            deprecatedLegacyJsonFieldConflicts?: (boolean|null);

            /** MessageOptions features */
            features?: (google.protobuf.IFeatureSet|null);

            /** MessageOptions uninterpretedOption */
            uninterpretedOption?: (google.protobuf.IUninterpretedOption[]|null);

            /** MessageOptions .google.api.resource */
            ".google.api.resource"?: (google.api.IResourceDescriptor|null);
        }

        /** Represents a MessageOptions. */
        class MessageOptions implements IMessageOptions {

            /**
             * Constructs a new MessageOptions.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IMessageOptions);

            /** MessageOptions messageSetWireFormat. */
            public messageSetWireFormat: boolean;

            /** MessageOptions noStandardDescriptorAccessor. */
            public noStandardDescriptorAccessor: boolean;

            /** MessageOptions deprecated. */
            public deprecated: boolean;

            /** MessageOptions mapEntry. */
            public mapEntry: boolean;

            /** MessageOptions deprecatedLegacyJsonFieldConflicts. */
            public deprecatedLegacyJsonFieldConflicts: boolean;

            /** MessageOptions features. */
            public features?: (google.protobuf.IFeatureSet|null);

            /** MessageOptions uninterpretedOption. */
            public uninterpretedOption: google.protobuf.IUninterpretedOption[];

            /**
             * Creates a new MessageOptions instance using the specified properties.
             * @param [properties] Properties to set
             * @returns MessageOptions instance
             */
            public static create(properties?: google.protobuf.IMessageOptions): google.protobuf.MessageOptions;

            /**
             * Encodes the specified MessageOptions message. Does not implicitly {@link google.protobuf.MessageOptions.verify|verify} messages.
             * @param message MessageOptions message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IMessageOptions, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified MessageOptions message, length delimited. Does not implicitly {@link google.protobuf.MessageOptions.verify|verify} messages.
             * @param message MessageOptions message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IMessageOptions, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a MessageOptions message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns MessageOptions
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.MessageOptions;

            /**
             * Decodes a MessageOptions message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns MessageOptions
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.MessageOptions;

            /**
             * Verifies a MessageOptions message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a MessageOptions message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns MessageOptions
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.MessageOptions;

            /**
             * Creates a plain object from a MessageOptions message. Also converts values to other types if specified.
             * @param message MessageOptions
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.MessageOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this MessageOptions to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for MessageOptions
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a FieldOptions. */
        interface IFieldOptions {

            /** FieldOptions ctype */
            ctype?: (google.protobuf.FieldOptions.CType|keyof typeof google.protobuf.FieldOptions.CType|null);

            /** FieldOptions packed */
            packed?: (boolean|null);

            /** FieldOptions jstype */
            jstype?: (google.protobuf.FieldOptions.JSType|keyof typeof google.protobuf.FieldOptions.JSType|null);

            /** FieldOptions lazy */
            lazy?: (boolean|null);

            /** FieldOptions unverifiedLazy */
            unverifiedLazy?: (boolean|null);

            /** FieldOptions deprecated */
            deprecated?: (boolean|null);

            /** FieldOptions weak */
            weak?: (boolean|null);

            /** FieldOptions debugRedact */
            debugRedact?: (boolean|null);

            /** FieldOptions retention */
            retention?: (google.protobuf.FieldOptions.OptionRetention|keyof typeof google.protobuf.FieldOptions.OptionRetention|null);

            /** FieldOptions targets */
            targets?: (google.protobuf.FieldOptions.OptionTargetType[]|null);

            /** FieldOptions editionDefaults */
            editionDefaults?: (google.protobuf.FieldOptions.IEditionDefault[]|null);

            /** FieldOptions features */
            features?: (google.protobuf.IFeatureSet|null);

            /** FieldOptions uninterpretedOption */
            uninterpretedOption?: (google.protobuf.IUninterpretedOption[]|null);

            /** FieldOptions .google.api.fieldBehavior */
            ".google.api.fieldBehavior"?: (google.api.FieldBehavior[]|null);

            /** FieldOptions .google.api.resourceReference */
            ".google.api.resourceReference"?: (google.api.IResourceReference|null);
        }

        /** Represents a FieldOptions. */
        class FieldOptions implements IFieldOptions {

            /**
             * Constructs a new FieldOptions.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IFieldOptions);

            /** FieldOptions ctype. */
            public ctype: (google.protobuf.FieldOptions.CType|keyof typeof google.protobuf.FieldOptions.CType);

            /** FieldOptions packed. */
            public packed: boolean;

            /** FieldOptions jstype. */
            public jstype: (google.protobuf.FieldOptions.JSType|keyof typeof google.protobuf.FieldOptions.JSType);

            /** FieldOptions lazy. */
            public lazy: boolean;

            /** FieldOptions unverifiedLazy. */
            public unverifiedLazy: boolean;

            /** FieldOptions deprecated. */
            public deprecated: boolean;

            /** FieldOptions weak. */
            public weak: boolean;

            /** FieldOptions debugRedact. */
            public debugRedact: boolean;

            /** FieldOptions retention. */
            public retention: (google.protobuf.FieldOptions.OptionRetention|keyof typeof google.protobuf.FieldOptions.OptionRetention);

            /** FieldOptions targets. */
            public targets: google.protobuf.FieldOptions.OptionTargetType[];

            /** FieldOptions editionDefaults. */
            public editionDefaults: google.protobuf.FieldOptions.IEditionDefault[];

            /** FieldOptions features. */
            public features?: (google.protobuf.IFeatureSet|null);

            /** FieldOptions uninterpretedOption. */
            public uninterpretedOption: google.protobuf.IUninterpretedOption[];

            /**
             * Creates a new FieldOptions instance using the specified properties.
             * @param [properties] Properties to set
             * @returns FieldOptions instance
             */
            public static create(properties?: google.protobuf.IFieldOptions): google.protobuf.FieldOptions;

            /**
             * Encodes the specified FieldOptions message. Does not implicitly {@link google.protobuf.FieldOptions.verify|verify} messages.
             * @param message FieldOptions message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IFieldOptions, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified FieldOptions message, length delimited. Does not implicitly {@link google.protobuf.FieldOptions.verify|verify} messages.
             * @param message FieldOptions message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IFieldOptions, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a FieldOptions message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns FieldOptions
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.FieldOptions;

            /**
             * Decodes a FieldOptions message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns FieldOptions
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.FieldOptions;

            /**
             * Verifies a FieldOptions message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a FieldOptions message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns FieldOptions
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.FieldOptions;

            /**
             * Creates a plain object from a FieldOptions message. Also converts values to other types if specified.
             * @param message FieldOptions
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.FieldOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this FieldOptions to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for FieldOptions
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace FieldOptions {

            /** CType enum. */
            enum CType {
                STRING = 0,
                CORD = 1,
                STRING_PIECE = 2
            }

            /** JSType enum. */
            enum JSType {
                JS_NORMAL = 0,
                JS_STRING = 1,
                JS_NUMBER = 2
            }

            /** OptionRetention enum. */
            enum OptionRetention {
                RETENTION_UNKNOWN = 0,
                RETENTION_RUNTIME = 1,
                RETENTION_SOURCE = 2
            }

            /** OptionTargetType enum. */
            enum OptionTargetType {
                TARGET_TYPE_UNKNOWN = 0,
                TARGET_TYPE_FILE = 1,
                TARGET_TYPE_EXTENSION_RANGE = 2,
                TARGET_TYPE_MESSAGE = 3,
                TARGET_TYPE_FIELD = 4,
                TARGET_TYPE_ONEOF = 5,
                TARGET_TYPE_ENUM = 6,
                TARGET_TYPE_ENUM_ENTRY = 7,
                TARGET_TYPE_SERVICE = 8,
                TARGET_TYPE_METHOD = 9
            }

            /** Properties of an EditionDefault. */
            interface IEditionDefault {

                /** EditionDefault edition */
                edition?: (google.protobuf.Edition|keyof typeof google.protobuf.Edition|null);

                /** EditionDefault value */
                value?: (string|null);
            }

            /** Represents an EditionDefault. */
            class EditionDefault implements IEditionDefault {

                /**
                 * Constructs a new EditionDefault.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: google.protobuf.FieldOptions.IEditionDefault);

                /** EditionDefault edition. */
                public edition: (google.protobuf.Edition|keyof typeof google.protobuf.Edition);

                /** EditionDefault value. */
                public value: string;

                /**
                 * Creates a new EditionDefault instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns EditionDefault instance
                 */
                public static create(properties?: google.protobuf.FieldOptions.IEditionDefault): google.protobuf.FieldOptions.EditionDefault;

                /**
                 * Encodes the specified EditionDefault message. Does not implicitly {@link google.protobuf.FieldOptions.EditionDefault.verify|verify} messages.
                 * @param message EditionDefault message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encode(message: google.protobuf.FieldOptions.IEditionDefault, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Encodes the specified EditionDefault message, length delimited. Does not implicitly {@link google.protobuf.FieldOptions.EditionDefault.verify|verify} messages.
                 * @param message EditionDefault message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encodeDelimited(message: google.protobuf.FieldOptions.IEditionDefault, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes an EditionDefault message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns EditionDefault
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.FieldOptions.EditionDefault;

                /**
                 * Decodes an EditionDefault message from the specified reader or buffer, length delimited.
                 * @param reader Reader or buffer to decode from
                 * @returns EditionDefault
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.FieldOptions.EditionDefault;

                /**
                 * Verifies an EditionDefault message.
                 * @param message Plain object to verify
                 * @returns `null` if valid, otherwise the reason why it is not
                 */
                public static verify(message: { [k: string]: any }): (string|null);

                /**
                 * Creates an EditionDefault message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns EditionDefault
                 */
                public static fromObject(object: { [k: string]: any }): google.protobuf.FieldOptions.EditionDefault;

                /**
                 * Creates a plain object from an EditionDefault message. Also converts values to other types if specified.
                 * @param message EditionDefault
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: google.protobuf.FieldOptions.EditionDefault, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this EditionDefault to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for EditionDefault
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }
        }

        /** Properties of an OneofOptions. */
        interface IOneofOptions {

            /** OneofOptions features */
            features?: (google.protobuf.IFeatureSet|null);

            /** OneofOptions uninterpretedOption */
            uninterpretedOption?: (google.protobuf.IUninterpretedOption[]|null);
        }

        /** Represents an OneofOptions. */
        class OneofOptions implements IOneofOptions {

            /**
             * Constructs a new OneofOptions.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IOneofOptions);

            /** OneofOptions features. */
            public features?: (google.protobuf.IFeatureSet|null);

            /** OneofOptions uninterpretedOption. */
            public uninterpretedOption: google.protobuf.IUninterpretedOption[];

            /**
             * Creates a new OneofOptions instance using the specified properties.
             * @param [properties] Properties to set
             * @returns OneofOptions instance
             */
            public static create(properties?: google.protobuf.IOneofOptions): google.protobuf.OneofOptions;

            /**
             * Encodes the specified OneofOptions message. Does not implicitly {@link google.protobuf.OneofOptions.verify|verify} messages.
             * @param message OneofOptions message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IOneofOptions, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified OneofOptions message, length delimited. Does not implicitly {@link google.protobuf.OneofOptions.verify|verify} messages.
             * @param message OneofOptions message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IOneofOptions, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an OneofOptions message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns OneofOptions
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.OneofOptions;

            /**
             * Decodes an OneofOptions message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns OneofOptions
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.OneofOptions;

            /**
             * Verifies an OneofOptions message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates an OneofOptions message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns OneofOptions
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.OneofOptions;

            /**
             * Creates a plain object from an OneofOptions message. Also converts values to other types if specified.
             * @param message OneofOptions
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.OneofOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this OneofOptions to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for OneofOptions
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of an EnumOptions. */
        interface IEnumOptions {

            /** EnumOptions allowAlias */
            allowAlias?: (boolean|null);

            /** EnumOptions deprecated */
            deprecated?: (boolean|null);

            /** EnumOptions deprecatedLegacyJsonFieldConflicts */
            deprecatedLegacyJsonFieldConflicts?: (boolean|null);

            /** EnumOptions features */
            features?: (google.protobuf.IFeatureSet|null);

            /** EnumOptions uninterpretedOption */
            uninterpretedOption?: (google.protobuf.IUninterpretedOption[]|null);
        }

        /** Represents an EnumOptions. */
        class EnumOptions implements IEnumOptions {

            /**
             * Constructs a new EnumOptions.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IEnumOptions);

            /** EnumOptions allowAlias. */
            public allowAlias: boolean;

            /** EnumOptions deprecated. */
            public deprecated: boolean;

            /** EnumOptions deprecatedLegacyJsonFieldConflicts. */
            public deprecatedLegacyJsonFieldConflicts: boolean;

            /** EnumOptions features. */
            public features?: (google.protobuf.IFeatureSet|null);

            /** EnumOptions uninterpretedOption. */
            public uninterpretedOption: google.protobuf.IUninterpretedOption[];

            /**
             * Creates a new EnumOptions instance using the specified properties.
             * @param [properties] Properties to set
             * @returns EnumOptions instance
             */
            public static create(properties?: google.protobuf.IEnumOptions): google.protobuf.EnumOptions;

            /**
             * Encodes the specified EnumOptions message. Does not implicitly {@link google.protobuf.EnumOptions.verify|verify} messages.
             * @param message EnumOptions message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IEnumOptions, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified EnumOptions message, length delimited. Does not implicitly {@link google.protobuf.EnumOptions.verify|verify} messages.
             * @param message EnumOptions message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IEnumOptions, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an EnumOptions message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns EnumOptions
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.EnumOptions;

            /**
             * Decodes an EnumOptions message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns EnumOptions
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.EnumOptions;

            /**
             * Verifies an EnumOptions message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates an EnumOptions message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns EnumOptions
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.EnumOptions;

            /**
             * Creates a plain object from an EnumOptions message. Also converts values to other types if specified.
             * @param message EnumOptions
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.EnumOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this EnumOptions to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for EnumOptions
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of an EnumValueOptions. */
        interface IEnumValueOptions {

            /** EnumValueOptions deprecated */
            deprecated?: (boolean|null);

            /** EnumValueOptions features */
            features?: (google.protobuf.IFeatureSet|null);

            /** EnumValueOptions debugRedact */
            debugRedact?: (boolean|null);

            /** EnumValueOptions uninterpretedOption */
            uninterpretedOption?: (google.protobuf.IUninterpretedOption[]|null);
        }

        /** Represents an EnumValueOptions. */
        class EnumValueOptions implements IEnumValueOptions {

            /**
             * Constructs a new EnumValueOptions.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IEnumValueOptions);

            /** EnumValueOptions deprecated. */
            public deprecated: boolean;

            /** EnumValueOptions features. */
            public features?: (google.protobuf.IFeatureSet|null);

            /** EnumValueOptions debugRedact. */
            public debugRedact: boolean;

            /** EnumValueOptions uninterpretedOption. */
            public uninterpretedOption: google.protobuf.IUninterpretedOption[];

            /**
             * Creates a new EnumValueOptions instance using the specified properties.
             * @param [properties] Properties to set
             * @returns EnumValueOptions instance
             */
            public static create(properties?: google.protobuf.IEnumValueOptions): google.protobuf.EnumValueOptions;

            /**
             * Encodes the specified EnumValueOptions message. Does not implicitly {@link google.protobuf.EnumValueOptions.verify|verify} messages.
             * @param message EnumValueOptions message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IEnumValueOptions, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified EnumValueOptions message, length delimited. Does not implicitly {@link google.protobuf.EnumValueOptions.verify|verify} messages.
             * @param message EnumValueOptions message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IEnumValueOptions, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an EnumValueOptions message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns EnumValueOptions
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.EnumValueOptions;

            /**
             * Decodes an EnumValueOptions message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns EnumValueOptions
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.EnumValueOptions;

            /**
             * Verifies an EnumValueOptions message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates an EnumValueOptions message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns EnumValueOptions
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.EnumValueOptions;

            /**
             * Creates a plain object from an EnumValueOptions message. Also converts values to other types if specified.
             * @param message EnumValueOptions
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.EnumValueOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this EnumValueOptions to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for EnumValueOptions
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a ServiceOptions. */
        interface IServiceOptions {

            /** ServiceOptions features */
            features?: (google.protobuf.IFeatureSet|null);

            /** ServiceOptions deprecated */
            deprecated?: (boolean|null);

            /** ServiceOptions uninterpretedOption */
            uninterpretedOption?: (google.protobuf.IUninterpretedOption[]|null);

            /** ServiceOptions .google.api.defaultHost */
            ".google.api.defaultHost"?: (string|null);

            /** ServiceOptions .google.api.oauthScopes */
            ".google.api.oauthScopes"?: (string|null);

            /** ServiceOptions .google.api.apiVersion */
            ".google.api.apiVersion"?: (string|null);
        }

        /** Represents a ServiceOptions. */
        class ServiceOptions implements IServiceOptions {

            /**
             * Constructs a new ServiceOptions.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IServiceOptions);

            /** ServiceOptions features. */
            public features?: (google.protobuf.IFeatureSet|null);

            /** ServiceOptions deprecated. */
            public deprecated: boolean;

            /** ServiceOptions uninterpretedOption. */
            public uninterpretedOption: google.protobuf.IUninterpretedOption[];

            /**
             * Creates a new ServiceOptions instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ServiceOptions instance
             */
            public static create(properties?: google.protobuf.IServiceOptions): google.protobuf.ServiceOptions;

            /**
             * Encodes the specified ServiceOptions message. Does not implicitly {@link google.protobuf.ServiceOptions.verify|verify} messages.
             * @param message ServiceOptions message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IServiceOptions, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified ServiceOptions message, length delimited. Does not implicitly {@link google.protobuf.ServiceOptions.verify|verify} messages.
             * @param message ServiceOptions message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IServiceOptions, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ServiceOptions message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns ServiceOptions
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.ServiceOptions;

            /**
             * Decodes a ServiceOptions message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns ServiceOptions
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.ServiceOptions;

            /**
             * Verifies a ServiceOptions message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a ServiceOptions message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ServiceOptions
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.ServiceOptions;

            /**
             * Creates a plain object from a ServiceOptions message. Also converts values to other types if specified.
             * @param message ServiceOptions
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.ServiceOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ServiceOptions to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ServiceOptions
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a MethodOptions. */
        interface IMethodOptions {

            /** MethodOptions deprecated */
            deprecated?: (boolean|null);

            /** MethodOptions idempotencyLevel */
            idempotencyLevel?: (google.protobuf.MethodOptions.IdempotencyLevel|keyof typeof google.protobuf.MethodOptions.IdempotencyLevel|null);

            /** MethodOptions features */
            features?: (google.protobuf.IFeatureSet|null);

            /** MethodOptions uninterpretedOption */
            uninterpretedOption?: (google.protobuf.IUninterpretedOption[]|null);

            /** MethodOptions .google.api.http */
            ".google.api.http"?: (google.api.IHttpRule|null);

            /** MethodOptions .google.api.methodSignature */
            ".google.api.methodSignature"?: (string[]|null);

            /** MethodOptions .google.longrunning.operationInfo */
            ".google.longrunning.operationInfo"?: (google.longrunning.IOperationInfo|null);
        }

        /** Represents a MethodOptions. */
        class MethodOptions implements IMethodOptions {

            /**
             * Constructs a new MethodOptions.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IMethodOptions);

            /** MethodOptions deprecated. */
            public deprecated: boolean;

            /** MethodOptions idempotencyLevel. */
            public idempotencyLevel: (google.protobuf.MethodOptions.IdempotencyLevel|keyof typeof google.protobuf.MethodOptions.IdempotencyLevel);

            /** MethodOptions features. */
            public features?: (google.protobuf.IFeatureSet|null);

            /** MethodOptions uninterpretedOption. */
            public uninterpretedOption: google.protobuf.IUninterpretedOption[];

            /**
             * Creates a new MethodOptions instance using the specified properties.
             * @param [properties] Properties to set
             * @returns MethodOptions instance
             */
            public static create(properties?: google.protobuf.IMethodOptions): google.protobuf.MethodOptions;

            /**
             * Encodes the specified MethodOptions message. Does not implicitly {@link google.protobuf.MethodOptions.verify|verify} messages.
             * @param message MethodOptions message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IMethodOptions, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified MethodOptions message, length delimited. Does not implicitly {@link google.protobuf.MethodOptions.verify|verify} messages.
             * @param message MethodOptions message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IMethodOptions, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a MethodOptions message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns MethodOptions
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.MethodOptions;

            /**
             * Decodes a MethodOptions message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns MethodOptions
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.MethodOptions;

            /**
             * Verifies a MethodOptions message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a MethodOptions message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns MethodOptions
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.MethodOptions;

            /**
             * Creates a plain object from a MethodOptions message. Also converts values to other types if specified.
             * @param message MethodOptions
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.MethodOptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this MethodOptions to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for MethodOptions
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace MethodOptions {

            /** IdempotencyLevel enum. */
            enum IdempotencyLevel {
                IDEMPOTENCY_UNKNOWN = 0,
                NO_SIDE_EFFECTS = 1,
                IDEMPOTENT = 2
            }
        }

        /** Properties of an UninterpretedOption. */
        interface IUninterpretedOption {

            /** UninterpretedOption name */
            name?: (google.protobuf.UninterpretedOption.INamePart[]|null);

            /** UninterpretedOption identifierValue */
            identifierValue?: (string|null);

            /** UninterpretedOption positiveIntValue */
            positiveIntValue?: (number|Long|string|null);

            /** UninterpretedOption negativeIntValue */
            negativeIntValue?: (number|Long|string|null);

            /** UninterpretedOption doubleValue */
            doubleValue?: (number|null);

            /** UninterpretedOption stringValue */
            stringValue?: (Uint8Array|Buffer|string|null);

            /** UninterpretedOption aggregateValue */
            aggregateValue?: (string|null);
        }

        /** Represents an UninterpretedOption. */
        class UninterpretedOption implements IUninterpretedOption {

            /**
             * Constructs a new UninterpretedOption.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IUninterpretedOption);

            /** UninterpretedOption name. */
            public name: google.protobuf.UninterpretedOption.INamePart[];

            /** UninterpretedOption identifierValue. */
            public identifierValue: string;

            /** UninterpretedOption positiveIntValue. */
            public positiveIntValue: (number|Long|string);

            /** UninterpretedOption negativeIntValue. */
            public negativeIntValue: (number|Long|string);

            /** UninterpretedOption doubleValue. */
            public doubleValue: number;

            /** UninterpretedOption stringValue. */
            public stringValue: (Uint8Array|Buffer|string);

            /** UninterpretedOption aggregateValue. */
            public aggregateValue: string;

            /**
             * Creates a new UninterpretedOption instance using the specified properties.
             * @param [properties] Properties to set
             * @returns UninterpretedOption instance
             */
            public static create(properties?: google.protobuf.IUninterpretedOption): google.protobuf.UninterpretedOption;

            /**
             * Encodes the specified UninterpretedOption message. Does not implicitly {@link google.protobuf.UninterpretedOption.verify|verify} messages.
             * @param message UninterpretedOption message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IUninterpretedOption, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified UninterpretedOption message, length delimited. Does not implicitly {@link google.protobuf.UninterpretedOption.verify|verify} messages.
             * @param message UninterpretedOption message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IUninterpretedOption, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an UninterpretedOption message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns UninterpretedOption
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.UninterpretedOption;

            /**
             * Decodes an UninterpretedOption message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns UninterpretedOption
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.UninterpretedOption;

            /**
             * Verifies an UninterpretedOption message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates an UninterpretedOption message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns UninterpretedOption
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.UninterpretedOption;

            /**
             * Creates a plain object from an UninterpretedOption message. Also converts values to other types if specified.
             * @param message UninterpretedOption
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.UninterpretedOption, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this UninterpretedOption to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for UninterpretedOption
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace UninterpretedOption {

            /** Properties of a NamePart. */
            interface INamePart {

                /** NamePart namePart */
                namePart: string;

                /** NamePart isExtension */
                isExtension: boolean;
            }

            /** Represents a NamePart. */
            class NamePart implements INamePart {

                /**
                 * Constructs a new NamePart.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: google.protobuf.UninterpretedOption.INamePart);

                /** NamePart namePart. */
                public namePart: string;

                /** NamePart isExtension. */
                public isExtension: boolean;

                /**
                 * Creates a new NamePart instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns NamePart instance
                 */
                public static create(properties?: google.protobuf.UninterpretedOption.INamePart): google.protobuf.UninterpretedOption.NamePart;

                /**
                 * Encodes the specified NamePart message. Does not implicitly {@link google.protobuf.UninterpretedOption.NamePart.verify|verify} messages.
                 * @param message NamePart message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encode(message: google.protobuf.UninterpretedOption.INamePart, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Encodes the specified NamePart message, length delimited. Does not implicitly {@link google.protobuf.UninterpretedOption.NamePart.verify|verify} messages.
                 * @param message NamePart message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encodeDelimited(message: google.protobuf.UninterpretedOption.INamePart, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a NamePart message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns NamePart
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.UninterpretedOption.NamePart;

                /**
                 * Decodes a NamePart message from the specified reader or buffer, length delimited.
                 * @param reader Reader or buffer to decode from
                 * @returns NamePart
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.UninterpretedOption.NamePart;

                /**
                 * Verifies a NamePart message.
                 * @param message Plain object to verify
                 * @returns `null` if valid, otherwise the reason why it is not
                 */
                public static verify(message: { [k: string]: any }): (string|null);

                /**
                 * Creates a NamePart message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns NamePart
                 */
                public static fromObject(object: { [k: string]: any }): google.protobuf.UninterpretedOption.NamePart;

                /**
                 * Creates a plain object from a NamePart message. Also converts values to other types if specified.
                 * @param message NamePart
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: google.protobuf.UninterpretedOption.NamePart, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this NamePart to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for NamePart
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }
        }

        /** Properties of a FeatureSet. */
        interface IFeatureSet {

            /** FeatureSet fieldPresence */
            fieldPresence?: (google.protobuf.FeatureSet.FieldPresence|keyof typeof google.protobuf.FeatureSet.FieldPresence|null);

            /** FeatureSet enumType */
            enumType?: (google.protobuf.FeatureSet.EnumType|keyof typeof google.protobuf.FeatureSet.EnumType|null);

            /** FeatureSet repeatedFieldEncoding */
            repeatedFieldEncoding?: (google.protobuf.FeatureSet.RepeatedFieldEncoding|keyof typeof google.protobuf.FeatureSet.RepeatedFieldEncoding|null);

            /** FeatureSet utf8Validation */
            utf8Validation?: (google.protobuf.FeatureSet.Utf8Validation|keyof typeof google.protobuf.FeatureSet.Utf8Validation|null);

            /** FeatureSet messageEncoding */
            messageEncoding?: (google.protobuf.FeatureSet.MessageEncoding|keyof typeof google.protobuf.FeatureSet.MessageEncoding|null);

            /** FeatureSet jsonFormat */
            jsonFormat?: (google.protobuf.FeatureSet.JsonFormat|keyof typeof google.protobuf.FeatureSet.JsonFormat|null);
        }

        /** Represents a FeatureSet. */
        class FeatureSet implements IFeatureSet {

            /**
             * Constructs a new FeatureSet.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IFeatureSet);

            /** FeatureSet fieldPresence. */
            public fieldPresence: (google.protobuf.FeatureSet.FieldPresence|keyof typeof google.protobuf.FeatureSet.FieldPresence);

            /** FeatureSet enumType. */
            public enumType: (google.protobuf.FeatureSet.EnumType|keyof typeof google.protobuf.FeatureSet.EnumType);

            /** FeatureSet repeatedFieldEncoding. */
            public repeatedFieldEncoding: (google.protobuf.FeatureSet.RepeatedFieldEncoding|keyof typeof google.protobuf.FeatureSet.RepeatedFieldEncoding);

            /** FeatureSet utf8Validation. */
            public utf8Validation: (google.protobuf.FeatureSet.Utf8Validation|keyof typeof google.protobuf.FeatureSet.Utf8Validation);

            /** FeatureSet messageEncoding. */
            public messageEncoding: (google.protobuf.FeatureSet.MessageEncoding|keyof typeof google.protobuf.FeatureSet.MessageEncoding);

            /** FeatureSet jsonFormat. */
            public jsonFormat: (google.protobuf.FeatureSet.JsonFormat|keyof typeof google.protobuf.FeatureSet.JsonFormat);

            /**
             * Creates a new FeatureSet instance using the specified properties.
             * @param [properties] Properties to set
             * @returns FeatureSet instance
             */
            public static create(properties?: google.protobuf.IFeatureSet): google.protobuf.FeatureSet;

            /**
             * Encodes the specified FeatureSet message. Does not implicitly {@link google.protobuf.FeatureSet.verify|verify} messages.
             * @param message FeatureSet message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IFeatureSet, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified FeatureSet message, length delimited. Does not implicitly {@link google.protobuf.FeatureSet.verify|verify} messages.
             * @param message FeatureSet message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IFeatureSet, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a FeatureSet message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns FeatureSet
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.FeatureSet;

            /**
             * Decodes a FeatureSet message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns FeatureSet
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.FeatureSet;

            /**
             * Verifies a FeatureSet message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a FeatureSet message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns FeatureSet
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.FeatureSet;

            /**
             * Creates a plain object from a FeatureSet message. Also converts values to other types if specified.
             * @param message FeatureSet
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.FeatureSet, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this FeatureSet to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for FeatureSet
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace FeatureSet {

            /** FieldPresence enum. */
            enum FieldPresence {
                FIELD_PRESENCE_UNKNOWN = 0,
                EXPLICIT = 1,
                IMPLICIT = 2,
                LEGACY_REQUIRED = 3
            }

            /** EnumType enum. */
            enum EnumType {
                ENUM_TYPE_UNKNOWN = 0,
                OPEN = 1,
                CLOSED = 2
            }

            /** RepeatedFieldEncoding enum. */
            enum RepeatedFieldEncoding {
                REPEATED_FIELD_ENCODING_UNKNOWN = 0,
                PACKED = 1,
                EXPANDED = 2
            }

            /** Utf8Validation enum. */
            enum Utf8Validation {
                UTF8_VALIDATION_UNKNOWN = 0,
                VERIFY = 2,
                NONE = 3
            }

            /** MessageEncoding enum. */
            enum MessageEncoding {
                MESSAGE_ENCODING_UNKNOWN = 0,
                LENGTH_PREFIXED = 1,
                DELIMITED = 2
            }

            /** JsonFormat enum. */
            enum JsonFormat {
                JSON_FORMAT_UNKNOWN = 0,
                ALLOW = 1,
                LEGACY_BEST_EFFORT = 2
            }
        }

        /** Properties of a FeatureSetDefaults. */
        interface IFeatureSetDefaults {

            /** FeatureSetDefaults defaults */
            defaults?: (google.protobuf.FeatureSetDefaults.IFeatureSetEditionDefault[]|null);

            /** FeatureSetDefaults minimumEdition */
            minimumEdition?: (google.protobuf.Edition|keyof typeof google.protobuf.Edition|null);

            /** FeatureSetDefaults maximumEdition */
            maximumEdition?: (google.protobuf.Edition|keyof typeof google.protobuf.Edition|null);
        }

        /** Represents a FeatureSetDefaults. */
        class FeatureSetDefaults implements IFeatureSetDefaults {

            /**
             * Constructs a new FeatureSetDefaults.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IFeatureSetDefaults);

            /** FeatureSetDefaults defaults. */
            public defaults: google.protobuf.FeatureSetDefaults.IFeatureSetEditionDefault[];

            /** FeatureSetDefaults minimumEdition. */
            public minimumEdition: (google.protobuf.Edition|keyof typeof google.protobuf.Edition);

            /** FeatureSetDefaults maximumEdition. */
            public maximumEdition: (google.protobuf.Edition|keyof typeof google.protobuf.Edition);

            /**
             * Creates a new FeatureSetDefaults instance using the specified properties.
             * @param [properties] Properties to set
             * @returns FeatureSetDefaults instance
             */
            public static create(properties?: google.protobuf.IFeatureSetDefaults): google.protobuf.FeatureSetDefaults;

            /**
             * Encodes the specified FeatureSetDefaults message. Does not implicitly {@link google.protobuf.FeatureSetDefaults.verify|verify} messages.
             * @param message FeatureSetDefaults message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IFeatureSetDefaults, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified FeatureSetDefaults message, length delimited. Does not implicitly {@link google.protobuf.FeatureSetDefaults.verify|verify} messages.
             * @param message FeatureSetDefaults message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IFeatureSetDefaults, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a FeatureSetDefaults message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns FeatureSetDefaults
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.FeatureSetDefaults;

            /**
             * Decodes a FeatureSetDefaults message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns FeatureSetDefaults
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.FeatureSetDefaults;

            /**
             * Verifies a FeatureSetDefaults message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a FeatureSetDefaults message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns FeatureSetDefaults
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.FeatureSetDefaults;

            /**
             * Creates a plain object from a FeatureSetDefaults message. Also converts values to other types if specified.
             * @param message FeatureSetDefaults
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.FeatureSetDefaults, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this FeatureSetDefaults to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for FeatureSetDefaults
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace FeatureSetDefaults {

            /** Properties of a FeatureSetEditionDefault. */
            interface IFeatureSetEditionDefault {

                /** FeatureSetEditionDefault edition */
                edition?: (google.protobuf.Edition|keyof typeof google.protobuf.Edition|null);

                /** FeatureSetEditionDefault features */
                features?: (google.protobuf.IFeatureSet|null);
            }

            /** Represents a FeatureSetEditionDefault. */
            class FeatureSetEditionDefault implements IFeatureSetEditionDefault {

                /**
                 * Constructs a new FeatureSetEditionDefault.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: google.protobuf.FeatureSetDefaults.IFeatureSetEditionDefault);

                /** FeatureSetEditionDefault edition. */
                public edition: (google.protobuf.Edition|keyof typeof google.protobuf.Edition);

                /** FeatureSetEditionDefault features. */
                public features?: (google.protobuf.IFeatureSet|null);

                /**
                 * Creates a new FeatureSetEditionDefault instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns FeatureSetEditionDefault instance
                 */
                public static create(properties?: google.protobuf.FeatureSetDefaults.IFeatureSetEditionDefault): google.protobuf.FeatureSetDefaults.FeatureSetEditionDefault;

                /**
                 * Encodes the specified FeatureSetEditionDefault message. Does not implicitly {@link google.protobuf.FeatureSetDefaults.FeatureSetEditionDefault.verify|verify} messages.
                 * @param message FeatureSetEditionDefault message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encode(message: google.protobuf.FeatureSetDefaults.IFeatureSetEditionDefault, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Encodes the specified FeatureSetEditionDefault message, length delimited. Does not implicitly {@link google.protobuf.FeatureSetDefaults.FeatureSetEditionDefault.verify|verify} messages.
                 * @param message FeatureSetEditionDefault message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encodeDelimited(message: google.protobuf.FeatureSetDefaults.IFeatureSetEditionDefault, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a FeatureSetEditionDefault message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns FeatureSetEditionDefault
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.FeatureSetDefaults.FeatureSetEditionDefault;

                /**
                 * Decodes a FeatureSetEditionDefault message from the specified reader or buffer, length delimited.
                 * @param reader Reader or buffer to decode from
                 * @returns FeatureSetEditionDefault
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.FeatureSetDefaults.FeatureSetEditionDefault;

                /**
                 * Verifies a FeatureSetEditionDefault message.
                 * @param message Plain object to verify
                 * @returns `null` if valid, otherwise the reason why it is not
                 */
                public static verify(message: { [k: string]: any }): (string|null);

                /**
                 * Creates a FeatureSetEditionDefault message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns FeatureSetEditionDefault
                 */
                public static fromObject(object: { [k: string]: any }): google.protobuf.FeatureSetDefaults.FeatureSetEditionDefault;

                /**
                 * Creates a plain object from a FeatureSetEditionDefault message. Also converts values to other types if specified.
                 * @param message FeatureSetEditionDefault
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: google.protobuf.FeatureSetDefaults.FeatureSetEditionDefault, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this FeatureSetEditionDefault to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for FeatureSetEditionDefault
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }
        }

        /** Properties of a SourceCodeInfo. */
        interface ISourceCodeInfo {

            /** SourceCodeInfo location */
            location?: (google.protobuf.SourceCodeInfo.ILocation[]|null);
        }

        /** Represents a SourceCodeInfo. */
        class SourceCodeInfo implements ISourceCodeInfo {

            /**
             * Constructs a new SourceCodeInfo.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.ISourceCodeInfo);

            /** SourceCodeInfo location. */
            public location: google.protobuf.SourceCodeInfo.ILocation[];

            /**
             * Creates a new SourceCodeInfo instance using the specified properties.
             * @param [properties] Properties to set
             * @returns SourceCodeInfo instance
             */
            public static create(properties?: google.protobuf.ISourceCodeInfo): google.protobuf.SourceCodeInfo;

            /**
             * Encodes the specified SourceCodeInfo message. Does not implicitly {@link google.protobuf.SourceCodeInfo.verify|verify} messages.
             * @param message SourceCodeInfo message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.ISourceCodeInfo, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified SourceCodeInfo message, length delimited. Does not implicitly {@link google.protobuf.SourceCodeInfo.verify|verify} messages.
             * @param message SourceCodeInfo message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.ISourceCodeInfo, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a SourceCodeInfo message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns SourceCodeInfo
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.SourceCodeInfo;

            /**
             * Decodes a SourceCodeInfo message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns SourceCodeInfo
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.SourceCodeInfo;

            /**
             * Verifies a SourceCodeInfo message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a SourceCodeInfo message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns SourceCodeInfo
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.SourceCodeInfo;

            /**
             * Creates a plain object from a SourceCodeInfo message. Also converts values to other types if specified.
             * @param message SourceCodeInfo
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.SourceCodeInfo, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this SourceCodeInfo to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for SourceCodeInfo
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace SourceCodeInfo {

            /** Properties of a Location. */
            interface ILocation {

                /** Location path */
                path?: (number[]|null);

                /** Location span */
                span?: (number[]|null);

                /** Location leadingComments */
                leadingComments?: (string|null);

                /** Location trailingComments */
                trailingComments?: (string|null);

                /** Location leadingDetachedComments */
                leadingDetachedComments?: (string[]|null);
            }

            /** Represents a Location. */
            class Location implements ILocation {

                /**
                 * Constructs a new Location.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: google.protobuf.SourceCodeInfo.ILocation);

                /** Location path. */
                public path: number[];

                /** Location span. */
                public span: number[];

                /** Location leadingComments. */
                public leadingComments: string;

                /** Location trailingComments. */
                public trailingComments: string;

                /** Location leadingDetachedComments. */
                public leadingDetachedComments: string[];

                /**
                 * Creates a new Location instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Location instance
                 */
                public static create(properties?: google.protobuf.SourceCodeInfo.ILocation): google.protobuf.SourceCodeInfo.Location;

                /**
                 * Encodes the specified Location message. Does not implicitly {@link google.protobuf.SourceCodeInfo.Location.verify|verify} messages.
                 * @param message Location message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encode(message: google.protobuf.SourceCodeInfo.ILocation, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Encodes the specified Location message, length delimited. Does not implicitly {@link google.protobuf.SourceCodeInfo.Location.verify|verify} messages.
                 * @param message Location message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encodeDelimited(message: google.protobuf.SourceCodeInfo.ILocation, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a Location message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns Location
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.SourceCodeInfo.Location;

                /**
                 * Decodes a Location message from the specified reader or buffer, length delimited.
                 * @param reader Reader or buffer to decode from
                 * @returns Location
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.SourceCodeInfo.Location;

                /**
                 * Verifies a Location message.
                 * @param message Plain object to verify
                 * @returns `null` if valid, otherwise the reason why it is not
                 */
                public static verify(message: { [k: string]: any }): (string|null);

                /**
                 * Creates a Location message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns Location
                 */
                public static fromObject(object: { [k: string]: any }): google.protobuf.SourceCodeInfo.Location;

                /**
                 * Creates a plain object from a Location message. Also converts values to other types if specified.
                 * @param message Location
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: google.protobuf.SourceCodeInfo.Location, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this Location to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for Location
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }
        }

        /** Properties of a GeneratedCodeInfo. */
        interface IGeneratedCodeInfo {

            /** GeneratedCodeInfo annotation */
            annotation?: (google.protobuf.GeneratedCodeInfo.IAnnotation[]|null);
        }

        /** Represents a GeneratedCodeInfo. */
        class GeneratedCodeInfo implements IGeneratedCodeInfo {

            /**
             * Constructs a new GeneratedCodeInfo.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IGeneratedCodeInfo);

            /** GeneratedCodeInfo annotation. */
            public annotation: google.protobuf.GeneratedCodeInfo.IAnnotation[];

            /**
             * Creates a new GeneratedCodeInfo instance using the specified properties.
             * @param [properties] Properties to set
             * @returns GeneratedCodeInfo instance
             */
            public static create(properties?: google.protobuf.IGeneratedCodeInfo): google.protobuf.GeneratedCodeInfo;

            /**
             * Encodes the specified GeneratedCodeInfo message. Does not implicitly {@link google.protobuf.GeneratedCodeInfo.verify|verify} messages.
             * @param message GeneratedCodeInfo message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IGeneratedCodeInfo, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified GeneratedCodeInfo message, length delimited. Does not implicitly {@link google.protobuf.GeneratedCodeInfo.verify|verify} messages.
             * @param message GeneratedCodeInfo message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IGeneratedCodeInfo, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a GeneratedCodeInfo message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns GeneratedCodeInfo
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.GeneratedCodeInfo;

            /**
             * Decodes a GeneratedCodeInfo message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns GeneratedCodeInfo
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.GeneratedCodeInfo;

            /**
             * Verifies a GeneratedCodeInfo message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a GeneratedCodeInfo message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns GeneratedCodeInfo
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.GeneratedCodeInfo;

            /**
             * Creates a plain object from a GeneratedCodeInfo message. Also converts values to other types if specified.
             * @param message GeneratedCodeInfo
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.GeneratedCodeInfo, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this GeneratedCodeInfo to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for GeneratedCodeInfo
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace GeneratedCodeInfo {

            /** Properties of an Annotation. */
            interface IAnnotation {

                /** Annotation path */
                path?: (number[]|null);

                /** Annotation sourceFile */
                sourceFile?: (string|null);

                /** Annotation begin */
                begin?: (number|null);

                /** Annotation end */
                end?: (number|null);

                /** Annotation semantic */
                semantic?: (google.protobuf.GeneratedCodeInfo.Annotation.Semantic|keyof typeof google.protobuf.GeneratedCodeInfo.Annotation.Semantic|null);
            }

            /** Represents an Annotation. */
            class Annotation implements IAnnotation {

                /**
                 * Constructs a new Annotation.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: google.protobuf.GeneratedCodeInfo.IAnnotation);

                /** Annotation path. */
                public path: number[];

                /** Annotation sourceFile. */
                public sourceFile: string;

                /** Annotation begin. */
                public begin: number;

                /** Annotation end. */
                public end: number;

                /** Annotation semantic. */
                public semantic: (google.protobuf.GeneratedCodeInfo.Annotation.Semantic|keyof typeof google.protobuf.GeneratedCodeInfo.Annotation.Semantic);

                /**
                 * Creates a new Annotation instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns Annotation instance
                 */
                public static create(properties?: google.protobuf.GeneratedCodeInfo.IAnnotation): google.protobuf.GeneratedCodeInfo.Annotation;

                /**
                 * Encodes the specified Annotation message. Does not implicitly {@link google.protobuf.GeneratedCodeInfo.Annotation.verify|verify} messages.
                 * @param message Annotation message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encode(message: google.protobuf.GeneratedCodeInfo.IAnnotation, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Encodes the specified Annotation message, length delimited. Does not implicitly {@link google.protobuf.GeneratedCodeInfo.Annotation.verify|verify} messages.
                 * @param message Annotation message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encodeDelimited(message: google.protobuf.GeneratedCodeInfo.IAnnotation, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes an Annotation message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns Annotation
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.GeneratedCodeInfo.Annotation;

                /**
                 * Decodes an Annotation message from the specified reader or buffer, length delimited.
                 * @param reader Reader or buffer to decode from
                 * @returns Annotation
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.GeneratedCodeInfo.Annotation;

                /**
                 * Verifies an Annotation message.
                 * @param message Plain object to verify
                 * @returns `null` if valid, otherwise the reason why it is not
                 */
                public static verify(message: { [k: string]: any }): (string|null);

                /**
                 * Creates an Annotation message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns Annotation
                 */
                public static fromObject(object: { [k: string]: any }): google.protobuf.GeneratedCodeInfo.Annotation;

                /**
                 * Creates a plain object from an Annotation message. Also converts values to other types if specified.
                 * @param message Annotation
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: google.protobuf.GeneratedCodeInfo.Annotation, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this Annotation to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for Annotation
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            namespace Annotation {

                /** Semantic enum. */
                enum Semantic {
                    NONE = 0,
                    SET = 1,
                    ALIAS = 2
                }
            }
        }

        /** Properties of a Duration. */
        interface IDuration {

            /** Duration seconds */
            seconds?: (number|Long|string|null);

            /** Duration nanos */
            nanos?: (number|null);
        }

        /** Represents a Duration. */
        class Duration implements IDuration {

            /**
             * Constructs a new Duration.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IDuration);

            /** Duration seconds. */
            public seconds: (number|Long|string);

            /** Duration nanos. */
            public nanos: number;

            /**
             * Creates a new Duration instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Duration instance
             */
            public static create(properties?: google.protobuf.IDuration): google.protobuf.Duration;

            /**
             * Encodes the specified Duration message. Does not implicitly {@link google.protobuf.Duration.verify|verify} messages.
             * @param message Duration message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IDuration, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Duration message, length delimited. Does not implicitly {@link google.protobuf.Duration.verify|verify} messages.
             * @param message Duration message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IDuration, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Duration message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Duration
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.Duration;

            /**
             * Decodes a Duration message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Duration
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.Duration;

            /**
             * Verifies a Duration message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a Duration message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Duration
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Duration;

            /**
             * Creates a plain object from a Duration message. Also converts values to other types if specified.
             * @param message Duration
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Duration, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Duration to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Duration
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of an Any. */
        interface IAny {

            /** Any type_url */
            type_url?: (string|null);

            /** Any value */
            value?: (Uint8Array|Buffer|string|null);
        }

        /** Represents an Any. */
        class Any implements IAny {

            /**
             * Constructs a new Any.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IAny);

            /** Any type_url. */
            public type_url: string;

            /** Any value. */
            public value: (Uint8Array|Buffer|string);

            /**
             * Creates a new Any instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Any instance
             */
            public static create(properties?: google.protobuf.IAny): google.protobuf.Any;

            /**
             * Encodes the specified Any message. Does not implicitly {@link google.protobuf.Any.verify|verify} messages.
             * @param message Any message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IAny, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Any message, length delimited. Does not implicitly {@link google.protobuf.Any.verify|verify} messages.
             * @param message Any message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IAny, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an Any message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Any
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.Any;

            /**
             * Decodes an Any message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Any
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.Any;

            /**
             * Verifies an Any message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates an Any message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Any
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Any;

            /**
             * Creates a plain object from an Any message. Also converts values to other types if specified.
             * @param message Any
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Any, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Any to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Any
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of an Empty. */
        interface IEmpty {
        }

        /** Represents an Empty. */
        class Empty implements IEmpty {

            /**
             * Constructs a new Empty.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IEmpty);

            /**
             * Creates a new Empty instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Empty instance
             */
            public static create(properties?: google.protobuf.IEmpty): google.protobuf.Empty;

            /**
             * Encodes the specified Empty message. Does not implicitly {@link google.protobuf.Empty.verify|verify} messages.
             * @param message Empty message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IEmpty, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Empty message, length delimited. Does not implicitly {@link google.protobuf.Empty.verify|verify} messages.
             * @param message Empty message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IEmpty, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an Empty message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Empty
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.Empty;

            /**
             * Decodes an Empty message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Empty
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.Empty;

            /**
             * Verifies an Empty message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates an Empty message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Empty
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Empty;

            /**
             * Creates a plain object from an Empty message. Also converts values to other types if specified.
             * @param message Empty
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Empty, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Empty to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Empty
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a Timestamp. */
        interface ITimestamp {

            /** Timestamp seconds */
            seconds?: (number|Long|string|null);

            /** Timestamp nanos */
            nanos?: (number|null);
        }

        /** Represents a Timestamp. */
        class Timestamp implements ITimestamp {

            /**
             * Constructs a new Timestamp.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.ITimestamp);

            /** Timestamp seconds. */
            public seconds: (number|Long|string);

            /** Timestamp nanos. */
            public nanos: number;

            /**
             * Creates a new Timestamp instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Timestamp instance
             */
            public static create(properties?: google.protobuf.ITimestamp): google.protobuf.Timestamp;

            /**
             * Encodes the specified Timestamp message. Does not implicitly {@link google.protobuf.Timestamp.verify|verify} messages.
             * @param message Timestamp message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.ITimestamp, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Timestamp message, length delimited. Does not implicitly {@link google.protobuf.Timestamp.verify|verify} messages.
             * @param message Timestamp message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.ITimestamp, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Timestamp message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Timestamp
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.Timestamp;

            /**
             * Decodes a Timestamp message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Timestamp
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.Timestamp;

            /**
             * Verifies a Timestamp message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a Timestamp message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Timestamp
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Timestamp;

            /**
             * Creates a plain object from a Timestamp message. Also converts values to other types if specified.
             * @param message Timestamp
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Timestamp, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Timestamp to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Timestamp
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }

    /** Namespace longrunning. */
    namespace longrunning {

        /** Represents an Operations */
        class Operations extends $protobuf.rpc.Service {

            /**
             * Constructs a new Operations service.
             * @param rpcImpl RPC implementation
             * @param [requestDelimited=false] Whether requests are length-delimited
             * @param [responseDelimited=false] Whether responses are length-delimited
             */
            constructor(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean);

            /**
             * Creates new Operations service using the specified rpc implementation.
             * @param rpcImpl RPC implementation
             * @param [requestDelimited=false] Whether requests are length-delimited
             * @param [responseDelimited=false] Whether responses are length-delimited
             * @returns RPC service. Useful where requests and/or responses are streamed.
             */
            public static create(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean): Operations;

            /**
             * Calls ListOperations.
             * @param request ListOperationsRequest message or plain object
             * @param callback Node-style callback called with the error, if any, and ListOperationsResponse
             */
            public listOperations(request: google.longrunning.IListOperationsRequest, callback: google.longrunning.Operations.ListOperationsCallback): void;

            /**
             * Calls ListOperations.
             * @param request ListOperationsRequest message or plain object
             * @returns Promise
             */
            public listOperations(request: google.longrunning.IListOperationsRequest): Promise<google.longrunning.ListOperationsResponse>;

            /**
             * Calls GetOperation.
             * @param request GetOperationRequest message or plain object
             * @param callback Node-style callback called with the error, if any, and Operation
             */
            public getOperation(request: google.longrunning.IGetOperationRequest, callback: google.longrunning.Operations.GetOperationCallback): void;

            /**
             * Calls GetOperation.
             * @param request GetOperationRequest message or plain object
             * @returns Promise
             */
            public getOperation(request: google.longrunning.IGetOperationRequest): Promise<google.longrunning.Operation>;

            /**
             * Calls DeleteOperation.
             * @param request DeleteOperationRequest message or plain object
             * @param callback Node-style callback called with the error, if any, and Empty
             */
            public deleteOperation(request: google.longrunning.IDeleteOperationRequest, callback: google.longrunning.Operations.DeleteOperationCallback): void;

            /**
             * Calls DeleteOperation.
             * @param request DeleteOperationRequest message or plain object
             * @returns Promise
             */
            public deleteOperation(request: google.longrunning.IDeleteOperationRequest): Promise<google.protobuf.Empty>;

            /**
             * Calls CancelOperation.
             * @param request CancelOperationRequest message or plain object
             * @param callback Node-style callback called with the error, if any, and Empty
             */
            public cancelOperation(request: google.longrunning.ICancelOperationRequest, callback: google.longrunning.Operations.CancelOperationCallback): void;

            /**
             * Calls CancelOperation.
             * @param request CancelOperationRequest message or plain object
             * @returns Promise
             */
            public cancelOperation(request: google.longrunning.ICancelOperationRequest): Promise<google.protobuf.Empty>;

            /**
             * Calls WaitOperation.
             * @param request WaitOperationRequest message or plain object
             * @param callback Node-style callback called with the error, if any, and Operation
             */
            public waitOperation(request: google.longrunning.IWaitOperationRequest, callback: google.longrunning.Operations.WaitOperationCallback): void;

            /**
             * Calls WaitOperation.
             * @param request WaitOperationRequest message or plain object
             * @returns Promise
             */
            public waitOperation(request: google.longrunning.IWaitOperationRequest): Promise<google.longrunning.Operation>;
        }

        namespace Operations {

            /**
             * Callback as used by {@link google.longrunning.Operations|listOperations}.
             * @param error Error, if any
             * @param [response] ListOperationsResponse
             */
            type ListOperationsCallback = (error: (Error|null), response?: google.longrunning.ListOperationsResponse) => void;

            /**
             * Callback as used by {@link google.longrunning.Operations|getOperation}.
             * @param error Error, if any
             * @param [response] Operation
             */
            type GetOperationCallback = (error: (Error|null), response?: google.longrunning.Operation) => void;

            /**
             * Callback as used by {@link google.longrunning.Operations|deleteOperation}.
             * @param error Error, if any
             * @param [response] Empty
             */
            type DeleteOperationCallback = (error: (Error|null), response?: google.protobuf.Empty) => void;

            /**
             * Callback as used by {@link google.longrunning.Operations|cancelOperation}.
             * @param error Error, if any
             * @param [response] Empty
             */
            type CancelOperationCallback = (error: (Error|null), response?: google.protobuf.Empty) => void;

            /**
             * Callback as used by {@link google.longrunning.Operations|waitOperation}.
             * @param error Error, if any
             * @param [response] Operation
             */
            type WaitOperationCallback = (error: (Error|null), response?: google.longrunning.Operation) => void;
        }

        /** Properties of an Operation. */
        interface IOperation {

            /** Operation name */
            name?: (string|null);

            /** Operation metadata */
            metadata?: (google.protobuf.IAny|null);

            /** Operation done */
            done?: (boolean|null);

            /** Operation error */
            error?: (google.rpc.IStatus|null);

            /** Operation response */
            response?: (google.protobuf.IAny|null);
        }

        /** Represents an Operation. */
        class Operation implements IOperation {

            /**
             * Constructs a new Operation.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.longrunning.IOperation);

            /** Operation name. */
            public name: string;

            /** Operation metadata. */
            public metadata?: (google.protobuf.IAny|null);

            /** Operation done. */
            public done: boolean;

            /** Operation error. */
            public error?: (google.rpc.IStatus|null);

            /** Operation response. */
            public response?: (google.protobuf.IAny|null);

            /** Operation result. */
            public result?: ("error"|"response");

            /**
             * Creates a new Operation instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Operation instance
             */
            public static create(properties?: google.longrunning.IOperation): google.longrunning.Operation;

            /**
             * Encodes the specified Operation message. Does not implicitly {@link google.longrunning.Operation.verify|verify} messages.
             * @param message Operation message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.longrunning.IOperation, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Operation message, length delimited. Does not implicitly {@link google.longrunning.Operation.verify|verify} messages.
             * @param message Operation message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.longrunning.IOperation, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an Operation message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Operation
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.longrunning.Operation;

            /**
             * Decodes an Operation message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Operation
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.longrunning.Operation;

            /**
             * Verifies an Operation message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates an Operation message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Operation
             */
            public static fromObject(object: { [k: string]: any }): google.longrunning.Operation;

            /**
             * Creates a plain object from an Operation message. Also converts values to other types if specified.
             * @param message Operation
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.longrunning.Operation, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Operation to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Operation
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a GetOperationRequest. */
        interface IGetOperationRequest {

            /** GetOperationRequest name */
            name?: (string|null);
        }

        /** Represents a GetOperationRequest. */
        class GetOperationRequest implements IGetOperationRequest {

            /**
             * Constructs a new GetOperationRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.longrunning.IGetOperationRequest);

            /** GetOperationRequest name. */
            public name: string;

            /**
             * Creates a new GetOperationRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns GetOperationRequest instance
             */
            public static create(properties?: google.longrunning.IGetOperationRequest): google.longrunning.GetOperationRequest;

            /**
             * Encodes the specified GetOperationRequest message. Does not implicitly {@link google.longrunning.GetOperationRequest.verify|verify} messages.
             * @param message GetOperationRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.longrunning.IGetOperationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified GetOperationRequest message, length delimited. Does not implicitly {@link google.longrunning.GetOperationRequest.verify|verify} messages.
             * @param message GetOperationRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.longrunning.IGetOperationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a GetOperationRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns GetOperationRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.longrunning.GetOperationRequest;

            /**
             * Decodes a GetOperationRequest message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns GetOperationRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.longrunning.GetOperationRequest;

            /**
             * Verifies a GetOperationRequest message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a GetOperationRequest message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns GetOperationRequest
             */
            public static fromObject(object: { [k: string]: any }): google.longrunning.GetOperationRequest;

            /**
             * Creates a plain object from a GetOperationRequest message. Also converts values to other types if specified.
             * @param message GetOperationRequest
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.longrunning.GetOperationRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this GetOperationRequest to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for GetOperationRequest
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a ListOperationsRequest. */
        interface IListOperationsRequest {

            /** ListOperationsRequest name */
            name?: (string|null);

            /** ListOperationsRequest filter */
            filter?: (string|null);

            /** ListOperationsRequest pageSize */
            pageSize?: (number|null);

            /** ListOperationsRequest pageToken */
            pageToken?: (string|null);
        }

        /** Represents a ListOperationsRequest. */
        class ListOperationsRequest implements IListOperationsRequest {

            /**
             * Constructs a new ListOperationsRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.longrunning.IListOperationsRequest);

            /** ListOperationsRequest name. */
            public name: string;

            /** ListOperationsRequest filter. */
            public filter: string;

            /** ListOperationsRequest pageSize. */
            public pageSize: number;

            /** ListOperationsRequest pageToken. */
            public pageToken: string;

            /**
             * Creates a new ListOperationsRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ListOperationsRequest instance
             */
            public static create(properties?: google.longrunning.IListOperationsRequest): google.longrunning.ListOperationsRequest;

            /**
             * Encodes the specified ListOperationsRequest message. Does not implicitly {@link google.longrunning.ListOperationsRequest.verify|verify} messages.
             * @param message ListOperationsRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.longrunning.IListOperationsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified ListOperationsRequest message, length delimited. Does not implicitly {@link google.longrunning.ListOperationsRequest.verify|verify} messages.
             * @param message ListOperationsRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.longrunning.IListOperationsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ListOperationsRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns ListOperationsRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.longrunning.ListOperationsRequest;

            /**
             * Decodes a ListOperationsRequest message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns ListOperationsRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.longrunning.ListOperationsRequest;

            /**
             * Verifies a ListOperationsRequest message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a ListOperationsRequest message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ListOperationsRequest
             */
            public static fromObject(object: { [k: string]: any }): google.longrunning.ListOperationsRequest;

            /**
             * Creates a plain object from a ListOperationsRequest message. Also converts values to other types if specified.
             * @param message ListOperationsRequest
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.longrunning.ListOperationsRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ListOperationsRequest to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ListOperationsRequest
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a ListOperationsResponse. */
        interface IListOperationsResponse {

            /** ListOperationsResponse operations */
            operations?: (google.longrunning.IOperation[]|null);

            /** ListOperationsResponse nextPageToken */
            nextPageToken?: (string|null);
        }

        /** Represents a ListOperationsResponse. */
        class ListOperationsResponse implements IListOperationsResponse {

            /**
             * Constructs a new ListOperationsResponse.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.longrunning.IListOperationsResponse);

            /** ListOperationsResponse operations. */
            public operations: google.longrunning.IOperation[];

            /** ListOperationsResponse nextPageToken. */
            public nextPageToken: string;

            /**
             * Creates a new ListOperationsResponse instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ListOperationsResponse instance
             */
            public static create(properties?: google.longrunning.IListOperationsResponse): google.longrunning.ListOperationsResponse;

            /**
             * Encodes the specified ListOperationsResponse message. Does not implicitly {@link google.longrunning.ListOperationsResponse.verify|verify} messages.
             * @param message ListOperationsResponse message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.longrunning.IListOperationsResponse, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified ListOperationsResponse message, length delimited. Does not implicitly {@link google.longrunning.ListOperationsResponse.verify|verify} messages.
             * @param message ListOperationsResponse message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.longrunning.IListOperationsResponse, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ListOperationsResponse message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns ListOperationsResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.longrunning.ListOperationsResponse;

            /**
             * Decodes a ListOperationsResponse message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns ListOperationsResponse
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.longrunning.ListOperationsResponse;

            /**
             * Verifies a ListOperationsResponse message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a ListOperationsResponse message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ListOperationsResponse
             */
            public static fromObject(object: { [k: string]: any }): google.longrunning.ListOperationsResponse;

            /**
             * Creates a plain object from a ListOperationsResponse message. Also converts values to other types if specified.
             * @param message ListOperationsResponse
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.longrunning.ListOperationsResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ListOperationsResponse to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ListOperationsResponse
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a CancelOperationRequest. */
        interface ICancelOperationRequest {

            /** CancelOperationRequest name */
            name?: (string|null);
        }

        /** Represents a CancelOperationRequest. */
        class CancelOperationRequest implements ICancelOperationRequest {

            /**
             * Constructs a new CancelOperationRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.longrunning.ICancelOperationRequest);

            /** CancelOperationRequest name. */
            public name: string;

            /**
             * Creates a new CancelOperationRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns CancelOperationRequest instance
             */
            public static create(properties?: google.longrunning.ICancelOperationRequest): google.longrunning.CancelOperationRequest;

            /**
             * Encodes the specified CancelOperationRequest message. Does not implicitly {@link google.longrunning.CancelOperationRequest.verify|verify} messages.
             * @param message CancelOperationRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.longrunning.ICancelOperationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified CancelOperationRequest message, length delimited. Does not implicitly {@link google.longrunning.CancelOperationRequest.verify|verify} messages.
             * @param message CancelOperationRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.longrunning.ICancelOperationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a CancelOperationRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns CancelOperationRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.longrunning.CancelOperationRequest;

            /**
             * Decodes a CancelOperationRequest message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns CancelOperationRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.longrunning.CancelOperationRequest;

            /**
             * Verifies a CancelOperationRequest message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a CancelOperationRequest message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns CancelOperationRequest
             */
            public static fromObject(object: { [k: string]: any }): google.longrunning.CancelOperationRequest;

            /**
             * Creates a plain object from a CancelOperationRequest message. Also converts values to other types if specified.
             * @param message CancelOperationRequest
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.longrunning.CancelOperationRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this CancelOperationRequest to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for CancelOperationRequest
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a DeleteOperationRequest. */
        interface IDeleteOperationRequest {

            /** DeleteOperationRequest name */
            name?: (string|null);
        }

        /** Represents a DeleteOperationRequest. */
        class DeleteOperationRequest implements IDeleteOperationRequest {

            /**
             * Constructs a new DeleteOperationRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.longrunning.IDeleteOperationRequest);

            /** DeleteOperationRequest name. */
            public name: string;

            /**
             * Creates a new DeleteOperationRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns DeleteOperationRequest instance
             */
            public static create(properties?: google.longrunning.IDeleteOperationRequest): google.longrunning.DeleteOperationRequest;

            /**
             * Encodes the specified DeleteOperationRequest message. Does not implicitly {@link google.longrunning.DeleteOperationRequest.verify|verify} messages.
             * @param message DeleteOperationRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.longrunning.IDeleteOperationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified DeleteOperationRequest message, length delimited. Does not implicitly {@link google.longrunning.DeleteOperationRequest.verify|verify} messages.
             * @param message DeleteOperationRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.longrunning.IDeleteOperationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a DeleteOperationRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns DeleteOperationRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.longrunning.DeleteOperationRequest;

            /**
             * Decodes a DeleteOperationRequest message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns DeleteOperationRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.longrunning.DeleteOperationRequest;

            /**
             * Verifies a DeleteOperationRequest message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a DeleteOperationRequest message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns DeleteOperationRequest
             */
            public static fromObject(object: { [k: string]: any }): google.longrunning.DeleteOperationRequest;

            /**
             * Creates a plain object from a DeleteOperationRequest message. Also converts values to other types if specified.
             * @param message DeleteOperationRequest
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.longrunning.DeleteOperationRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this DeleteOperationRequest to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for DeleteOperationRequest
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a WaitOperationRequest. */
        interface IWaitOperationRequest {

            /** WaitOperationRequest name */
            name?: (string|null);

            /** WaitOperationRequest timeout */
            timeout?: (google.protobuf.IDuration|null);
        }

        /** Represents a WaitOperationRequest. */
        class WaitOperationRequest implements IWaitOperationRequest {

            /**
             * Constructs a new WaitOperationRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.longrunning.IWaitOperationRequest);

            /** WaitOperationRequest name. */
            public name: string;

            /** WaitOperationRequest timeout. */
            public timeout?: (google.protobuf.IDuration|null);

            /**
             * Creates a new WaitOperationRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns WaitOperationRequest instance
             */
            public static create(properties?: google.longrunning.IWaitOperationRequest): google.longrunning.WaitOperationRequest;

            /**
             * Encodes the specified WaitOperationRequest message. Does not implicitly {@link google.longrunning.WaitOperationRequest.verify|verify} messages.
             * @param message WaitOperationRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.longrunning.IWaitOperationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified WaitOperationRequest message, length delimited. Does not implicitly {@link google.longrunning.WaitOperationRequest.verify|verify} messages.
             * @param message WaitOperationRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.longrunning.IWaitOperationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a WaitOperationRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns WaitOperationRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.longrunning.WaitOperationRequest;

            /**
             * Decodes a WaitOperationRequest message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns WaitOperationRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.longrunning.WaitOperationRequest;

            /**
             * Verifies a WaitOperationRequest message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a WaitOperationRequest message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns WaitOperationRequest
             */
            public static fromObject(object: { [k: string]: any }): google.longrunning.WaitOperationRequest;

            /**
             * Creates a plain object from a WaitOperationRequest message. Also converts values to other types if specified.
             * @param message WaitOperationRequest
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.longrunning.WaitOperationRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this WaitOperationRequest to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for WaitOperationRequest
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of an OperationInfo. */
        interface IOperationInfo {

            /** OperationInfo responseType */
            responseType?: (string|null);

            /** OperationInfo metadataType */
            metadataType?: (string|null);
        }

        /** Represents an OperationInfo. */
        class OperationInfo implements IOperationInfo {

            /**
             * Constructs a new OperationInfo.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.longrunning.IOperationInfo);

            /** OperationInfo responseType. */
            public responseType: string;

            /** OperationInfo metadataType. */
            public metadataType: string;

            /**
             * Creates a new OperationInfo instance using the specified properties.
             * @param [properties] Properties to set
             * @returns OperationInfo instance
             */
            public static create(properties?: google.longrunning.IOperationInfo): google.longrunning.OperationInfo;

            /**
             * Encodes the specified OperationInfo message. Does not implicitly {@link google.longrunning.OperationInfo.verify|verify} messages.
             * @param message OperationInfo message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.longrunning.IOperationInfo, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified OperationInfo message, length delimited. Does not implicitly {@link google.longrunning.OperationInfo.verify|verify} messages.
             * @param message OperationInfo message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.longrunning.IOperationInfo, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an OperationInfo message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns OperationInfo
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.longrunning.OperationInfo;

            /**
             * Decodes an OperationInfo message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns OperationInfo
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.longrunning.OperationInfo;

            /**
             * Verifies an OperationInfo message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates an OperationInfo message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns OperationInfo
             */
            public static fromObject(object: { [k: string]: any }): google.longrunning.OperationInfo;

            /**
             * Creates a plain object from an OperationInfo message. Also converts values to other types if specified.
             * @param message OperationInfo
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.longrunning.OperationInfo, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this OperationInfo to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for OperationInfo
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }

    /** Namespace rpc. */
    namespace rpc {

        /** Properties of a Status. */
        interface IStatus {

            /** Status code */
            code?: (number|null);

            /** Status message */
            message?: (string|null);

            /** Status details */
            details?: (google.protobuf.IAny[]|null);
        }

        /** Represents a Status. */
        class Status implements IStatus {

            /**
             * Constructs a new Status.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.rpc.IStatus);

            /** Status code. */
            public code: number;

            /** Status message. */
            public message: string;

            /** Status details. */
            public details: google.protobuf.IAny[];

            /**
             * Creates a new Status instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Status instance
             */
            public static create(properties?: google.rpc.IStatus): google.rpc.Status;

            /**
             * Encodes the specified Status message. Does not implicitly {@link google.rpc.Status.verify|verify} messages.
             * @param message Status message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.rpc.IStatus, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Status message, length delimited. Does not implicitly {@link google.rpc.Status.verify|verify} messages.
             * @param message Status message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.rpc.IStatus, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Status message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Status
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.rpc.Status;

            /**
             * Decodes a Status message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Status
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.rpc.Status;

            /**
             * Verifies a Status message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a Status message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Status
             */
            public static fromObject(object: { [k: string]: any }): google.rpc.Status;

            /**
             * Creates a plain object from a Status message. Also converts values to other types if specified.
             * @param message Status
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.rpc.Status, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Status to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Status
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }
}
