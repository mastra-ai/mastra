import { Sms, SmsResponse } from './sms.interface';
import { Totp, TotpResponse, TotpWithSecrets, TotpWithSecretsResponse } from './totp.interface';
type FactorType = 'sms' | 'totp' | 'generic_otp';
export interface Factor {
    object: 'authentication_factor';
    id: string;
    createdAt: string;
    updatedAt: string;
    type: FactorType;
    sms?: Sms;
    totp?: Totp;
}
export interface FactorWithSecrets {
    object: 'authentication_factor';
    id: string;
    createdAt: string;
    updatedAt: string;
    type: FactorType;
    sms?: Sms;
    totp?: TotpWithSecrets;
}
export interface FactorResponse {
    object: 'authentication_factor';
    id: string;
    created_at: string;
    updated_at: string;
    type: FactorType;
    sms?: SmsResponse;
    totp?: TotpResponse;
}
export interface FactorWithSecretsResponse {
    object: 'authentication_factor';
    id: string;
    created_at: string;
    updated_at: string;
    type: FactorType;
    sms?: SmsResponse;
    totp?: TotpWithSecretsResponse;
}
export {};
