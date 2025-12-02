//#region src/topic.ts
/**
* TODO
*/
const topic = (id) => {
	return new TopicDefinitionImpl(id);
};
var TopicDefinitionImpl = class TopicDefinitionImpl {
	name;
	#schema;
	constructor(name, schema) {
		this.name = name;
		this.#schema = schema;
	}
	type() {
		return this;
	}
	schema(schema) {
		return new TopicDefinitionImpl(this.name, schema);
	}
	getSchema() {
		return this.#schema;
	}
};

//#endregion
export { TopicDefinitionImpl, topic };
//# sourceMappingURL=topic.mjs.map