import type { DeletedObject, EmailAddress } from '../resources';
import { AbstractAPI } from './AbstractApi';
type CreateEmailAddressParams = {
    userId: string;
    emailAddress: string;
    verified?: boolean;
    primary?: boolean;
};
type UpdateEmailAddressParams = {
    verified?: boolean;
    primary?: boolean;
};
export declare class EmailAddressAPI extends AbstractAPI {
    getEmailAddress(emailAddressId: string): Promise<EmailAddress>;
    createEmailAddress(params: CreateEmailAddressParams): Promise<EmailAddress>;
    updateEmailAddress(emailAddressId: string, params?: UpdateEmailAddressParams): Promise<EmailAddress>;
    deleteEmailAddress(emailAddressId: string): Promise<DeletedObject>;
}
export {};
//# sourceMappingURL=EmailAddressApi.d.ts.map