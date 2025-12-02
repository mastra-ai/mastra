import { Event } from '../common/interfaces';
import { CryptoProvider } from '../common/crypto/crypto-provider';
export declare class Webhooks {
    private signatureProvider;
    constructor(cryptoProvider: CryptoProvider);
    get verifyHeader(): ({ payload, sigHeader, secret, tolerance, }: {
        payload: any;
        sigHeader: string;
        secret: string;
        tolerance?: number | undefined;
    }) => Promise<boolean>;
    get computeSignature(): (timestamp: any, payload: any, secret: string) => Promise<string>;
    get getTimestampAndSignatureHash(): (sigHeader: string) => [string, string];
    constructEvent({ payload, sigHeader, secret, tolerance, }: {
        payload: unknown;
        sigHeader: string;
        secret: string;
        tolerance?: number;
    }): Promise<Event>;
}
