/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * @license
 * Copyright 2017 Google Inc.
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
exports.UserRecord = exports.UserInfo = exports.UserMetadata = exports.MultiFactorSettings = exports.TotpMultiFactorInfo = exports.TotpInfo = exports.PhoneMultiFactorInfo = exports.MultiFactorInfo = void 0;
const deep_copy_1 = require("../utils/deep-copy");
const validator_1 = require("../utils/validator");
const utils = require("../utils");
const error_1 = require("../utils/error");
/**
 * 'REDACTED', encoded as a base64 string.
 */
const B64_REDACTED = Buffer.from('REDACTED').toString('base64');
/**
 * Parses a time stamp string or number and returns the corresponding date if valid.
 *
 * @param time - The unix timestamp string or number in milliseconds.
 * @returns The corresponding date as a UTC string, if valid. Otherwise, null.
 */
function parseDate(time) {
    try {
        const date = new Date(parseInt(time, 10));
        if (!isNaN(date.getTime())) {
            return date.toUTCString();
        }
    }
    catch (e) {
        // Do nothing. null will be returned.
    }
    return null;
}
var MultiFactorId;
(function (MultiFactorId) {
    MultiFactorId["Phone"] = "phone";
    MultiFactorId["Totp"] = "totp";
})(MultiFactorId || (MultiFactorId = {}));
/**
 * Interface representing the common properties of a user-enrolled second factor.
 */
class MultiFactorInfo {
    /**
     * Initializes the MultiFactorInfo associated subclass using the server side.
     * If no MultiFactorInfo is associated with the response, null is returned.
     *
     * @param response - The server side response.
     * @internal
     */
    static initMultiFactorInfo(response) {
        let multiFactorInfo = null;
        // PhoneMultiFactorInfo, TotpMultiFactorInfo currently available.
        try {
            if (response.phoneInfo !== undefined) {
                multiFactorInfo = new PhoneMultiFactorInfo(response);
            }
            else if (response.totpInfo !== undefined) {
                multiFactorInfo = new TotpMultiFactorInfo(response);
            }
            else {
                // Ignore the other SDK unsupported MFA factors to prevent blocking developers using the current SDK.
            }
        }
        catch (e) {
            // Ignore error.
        }
        return multiFactorInfo;
    }
    /**
     * Initializes the MultiFactorInfo object using the server side response.
     *
     * @param response - The server side response.
     * @constructor
     * @internal
     */
    constructor(response) {
        this.initFromServerResponse(response);
    }
    /**
     * Returns a JSON-serializable representation of this object.
     *
     * @returns A JSON-serializable representation of this object.
     */
    toJSON() {
        return {
            uid: this.uid,
            displayName: this.displayName,
            factorId: this.factorId,
            enrollmentTime: this.enrollmentTime,
        };
    }
    /**
     * Initializes the MultiFactorInfo object using the provided server response.
     *
     * @param response - The server side response.
     */
    initFromServerResponse(response) {
        const factorId = response && this.getFactorId(response);
        if (!factorId || !response || !response.mfaEnrollmentId) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Invalid multi-factor info response');
        }
        utils.addReadonlyGetter(this, 'uid', response.mfaEnrollmentId);
        utils.addReadonlyGetter(this, 'factorId', factorId);
        utils.addReadonlyGetter(this, 'displayName', response.displayName);
        // Encoded using [RFC 3339](https://www.ietf.org/rfc/rfc3339.txt) format.
        // For example, "2017-01-15T01:30:15.01Z".
        // This can be parsed directly via Date constructor.
        // This can be computed using Data.prototype.toISOString.
        if (response.enrolledAt) {
            utils.addReadonlyGetter(this, 'enrollmentTime', new Date(response.enrolledAt).toUTCString());
        }
        else {
            utils.addReadonlyGetter(this, 'enrollmentTime', null);
        }
    }
}
exports.MultiFactorInfo = MultiFactorInfo;
/**
 * Interface representing a phone specific user-enrolled second factor.
 */
class PhoneMultiFactorInfo extends MultiFactorInfo {
    /**
     * Initializes the PhoneMultiFactorInfo object using the server side response.
     *
     * @param response - The server side response.
     * @constructor
     * @internal
     */
    constructor(response) {
        super(response);
        utils.addReadonlyGetter(this, 'phoneNumber', response.phoneInfo);
    }
    /**
     * {@inheritdoc MultiFactorInfo.toJSON}
     */
    toJSON() {
        return Object.assign(super.toJSON(), {
            phoneNumber: this.phoneNumber,
        });
    }
    /**
     * Returns the factor ID based on the response provided.
     *
     * @param response - The server side response.
     * @returns The multi-factor ID associated with the provided response. If the response is
     *     not associated with any known multi-factor ID, null is returned.
     *
     * @internal
     */
    getFactorId(response) {
        return (response && response.phoneInfo) ? MultiFactorId.Phone : null;
    }
}
exports.PhoneMultiFactorInfo = PhoneMultiFactorInfo;
/**
 * `TotpInfo` struct associated with a second factor
 */
class TotpInfo {
}
exports.TotpInfo = TotpInfo;
/**
 * Interface representing a TOTP specific user-enrolled second factor.
 */
class TotpMultiFactorInfo extends MultiFactorInfo {
    /**
     * Initializes the `TotpMultiFactorInfo` object using the server side response.
     *
     * @param response - The server side response.
     * @constructor
     * @internal
     */
    constructor(response) {
        super(response);
        utils.addReadonlyGetter(this, 'totpInfo', response.totpInfo);
    }
    /**
     * {@inheritdoc MultiFactorInfo.toJSON}
     */
    toJSON() {
        return Object.assign(super.toJSON(), {
            totpInfo: this.totpInfo,
        });
    }
    /**
     * Returns the factor ID based on the response provided.
     *
     * @param response - The server side response.
     * @returns The multi-factor ID associated with the provided response. If the response is
     *     not associated with any known multi-factor ID, `null` is returned.
     *
     * @internal
     */
    getFactorId(response) {
        return (response && response.totpInfo) ? MultiFactorId.Totp : null;
    }
}
exports.TotpMultiFactorInfo = TotpMultiFactorInfo;
/**
 * The multi-factor related user settings.
 */
class MultiFactorSettings {
    /**
     * Initializes the `MultiFactor` object using the server side or JWT format response.
     *
     * @param response - The server side response.
     * @constructor
     * @internal
     */
    constructor(response) {
        const parsedEnrolledFactors = [];
        if (!(0, validator_1.isNonNullObject)(response)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Invalid multi-factor response');
        }
        else if (response.mfaInfo) {
            response.mfaInfo.forEach((factorResponse) => {
                const multiFactorInfo = MultiFactorInfo.initMultiFactorInfo(factorResponse);
                if (multiFactorInfo) {
                    parsedEnrolledFactors.push(multiFactorInfo);
                }
            });
        }
        // Make enrolled factors immutable.
        utils.addReadonlyGetter(this, 'enrolledFactors', Object.freeze(parsedEnrolledFactors));
    }
    /**
     * Returns a JSON-serializable representation of this multi-factor object.
     *
     * @returns A JSON-serializable representation of this multi-factor object.
     */
    toJSON() {
        return {
            enrolledFactors: this.enrolledFactors.map((info) => info.toJSON()),
        };
    }
}
exports.MultiFactorSettings = MultiFactorSettings;
/**
 * Represents a user's metadata.
 */
class UserMetadata {
    /**
     * @param response - The server side response returned from the `getAccountInfo`
     *     endpoint.
     * @constructor
     * @internal
     */
    constructor(response) {
        // Creation date should always be available but due to some backend bugs there
        // were cases in the past where users did not have creation date properly set.
        // This included legacy Firebase migrating project users and some anonymous users.
        // These bugs have already been addressed since then.
        utils.addReadonlyGetter(this, 'creationTime', parseDate(response.createdAt));
        utils.addReadonlyGetter(this, 'lastSignInTime', parseDate(response.lastLoginAt));
        const lastRefreshAt = response.lastRefreshAt ? new Date(response.lastRefreshAt).toUTCString() : null;
        utils.addReadonlyGetter(this, 'lastRefreshTime', lastRefreshAt);
    }
    /**
     * Returns a JSON-serializable representation of this object.
     *
     * @returns A JSON-serializable representation of this object.
     */
    toJSON() {
        return {
            lastSignInTime: this.lastSignInTime,
            creationTime: this.creationTime,
            lastRefreshTime: this.lastRefreshTime,
        };
    }
}
exports.UserMetadata = UserMetadata;
/**
 * Represents a user's info from a third-party identity provider
 * such as Google or Facebook.
 */
class UserInfo {
    /**
     * @param response - The server side response returned from the `getAccountInfo`
     *     endpoint.
     * @constructor
     * @internal
     */
    constructor(response) {
        // Provider user id and provider id are required.
        if (!response.rawId || !response.providerId) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Invalid user info response');
        }
        utils.addReadonlyGetter(this, 'uid', response.rawId);
        utils.addReadonlyGetter(this, 'displayName', response.displayName);
        utils.addReadonlyGetter(this, 'email', response.email);
        utils.addReadonlyGetter(this, 'photoURL', response.photoUrl);
        utils.addReadonlyGetter(this, 'providerId', response.providerId);
        utils.addReadonlyGetter(this, 'phoneNumber', response.phoneNumber);
    }
    /**
     * Returns a JSON-serializable representation of this object.
     *
     * @returns A JSON-serializable representation of this object.
     */
    toJSON() {
        return {
            uid: this.uid,
            displayName: this.displayName,
            email: this.email,
            photoURL: this.photoURL,
            providerId: this.providerId,
            phoneNumber: this.phoneNumber,
        };
    }
}
exports.UserInfo = UserInfo;
/**
 * Represents a user.
 */
class UserRecord {
    /**
     * @param response - The server side response returned from the getAccountInfo
     *     endpoint.
     * @constructor
     * @internal
     */
    constructor(response) {
        // The Firebase user id is required.
        if (!response.localId) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Invalid user response');
        }
        utils.addReadonlyGetter(this, 'uid', response.localId);
        utils.addReadonlyGetter(this, 'email', response.email);
        utils.addReadonlyGetter(this, 'emailVerified', !!response.emailVerified);
        utils.addReadonlyGetter(this, 'displayName', response.displayName);
        utils.addReadonlyGetter(this, 'photoURL', response.photoUrl);
        utils.addReadonlyGetter(this, 'phoneNumber', response.phoneNumber);
        // If disabled is not provided, the account is enabled by default.
        utils.addReadonlyGetter(this, 'disabled', response.disabled || false);
        utils.addReadonlyGetter(this, 'metadata', new UserMetadata(response));
        const providerData = [];
        for (const entry of (response.providerUserInfo || [])) {
            providerData.push(new UserInfo(entry));
        }
        utils.addReadonlyGetter(this, 'providerData', providerData);
        // If the password hash is redacted (probably due to missing permissions)
        // then clear it out, similar to how the salt is returned. (Otherwise, it
        // *looks* like a b64-encoded hash is present, which is confusing.)
        if (response.passwordHash === B64_REDACTED) {
            utils.addReadonlyGetter(this, 'passwordHash', undefined);
        }
        else {
            utils.addReadonlyGetter(this, 'passwordHash', response.passwordHash);
        }
        utils.addReadonlyGetter(this, 'passwordSalt', response.salt);
        if (response.customAttributes) {
            utils.addReadonlyGetter(this, 'customClaims', JSON.parse(response.customAttributes));
        }
        let validAfterTime = null;
        // Convert validSince first to UTC milliseconds and then to UTC date string.
        if (typeof response.validSince !== 'undefined') {
            validAfterTime = parseDate(parseInt(response.validSince, 10) * 1000);
        }
        utils.addReadonlyGetter(this, 'tokensValidAfterTime', validAfterTime || undefined);
        utils.addReadonlyGetter(this, 'tenantId', response.tenantId);
        const multiFactor = new MultiFactorSettings(response);
        if (multiFactor.enrolledFactors.length > 0) {
            utils.addReadonlyGetter(this, 'multiFactor', multiFactor);
        }
    }
    /**
     * Returns a JSON-serializable representation of this object.
     *
     * @returns A JSON-serializable representation of this object.
     */
    toJSON() {
        const json = {
            uid: this.uid,
            email: this.email,
            emailVerified: this.emailVerified,
            displayName: this.displayName,
            photoURL: this.photoURL,
            phoneNumber: this.phoneNumber,
            disabled: this.disabled,
            // Convert metadata to json.
            metadata: this.metadata.toJSON(),
            passwordHash: this.passwordHash,
            passwordSalt: this.passwordSalt,
            customClaims: (0, deep_copy_1.deepCopy)(this.customClaims),
            tokensValidAfterTime: this.tokensValidAfterTime,
            tenantId: this.tenantId,
        };
        if (this.multiFactor) {
            json.multiFactor = this.multiFactor.toJSON();
        }
        json.providerData = [];
        for (const entry of this.providerData) {
            // Convert each provider data to json.
            json.providerData.push(entry.toJSON());
        }
        return json;
    }
}
exports.UserRecord = UserRecord;
