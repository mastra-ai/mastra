import { toNodeHandler as toNodeHandler$1 } from "better-call/node";

//#region src/integrations/node.ts
const toNodeHandler = (auth) => {
	return "handler" in auth ? toNodeHandler$1(auth.handler) : toNodeHandler$1(auth);
};
function fromNodeHeaders(nodeHeaders) {
	const webHeaders = new Headers();
	for (const [key, value] of Object.entries(nodeHeaders)) if (value !== void 0) if (Array.isArray(value)) value.forEach((v) => webHeaders.append(key, v));
	else webHeaders.set(key, value);
	return webHeaders;
}

//#endregion
export { fromNodeHeaders, toNodeHandler };