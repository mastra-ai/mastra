//#region src/components/InngestFunctionReference.ts
/**
* A reference to an `InngestFunction` that can be used to represent both local
* and remote functions without pulling in the full function definition (i.e.
* dependencies).
*
* These references can be invoked in the same manner as a regular
* `InngestFunction`.
*
* To create a reference function, use the {@link referenceFunction} helper.
*
* @public
*/
var InngestFunctionReference = class InngestFunctionReference {
	get [Symbol.toStringTag]() {
		return InngestFunctionReference.Tag;
	}
	constructor(opts) {
		this.opts = opts;
	}
};
/**
* Create a reference to an `InngestFunction` that can be used to represent both
* local and remote functions without pulling in the full function definition
* (i.e. dependencies).
*
* These references can be invoked in the same manner as a regular
* `InngestFunction`.
*
* @public
*/
const referenceFunction = ({ functionId, appId }) => {
	return new InngestFunctionReference({
		functionId,
		appId
	});
};
(function(_InngestFunctionReference) {
	_InngestFunctionReference.Tag = "Inngest.FunctionReference";
})(InngestFunctionReference || (InngestFunctionReference = {}));

//#endregion
export { InngestFunctionReference, referenceFunction };
//# sourceMappingURL=InngestFunctionReference.js.map