export interface VoiceLanguageServer {
	locale: string;
	preview_audio?: string | null;
}

export interface VoiceLanguage {
	/**
	 * Language code, i.e. en-US.
	 */
	locale: VoiceLanguageServer["locale"];
	/**
	 * Voice audio preview URL.
	 */
	previewAudio: VoiceLanguageServer["preview_audio"];
}

export type VoiceModelName =
	| "simba-english"
	| "simba-multilingual"
	| "simba-turbo";

export interface VoiceModelServer {
	name: VoiceModelName;
	languages: VoiceLanguageServer[];
}

export interface VoiceModel {
	/**
	 * Voice model name.
	 */
	name: VoiceModelServer["name"];
	/**
	 * Supported languages.
	 */
	languages: VoiceLanguage[];
}

/**
 * Gender marker for the voice.
 */
export type Gender = "male" | "female" | "notSpecified";

export interface VoiceBasePropsServer {
	id: string;
	type: "shared" | "personal";

	display_name: string;
	gender?: Gender;
	avatar_image?: string | null;
	models: VoiceModelServer[];
	locale?: string;
}

export interface VoiceBaseProps {
	/**
	 * The unique identifier of the voice.
	 */
	id: VoiceBasePropsServer["id"];
	/**
	 * The type of the voice.
	 */
	type: VoiceBasePropsServer["type"];
	/**
	 * The display name of the voice.
	 */
	displayName: VoiceBasePropsServer["display_name"];
	/**
	 * The gender marker for the voice.
	 */
	gender: VoiceBasePropsServer["gender"];
	/**
	 * URL for the voice avatar image.
	 */
	avatarUrl?: string | null;
	/**
	 * The list of models that support this voice.
	 */
	models: VoiceModel[];
	/**
	 * The native language (locale) of the personal voice (e.g. en-US, es-ES, etc.)
	 */
	locale?: string;
}

export interface VoicesListEntryServer extends VoiceBasePropsServer {
	preview_audio?: string | null;
	tags?: string[];
}

/**
 * Voice entry in the list of available voices.
 */
export interface VoicesListEntry extends VoiceBaseProps {
	/**
	 * Voice avatar image URL.
	 */
	avatarImage: VoicesListEntryServer["avatar_image"];
	/**
	 * Voice gender.
	 */
	gender: VoicesListEntryServer["gender"];
	/**
	 * Voice audio preview URL.
	 */
	previewAudio: VoicesListEntryServer["preview_audio"];
	/**
	 * Voice tags.
	 */
	tags: VoicesListEntryServer["tags"];
}

export type VoicesListResponseServer = VoicesListEntryServer[];

/**
 * The list of available voices.
 */
export type VoicesListResponse = VoicesListEntry[];

/**
 * Request details to create a new voice.
 */
export interface VoicesCreateRequest {
	/**
	 * The name of the voice.
	 */
	name: string;
	/**
	 * Voice gender marker.
	 */
	gender?: Gender;
	/**
	 * The audio sample file to be used for the voice.
	 */
	sample: Blob | Buffer;
	/**
	 * The voice avatar image.
	 */
	avatar?: Blob | Buffer;
	/**
	 * The user consent that the voice belongs to you, or to someone you represent.
	 */
	consent: {
		/**
		 * The full name of the person who gave the consent.
		 */
		fullName: string;
		/**
		 * The email of the person who gave the consent.
		 */
		email: string;
	};
	/**
	 * The native language (locale) of the personal voice (e.g. en-US, es-ES, etc.)
	 */
	locale?: string;
}

export type VoicesCreateResponseServer = VoiceBasePropsServer;

/**
 * The newly created voice details.
 */
export interface VoicesCreateResponse extends VoiceBaseProps {}

/**
 * The scopes that can be granted by an access token.
 */
export type AccessTokenScope =
	| "audio:speech"
	| "audio:stream"
	| "audio:all"
	| "voices:read"
	| "voices:create"
	| "voices:delete"
	| "voices:all";

/**
 * The raw server response of the access token request, following the OAuth 2.0 format.
 * You shouldn't need to deal with it directly, use {@link AccessTokenResponse} instead.
 * The only exception is when your server is not using the Speechify SDK,
 * and you return the Speechify AI API response unmodified to the client app.
 */
export interface AccessTokenServerResponse {
	access_token: string;
	expires_in: number;
	scope: string;
	token_type: "bearer";
}

export interface AccessTokenResponse {
	/**
	 * The access token.
	 */
	accessToken: string;
	/**
	 * Token expiration time in seconds.
	 */
	expiresIn: number;
	/**
	 * The list of scopes granted by the token.
	 */
	scopes: AccessTokenScope[];
	/**
	 * The token type, always "bearer".
	 */
	tokenType: "bearer";
}

/**
 * The format of the audio speech.
 */
export type AudioSpeechFormat = "mp3" | "wav" | "ogg" | "aac";

/**
 * The format of the audio stream.
 */
export type AudioStreamFormat = Exclude<AudioSpeechFormat, "wav">;
export interface AudioSpeechRequestOptions {
	enableLoudnessNormalization?: boolean;
	enableTextNormalization?: boolean;
}

/**
 * Request details to generate audio from text.
 */
export interface AudioSpeechRequest {
	/**
	 * The text to be synthesized, either [SSML](https://docs.sws.speechify.com/docs/ssml) or plain text.
	 */
	input: string;
	/**
	 * The voice ID to be used for the synthesis.
	 * @see {@link VoicesListEntry.id}
	 */
	voiceId: string;
	/**
	 * The audio format of the synthesized speech.
	 * @default "mp3"
	 */
	audioFormat?: AudioSpeechFormat;
	/**
	 * The language code of the text.
	 * Read about the supported languages [here](https://docs.sws.speechify.com/docs/language-support).
	 * @example "en-US"
	 */
	language?: string;
	/**
	 * The voice model to be used for the synthesis.
	 * Read about the supported models [here](https://docs.sws.speechify.com/docs/text-to-speech-models).
	 */
	model?: VoiceModelName;
	/**
	 * Additional options for the synthesis.
	 */
	options?: AudioSpeechRequestOptions;
}

export interface SpeechMarkChunkServer {
	type: string;
	value: string;
	start: number;
	end: number;
	start_time: number;
	end_time: number;
}

export interface SpeechMarkServer extends SpeechMarkChunkServer {
	chunks: SpeechMarkChunkServer[];
}

export interface SpeechMarkChunk extends SpeechMarkChunkServer {}

export interface SpeechMark extends SpeechMarkServer {
	/**
	 * Array of NestedChunk, each providing detailed segment information within the synthesized speech.
	 */
	chunks: SpeechMarkChunk[];
}

export interface AudioSpeechResponseServer {
	audio_data: string;
	audio_format: AudioSpeechFormat;
	billable_characters_count: number;
	speech_marks: SpeechMarkServer[];
}

export interface AudioSpeechResponse {
	audioData: Blob;
	audioFormat: AudioSpeechResponseServer["audio_format"];
	billableCharactersCount: AudioSpeechResponseServer["billable_characters_count"];
	/**
	 * Speech marks annotate the audio data with metadata about the synthesis process, like word timing or phoneme details.
	 */
	speech_marks: SpeechMark[];
}

/**
 * Request details to stream audio from text.
 */
export interface AudioStreamRequest {
	/**
	 * The text to be synthesized, either [SSML](https://docs.sws.speechify.com/docs/ssml) or plain text.
	 */
	input: string;
	/**
	 * The voice ID to be used for the synthesis.
	 * @see {@link VoicesListEntry.id}
	 */
	voiceId: string;
	/**
	 * The audio format of the synthesized speech.
	 * @default "mp3"
	 */
	audioFormat?: AudioStreamFormat;
	/**
	 * The language code of the text.
	 * Read about the supported languages [here](https://docs.sws.speechify.com/docs/language-support).
	 * @example "en-US"
	 */
	language?: string;
	/**
	 * The voice model to be used for the synthesis.
	 * Read about the supported models [here](https://docs.sws.speechify.com/docs/text-to-speech-models).
	 */
	model?: VoiceModelName;
	/**
	 * Additional options for the synthesis.
	 */
	options?: AudioSpeechRequestOptions;
}

/**
 * The getter function to obtain the access token.
 */
export type AccessTokenGetter = () => Promise<
	AccessTokenResponse | AccessTokenServerResponse
>;

/**
 * The Speechify Access Token Manager init options.
 */
export interface SpeechifyAccessTokenManagerOptions {
	/**
	 * Lets you set the user initial authentication state at the moment of the SpeechifyAccessTokenManager initialization.
	 */
	isAuthenticated?: boolean;
}
