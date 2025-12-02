interface Options {
    encrypt: boolean;
    version: {
        major: number;
        minor: number;
        build: number;
        subbuild: number;
    };
}
declare class PreloginPayload {
    data: Buffer;
    options: Options;
    version: {
        major: number;
        minor: number;
        build: number;
        subbuild: number;
    };
    encryption: number;
    encryptionString: string;
    instance: number;
    threadId: number;
    mars: number;
    marsString: string;
    fedAuthRequired: number;
    constructor(bufferOrOptions?: Buffer | Options);
    createOptions(): void;
    createVersionOption(): {
        token: number;
        data: Buffer;
    };
    createEncryptionOption(): {
        token: number;
        data: Buffer;
    };
    createInstanceOption(): {
        token: number;
        data: Buffer;
    };
    createThreadIdOption(): {
        token: number;
        data: Buffer;
    };
    createMarsOption(): {
        token: number;
        data: Buffer;
    };
    createFedAuthOption(): {
        token: number;
        data: Buffer;
    };
    extractOptions(): void;
    extractVersion(offset: number): void;
    extractEncryption(offset: number): void;
    extractInstance(offset: number): void;
    extractThreadId(offset: number): void;
    extractMars(offset: number): void;
    extractFedAuth(offset: number): void;
    toString(indent?: string): string;
}
export default PreloginPayload;
