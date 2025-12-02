import type { JsonObject } from "./vendor/type-fest/basic";

export async function createApiError(
	response: Response,
	opts?: { requestId?: string; message?: string }
): Promise<never> {
	const error = new HubApiError(response.url, response.status, response.headers.get("X-Request-Id") ?? opts?.requestId);

	error.message = `Api error with status ${error.statusCode}${opts?.message ? `. ${opts.message}` : ""}`;

	const trailer = [`URL: ${error.url}`, error.requestId ? `Request ID: ${error.requestId}` : undefined]
		.filter(Boolean)
		.join(". ");

	if (response.headers.get("Content-Type")?.startsWith("application/json")) {
		const json = await response.json();
		error.message = json.error || json.message || error.message;
		error.data = json;
	} else {
		error.data = { message: await response.text() };
	}

	error.message += `. ${trailer}`;

	throw error;
}

/**
 * Error thrown when an API call to the Hugging Face Hub fails.
 */
export class HubApiError extends Error {
	statusCode: number;
	url: string;
	requestId?: string;
	data?: JsonObject;

	constructor(url: string, statusCode: number, requestId?: string, message?: string) {
		super(message);

		this.statusCode = statusCode;
		this.requestId = requestId;
		this.url = url;
	}
}

export class InvalidApiResponseFormatError extends Error {}
