const require_env = require('../env.js');
const require_TokenSubscription = require('./TokenSubscription.js');

//#region src/subscribe/helpers.ts
/**
* TODO
*/
const subscribe = async (token, callback) => {
	const app = token.app;
	const api = app?.["inngestApi"];
	const subscription = new require_TokenSubscription.TokenSubscription(token, app?.apiBaseUrl || require_env.getEnvVar("INNGEST_BASE_URL") || require_env.getEnvVar("INNGEST_API_BASE_URL"), api?.["signingKey"] || require_env.getEnvVar("INNGEST_SIGNING_KEY"), api?.["signingKeyFallback"] || require_env.getEnvVar("INNGEST_SIGNING_KEY_FALLBACK"));
	const retStream = subscription.getJsonStream();
	const callbackStream = subscription.getJsonStream();
	await subscription.connect();
	const extras = {
		getJsonStream: () => subscription.getJsonStream(),
		getEncodedStream: () => subscription.getEncodedStream()
	};
	if (callback) subscription.useCallback(callback, callbackStream);
	else callbackStream.cancel("Not needed");
	return Object.assign(retStream, extras);
};
/**
* TODO
*/
const getSubscriptionToken = async (app, args) => {
	const channelId = typeof args.channel === "string" ? args.channel : args.channel.name;
	if (!channelId) throw new Error("Channel ID is required to create a subscription token");
	const key = await app["inngestApi"].getSubscriptionToken(channelId, args.topics);
	return {
		channel: channelId,
		topics: args.topics,
		key
	};
};

//#endregion
exports.getSubscriptionToken = getSubscriptionToken;
exports.subscribe = subscribe;
//# sourceMappingURL=helpers.js.map