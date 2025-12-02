import { serve as serve$1 } from "./h3.js";

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
	return serve$1(optsOverrides);
};

//#endregion
export { frameworkName, serve };
//# sourceMappingURL=nitro.js.map