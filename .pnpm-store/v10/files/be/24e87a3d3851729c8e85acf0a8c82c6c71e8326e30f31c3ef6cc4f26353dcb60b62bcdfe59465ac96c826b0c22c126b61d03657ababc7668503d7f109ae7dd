/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * Copyright 2018 Google Inc.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionCodeSettingsBuilder = void 0;
const validator = require("../utils/validator");
const error_1 = require("../utils/error");
/**
 * Defines the ActionCodeSettings builder class used to convert the
 * ActionCodeSettings object to its corresponding server request.
 *
 * @internal
 */
class ActionCodeSettingsBuilder {
    /**
     * ActionCodeSettingsBuilder constructor.
     *
     * @param {ActionCodeSettings} actionCodeSettings The ActionCodeSettings
     *     object used to initiliaze this server request builder.
     * @constructor
     */
    constructor(actionCodeSettings) {
        if (!validator.isNonNullObject(actionCodeSettings)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"ActionCodeSettings" must be a non-null object.');
        }
        if (typeof actionCodeSettings.url === 'undefined') {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.MISSING_CONTINUE_URI);
        }
        else if (!validator.isURL(actionCodeSettings.url)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONTINUE_URI);
        }
        this.continueUrl = actionCodeSettings.url;
        if (typeof actionCodeSettings.handleCodeInApp !== 'undefined' &&
            !validator.isBoolean(actionCodeSettings.handleCodeInApp)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"ActionCodeSettings.handleCodeInApp" must be a boolean.');
        }
        this.canHandleCodeInApp = actionCodeSettings.handleCodeInApp || false;
        if (typeof actionCodeSettings.dynamicLinkDomain !== 'undefined' &&
            !validator.isNonEmptyString(actionCodeSettings.dynamicLinkDomain)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_DYNAMIC_LINK_DOMAIN);
        }
        this.dynamicLinkDomain = actionCodeSettings.dynamicLinkDomain;
        if (typeof actionCodeSettings.linkDomain !== 'undefined' &&
            !validator.isNonEmptyString(actionCodeSettings.linkDomain)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_HOSTING_LINK_DOMAIN);
        }
        this.linkDomain = actionCodeSettings.linkDomain;
        if (typeof actionCodeSettings.iOS !== 'undefined') {
            if (!validator.isNonNullObject(actionCodeSettings.iOS)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"ActionCodeSettings.iOS" must be a valid non-null object.');
            }
            else if (typeof actionCodeSettings.iOS.bundleId === 'undefined') {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.MISSING_IOS_BUNDLE_ID);
            }
            else if (!validator.isNonEmptyString(actionCodeSettings.iOS.bundleId)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"ActionCodeSettings.iOS.bundleId" must be a valid non-empty string.');
            }
            this.ibi = actionCodeSettings.iOS.bundleId;
        }
        if (typeof actionCodeSettings.android !== 'undefined') {
            if (!validator.isNonNullObject(actionCodeSettings.android)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"ActionCodeSettings.android" must be a valid non-null object.');
            }
            else if (typeof actionCodeSettings.android.packageName === 'undefined') {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.MISSING_ANDROID_PACKAGE_NAME);
            }
            else if (!validator.isNonEmptyString(actionCodeSettings.android.packageName)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"ActionCodeSettings.android.packageName" must be a valid non-empty string.');
            }
            else if (typeof actionCodeSettings.android.minimumVersion !== 'undefined' &&
                !validator.isNonEmptyString(actionCodeSettings.android.minimumVersion)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"ActionCodeSettings.android.minimumVersion" must be a valid non-empty string.');
            }
            else if (typeof actionCodeSettings.android.installApp !== 'undefined' &&
                !validator.isBoolean(actionCodeSettings.android.installApp)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"ActionCodeSettings.android.installApp" must be a valid boolean.');
            }
            this.apn = actionCodeSettings.android.packageName;
            this.amv = actionCodeSettings.android.minimumVersion;
            this.installApp = actionCodeSettings.android.installApp || false;
        }
    }
    /**
     * Returns the corresponding constructed server request corresponding to the
     * current ActionCodeSettings.
     *
     * @returns The constructed EmailActionCodeRequest request.
     */
    buildRequest() {
        const request = {
            continueUrl: this.continueUrl,
            canHandleCodeInApp: this.canHandleCodeInApp,
            dynamicLinkDomain: this.dynamicLinkDomain,
            linkDomain: this.linkDomain,
            androidPackageName: this.apn,
            androidMinimumVersion: this.amv,
            androidInstallApp: this.installApp,
            iOSBundleId: this.ibi,
        };
        // Remove all null and undefined fields from request.
        for (const key in request) {
            if (Object.prototype.hasOwnProperty.call(request, key)) {
                if (typeof request[key] === 'undefined' || request[key] === null) {
                    delete request[key];
                }
            }
        }
        return request;
    }
}
exports.ActionCodeSettingsBuilder = ActionCodeSettingsBuilder;
