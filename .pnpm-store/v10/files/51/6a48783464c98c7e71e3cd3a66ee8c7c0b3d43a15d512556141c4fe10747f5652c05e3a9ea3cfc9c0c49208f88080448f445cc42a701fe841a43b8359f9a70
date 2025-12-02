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
exports.UserImportBuilder = void 0;
exports.convertMultiFactorInfoToServerFormat = convertMultiFactorInfoToServerFormat;
const deep_copy_1 = require("../utils/deep-copy");
const utils = require("../utils");
const validator = require("../utils/validator");
const error_1 = require("../utils/error");
/**
 * Converts a client format second factor object to server format.
 * @param multiFactorInfo - The client format second factor.
 * @returns The corresponding AuthFactorInfo server request format.
 */
function convertMultiFactorInfoToServerFormat(multiFactorInfo) {
    let enrolledAt;
    if (typeof multiFactorInfo.enrollmentTime !== 'undefined') {
        if (validator.isUTCDateString(multiFactorInfo.enrollmentTime)) {
            // Convert from UTC date string (client side format) to ISO date string (server side format).
            enrolledAt = new Date(multiFactorInfo.enrollmentTime).toISOString();
        }
        else {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ENROLLMENT_TIME, `The second factor "enrollmentTime" for "${multiFactorInfo.uid}" must be a valid ` +
                'UTC date string.');
        }
    }
    // Currently only phone second factors are supported.
    if (isPhoneFactor(multiFactorInfo)) {
        // If any required field is missing or invalid, validation will still fail later.
        const authFactorInfo = {
            mfaEnrollmentId: multiFactorInfo.uid,
            displayName: multiFactorInfo.displayName,
            // Required for all phone second factors.
            phoneInfo: multiFactorInfo.phoneNumber,
            enrolledAt,
        };
        for (const objKey in authFactorInfo) {
            if (typeof authFactorInfo[objKey] === 'undefined') {
                delete authFactorInfo[objKey];
            }
        }
        return authFactorInfo;
    }
    else {
        // Unsupported second factor.
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.UNSUPPORTED_SECOND_FACTOR, `Unsupported second factor "${JSON.stringify(multiFactorInfo)}" provided.`);
    }
}
function isPhoneFactor(multiFactorInfo) {
    return multiFactorInfo.factorId === 'phone';
}
/**
 * @param {any} obj The object to check for number field within.
 * @param {string} key The entry key.
 * @returns {number} The corresponding number if available. Otherwise, NaN.
 */
function getNumberField(obj, key) {
    if (typeof obj[key] !== 'undefined' && obj[key] !== null) {
        return parseInt(obj[key].toString(), 10);
    }
    return NaN;
}
/**
 * Converts a UserImportRecord to a UploadAccountUser object. Throws an error when invalid
 * fields are provided.
 * @param {UserImportRecord} user The UserImportRecord to conver to UploadAccountUser.
 * @param {ValidatorFunction=} userValidator The user validator function.
 * @returns {UploadAccountUser} The corresponding UploadAccountUser to return.
 */
function populateUploadAccountUser(user, userValidator) {
    const result = {
        localId: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        disabled: user.disabled,
        photoUrl: user.photoURL,
        phoneNumber: user.phoneNumber,
        providerUserInfo: [],
        mfaInfo: [],
        tenantId: user.tenantId,
        customAttributes: user.customClaims && JSON.stringify(user.customClaims),
    };
    if (typeof user.passwordHash !== 'undefined') {
        if (!validator.isBuffer(user.passwordHash)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PASSWORD_HASH);
        }
        result.passwordHash = utils.toWebSafeBase64(user.passwordHash);
    }
    if (typeof user.passwordSalt !== 'undefined') {
        if (!validator.isBuffer(user.passwordSalt)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PASSWORD_SALT);
        }
        result.salt = utils.toWebSafeBase64(user.passwordSalt);
    }
    if (validator.isNonNullObject(user.metadata)) {
        if (validator.isNonEmptyString(user.metadata.creationTime)) {
            result.createdAt = new Date(user.metadata.creationTime).getTime();
        }
        if (validator.isNonEmptyString(user.metadata.lastSignInTime)) {
            result.lastLoginAt = new Date(user.metadata.lastSignInTime).getTime();
        }
    }
    if (validator.isArray(user.providerData)) {
        user.providerData.forEach((providerData) => {
            result.providerUserInfo.push({
                providerId: providerData.providerId,
                rawId: providerData.uid,
                email: providerData.email,
                displayName: providerData.displayName,
                photoUrl: providerData.photoURL,
            });
        });
    }
    // Convert user.multiFactor.enrolledFactors to server format.
    if (validator.isNonNullObject(user.multiFactor) &&
        validator.isNonEmptyArray(user.multiFactor.enrolledFactors)) {
        user.multiFactor.enrolledFactors.forEach((multiFactorInfo) => {
            result.mfaInfo.push(convertMultiFactorInfoToServerFormat(multiFactorInfo));
        });
    }
    // Remove blank fields.
    let key;
    for (key in result) {
        if (typeof result[key] === 'undefined') {
            delete result[key];
        }
    }
    if (result.providerUserInfo.length === 0) {
        delete result.providerUserInfo;
    }
    if (result.mfaInfo.length === 0) {
        delete result.mfaInfo;
    }
    // Validate the constructured user individual request. This will throw if an error
    // is detected.
    if (typeof userValidator === 'function') {
        userValidator(result);
    }
    return result;
}
/**
 * Class that provides a helper for building/validating uploadAccount requests and
 * UserImportResult responses.
 */
class UserImportBuilder {
    /**
     * @param {UserImportRecord[]} users The list of user records to import.
     * @param {UserImportOptions=} options The import options which includes hashing
     *     algorithm details.
     * @param {ValidatorFunction=} userRequestValidator The user request validator function.
     * @constructor
     */
    constructor(users, options, userRequestValidator) {
        this.requiresHashOptions = false;
        this.validatedUsers = [];
        this.userImportResultErrors = [];
        this.indexMap = {};
        this.validatedUsers = this.populateUsers(users, userRequestValidator);
        this.validatedOptions = this.populateOptions(options, this.requiresHashOptions);
    }
    /**
     * Returns the corresponding constructed uploadAccount request.
     * @returns {UploadAccountRequest} The constructed uploadAccount request.
     */
    buildRequest() {
        const users = this.validatedUsers.map((user) => {
            return (0, deep_copy_1.deepCopy)(user);
        });
        return (0, deep_copy_1.deepExtend)({ users }, (0, deep_copy_1.deepCopy)(this.validatedOptions));
    }
    /**
     * Populates the UserImportResult using the client side detected errors and the server
     * side returned errors.
     * @returns {UserImportResult} The user import result based on the returned failed
     *     uploadAccount response.
     */
    buildResponse(failedUploads) {
        // Initialize user import result.
        const importResult = {
            successCount: this.validatedUsers.length,
            failureCount: this.userImportResultErrors.length,
            errors: (0, deep_copy_1.deepCopy)(this.userImportResultErrors),
        };
        importResult.failureCount += failedUploads.length;
        importResult.successCount -= failedUploads.length;
        failedUploads.forEach((failedUpload) => {
            importResult.errors.push({
                // Map backend request index to original developer provided array index.
                index: this.indexMap[failedUpload.index],
                error: new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_USER_IMPORT, failedUpload.message),
            });
        });
        // Sort errors by index.
        importResult.errors.sort((a, b) => {
            return a.index - b.index;
        });
        // Return sorted result.
        return importResult;
    }
    /**
     * Validates and returns the hashing options of the uploadAccount request.
     * Throws an error whenever an invalid or missing options is detected.
     * @param {UserImportOptions} options The UserImportOptions.
     * @param {boolean} requiresHashOptions Whether to require hash options.
     * @returns {UploadAccountOptions} The populated UploadAccount options.
     */
    populateOptions(options, requiresHashOptions) {
        let populatedOptions;
        if (!requiresHashOptions) {
            return {};
        }
        if (!validator.isNonNullObject(options)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"UserImportOptions" are required when importing users with passwords.');
        }
        if (!validator.isNonNullObject(options.hash)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.MISSING_HASH_ALGORITHM, '"hash.algorithm" is missing from the provided "UserImportOptions".');
        }
        if (typeof options.hash.algorithm === 'undefined' ||
            !validator.isNonEmptyString(options.hash.algorithm)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_HASH_ALGORITHM, '"hash.algorithm" must be a string matching the list of supported algorithms.');
        }
        let rounds;
        switch (options.hash.algorithm) {
            case 'HMAC_SHA512':
            case 'HMAC_SHA256':
            case 'HMAC_SHA1':
            case 'HMAC_MD5':
                if (!validator.isBuffer(options.hash.key)) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_HASH_KEY, 'A non-empty "hash.key" byte buffer must be provided for ' +
                        `hash algorithm ${options.hash.algorithm}.`);
                }
                populatedOptions = {
                    hashAlgorithm: options.hash.algorithm,
                    signerKey: utils.toWebSafeBase64(options.hash.key),
                };
                break;
            case 'MD5':
            case 'SHA1':
            case 'SHA256':
            case 'SHA512': {
                // MD5 is [0,8192] but SHA1, SHA256, and SHA512 are [1,8192]
                rounds = getNumberField(options.hash, 'rounds');
                const minRounds = options.hash.algorithm === 'MD5' ? 0 : 1;
                if (isNaN(rounds) || rounds < minRounds || rounds > 8192) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_HASH_ROUNDS, `A valid "hash.rounds" number between ${minRounds} and 8192 must be provided for ` +
                        `hash algorithm ${options.hash.algorithm}.`);
                }
                populatedOptions = {
                    hashAlgorithm: options.hash.algorithm,
                    rounds,
                };
                break;
            }
            case 'PBKDF_SHA1':
            case 'PBKDF2_SHA256':
                rounds = getNumberField(options.hash, 'rounds');
                if (isNaN(rounds) || rounds < 0 || rounds > 120000) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_HASH_ROUNDS, 'A valid "hash.rounds" number between 0 and 120000 must be provided for ' +
                        `hash algorithm ${options.hash.algorithm}.`);
                }
                populatedOptions = {
                    hashAlgorithm: options.hash.algorithm,
                    rounds,
                };
                break;
            case 'SCRYPT': {
                if (!validator.isBuffer(options.hash.key)) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_HASH_KEY, 'A "hash.key" byte buffer must be provided for ' +
                        `hash algorithm ${options.hash.algorithm}.`);
                }
                rounds = getNumberField(options.hash, 'rounds');
                if (isNaN(rounds) || rounds <= 0 || rounds > 8) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_HASH_ROUNDS, 'A valid "hash.rounds" number between 1 and 8 must be provided for ' +
                        `hash algorithm ${options.hash.algorithm}.`);
                }
                const memoryCost = getNumberField(options.hash, 'memoryCost');
                if (isNaN(memoryCost) || memoryCost <= 0 || memoryCost > 14) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_HASH_MEMORY_COST, 'A valid "hash.memoryCost" number between 1 and 14 must be provided for ' +
                        `hash algorithm ${options.hash.algorithm}.`);
                }
                if (typeof options.hash.saltSeparator !== 'undefined' &&
                    !validator.isBuffer(options.hash.saltSeparator)) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_HASH_SALT_SEPARATOR, '"hash.saltSeparator" must be a byte buffer.');
                }
                populatedOptions = {
                    hashAlgorithm: options.hash.algorithm,
                    signerKey: utils.toWebSafeBase64(options.hash.key),
                    rounds,
                    memoryCost,
                    saltSeparator: utils.toWebSafeBase64(options.hash.saltSeparator || Buffer.from('')),
                };
                break;
            }
            case 'BCRYPT':
                populatedOptions = {
                    hashAlgorithm: options.hash.algorithm,
                };
                break;
            case 'STANDARD_SCRYPT': {
                const cpuMemCost = getNumberField(options.hash, 'memoryCost');
                if (isNaN(cpuMemCost)) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_HASH_MEMORY_COST, 'A valid "hash.memoryCost" number must be provided for ' +
                        `hash algorithm ${options.hash.algorithm}.`);
                }
                const parallelization = getNumberField(options.hash, 'parallelization');
                if (isNaN(parallelization)) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_HASH_PARALLELIZATION, 'A valid "hash.parallelization" number must be provided for ' +
                        `hash algorithm ${options.hash.algorithm}.`);
                }
                const blockSize = getNumberField(options.hash, 'blockSize');
                if (isNaN(blockSize)) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_HASH_BLOCK_SIZE, 'A valid "hash.blockSize" number must be provided for ' +
                        `hash algorithm ${options.hash.algorithm}.`);
                }
                const dkLen = getNumberField(options.hash, 'derivedKeyLength');
                if (isNaN(dkLen)) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_HASH_DERIVED_KEY_LENGTH, 'A valid "hash.derivedKeyLength" number must be provided for ' +
                        `hash algorithm ${options.hash.algorithm}.`);
                }
                populatedOptions = {
                    hashAlgorithm: options.hash.algorithm,
                    cpuMemCost,
                    parallelization,
                    blockSize,
                    dkLen,
                };
                break;
            }
            default:
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_HASH_ALGORITHM, `Unsupported hash algorithm provider "${options.hash.algorithm}".`);
        }
        return populatedOptions;
    }
    /**
     * Validates and returns the users list of the uploadAccount request.
     * Whenever a user with an error is detected, the error is cached and will later be
     * merged into the user import result. This allows the processing of valid users without
     * failing early on the first error detected.
     * @param {UserImportRecord[]} users The UserImportRecords to convert to UnploadAccountUser
     *     objects.
     * @param {ValidatorFunction=} userValidator The user validator function.
     * @returns {UploadAccountUser[]} The populated uploadAccount users.
     */
    populateUsers(users, userValidator) {
        const populatedUsers = [];
        users.forEach((user, index) => {
            try {
                const result = populateUploadAccountUser(user, userValidator);
                if (typeof result.passwordHash !== 'undefined') {
                    this.requiresHashOptions = true;
                }
                // Only users that pass client screening will be passed to backend for processing.
                populatedUsers.push(result);
                // Map user's index (the one to be sent to backend) to original developer provided array.
                this.indexMap[populatedUsers.length - 1] = index;
            }
            catch (error) {
                // Save the client side error with respect to the developer provided array.
                this.userImportResultErrors.push({
                    index,
                    error,
                });
            }
        });
        return populatedUsers;
    }
}
exports.UserImportBuilder = UserImportBuilder;
