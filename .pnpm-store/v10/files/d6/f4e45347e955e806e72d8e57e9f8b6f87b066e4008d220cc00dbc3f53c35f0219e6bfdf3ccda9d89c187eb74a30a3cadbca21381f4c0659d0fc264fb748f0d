import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import packageJson from "../package.json";

const sampleFileName = "test-fixtures/sample.mp3";
const avatarFileName = "test-fixtures/avatar.jpeg";

const getSomeBlob = async ({ type, isBrowser = false } = {}) => {
	const fileName = type === "avatar" ? avatarFileName : sampleFileName;

	if (isBrowser) {
		const res = await fetch(
			// the file is the very same file used below in Node.js branch,
			// but downloaded from GitHub public URL
			// the prefix is proxied in the vitest config in `nodejs/vitest.config.browser.ts`, to avoid CORS issues
			`/github-assets/SpeechifyInc/speechify-api-sdks/raw/refs/heads/main/nodejs/src/${fileName}`,
		);

		if (!res.ok) {
			throw new Error(`${res.statusText}: ${await res.text()}`);
		}

		return res.blob();
	}

	const file = fs.readFileSync(
		path.resolve(import.meta.dirname, `./${fileName}`),
	);
	return new Blob([file], {
		type: type === "avatar" ? "image/jpeg" : "audio/mpeg",
	});
};

export default function testSuite(
	Speechify,
	SpeechifyAccessTokenManager,
	{ strict = true } = {},
) {
	let speechify;

	beforeAll(() => {
		const apiKey = process.env.SPEECHIFY_API_KEY;
		if (!apiKey) {
			throw new Error("SPEECHIFY_API_KEY is not set");
		}
		speechify = new Speechify({
			apiKey,
			apiUrl: "https://api.sws.speechify.dev",
			strict,
		});
	});

	describe("voices", () => {
		test("list", async () => {
			const voices = await speechify.voicesList();

			expect(voices).toBeInstanceOf(Array);

			const george = voices.find((voice) => voice.id === "george");

			expect(george).toBeDefined();

			expect(george?.displayName).toBe("George");
		});

		test("create with Blob", async () => {
			const blob = await getSomeBlob({
				type: "sample",
				isBrowser: typeof window !== "undefined",
			});

			const voice = await speechify.voicesCreate({
				name: "J. S. Bach",
				sample: blob,
				consent: {
					fullName: "J. S. Bach",
					email: "j.s.bach@mezzo.tv",
				},
			});

			expect(voice).toMatchObject({
				displayName: "J. S. Bach",
				type: "personal",
			});
		});

		test("create with Buffer", async () => {
			if (typeof window !== "undefined") {
				console.warn("Skipping node-specific test in the browser");
				return;
			}

			const file = fs.readFileSync(
				path.resolve(import.meta.dirname, `./${sampleFileName}`),
			);

			const voice = await speechify.voicesCreate({
				name: "J. S. Bach",
				sample: file,
				consent: {
					fullName: "J. S. Bach",
					email: "j.s.bach@mezzo.tv",
				},
			});

			expect(voice).toMatchObject({
				displayName: "J. S. Bach",
				type: "personal",
			});
		});

		test("create with avatar and gender", async () => {
			const sampleBlob = await getSomeBlob({
				type: "sample",
				isBrowser: typeof window !== "undefined",
			});
			const avatarBlob = await getSomeBlob({
				type: "avatar",
				isBrowser: typeof window !== "undefined",
			});

			const voice = await speechify.voicesCreate({
				name: "J. S. Bach",
				gender: "male",
				avatar: avatarBlob,
				sample: sampleBlob,
				consent: {
					fullName: "J. S. Bach",
					email: "j.s.bach@mezzo.tv",
				},
			});

			expect(voice).toMatchObject({
				displayName: "J. S. Bach",
				gender: "male",
				type: "personal",
			});

			expect(voice.avatarUrl).toBeTruthy();
		});

		test("delete", async () => {
			const blob = await getSomeBlob({
				isBrowser: typeof window !== "undefined",
			});

			const voice = await speechify.voicesCreate({
				name: "J. S. Bach",
				sample: blob,
				consent: {
					fullName: "J. S. Bach",
					email: "j.s.bach@mezzo.tv",
				},
			});

			const id = voice.id;

			await speechify.voicesDelete(id);
		});

		test("download sample", async () => {
			const sample = await getSomeBlob({
				isBrowser: typeof window !== "undefined",
			});

			const voice = await speechify.voicesCreate({
				name: "J. S. Bach",
				sample,
				consent: {
					fullName: "J. S. Bach",
					email: "j.s.bach@mezzo.tv",
				},
			});

			const id = voice.id;
			const blob = await speechify.voiceSampleDownload(id);

			expect(blob).toBeInstanceOf(Blob);
		});
	});

	describe("access token", () => {
		test("issue", async () => {
			const token = await speechify.accessTokenIssue("audio:speech");

			expect(token).toMatchObject({
				accessToken: expect.any(String),
				expiresIn: 3600,
				scopes: ["audio:speech"],
				tokenType: "bearer",
			});
		});

		test("issue with multiple scopes", async () => {
			const token = await speechify.accessTokenIssue([
				"audio:speech",
				"voices:read",
			]);

			expect(token).toMatchObject({
				accessToken: expect.any(String),
				expiresIn: 3600,
				scopes: ["audio:speech", "voices:read"],
				tokenType: "bearer",
			});
		});

		test("use normally", async () => {
			const token = await speechify.accessTokenIssue("audio:speech");

			speechify.setAccessToken(token.accessToken);

			const speech = await speechify.audioGenerate({
				input: "Hello, world!",
				audioFormat: "mp3",
				voiceId: "george",
			});

			expect(speech.audioData).toBeInstanceOf(Blob);

			speechify.setAccessToken(undefined);
		});

		test("use with wrong scope", async () => {
			const token = await speechify.accessTokenIssue("audio:speech");

			speechify.setAccessToken(token.accessToken);

			await expect(speechify.voicesList()).rejects.toThrowError(
				/none of the sufficient scopes found/,
			);

			speechify.setAccessToken(undefined);
		});

		test("use, then remove: API key is used again", async () => {
			const token = await speechify.accessTokenIssue("audio:speech");

			speechify.setAccessToken(token.accessToken);

			await expect(speechify.voicesList()).rejects.toThrowError();

			speechify.setAccessToken(undefined);

			const voices = await speechify.voicesList();

			expect(voices).toBeInstanceOf(Array);
		});
	});

	describe("audio", () => {
		test("generate", async () => {
			const speech = await speechify.audioGenerate({
				input: "Hello, world!",
				audioFormat: "mp3",
				voiceId: "george",
			});

			expect(speech.audioData).toBeInstanceOf(Blob);
		});

		test("generate with SSML", async () => {
			const speech = await speechify.audioGenerate({
				input: "<speak>Hello, world!</speak>",
				audioFormat: "mp3",
				voiceId: "george",
			});

			expect(speech.audioData).toBeInstanceOf(Blob);
		});

		test("stream", async () => {
			const stream = await speechify.audioStream({
				input: "Hello, world!",
				voiceId: "george",
			});

			expect(stream).toBeInstanceOf(ReadableStream);
		});
	});

	describe("stream error handling", () => {
		afterEach(() => {
			vi.restoreAllMocks();
		});

		test("handles audio-server stream errors correctly", async () => {
			const streamResponseWithError = new Response(
				new ReadableStream({
					async pull(controller) {
						controller.enqueue(new Uint8Array([1, 2, 3]));
						await new Promise((resolve) => setTimeout(resolve, 1000));
						controller.enqueue(new Uint8Array([4, 5, 6]));
						await new Promise((resolve) => setTimeout(resolve, 1000));
						controller.error(new Error("Some error from audio server"));
						controller.enqueue(new Uint8Array([7, 8, 9]));
					},
				}),
			);
			vi.spyOn(globalThis, "fetch").mockImplementation(
				() => streamResponseWithError,
			);

			const response = await speechify.audioStream({
				input: "Hello, world!",
				voiceId: "george",
			});

			const reader = response.getReader();

			await reader.read();
			await reader.read();
			const resp3 = reader.read();

			await expect(resp3).rejects.toThrow(
				"Error occurred while reading stream",
			);
		});

		test("handles empty chunk correctly", async () => {
			const streamResponseWithEmptyChunk = new Response(
				new ReadableStream({
					async pull(controller) {
						controller.enqueue(new Uint8Array([1, 2, 3]));
						await new Promise((resolve) => setTimeout(resolve, 1000));
						controller.enqueue(new Uint8Array([4, 5, 6]));
						await new Promise((resolve) => setTimeout(resolve, 1000));
						controller.enqueue();
						controller.enqueue(new Uint8Array([7, 8, 9]));
					},
				}),
			);

			vi.spyOn(globalThis, "fetch").mockImplementation(
				() => streamResponseWithEmptyChunk,
			);

			const response = await speechify.audioStream({
				input: "Hello, world!",
				voiceId: "george",
			});
			const reader = response.getReader();

			await reader.read();
			await reader.read();

			await expect(reader.read()).rejects.toThrow(
				"Error occurred while reading stream",
			);
		});
	});

	describe("version", () => {
		test("returns the current package version", () => {
			expect(speechify.version).toBe(packageJson.version);
		});
	});

	describe("SpeechifyAccessTokenManager", () => {
		test("works with raw server response", async () => {
			let callCounter = 0;

			const getToken = async () => {
				callCounter += 1;

				return {
					access_token: "a.b.c",
					expires_in: 1,
					scope: "audio:speech",
					token_type: "bearer",
				};
			};

			const manager = new SpeechifyAccessTokenManager(speechify, getToken);

			manager.setIsAuthenticated(true);

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(callCounter).toBe(1);

			await new Promise((resolve) => setTimeout(resolve, 500));

			expect(callCounter).toBe(2);

			await new Promise((resolve) => setTimeout(resolve, 500));

			expect(callCounter).toBe(3);

			manager.setIsAuthenticated(false);

			await new Promise((resolve) => setTimeout(resolve, 500));

			expect(callCounter).toBe(3);
		});

		test("works with SDK server response", async () => {
			let callCounter = 0;

			const getToken = async () => {
				callCounter += 1;

				return {
					accessToken: "a.b.c",
					expiresIn: 1,
					scopes: ["audio:speech"],
					tokenType: "bearer",
				};
			};

			const manager = new SpeechifyAccessTokenManager(speechify, getToken);

			manager.setIsAuthenticated(true);

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(callCounter).toBe(1);

			await new Promise((resolve) => setTimeout(resolve, 500));

			expect(callCounter).toBe(2);

			await new Promise((resolve) => setTimeout(resolve, 500));

			expect(callCounter).toBe(3);

			manager.setIsAuthenticated(false);

			await new Promise((resolve) => setTimeout(resolve, 500));

			expect(callCounter).toBe(3);
		});
	});
}
