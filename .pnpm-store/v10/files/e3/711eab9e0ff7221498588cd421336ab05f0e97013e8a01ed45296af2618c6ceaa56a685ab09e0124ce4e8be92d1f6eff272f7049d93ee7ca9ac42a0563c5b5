
//#region src/helpers/crypto.ts
/**
* Create a cryptographically secure random value.
*
* @throws {Error} If the crypto module is not available.
*/
function createEntropy(byteLength) {
	const bytes = new Uint8Array(byteLength);
	const { crypto } = globalThis;
	if (!crypto) throw new Error("missing crypto module");
	if (!crypto.getRandomValues) throw new Error("missing crypto.getRandomValues");
	crypto.getRandomValues(bytes);
	return bytes;
}

//#endregion
exports.createEntropy = createEntropy;
//# sourceMappingURL=crypto.cjs.map