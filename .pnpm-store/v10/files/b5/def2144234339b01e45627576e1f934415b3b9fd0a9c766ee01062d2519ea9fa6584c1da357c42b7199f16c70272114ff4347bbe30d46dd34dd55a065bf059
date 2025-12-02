/*! @azure/msal-browser v4.25.1 2025-10-17 */
'use strict';
import { CustomAuthError } from './CustomAuthError.mjs';

/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
class UserAlreadySignedInError extends CustomAuthError {
    constructor(correlationId) {
        super("user_already_signed_in", "The user has already signed in.", correlationId);
        Object.setPrototypeOf(this, UserAlreadySignedInError.prototype);
    }
}

export { UserAlreadySignedInError };
//# sourceMappingURL=UserAlreadySignedInError.mjs.map
