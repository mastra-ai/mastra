"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.StringUtils = void 0;
/**
 * String helper functions
 */
class StringUtils {
    /**
     * Formats a string by replacing the named {keys} in the string with the values contained in the replacement dictionary.
     * @param format The format string that contains the parts to replace surrounded by {}. For example: "wss://{region}.cts.speech.microsoft.com".
     * If your string needs to contain a { or } you can use the {{ and }} escape sequences respectively.
     * @param replacements The dictionary of replacements. If a replacement is not found, it is replaced with an empty string
     * @returns The formatted string. If you pass in a null or undefined format string, an empty string will be returned
     */
    static formatString(format, replacements) {
        if (!format) {
            return "";
        }
        if (!replacements) {
            return format;
        }
        let formatted = "";
        let key = "";
        const appendToFormatted = (str) => {
            formatted += str;
        };
        const appendToKey = (str) => {
            key += str;
        };
        let appendFunc = appendToFormatted;
        for (let i = 0; i < format.length; i++) {
            const c = format[i];
            const next = i + 1 < format.length ? format[i + 1] : "";
            switch (c) {
                case "{":
                    if (next === "{") {
                        appendFunc("{");
                        i++;
                    }
                    else {
                        appendFunc = appendToKey;
                    }
                    break;
                case "}":
                    if (next === "}") {
                        appendFunc("}");
                        i++;
                    }
                    else {
                        if (replacements.hasOwnProperty(key)) {
                            formatted += replacements[key];
                        }
                        appendFunc = appendToFormatted;
                        key = "";
                    }
                    break;
                default:
                    appendFunc(c);
                    break;
            }
        }
        return formatted;
    }
}
exports.StringUtils = StringUtils;

//# sourceMappingURL=StringUtils.js.map
