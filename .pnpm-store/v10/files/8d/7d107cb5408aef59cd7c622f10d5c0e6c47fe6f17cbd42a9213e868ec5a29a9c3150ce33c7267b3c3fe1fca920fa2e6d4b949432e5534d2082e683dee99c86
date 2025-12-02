/*
 * Copyright Michael Hart
 * Licensed under the MIT license. See LICENSE file for details.
 *
 * Portions of this file Copyright Fastly, Inc. See LICENSE file for details.
 * Portions of this file Copyright Joyent, Inc. and other Node contributors. See LICENSE file for details.
 */
import { ERR_INVALID_ARG_TYPE, ERR_INVALID_ARG_VALUE } from "./errors.js";
/* These items copied from Node.js: node/lib/internal/validators.js */
export function validateString(value, name) {
    if (typeof value !== "string")
        throw new ERR_INVALID_ARG_TYPE(name, "string", value);
}
const linkValueRegExp = /^(?:<[^>]*>)(?:\s*;\s*[^;"\s]+(?:=(")?[^;"\s]*\1)?)*$/;
export function validateLinkHeaderFormat(value, name) {
    if (typeof value === "undefined" || !linkValueRegExp.exec(value)) {
        throw new ERR_INVALID_ARG_VALUE(name, value, 'must be an array or string of format "</styles.css>; rel=preload; as=style"');
    }
}
export function validateLinkHeaderValue(hints) {
    if (typeof hints === "string") {
        validateLinkHeaderFormat(hints, "hints");
        return hints;
    }
    else if (Array.isArray(hints)) {
        const hintsLength = hints.length;
        let result = "";
        if (hintsLength === 0) {
            return result;
        }
        for (let i = 0; i < hintsLength; i++) {
            const link = hints[i];
            validateLinkHeaderFormat(link, "hints");
            result += link;
            if (i !== hintsLength - 1) {
                result += ", ";
            }
        }
        return result;
    }
    throw new ERR_INVALID_ARG_VALUE("hints", hints, 'must be an array or string of format "</styles.css>; rel=preload; as=style"');
}
/* These items copied from Node.js: node/lib/internal/util/types.js */
export function isUint8Array(value) {
    return value != null && value[Symbol.toStringTag] === "Uint8Array";
}
