import { CryptoProvider } from '../common/crypto/crypto-provider';
import { ActionContext } from './interfaces/action.interface';
import { AuthenticationActionResponseData, ResponsePayload, UserRegistrationActionResponseData } from './interfaces/response-payload.interface';
export declare class Actions {
    private signatureProvider;
    constructor(cryptoProvider: CryptoProvider);
    private get computeSignature();
    get verifyHeader(): ({ payload, sigHeader, secret, tolerance, }: {
        payload: any;
        sigHeader: string;
        secret: string;
        tolerance?: number | undefined;
    }) => Promise<boolean>;
    serializeType(type: AuthenticationActionResponseData['type'] | UserRegistrationActionResponseData['type']): "authentication_action_response" | "user_registration_action_response";
    signResponse(data: AuthenticationActionResponseData | UserRegistrationActionResponseData, secret: string): Promise<{
        object: string;
        payload: ResponsePayload;
        signature: string;
    }>;
    constructAction({ payload, sigHeader, secret, tolerance, }: {
        payload: unknown;
        sigHeader: string;
        secret: string;
        tolerance?: number;
    }): Promise<ActionContext>;
}
