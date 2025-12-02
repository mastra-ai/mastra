/*! @azure/msal-browser v4.25.1 2025-10-17 */
'use strict';
import { CustomAuthError } from './CustomAuthError.mjs';

/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
class UserAccountAttributeError extends CustomAuthError {
    constructor(error, attributeName, attributeValue) {
        const errorDescription = `Failed to set attribute '${attributeName}' with value '${attributeValue}'`;
        super(error, errorDescription);
        Object.setPrototypeOf(this, UserAccountAttributeError.prototype);
    }
}

export { UserAccountAttributeError };
//# sourceMappingURL=UserAccountAttributeError.mjs.map
