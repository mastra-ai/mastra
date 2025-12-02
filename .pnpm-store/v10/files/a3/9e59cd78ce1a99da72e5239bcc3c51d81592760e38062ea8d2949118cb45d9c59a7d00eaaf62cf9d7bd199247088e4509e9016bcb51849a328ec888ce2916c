export interface ResponsePayload {
    timestamp: number;
    verdict?: 'Allow' | 'Deny';
    errorMessage?: string;
}
interface AllowResponseData {
    verdict: 'Allow';
}
interface DenyResponseData {
    verdict: 'Deny';
    errorMessage?: string;
}
export type AuthenticationActionResponseData = (AllowResponseData & {
    type: 'authentication';
}) | (DenyResponseData & {
    type: 'authentication';
});
export type UserRegistrationActionResponseData = (AllowResponseData & {
    type: 'user_registration';
}) | (DenyResponseData & {
    type: 'user_registration';
});
export {};
