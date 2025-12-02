import { CryptoProvider } from './crypto-provider';
export declare class SignatureProvider {
    private cryptoProvider;
    constructor(cryptoProvider: CryptoProvider);
    verifyHeader({ payload, sigHeader, secret, tolerance, }: {
        payload: any;
        sigHeader: string;
        secret: string;
        tolerance?: number;
    }): Promise<boolean>;
    getTimestampAndSignatureHash(sigHeader: string): [string, string];
    computeSignature(timestamp: any, payload: any, secret: string): Promise<string>;
}
