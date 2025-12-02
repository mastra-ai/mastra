interface Options {
    domain: string;
    userName: string;
    password: string;
    ntlmpacket: {
        target: Buffer;
        nonce: Buffer;
    };
}
declare class NTLMResponsePayload {
    data: Buffer;
    constructor(loginData: Options);
    toString(indent?: string): string;
    createResponse(challenge: Options): Buffer;
    createClientNonce(): Buffer;
    ntlmv2Response(domain: string, user: string, password: string, serverNonce: Buffer, targetInfo: Buffer, clientNonce: Buffer, mytime: number): Buffer;
    createTimestamp(time: number): Buffer;
    lmv2Response(domain: string, user: string, password: string, serverNonce: Buffer, clientNonce: Buffer): Buffer;
    ntv2Hash(domain: string, user: string, password: string): Buffer;
    ntHash(text: string): Buffer;
    hmacMD5(data: Buffer, key: Buffer): Buffer;
}
export default NTLMResponsePayload;
