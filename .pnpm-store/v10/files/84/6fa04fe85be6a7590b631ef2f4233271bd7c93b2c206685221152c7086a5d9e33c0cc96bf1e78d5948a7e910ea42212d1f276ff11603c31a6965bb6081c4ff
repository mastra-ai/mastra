import {
	audioFormatToMime,
	fetchJSON,
	mapModel,
	mapVoice,
	queryAPI,
} from "./fetch.js";
import type {
	AccessTokenGetter,
	AccessTokenResponse,
	AccessTokenScope,
	AccessTokenServerResponse,
	AudioSpeechFormat,
	AudioSpeechRequest,
	AudioSpeechResponse,
	AudioSpeechResponseServer,
	AudioStreamRequest,
	SpeechifyAccessTokenManagerOptions,
	VoicesCreateRequest,
	VoicesCreateResponse,
	VoicesCreateResponseServer,
	VoicesListResponse,
	VoicesListResponseServer,
} from "./types.js";
import { VERSION } from "./version.js";

export type { SpeechifyError } from "./fetch.js";
export type {
	AccessTokenGetter,
	AccessTokenResponse,
	AccessTokenScope,
	AccessTokenServerResponse,
	AudioSpeechFormat,
	AudioSpeechRequest,
	AudioSpeechRequestOptions,
	AudioSpeechResponse,
	AudioStreamFormat,
	AudioStreamRequest,
	Gender,
	SpeechifyAccessTokenManagerOptions,
	SpeechMark,
	SpeechMarkChunk,
	VoiceLanguage,
	VoiceModel,
	VoiceModelName,
	VoicesCreateRequest,
	VoicesCreateResponse,
	VoicesListEntry,
	VoicesListResponse,
} from "./types.js";

/**
 * The Speechify client options.
 */
export interface SpeechifyOptions {
	/**
	 * Strict mode will throw an error if the API key is used in the browser environment.
	 * Otherwise, it will only log a warning.
	 */
	strict?: boolean;
	/**
	 * API Key can be used for server-side usage. It is the simplest form, but it's not suitable for
	 * the public client environment.
	 * Access Token is recommended for the public client environment.
	 * Read more about this at https://docs.sws.speechify.com/docs/authentication.
	 */
	apiKey?: string;
	/**
	 * API URL is the base URL for the Speechify API. It is optional and defaults to the production URL,
	 * which is https://api.sws.speechify.com.
	 * If you know what you're doing, you can use this option to point to a different environment, like staging or development.
	 */
	apiUrl?: string;
}

const defaultOptions = {
	strict: true,
	apiKey: undefined,
	apiUrl: "https://api.sws.speechify.com",
} as const satisfies SpeechifyOptions;

/**
 * The Speechify client.
 */
export class Speechify {
	#strict: boolean;
	#apiKey: string | undefined;
	#apiUrl: string;
	#accessToken: string | undefined;

	constructor(options: SpeechifyOptions) {
		this.#strict = options.strict ?? defaultOptions.strict;

		this.#checkEnvironment(!!options.apiKey);
		this.#apiKey = options.apiKey ?? defaultOptions.apiKey;

		this.#apiUrl = options.apiUrl ?? defaultOptions.apiUrl;
		if (!this.#apiUrl) {
			throw new Error("API URL is required");
		}
	}

	#errOrWarn(message: string) {
		if (this.#strict) {
			throw new Error(message);
		}
		console.warn(message);
	}

	#checkEnvironment(isApiKeySet: boolean) {
		const isBrowser = typeof window !== "undefined";

		/* @todo handle more known clients like Electron apps if we can */
		const isPublicClient = isBrowser;

		if (isPublicClient && isApiKeySet) {
			return this
				.#errOrWarn(`You are using the API key in the browser environment.
This is strictly not recommended, as it is exposing your Speechify account for anyone to use.
Instead, use the API key in a server environment or use the Access Token in the browser.
Read more about this at https://docs.sws.speechify.com/docs/authentication`);
		}

		if (!isPublicClient && !isApiKeySet) {
			return this
				.#errOrWarn(`You are not using the API Key in the server environment when it's required.
Read more about this at https://docs.sws.speechify.com/docs/authentication`);
		}
	}

	/**
	 * Get the current version of the package
	 */
	get version() {
		return VERSION;
	}

	/**
	 * Set the [access token](https://docs.sws.speechify.com/docs/authentication#access-tokens) for the client.
	 * @param token The Access Token to set.
	 */
	setAccessToken(token: string | undefined) {
		this.#accessToken = token;
	}

	/**
	 * Set the [API key](https://docs.sws.speechify.com/docs/authentication#api-keys) for the client.
	 * @param key The API Key to set.
	 */
	setApiKey(key: string | undefined) {
		this.#checkEnvironment(!!key);
		this.#apiKey = key;
	}

	#getToken() {
		const token = this.#accessToken ?? this.#apiKey;
		if (!token) {
			throw new Error("API Key or Access Token is required");
		}
		return token;
	}

	async #queryAPI({
		url,
		jsonPayload,
		tokenOverride,
		options,
	}: {
		url: string;
		jsonPayload?: Record<string, unknown>;
		tokenOverride?: string;
		options?: RequestInit;
	}) {
		return queryAPI({
			baseUrl: this.#apiUrl,
			url,
			token: tokenOverride ?? this.#getToken(),
			jsonPayload,
			options,
		});
	}

	async #fetchJSON({
		url,
		jsonPayload,
		tokenOverride,
		options,
	}: {
		url: string;
		jsonPayload?: Record<string, unknown>;
		tokenOverride?: string;
		options?: RequestInit;
	}) {
		return fetchJSON({
			baseUrl: this.#apiUrl,
			url,
			token: tokenOverride ?? this.#getToken(),
			jsonPayload,
			options,
		});
	}

	/**
	 * Get the list of available voices.
	 * [API Reference](https://docs.sws.speechify.com/reference/getvoices-1).
	 * @returns The list of available voices.
	 */
	async voicesList() {
		const response = (await this.#fetchJSON({
			url: "/v1/voices",
		})) as VoicesListResponseServer;

		return response.map(
			mapVoice,
		) satisfies VoicesListResponse as VoicesListResponse;
	}

	/**
	 * Create a new voice.
	 * [API Reference](https://docs.sws.speechify.com/reference/createvoice).
	 * @param req Request details.
	 * @returns The newly created voice details.
	 */
	async voicesCreate(req: VoicesCreateRequest) {
		const formData = new FormData();
		formData.set("name", req.name);
		if (req.gender) {
			formData.set("gender", req.gender);
		}
		if (req.avatar) {
			formData.set("avatar", somethingToBlob(req.avatar));
		}
		if (req.locale) {
			formData.set("locale", req.locale);
		}
		formData.set("sample", somethingToBlob(req.sample));
		formData.set("consent", JSON.stringify(req.consent));

		const response = (await this.#fetchJSON({
			url: "/v1/voices",
			options: {
				method: "POST",
				body: formData,
			},
		})) as VoicesCreateResponseServer;

		return {
			id: response.id,
			type: response.type,
			displayName: response.display_name,
			gender: response.gender,
			avatarUrl: response.avatar_image,
			models: response.models.map(mapModel),
			locale: response.locale,
		} satisfies VoicesCreateResponse as VoicesCreateResponse;
	}

	/**
	 * Delete a voice.
	 * [API Reference](https://docs.sws.speechify.com/reference/deletevoice).
	 * @param voiceId The ID of the voice to delete.
	 */
	async voicesDelete(voiceId: string) {
		const response = await this.#queryAPI({
			url: `/v1/voices/${voiceId}`,
			options: {
				method: "DELETE",
			},
		});
		if (response.status === 404) {
			throw new Error("Voice not found");
		}
		if (response.status !== 204) {
			throw new Error("Failed to delete voice");
		}
	}

	/**
	 * Download sample audio for a personal cloned voice.
	 * [API Reference](https://docs.sws.speechify.com/v1/api-reference/api-reference/tts/voices/download-sample).
	 * @param voiceId The ID of the voice to delete.
	 * @returns A Blob containing the audio sample data
	 */
	async voiceSampleDownload(voiceId: string): Promise<Blob> {
		const response = await this.#queryAPI({
			url: `/v1/voices/${voiceId}/sample`,
			options: {
				method: "GET",
			},
		});
		if (response.status === 404) {
			throw new Error("Voice not found");
		}
		if (response.status !== 200) {
			throw new Error("Failed to download voice sample");
		}

		return await response.blob();
	}

	/**
	 * Issue a short-living access token to be used by the public-client.
	 * [API Reference](https://docs.sws.speechify.com/reference/createaccesstoken).
	 * This method must only be called server-side, and the resultant token should be passed to the client.
	 * Read more about this at https://docs.sws.speechify.com/docs/authentication#access-tokens.
	 * You need to call this method regularly to issue the new token and keep it fresh.
	 * The expiration time is defined by the expiresIn property on the return value.
	 * @param scope a single scope, or an array of scopes to issue the token for.
	 * @returns The token details
	 */
	async accessTokenIssue(scope: AccessTokenScope | AccessTokenScope[]) {
		if (!this.#apiKey) {
			throw new Error("API Key is required to issue an access token");
		}
		this.#checkEnvironment(true);

		const scopeString = Array.isArray(scope) ? scope.join(" ") : scope;

		const params = new URLSearchParams({
			grant_type: "client_credentials",
			scope: scopeString,
		});

		const response = await (this.#fetchJSON({
			url: "/v1/auth/token",
			tokenOverride: this.#apiKey,
			options: {
				body: params,
				method: "POST",
			},
		}) as Promise<AccessTokenServerResponse>);

		return {
			accessToken: response.access_token,
			expiresIn: response.expires_in,
			tokenType: response.token_type,
			scopes: response.scope.split(" ") as AccessTokenScope[],
		} satisfies AccessTokenResponse as AccessTokenResponse;
	}

	/**
	 * Generate audio from text.
	 * [API Reference](https://docs.sws.speechify.com/reference/getspeech).
	 * @param req Request details.
	 * @returns The object containing raw audio data and additional information.
	 */
	async audioGenerate(req: AudioSpeechRequest) {
		const body = {
			input: req.input,
			voice_id: req.voiceId,
			audio_format: req.audioFormat ?? "mp3",
			language: req.language,
			model: req.model,
			options: req.options
				? {
						loudness_normalization: req.options.enableLoudnessNormalization,
						text_normalization: req.options.enableTextNormalization,
					}
				: undefined,
		};

		const response = await (this.#fetchJSON({
			url: "/v1/audio/speech",
			jsonPayload: body,
			options: {
				method: "POST",
			},
		}) as Promise<AudioSpeechResponseServer>);

		return {
			audioData: await base64ToBlob(response.audio_data, response.audio_format),
			audioFormat: response.audio_format,
			billableCharactersCount: response.billable_characters_count,
			speech_marks: response.speech_marks,
		} satisfies AudioSpeechResponse as AudioSpeechResponse;
	}

	/**
	 * Stream audio from text.
	 * [API Reference](https://docs.sws.speechify.com/reference/getstream).
	 */
	async audioStream(req: AudioStreamRequest) {
		const body = {
			input: req.input,
			voice_id: req.voiceId,
			language: req.language,
			model: req.model,
			options: req.options
				? {
						loudness_normalization: req.options.enableLoudnessNormalization,
						text_normalization: req.options.enableTextNormalization,
					}
				: undefined,
		};

		const response = await this.#queryAPI({
			url: "/v1/audio/stream",
			jsonPayload: body,
			options: {
				method: "POST",
				headers: {
					Accept: audioFormatToMime(req.audioFormat ?? "mp3"),
				},
			},
		});

		if (!response.body) {
			throw new Error("Response body is empty");
		}

		const reader = response.body.getReader();
		const stream = new ReadableStream<Uint8Array>({
			async pull(controller) {
				try {
					const { done, value } = await reader.read();

					if (done) {
						controller.close();
						return;
					}

					if (value) {
						controller.enqueue(value);
					} else {
						controller.error(new Error("Error occurred while reading stream"));
					}
				} catch (error) {
					controller.error(new Error("Error occurred while reading stream"));
				}
			},
			cancel() {
				reader.cancel();
			},
		});

		return stream;
	}
}

type TimeoutID = ReturnType<typeof setTimeout>;

/**
 * The Speechify Access Token Manager handles the access token issue, refresh, and erasing
 * in accordance with the end-user auth status change.
 * You have to implement the AccessTokenGetter function to obtain the access token
 * (typically it should be a plain HTTP call to your own server endpoint calling
 * the [token issue API](https://docs.sws.speechify.com/reference/createaccesstoken)).
 * This API is also exposed via the SDK as the {@link Speechify.accessTokenIssue} method.
 * Read more [about the Speechify authentication](https://docs.sws.speechify.com/docs/authentication).
 */
export class SpeechifyAccessTokenManager {
	#client: Speechify;
	#getToken: AccessTokenGetter;
	#isAuthenticated = false;
	#tokenRefreshTimeout: TimeoutID | undefined;

	/**
	 * @param speechifyClient An instance of Speechify, to be managed by this manager.
	 * @param getToken The async function to obtain the access token.
	 * @param options The Speechify Access Token Manager init options.
	 */
	constructor(
		speechifyClient: Speechify,
		getToken: AccessTokenGetter,
		options: SpeechifyAccessTokenManagerOptions = {},
	) {
		const { isAuthenticated = false } = options;

		this.#client = speechifyClient;
		this.#getToken = getToken;
		this.setIsAuthenticated(isAuthenticated);
	}

	/**
	 * Set the user authentication status. Call this method when the user logs in or logs out.
	 * It is safe to call this method multiple times with the same value.
	 */
	setIsAuthenticated(isAuthenticated: boolean) {
		if (this.#isAuthenticated === Boolean(isAuthenticated)) {
			return;
		}
		this.#isAuthenticated = Boolean(isAuthenticated);

		if (!this.#isAuthenticated) {
			clearTimeout(this.#tokenRefreshTimeout);
			this.#tokenRefreshTimeout = undefined;
			this.#client.setAccessToken(undefined);
		} else {
			this.#refreshToken();
		}
	}

	async #refreshToken() {
		if (!this.#isAuthenticated) {
			return;
		}

		const tokenResponse = await this.#getToken();
		if (!tokenResponse) {
			throw new Error("Token response is missing");
		}

		const token =
			"accessToken" in tokenResponse
				? tokenResponse.accessToken
				: tokenResponse.access_token;
		if (!token) {
			throw new Error("Token is missing");
		}

		this.#client.setAccessToken(token);

		const expiresIn =
			"expiresIn" in tokenResponse
				? tokenResponse.expiresIn
				: tokenResponse.expires_in;
		if (!expiresIn) {
			throw new Error("Token expiration time is missing");
		}

		setTimeout(
			() => {
				this.#refreshToken();
			},
			(expiresIn / 2) * 1000,
		);
	}
}

const base64ToBlob = async (data: string, audioFormat: AudioSpeechFormat) => {
	const mime = audioFormatToMime(audioFormat);

	if (typeof Buffer !== "undefined") {
		return new Blob([Buffer.from(data, "base64")], { type: mime });
	}

	// Browser trick
	const base64Response = await fetch(`data:${mime};base64,${data}`);
	return base64Response.blob();
};

const somethingToBlob = (source: ArrayBuffer | Blob) => {
	if (source instanceof Blob) {
		return source;
	}
	return new Blob([source]);
};
