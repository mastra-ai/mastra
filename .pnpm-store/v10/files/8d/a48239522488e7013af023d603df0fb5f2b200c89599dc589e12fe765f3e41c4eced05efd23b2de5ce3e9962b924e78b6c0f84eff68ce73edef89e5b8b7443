/*! @azure/msal-browser v4.25.1 2025-10-17 */
'use strict';
import { CustomAuthError } from './CustomAuthError.mjs';

/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
class MethodNotImplementedError extends CustomAuthError {
    constructor(method, correlationId) {
        const errorDescription = `The method '${method}' is not implemented, please do not use.`;
        super("method_not_implemented", errorDescription, correlationId);
        Object.setPrototypeOf(this, MethodNotImplementedError.prototype);
    }
}

export { MethodNotImplementedError };
//# sourceMappingURL=MethodNotImplementedError.mjs.map
