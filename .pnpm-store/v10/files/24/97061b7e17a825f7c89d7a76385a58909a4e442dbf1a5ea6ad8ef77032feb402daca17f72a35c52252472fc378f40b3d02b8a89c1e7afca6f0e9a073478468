import type { ClerkPaginationRequest, OAuthProvider, OrganizationInvitationStatus } from '@clerk/types';
import type { DeletedObject, OauthAccessToken, OrganizationInvitation, OrganizationMembership, User } from '../resources';
import type { PaginatedResourceResponse } from '../resources/Deserializer';
import { AbstractAPI } from './AbstractApi';
import type { WithSign } from './util-types';
type UserCountParams = {
    emailAddress?: string[];
    phoneNumber?: string[];
    username?: string[];
    web3Wallet?: string[];
    query?: string;
    userId?: string[];
    externalId?: string[];
};
type UserListParams = ClerkPaginationRequest<UserCountParams & {
    orderBy?: WithSign<'created_at' | 'updated_at' | 'email_address' | 'web3wallet' | 'first_name' | 'last_name' | 'phone_number' | 'username' | 'last_active_at' | 'last_sign_in_at'>;
    last_active_at_since?: number;
    organizationId?: string[];
}>;
type UserMetadataParams = {
    publicMetadata?: UserPublicMetadata;
    privateMetadata?: UserPrivateMetadata;
    unsafeMetadata?: UserUnsafeMetadata;
};
type PasswordHasher = 'argon2i' | 'argon2id' | 'awscognito' | 'bcrypt' | 'bcrypt_sha256_django' | 'md5' | 'pbkdf2_sha256' | 'pbkdf2_sha256_django' | 'pbkdf2_sha1' | 'phpass' | 'scrypt_firebase' | 'scrypt_werkzeug' | 'sha256' | 'md5_phpass' | 'ldap_ssha';
type UserPasswordHashingParams = {
    passwordDigest: string;
    passwordHasher: PasswordHasher;
};
type CreateUserParams = {
    externalId?: string;
    emailAddress?: string[];
    phoneNumber?: string[];
    username?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    skipPasswordChecks?: boolean;
    skipPasswordRequirement?: boolean;
    skipLegalChecks?: boolean;
    legalAcceptedAt?: Date;
    totpSecret?: string;
    backupCodes?: string[];
    createdAt?: Date;
} & UserMetadataParams & (UserPasswordHashingParams | object);
type UpdateUserParams = {
    /** The first name to assign to the user. */
    firstName?: string;
    /** The last name of the user. */
    lastName?: string;
    /** The username to give to the user. It must be unique across your instance. */
    username?: string;
    /** The plaintext password to give the user. Must be at least 8 characters long, and can not be in any list of hacked passwords. */
    password?: string;
    /** Set it to true if you're updating the user's password and want to skip any password policy settings check. This parameter can only be used when providing a password. */
    skipPasswordChecks?: boolean;
    /** Set to true to sign out the user from all their active sessions once their password is updated. This parameter can only be used when providing a password. */
    signOutOfOtherSessions?: boolean;
    /** The ID of the email address to set as primary. It must be verified, and present on the current user. */
    primaryEmailAddressID?: string;
    /** If set to true, the user will be notified that their primary email address has changed. By default, no notification is sent. */
    notifyPrimaryEmailAddressChanged?: boolean;
    /** The ID of the phone number to set as primary. It must be verified, and present on the current user. */
    primaryPhoneNumberID?: string;
    /** The ID of the web3 wallets to set as primary. It must be verified, and present on the current user. */
    primaryWeb3WalletID?: string;
    /** The ID of the image to set as the user's profile image */
    profileImageID?: string;
    /**
     * In case TOTP is configured on the instance, you can provide the secret to enable it on the specific user without the need to reset it.
     * Please note that currently the supported options are:
     * - Period: 30 seconds
     * - Code length: 6 digits
     * - Algorithm: SHA1
     */
    totpSecret?: string;
    /** If Backup Codes are configured on the instance, you can provide them to enable it on the specific user without the need to reset them. You must provide the backup codes in plain format or the corresponding bcrypt digest. */
    backupCodes?: string[];
    /** The ID of the user as used in your external systems or your previous authentication solution. Must be unique across your instance. */
    externalId?: string;
    /** A custom timestamp denoting when the user signed up to the application, specified in RFC3339 format (e.g. 2012-10-20T07:15:20.902Z). */
    createdAt?: Date;
    /** When set to true all legal checks are skipped. It is not recommended to skip legal checks unless you are migrating a user to Clerk. */
    skipLegalChecks?: boolean;
    /** A custom timestamp denoting when the user accepted legal requirements, specified in RFC3339 format (e.g. 2012-10-20T07:15:20.902Z). */
    legalAcceptedAt?: Date;
    /** If true, the user can delete themselves with the Frontend API. */
    deleteSelfEnabled?: boolean;
    /** If true, the user can create organizations with the Frontend API. */
    createOrganizationEnabled?: boolean;
    /** The maximum number of organizations the user can create. 0 means unlimited. */
    createOrganizationsLimit?: number;
} & UserMetadataParams & (UserPasswordHashingParams | object);
type GetOrganizationMembershipListParams = ClerkPaginationRequest<{
    userId: string;
}>;
type GetOrganizationInvitationListParams = ClerkPaginationRequest<{
    userId: string;
    status?: OrganizationInvitationStatus;
}>;
type VerifyPasswordParams = {
    userId: string;
    password: string;
};
type VerifyTOTPParams = {
    userId: string;
    code: string;
};
type DeleteUserPasskeyParams = {
    userId: string;
    passkeyIdentificationId: string;
};
type DeleteWeb3WalletParams = {
    userId: string;
    web3WalletIdentificationId: string;
};
type DeleteUserExternalAccountParams = {
    userId: string;
    externalAccountId: string;
};
type UserID = {
    userId: string;
};
export declare class UserAPI extends AbstractAPI {
    getUserList(params?: UserListParams): Promise<PaginatedResourceResponse<User[]>>;
    getUser(userId: string): Promise<User>;
    createUser(params: CreateUserParams): Promise<User>;
    updateUser(userId: string, params?: UpdateUserParams): Promise<User>;
    updateUserProfileImage(userId: string, params: {
        file: Blob | File;
    }): Promise<User>;
    updateUserMetadata(userId: string, params: UserMetadataParams): Promise<User>;
    deleteUser(userId: string): Promise<User>;
    getCount(params?: UserCountParams): Promise<number>;
    /** @deprecated Use `getUserOauthAccessToken` without the `oauth_` provider prefix . */
    getUserOauthAccessToken(userId: string, provider: `oauth_${OAuthProvider}`): Promise<PaginatedResourceResponse<OauthAccessToken[]>>;
    getUserOauthAccessToken(userId: string, provider: OAuthProvider): Promise<PaginatedResourceResponse<OauthAccessToken[]>>;
    disableUserMFA(userId: string): Promise<UserID>;
    getOrganizationMembershipList(params: GetOrganizationMembershipListParams): Promise<PaginatedResourceResponse<OrganizationMembership[]>>;
    getOrganizationInvitationList(params: GetOrganizationInvitationListParams): Promise<PaginatedResourceResponse<OrganizationInvitation[]>>;
    verifyPassword(params: VerifyPasswordParams): Promise<{
        verified: true;
    }>;
    verifyTOTP(params: VerifyTOTPParams): Promise<{
        verified: true;
        code_type: "totp";
    }>;
    banUser(userId: string): Promise<User>;
    unbanUser(userId: string): Promise<User>;
    lockUser(userId: string): Promise<User>;
    unlockUser(userId: string): Promise<User>;
    deleteUserProfileImage(userId: string): Promise<User>;
    deleteUserPasskey(params: DeleteUserPasskeyParams): Promise<DeletedObject>;
    deleteUserWeb3Wallet(params: DeleteWeb3WalletParams): Promise<DeletedObject>;
    deleteUserExternalAccount(params: DeleteUserExternalAccountParams): Promise<DeletedObject>;
    deleteUserBackupCodes(userId: string): Promise<UserID>;
    deleteUserTOTP(userId: string): Promise<UserID>;
}
export {};
//# sourceMappingURL=UserApi.d.ts.map