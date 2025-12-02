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
exports.isBuffer = isBuffer;
exports.isArray = isArray;
exports.isNonEmptyArray = isNonEmptyArray;
exports.isBoolean = isBoolean;
exports.isNumber = isNumber;
exports.isString = isString;
exports.isBase64String = isBase64String;
exports.isNonEmptyString = isNonEmptyString;
exports.isObject = isObject;
exports.isNonNullObject = isNonNullObject;
exports.isUid = isUid;
exports.isPassword = isPassword;
exports.isEmail = isEmail;
exports.isPhoneNumber = isPhoneNumber;
exports.isISODateString = isISODateString;
exports.isUTCDateString = isUTCDateString;
exports.isURL = isURL;
exports.isTopic = isTopic;
exports.isTaskId = isTaskId;
const url = require("url");
/**
 * Validates that a value is a byte buffer.
 *
 * @param value - The value to validate.
 * @returns Whether the value is byte buffer or not.
 */
function isBuffer(value) {
    return value instanceof Buffer;
}
/**
 * Validates that a value is an array.
 *
 * @param value - The value to validate.
 * @returns Whether the value is an array or not.
 */
function isArray(value) {
    return Array.isArray(value);
}
/**
 * Validates that a value is a non-empty array.
 *
 * @param value - The value to validate.
 * @returns Whether the value is a non-empty array or not.
 */
function isNonEmptyArray(value) {
    return isArray(value) && value.length !== 0;
}
/**
 * Validates that a value is a boolean.
 *
 * @param value - The value to validate.
 * @returns Whether the value is a boolean or not.
 */
function isBoolean(value) {
    return typeof value === 'boolean';
}
/**
 * Validates that a value is a number.
 *
 * @param value - The value to validate.
 * @returns Whether the value is a number or not.
 */
function isNumber(value) {
    return typeof value === 'number' && !isNaN(value);
}
/**
 * Validates that a value is a string.
 *
 * @param value - The value to validate.
 * @returns Whether the value is a string or not.
 */
function isString(value) {
    return typeof value === 'string';
}
/**
 * Validates that a value is a base64 string.
 *
 * @param value - The value to validate.
 * @returns Whether the value is a base64 string or not.
 */
function isBase64String(value) {
    if (!isString(value)) {
        return false;
    }
    return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}
/**
 * Validates that a value is a non-empty string.
 *
 * @param value - The value to validate.
 * @returns Whether the value is a non-empty string or not.
 */
function isNonEmptyString(value) {
    return isString(value) && value !== '';
}
/**
 * Validates that a value is a nullable object.
 *
 * @param value - The value to validate.
 * @returns Whether the value is an object or not.
 */
function isObject(value) {
    return typeof value === 'object' && !isArray(value);
}
/**
 * Validates that a value is a non-null object.
 *
 * @param value - The value to validate.
 * @returns Whether the value is a non-null object or not.
 */
function isNonNullObject(value) {
    return isObject(value) && value !== null;
}
/**
 * Validates that a string is a valid Firebase Auth uid.
 *
 * @param uid - The string to validate.
 * @returns Whether the string is a valid Firebase Auth uid.
 */
function isUid(uid) {
    return typeof uid === 'string' && uid.length > 0 && uid.length <= 128;
}
/**
 * Validates that a string is a valid Firebase Auth password.
 *
 * @param password - The password string to validate.
 * @returns Whether the string is a valid Firebase Auth password.
 */
function isPassword(password) {
    // A password must be a string of at least 6 characters.
    return typeof password === 'string' && password.length >= 6;
}
/**
 * Validates that a string is a valid email.
 *
 * @param email - The string to validate.
 * @returns Whether the string is valid email or not.
 */
function isEmail(email) {
    if (typeof email !== 'string') {
        return false;
    }
    // There must at least one character before the @ symbol and another after.
    const re = /^[^@]+@[^@]+$/;
    return re.test(email);
}
/**
 * Validates that a string is a valid phone number.
 *
 * @param phoneNumber - The string to validate.
 * @returns Whether the string is a valid phone number or not.
 */
function isPhoneNumber(phoneNumber) {
    if (typeof phoneNumber !== 'string') {
        return false;
    }
    // Phone number validation is very lax here. Backend will enforce E.164
    // spec compliance and will normalize accordingly.
    // The phone number string must be non-empty and starts with a plus sign.
    const re1 = /^\+/;
    // The phone number string must contain at least one alphanumeric character.
    const re2 = /[\da-zA-Z]+/;
    return re1.test(phoneNumber) && re2.test(phoneNumber);
}
/**
 * Validates that a string is a valid ISO date string.
 *
 * @param dateString - The string to validate.
 * @returns Whether the string is a valid ISO date string.
 */
function isISODateString(dateString) {
    try {
        return isNonEmptyString(dateString) &&
            (new Date(dateString).toISOString() === dateString);
    }
    catch (e) {
        return false;
    }
}
/**
 * Validates that a string is a valid UTC date string.
 *
 * @param dateString - The string to validate.
 * @returns Whether the string is a valid UTC date string.
 */
function isUTCDateString(dateString) {
    try {
        return isNonEmptyString(dateString) &&
            (new Date(dateString).toUTCString() === dateString);
    }
    catch (e) {
        return false;
    }
}
/**
 * Validates that a string is a valid web URL.
 *
 * @param urlStr - The string to validate.
 * @returns Whether the string is valid web URL or not.
 */
function isURL(urlStr) {
    if (typeof urlStr !== 'string') {
        return false;
    }
    // Lookup illegal characters.
    const re = /[^a-z0-9:/?#[\]@!$&'()*+,;=.\-_~%]/i;
    if (re.test(urlStr)) {
        return false;
    }
    try {
        const uri = url.parse(urlStr);
        const scheme = uri.protocol;
        const slashes = uri.slashes;
        const hostname = uri.hostname;
        const pathname = uri.pathname;
        if ((scheme !== 'http:' && scheme !== 'https:') || !slashes) {
            return false;
        }
        // Validate hostname: Can contain letters, numbers, underscore and dashes separated by a dot.
        // Each zone must not start with a hyphen or underscore.
        if (!hostname || !/^[a-zA-Z0-9]+[\w-]*([.]?[a-zA-Z0-9]+[\w-]*)*$/.test(hostname)) {
            return false;
        }
        // Allow for pathnames: (/chars+)*/?
        // Where chars can be a combination of: a-z A-Z 0-9 - _ . ~ ! $ & ' ( ) * + , ; = : @ %
        const pathnameRe = /^(\/[\w\-.~!$'()*+,;=:@%]+)*\/?$/;
        // Validate pathname.
        if (pathname &&
            pathname !== '/' &&
            !pathnameRe.test(pathname)) {
            return false;
        }
        // Allow any query string and hash as long as no invalid character is used.
    }
    catch (e) {
        return false;
    }
    return true;
}
/**
 * Validates that the provided topic is a valid FCM topic name.
 *
 * @param topic - The topic to validate.
 * @returns Whether the provided topic is a valid FCM topic name.
 */
function isTopic(topic) {
    if (typeof topic !== 'string') {
        return false;
    }
    const VALID_TOPIC_REGEX = /^(\/topics\/)?(private\/)?[a-zA-Z0-9-_.~%]+$/;
    return VALID_TOPIC_REGEX.test(topic);
}
/**
 * Validates that the provided string can be used as a task ID
 * for Cloud Tasks.
 *
 * @param taskId - the task ID to validate.
 * @returns Whether the provided task ID is valid.
 */
function isTaskId(taskId) {
    if (typeof taskId !== 'string') {
        return false;
    }
    const VALID_TASK_ID_REGEX = /^[A-Za-z0-9_-]+$/;
    return VALID_TASK_ID_REGEX.test(taskId);
}
