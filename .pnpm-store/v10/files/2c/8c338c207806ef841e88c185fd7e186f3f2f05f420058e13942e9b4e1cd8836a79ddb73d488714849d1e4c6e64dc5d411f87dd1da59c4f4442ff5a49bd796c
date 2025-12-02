/*! firebase-admin v13.5.0 */
/*!
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Used for looking up an account by uid.
 *
 * See {@link BaseAuth.getUsers}.
 */
export interface UidIdentifier {
    uid: string;
}
/**
 * Used for looking up an account by email.
 *
 * See {@link BaseAuth.getUsers}.
 */
export interface EmailIdentifier {
    email: string;
}
/**
 * Used for looking up an account by phone number.
 *
 * See {@link BaseAuth.getUsers}.
 */
export interface PhoneIdentifier {
    phoneNumber: string;
}
/**
 * Used for looking up an account by federated provider.
 *
 * See {@link BaseAuth.getUsers}.
 */
export interface ProviderIdentifier {
    providerId: string;
    providerUid: string;
}
/**
 * Identifies a user to be looked up.
 */
export type UserIdentifier = UidIdentifier | EmailIdentifier | PhoneIdentifier | ProviderIdentifier;
export declare function isUidIdentifier(id: UserIdentifier): id is UidIdentifier;
export declare function isEmailIdentifier(id: UserIdentifier): id is EmailIdentifier;
export declare function isPhoneIdentifier(id: UserIdentifier): id is PhoneIdentifier;
export declare function isProviderIdentifier(id: ProviderIdentifier): id is ProviderIdentifier;
