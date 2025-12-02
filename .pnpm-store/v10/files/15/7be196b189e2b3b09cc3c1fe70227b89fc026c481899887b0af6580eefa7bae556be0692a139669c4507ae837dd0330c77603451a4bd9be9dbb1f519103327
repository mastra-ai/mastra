const require_h3 = require('./h3.cjs');

//#region src/nitro.ts
/**
* The name of the framework, used to identify the framework in Inngest
* dashboards and during testing.
*/
const frameworkName = "nitro";
/**
* In Nitro, serve and register any declared functions with Inngest, making them
* available to be triggered by events.
*
* @public
*/
const serve = (options) => {
	const optsOverrides = {
		...options,
		frameworkName
	};
	return require_h3.serve(optsOverrides);
};

//#endregion
exports.frameworkName = frameworkName;
exports.serve = serve;
//# sourceMappingURL=nitro.cjs.map