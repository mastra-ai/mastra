import type { DeletedObject, PhoneNumber } from '../resources';
import { AbstractAPI } from './AbstractApi';
type CreatePhoneNumberParams = {
    userId: string;
    phoneNumber: string;
    verified?: boolean;
    primary?: boolean;
    reservedForSecondFactor?: boolean;
};
type UpdatePhoneNumberParams = {
    verified?: boolean;
    primary?: boolean;
    reservedForSecondFactor?: boolean;
};
export declare class PhoneNumberAPI extends AbstractAPI {
    getPhoneNumber(phoneNumberId: string): Promise<PhoneNumber>;
    createPhoneNumber(params: CreatePhoneNumberParams): Promise<PhoneNumber>;
    updatePhoneNumber(phoneNumberId: string, params?: UpdatePhoneNumberParams): Promise<PhoneNumber>;
    deletePhoneNumber(phoneNumberId: string): Promise<DeletedObject>;
}
export {};
//# sourceMappingURL=PhoneNumberApi.d.ts.map