import { InngestMiddleware } from "../components/InngestMiddleware.js";
import { InngestFunction } from "../components/InngestFunction.js";
import { Inngest } from "../components/Inngest.js";

//#region src/helpers/assertions.ts
/**
* Asserts that the given `input` is an `Inngest` object.
*/
const isInngest = (input) => {
	return input[Symbol.toStringTag] === Inngest.Tag;
};
/**
* Asserts that the given `input` is an `InngestFunction` object.
*/
const isInngestFunction = (input) => {
	return input[Symbol.toStringTag] === InngestFunction.Tag;
};
/**
* Asserts that the given `input` is an `InngestMiddleware` object.
*/
const isInngestMiddleware = (input) => {
	return input[Symbol.toStringTag] === InngestMiddleware.Tag;
};

//#endregion
export { isInngest, isInngestFunction, isInngestMiddleware };
//# sourceMappingURL=assertions.js.map