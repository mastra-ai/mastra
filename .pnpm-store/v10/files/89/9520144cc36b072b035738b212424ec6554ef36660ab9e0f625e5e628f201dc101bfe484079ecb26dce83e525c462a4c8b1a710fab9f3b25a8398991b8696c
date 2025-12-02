import type { SignUpStatus } from '@clerk/types';
import type { SignUpVerificationNextAction } from './Enums';
import type { SignUpJSON, SignUpVerificationJSON, SignUpVerificationsJSON } from './JSON';
export declare class SignUpAttemptVerification {
    readonly nextAction: SignUpVerificationNextAction;
    readonly supportedStrategies: string[];
    constructor(nextAction: SignUpVerificationNextAction, supportedStrategies: string[]);
    static fromJSON(data: SignUpVerificationJSON): SignUpAttemptVerification;
}
export declare class SignUpAttemptVerifications {
    readonly emailAddress: SignUpAttemptVerification | null;
    readonly phoneNumber: SignUpAttemptVerification | null;
    readonly web3Wallet: SignUpAttemptVerification | null;
    readonly externalAccount: object | null;
    constructor(emailAddress: SignUpAttemptVerification | null, phoneNumber: SignUpAttemptVerification | null, web3Wallet: SignUpAttemptVerification | null, externalAccount: object | null);
    static fromJSON(data: SignUpVerificationsJSON): SignUpAttemptVerifications;
}
export declare class SignUpAttempt {
    readonly id: string;
    readonly status: SignUpStatus;
    readonly requiredFields: string[];
    readonly optionalFields: string[];
    readonly missingFields: string[];
    readonly unverifiedFields: string[];
    readonly verifications: SignUpAttemptVerifications | null;
    readonly username: string | null;
    readonly emailAddress: string | null;
    readonly phoneNumber: string | null;
    readonly web3Wallet: string | null;
    readonly passwordEnabled: boolean;
    readonly firstName: string | null;
    readonly lastName: string | null;
    readonly customAction: boolean;
    readonly externalId: string | null;
    readonly createdSessionId: string | null;
    readonly createdUserId: string | null;
    readonly abandonAt: number | null;
    readonly legalAcceptedAt: number | null;
    readonly publicMetadata?: (Record<string, unknown> | null) | undefined;
    readonly unsafeMetadata?: (Record<string, unknown> | null) | undefined;
    constructor(id: string, status: SignUpStatus, requiredFields: string[], optionalFields: string[], missingFields: string[], unverifiedFields: string[], verifications: SignUpAttemptVerifications | null, username: string | null, emailAddress: string | null, phoneNumber: string | null, web3Wallet: string | null, passwordEnabled: boolean, firstName: string | null, lastName: string | null, customAction: boolean, externalId: string | null, createdSessionId: string | null, createdUserId: string | null, abandonAt: number | null, legalAcceptedAt: number | null, publicMetadata?: (Record<string, unknown> | null) | undefined, unsafeMetadata?: (Record<string, unknown> | null) | undefined);
    static fromJSON(data: SignUpJSON): SignUpAttempt;
}
//# sourceMappingURL=SignUpAttempt.d.ts.map