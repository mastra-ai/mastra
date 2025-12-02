import { APIError } from "better-call";

//#region src/utils/plugin-helper.ts
const getEndpointResponse = async (ctx) => {
	const returned = ctx.context.returned;
	if (!returned) return null;
	if (returned instanceof Response) {
		if (returned.status !== 200) return null;
		return await returned.clone().json();
	}
	if (returned instanceof APIError) return null;
	return returned;
};

//#endregion
export { getEndpointResponse as t };