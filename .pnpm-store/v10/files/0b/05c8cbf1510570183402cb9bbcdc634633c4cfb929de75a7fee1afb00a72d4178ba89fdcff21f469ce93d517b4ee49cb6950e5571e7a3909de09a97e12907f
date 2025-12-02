import { VERSION } from "./version.js";

import type {
	AudioSpeechFormat,
	VoiceLanguage,
	VoiceLanguageServer,
	VoiceModel,
	VoiceModelServer,
	VoicesListEntry,
	VoicesListEntryServer,
} from "./types.js";

export interface QueryParams {
	baseUrl: string;
	url: string;
	token: string;
	options?: RequestInit;
	jsonPayload?: Record<string, unknown>;
}

/**
 * Error class that represents Speechify API server errors.
 * @property statusCode - The HTTP status code of the error.
 */
export class SpeechifyError extends Error {
	constructor(
		message: string,
		public statusCode: number,
	) {
		super(message);
	}
}

export const queryAPI = async ({
	baseUrl,
	url,
	token,
	jsonPayload,
	options: initialOptions = {},
}: QueryParams) => {
	const options = { ...initialOptions };

	const headers = new Headers(options.headers);
	options.headers = headers;

	headers.set("Authorization", `Bearer ${token}`);
	headers.set("X-Speechify-SDK", "nodejs");
	headers.set("X-Speechify-SDK-Version", VERSION);

	// In the browser, enforce CORS
	if (typeof window !== "undefined") {
		options.mode = "cors";
	}

	if (jsonPayload) {
		options.body = JSON.stringify(jsonPayload);
		if (!headers.get("Content-Type")) {
			headers.set("Content-Type", "application/json");
		}
	}

	const fullUrl = new URL(url, baseUrl);

	const response = await fetch(fullUrl.toString(), options);

	if (!response.ok) {
		const error = await response.text();
		throw new SpeechifyError(
			`Speechify API Error ${response.statusText}: ${error || "Unknown error"}`,
			response.status,
		);
	}

	return response;
};

export const fetchJSON = async ({
	baseUrl,
	url,
	token,
	jsonPayload,
	options = {},
}: QueryParams) => {
	const response = await queryAPI({
		baseUrl,
		url,
		token,
		jsonPayload,
		options,
	});

	const contentType = response.headers.get("content-type");
	const parseJson = contentType?.includes("application/json");

	if (!parseJson) {
		throw new Error("Response is not JSON");
	}

	return response.json();
};

export const mapLanguage = (lang: VoiceLanguageServer): VoiceLanguage => {
	return {
		locale: lang.locale,
		previewAudio: lang.preview_audio,
	} satisfies VoiceLanguage;
};

export const mapModel = (model: VoiceModelServer): VoiceModel => {
	return {
		name: model.name,
		languages: model.languages.map(mapLanguage),
	} satisfies VoiceModel;
};

export const mapVoice = (voice: VoicesListEntryServer): VoicesListEntry => {
	return {
		id: voice.id,
		type: voice.type,
		displayName: voice.display_name,
		models: voice.models.map(mapModel),
		gender: voice.gender,
		avatarImage: voice.avatar_image,
		previewAudio: voice.preview_audio,
		tags: voice.tags,
	} satisfies VoicesListEntry;
};

export const audioFormatToMime = (format: AudioSpeechFormat) => {
	switch (format) {
		case "mp3":
			return "audio/mpeg";
		case "wav":
			return "audio/wav";
		case "ogg":
			return "audio/ogg";
		case "aac":
			return "audio/aac";
		default:
			throw new Error(`Unsupported audio format: ${format}`);
	}
};
