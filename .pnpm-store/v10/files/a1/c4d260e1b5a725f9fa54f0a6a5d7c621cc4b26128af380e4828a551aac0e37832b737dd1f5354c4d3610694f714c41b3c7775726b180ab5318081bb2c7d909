import { IdentificationLink } from './IdentificationLink';
import type { PhoneNumberJSON } from './JSON';
import { Verification } from './Verification';
export declare class PhoneNumber {
    readonly id: string;
    readonly phoneNumber: string;
    readonly reservedForSecondFactor: boolean;
    readonly defaultSecondFactor: boolean;
    readonly verification: Verification | null;
    readonly linkedTo: IdentificationLink[];
    constructor(id: string, phoneNumber: string, reservedForSecondFactor: boolean, defaultSecondFactor: boolean, verification: Verification | null, linkedTo: IdentificationLink[]);
    static fromJSON(data: PhoneNumberJSON): PhoneNumber;
}
//# sourceMappingURL=PhoneNumber.d.ts.map