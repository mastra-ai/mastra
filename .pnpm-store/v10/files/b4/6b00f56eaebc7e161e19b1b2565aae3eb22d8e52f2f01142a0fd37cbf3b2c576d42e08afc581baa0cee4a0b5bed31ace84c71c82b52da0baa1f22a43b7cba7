import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { EncryptJWT, SignJWT, base64url, calculateJwkThumbprint, jwtDecrypt, jwtVerify } from "jose";

//#region src/crypto/jwt.ts
async function signJWT(payload, secret, expiresIn = 3600) {
	return await new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(Math.floor(Date.now() / 1e3) + expiresIn).sign(new TextEncoder().encode(secret));
}
async function verifyJWT(token, secret) {
	try {
		return (await jwtVerify(token, new TextEncoder().encode(secret))).payload;
	} catch (error) {
		return null;
	}
}
const info = new Uint8Array([
	66,
	101,
	116,
	116,
	101,
	114,
	65,
	117,
	116,
	104,
	46,
	106,
	115,
	32,
	71,
	101,
	110,
	101,
	114,
	97,
	116,
	101,
	100,
	32,
	69,
	110,
	99,
	114,
	121,
	112,
	116,
	105,
	111,
	110,
	32,
	75,
	101,
	121
]);
const now = () => Date.now() / 1e3 | 0;
const alg = "dir";
const enc = "A256CBC-HS512";
async function symmetricEncodeJWT(payload, secret, salt, expiresIn = 3600) {
	const encryptionSecret = hkdf(sha256, new TextEncoder().encode(secret), new TextEncoder().encode(salt), info, 64);
	const thumbprint = await calculateJwkThumbprint({
		kty: "oct",
		k: base64url.encode(encryptionSecret)
	}, "sha256");
	return await new EncryptJWT(payload).setProtectedHeader({
		alg,
		enc,
		kid: thumbprint
	}).setIssuedAt().setExpirationTime(now() + expiresIn).setJti(crypto.randomUUID()).encrypt(encryptionSecret);
}
async function symmetricDecodeJWT(token, secret, salt) {
	if (!token) return null;
	try {
		const { payload } = await jwtDecrypt(token, async ({ kid }) => {
			const encryptionSecret = hkdf(sha256, new TextEncoder().encode(secret), new TextEncoder().encode(salt), info, 64);
			if (kid === void 0) return encryptionSecret;
			if (kid === await calculateJwkThumbprint({
				kty: "oct",
				k: base64url.encode(encryptionSecret)
			}, "sha256")) return encryptionSecret;
			throw new Error("no matching decryption secret");
		}, {
			clockTolerance: 15,
			keyManagementAlgorithms: [alg],
			contentEncryptionAlgorithms: [enc, "A256GCM"]
		});
		return payload;
	} catch (error) {
		return null;
	}
}

//#endregion
export { verifyJWT as i, symmetricDecodeJWT as n, symmetricEncodeJWT as r, signJWT as t };