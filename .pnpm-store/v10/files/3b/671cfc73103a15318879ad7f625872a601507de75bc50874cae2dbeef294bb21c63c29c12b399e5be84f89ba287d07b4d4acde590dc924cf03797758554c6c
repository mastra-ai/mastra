import { InngestMiddleware } from "../components/InngestMiddleware.js";

//#region src/middleware/dependencyInjection.ts
/**
* Adds properties to the function input for every function created using this
* app.
*/
const dependencyInjectionMiddleware = (ctx) => {
	return new InngestMiddleware({
		name: "Inngest: Dependency Injection",
		init() {
			return { onFunctionRun() {
				return { transformInput() {
					return { ctx };
				} };
			} };
		}
	});
};

//#endregion
export { dependencyInjectionMiddleware };
//# sourceMappingURL=dependencyInjection.js.map