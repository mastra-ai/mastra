const require_InngestMiddleware = require('../components/InngestMiddleware.cjs');
const require_InngestFunction = require('../components/InngestFunction.cjs');
const require_Inngest = require('../components/Inngest.cjs');

//#region src/helpers/assertions.ts
/**
* Asserts that the given `input` is an `Inngest` object.
*/
const isInngest = (input) => {
	return input[Symbol.toStringTag] === require_Inngest.Inngest.Tag;
};
/**
* Asserts that the given `input` is an `InngestFunction` object.
*/
const isInngestFunction = (input) => {
	return input[Symbol.toStringTag] === require_InngestFunction.InngestFunction.Tag;
};
/**
* Asserts that the given `input` is an `InngestMiddleware` object.
*/
const isInngestMiddleware = (input) => {
	return input[Symbol.toStringTag] === require_InngestMiddleware.InngestMiddleware.Tag;
};

//#endregion
exports.isInngest = isInngest;
exports.isInngestFunction = isInngestFunction;
exports.isInngestMiddleware = isInngestMiddleware;
//# sourceMappingURL=assertions.cjs.map