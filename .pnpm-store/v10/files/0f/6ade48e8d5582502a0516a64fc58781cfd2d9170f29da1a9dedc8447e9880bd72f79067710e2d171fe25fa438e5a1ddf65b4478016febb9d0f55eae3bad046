import { logger } from "@better-auth/core/env";

//#region src/utils/json.ts
function safeJSONParse(data) {
	function reviver(_, value) {
		if (typeof value === "string") {
			if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) {
				const date = new Date(value);
				if (!isNaN(date.getTime())) return date;
			}
		}
		return value;
	}
	try {
		if (typeof data !== "string") return data;
		return JSON.parse(data, reviver);
	} catch (e) {
		logger.error("Error parsing JSON", { error: e });
		return null;
	}
}

//#endregion
export { safeJSONParse as t };