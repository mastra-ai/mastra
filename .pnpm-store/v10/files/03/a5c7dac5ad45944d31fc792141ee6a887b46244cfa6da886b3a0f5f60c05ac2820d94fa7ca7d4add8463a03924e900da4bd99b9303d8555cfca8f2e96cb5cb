import { createFetch } from "@better-fetch/fetch";

//#region src/client.ts
const createClient = (options) => {
	const fetch = createFetch(options);
	return async (path, ...options$1) => {
		return await fetch(path, { ...options$1[0] });
	};
};

//#endregion
export { createClient };
//# sourceMappingURL=client.js.map