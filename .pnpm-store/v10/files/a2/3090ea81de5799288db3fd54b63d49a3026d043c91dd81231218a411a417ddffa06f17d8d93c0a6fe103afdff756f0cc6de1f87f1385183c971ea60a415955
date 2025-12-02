"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHTTPSCRAMAuth = getHTTPSCRAMAuth;
const errors_1 = require("./errors");
const buffer_1 = require("./primitives/buffer");
const scram_1 = require("./scram");
const AUTH_ENDPOINT = "/auth/token";
function getHTTPSCRAMAuth(cryptoUtils) {
    const { bufferEquals, generateNonce, buildClientFirstMessage, buildClientFinalMessage, parseServerFirstMessage, parseServerFinalMessage, } = (0, scram_1.getSCRAM)(cryptoUtils);
    return async function HTTPSCRAMAuth(baseUrl, username, password) {
        const authUrl = baseUrl + AUTH_ENDPOINT;
        const clientNonce = generateNonce();
        const [clientFirst, clientFirstBare] = buildClientFirstMessage(clientNonce, username);
        const serverFirstRes = await fetch(authUrl, {
            headers: {
                Authorization: `SCRAM-SHA-256 data=${utf8ToB64(clientFirst)}`,
            },
        });
        const authenticateHeader = serverFirstRes.headers.get("WWW-Authenticate");
        if (serverFirstRes.status !== 401 || !authenticateHeader) {
            const body = await serverFirstRes.text();
            throw new errors_1.ProtocolError(`authentication failed: ${body}`);
        }
        if (!authenticateHeader.startsWith("SCRAM-SHA-256")) {
            throw new errors_1.ProtocolError(`unsupported authentication scheme: ${authenticateHeader}`);
        }
        const authParams = authenticateHeader.split(/ (.+)?/, 2)[1] ?? "";
        if (authParams.length === 0) {
            const body = await serverFirstRes.text();
            throw new errors_1.ProtocolError(`authentication failed: ${body}`);
        }
        const { sid, data: serverFirst } = parseScramAttrs(authParams);
        if (!sid || !serverFirst) {
            throw new errors_1.ProtocolError(`authentication challenge missing attributes: expected "sid" and "data", got '${authParams}'`);
        }
        const [serverNonce, salt, iterCount] = parseServerFirstMessage(serverFirst);
        const [clientFinal, expectedServerSig] = await buildClientFinalMessage(password, salt, iterCount, clientFirstBare, serverFirst, serverNonce);
        const serverFinalRes = await fetch(authUrl, {
            headers: {
                Authorization: `SCRAM-SHA-256 sid=${sid}, data=${utf8ToB64(clientFinal)}`,
            },
        });
        const authInfoHeader = serverFinalRes.headers.get("Authentication-Info");
        if (!serverFinalRes.ok || !authInfoHeader) {
            const body = await serverFinalRes.text();
            throw new errors_1.ProtocolError(`authentication failed: ${body}`);
        }
        const { data: serverFinal, sid: sidFinal } = parseScramAttrs(authInfoHeader);
        if (!sidFinal || !serverFinal) {
            throw new errors_1.ProtocolError(`authentication info missing attributes: expected "sid" and "data", got '${authInfoHeader}'`);
        }
        if (sidFinal !== sid) {
            throw new errors_1.ProtocolError("SCRAM session id does not match");
        }
        const serverSig = parseServerFinalMessage(serverFinal);
        if (!bufferEquals(serverSig, expectedServerSig)) {
            throw new errors_1.ProtocolError("server SCRAM proof does not match");
        }
        const authToken = await serverFinalRes.text();
        return authToken;
    };
}
function utf8ToB64(str) {
    return (0, buffer_1.encodeB64)(buffer_1.utf8Encoder.encode(str));
}
function b64ToUtf8(str) {
    return buffer_1.utf8Decoder.decode((0, buffer_1.decodeB64)(str));
}
function parseScramAttrs(paramsStr) {
    const params = new Map(paramsStr.length > 0
        ? paramsStr
            .split(",")
            .map((attr) => attr.split(/=(.+)?/, 2))
            .map(([key, val]) => [key.trim(), val.trim()])
        : []);
    const sid = params.get("sid") ?? null;
    const rawData = params.get("data");
    const data = rawData ? b64ToUtf8(rawData) : null;
    return { sid, data };
}
