import { WorkOS } from '../workos';
import { ChallengeFactorOptions, Challenge, EnrollFactorOptions, Factor, VerifyChallengeOptions, VerifyFactorOptions, VerifyResponse, FactorWithSecrets } from './interfaces';
export declare class Mfa {
    private readonly workos;
    constructor(workos: WorkOS);
    deleteFactor(id: string): Promise<void>;
    getFactor(id: string): Promise<Factor>;
    enrollFactor(options: EnrollFactorOptions): Promise<FactorWithSecrets>;
    challengeFactor(options: ChallengeFactorOptions): Promise<Challenge>;
    /**
     * @deprecated Please use `verifyChallenge` instead.
     */
    verifyFactor(options: VerifyFactorOptions): Promise<VerifyResponse>;
    verifyChallenge(options: VerifyChallengeOptions): Promise<VerifyResponse>;
}
