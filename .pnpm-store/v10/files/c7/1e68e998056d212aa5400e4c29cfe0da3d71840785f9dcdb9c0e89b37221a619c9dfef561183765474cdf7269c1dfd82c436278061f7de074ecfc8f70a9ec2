"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSnakeCaseMapper = createSnakeCaseMapper;
exports.createCamelCaseMapper = createCamelCaseMapper;
/**
 * Creates a function that transforms camel case strings to snake case.
 */
function createSnakeCaseMapper({ upperCase = false, underscoreBeforeDigits = false, underscoreBetweenUppercaseLetters = false, } = {}) {
    return memoize((str) => {
        if (str.length === 0) {
            return str;
        }
        const upper = str.toUpperCase();
        const lower = str.toLowerCase();
        let out = lower[0];
        for (let i = 1, l = str.length; i < l; ++i) {
            const char = str[i];
            const prevChar = str[i - 1];
            const upperChar = upper[i];
            const prevUpperChar = upper[i - 1];
            const lowerChar = lower[i];
            const prevLowerChar = lower[i - 1];
            // If underScoreBeforeDigits is true then, well, insert an underscore
            // before digits :). Only the first digit gets an underscore if
            // there are multiple.
            if (underscoreBeforeDigits &&
                isDigit(char) &&
                !isDigit(prevChar) &&
                !out.endsWith('_')) {
                out += '_' + char;
                continue;
            }
            // Test if `char` is an upper-case character and that the character
            // actually has different upper and lower case versions.
            if (char === upperChar && upperChar !== lowerChar) {
                const prevCharacterIsUppercase = prevChar === prevUpperChar && prevUpperChar !== prevLowerChar;
                // If underscoreBetweenUppercaseLetters is true, we always place an underscore
                // before consecutive uppercase letters (e.g. "fooBAR" becomes "foo_b_a_r").
                // Otherwise, we don't (e.g. "fooBAR" becomes "foo_bar").
                if (underscoreBetweenUppercaseLetters || !prevCharacterIsUppercase) {
                    out += '_' + lowerChar;
                }
                else {
                    out += lowerChar;
                }
            }
            else {
                out += char;
            }
        }
        if (upperCase) {
            return out.toUpperCase();
        }
        else {
            return out;
        }
    });
}
/**
 * Creates a function that transforms snake case strings to camel case.
 */
function createCamelCaseMapper({ upperCase = false, } = {}) {
    return memoize((str) => {
        if (str.length === 0) {
            return str;
        }
        if (upperCase && isAllUpperCaseSnakeCase(str)) {
            // Only convert to lower case if the string is all upper
            // case snake_case. This allows camelCase strings to go
            // through without changing.
            str = str.toLowerCase();
        }
        let out = str[0];
        for (let i = 1, l = str.length; i < l; ++i) {
            const char = str[i];
            const prevChar = str[i - 1];
            if (char !== '_') {
                if (prevChar === '_') {
                    out += char.toUpperCase();
                }
                else {
                    out += char;
                }
            }
        }
        return out;
    });
}
function isAllUpperCaseSnakeCase(str) {
    for (let i = 1, l = str.length; i < l; ++i) {
        const char = str[i];
        if (char !== '_' && char !== char.toUpperCase()) {
            return false;
        }
    }
    return true;
}
function isDigit(char) {
    return char >= '0' && char <= '9';
}
function memoize(func) {
    const cache = new Map();
    return (str) => {
        let mapped = cache.get(str);
        if (!mapped) {
            mapped = func(str);
            cache.set(str, mapped);
        }
        return mapped;
    };
}
