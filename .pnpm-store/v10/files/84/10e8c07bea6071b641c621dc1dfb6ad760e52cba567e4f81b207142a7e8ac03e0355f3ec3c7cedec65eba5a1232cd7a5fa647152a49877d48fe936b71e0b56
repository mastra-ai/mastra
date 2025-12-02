# Speechify API Node.js SDK

> ⚠️ **DEPRECATED**: This repository and its SDK are now deprecated. Please use the new official [@speechify/api](https://www.npmjs.com/package/@speechify/api) package instead.

The new package provides a more streamlined experience with better TypeScript support and improved API integration. For a quick start guide and migration instructions, please refer to our [changelog](https://docs.sws.speechify.com/changelog/2025/4/25).

---

This is the official Node.js SDK for the Speechify API.

Read the SDK full reference [here](https://speechifyinc.github.io/speechify-api-sdks/nodejs).

Read the REST API documentation [here](https://docs.sws.speechify.com/docs/overview).

## Installation

```bash
npm install @speechify/api-sdk
```

## Usage

### Server-Side Audio Generation

```typescript
import { Speechify } from "@speechify/api-sdk";

const speechify = new Speechify({
	apiKey: "YOUR_API_KEY",
});

const text = "Hello, world!";
const response = await speechify.audioGenerate({
	input: text,
	voiceId: "george",
	audioFormat: "mp3",
});
const audio = response.audioData;

someStorage.saveFile("audio.mp3", audio);
```

### Server-Side Auth Token Generation

```typescript
import { Speechify } from "@speechify/api-sdk";

const speechify = new Speechify({
	apiKey: "YOUR_API_KEY",
});

webServer.post("/speechify-token", async (req, res) => {
	const user = req.user;
	if (!user) {
		res.status(401).send("Unauthorized");
		return;
	}
	const tokenResponse = await speechify.accessTokenIssue("audio:all");
	res.json(tokenResponse);
});
```

### Client-Side Audio Generation

```typescript
import { Speechify } from "@speechify/api-sdk";

const speechify = new Speechify();

authSystem.on("login", async () => {
	const res = await fetch("/speechify-token", {
		method: "POST",
	});
	const tokenResponse = await res.json();

	speechify.setAccessToken(tokenResponse.accessToken);
});

generateButton.addEventListener("click", async () => {
	const text = "Hello, world!";
	const response = await speechify.audioGenerate({
		input: text,
		voiceId: "george",
		audioFormat: "mp3",
	});
	const audio = response.audioData;

	const audioElement = new Audio();
	audioElement.src = URL.createObjectURL(
		new Blob([audio], { type: "audio/mpeg" }),
	);
	audioElement.play();
});
```

### Client-Side Access Token Auto-Management

You can use the provided `SpeechifyAccessTokenManager` class to have the access token fully managed, including the auto-refresh before it expires.

```typescript
import { Speechify, SpeechifyAccessTokenManager } from "@speechify/api-sdk";

const speechify = new Speechify();

const getToken = async () => {
	const res = await fetch("/speechify-token", {
		method: "POST",
	});
	return res.json();
};

const tokenManager = new SpeechifyAccessTokenManager(speechify, getToken, {
	isAuthenticated: authSystem.isAuthenticated,
});

authSystem.on("login", () => {
	tokenManager.setIsAuthenticated(true);
});

authSystem.on("logout", () => {
	tokenManager.setIsAuthenticated(false);
});
```

With this setup in place, you can use the `speechify` client without worrying about the access token management.