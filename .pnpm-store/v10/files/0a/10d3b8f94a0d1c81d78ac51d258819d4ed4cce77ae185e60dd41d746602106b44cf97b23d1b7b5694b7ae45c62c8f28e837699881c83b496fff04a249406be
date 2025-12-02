//#region src/integrations/solid-start.ts
function toSolidStartHandler(auth) {
	const handler = async (event) => {
		return "handler" in auth ? auth.handler(event.request) : auth(event.request);
	};
	return {
		GET: handler,
		POST: handler,
		PATCH: handler,
		PUT: handler,
		DELETE: handler
	};
}

//#endregion
export { toSolidStartHandler };