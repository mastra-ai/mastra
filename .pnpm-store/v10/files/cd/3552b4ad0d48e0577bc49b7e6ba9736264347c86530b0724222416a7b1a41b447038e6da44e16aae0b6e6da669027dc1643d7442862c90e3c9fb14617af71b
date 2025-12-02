import { topic } from "./topic.mjs";

//#region src/channel.ts
/**
* TODO
*/
const channel = (id) => {
	let channelDefinition;
	const topics = {};
	const builder = (...args) => {
		const finalId = typeof id === "string" ? id : id(...args);
		return {
			name: finalId,
			topics,
			...Object.entries(topics).reduce((acc, [name, topic$1]) => {
				acc[name] = createTopicFn(finalId, topic$1);
				return acc;
			}, {})
		};
	};
	const extras = {
		topics,
		addTopic: (topic$1) => {
			topics[topic$1.name] = topic$1;
			return channelDefinition;
		}
	};
	channelDefinition = Object.assign(builder, extras);
	return channelDefinition;
};
/**
* TODO
*/
const typeOnlyChannel = (id) => {
	const blankChannel = {
		...channel(id),
		topics: new Proxy({}, { get: (target, prop) => {
			if (prop in target) return target[prop];
			if (typeof prop === "string") return topic(prop);
		} })
	};
	return new Proxy(blankChannel, { get: (target, prop) => {
		if (prop in target) return target[prop];
		if (typeof prop === "string") return createTopicFn(id, topic(prop));
	} });
};
const createTopicFn = (channelId, topic$1) => {
	return async (data) => {
		const schema = topic$1.getSchema();
		if (schema) try {
			await schema["~standard"].validate(data);
		} catch (err) {
			console.error(`Failed schema validation for channel "${channelId}" topic "${topic$1.name}":`, err);
			throw new Error("Failed schema validation");
		}
		return {
			channel: channelId,
			topic: topic$1.name,
			data
		};
	};
};

//#endregion
export { channel, typeOnlyChannel };
//# sourceMappingURL=channel.mjs.map