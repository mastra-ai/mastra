const require_InngestMiddleware = require('../components/InngestMiddleware.cjs');

//#region src/middleware/dependencyInjection.ts
/**
* Adds properties to the function input for every function created using this
* app.
*/
const dependencyInjectionMiddleware = (ctx) => {
	return new require_InngestMiddleware.InngestMiddleware({
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
exports.dependencyInjectionMiddleware = dependencyInjectionMiddleware;
//# sourceMappingURL=dependencyInjection.cjs.map