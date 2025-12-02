/*! @azure/msal-browser v4.25.1 2025-10-17 */
'use strict';
import { AuthFlowResultBase } from '../../AuthFlowResultBase.mjs';
import { AuthMethodRegistrationChallengeMethodError } from '../error_type/AuthMethodRegistrationError.mjs';
import { AuthMethodRegistrationFailedState } from '../state/AuthMethodRegistrationFailedState.mjs';
import { AUTH_METHOD_VERIFICATION_REQUIRED_STATE_TYPE, AUTH_METHOD_REGISTRATION_COMPLETED_STATE_TYPE, AUTH_METHOD_REGISTRATION_FAILED_STATE_TYPE } from '../../AuthFlowStateTypes.mjs';

/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
/**
 * Result of challenging an authentication method for registration.
 * Uses base state type to avoid circular dependencies.
 */
class AuthMethodRegistrationChallengeMethodResult extends AuthFlowResultBase {
    /**
     * Creates an AuthMethodRegistrationChallengeMethodResult with an error.
     * @param error The error that occurred.
     * @returns The AuthMethodRegistrationChallengeMethodResult with error.
     */
    static createWithError(error) {
        const result = new AuthMethodRegistrationChallengeMethodResult(new AuthMethodRegistrationFailedState());
        result.error = new AuthMethodRegistrationChallengeMethodError(AuthMethodRegistrationChallengeMethodResult.createErrorData(error));
        return result;
    }
    /**
     * Checks if the result indicates that verification is required.
     * @returns true if verification is required, false otherwise.
     * @warning This API is experimental. It may be changed in the future without notice. Do not use in production applications.
     */
    isVerificationRequired() {
        return (this.state.stateType ===
            AUTH_METHOD_VERIFICATION_REQUIRED_STATE_TYPE);
    }
    /**
     * Checks if the result indicates that registration is completed (fast-pass scenario).
     * @returns true if registration is completed, false otherwise.
     * @warning This API is experimental. It may be changed in the future without notice. Do not use in production applications.
     */
    isCompleted() {
        return (this.state.stateType ===
            AUTH_METHOD_REGISTRATION_COMPLETED_STATE_TYPE);
    }
    /**
     * Checks if the result is in a failed state.
     * @returns true if the result is failed, false otherwise.
     * @warning This API is experimental. It may be changed in the future without notice. Do not use in production applications.
     */
    isFailed() {
        return (this.state.stateType === AUTH_METHOD_REGISTRATION_FAILED_STATE_TYPE);
    }
}

export { AuthMethodRegistrationChallengeMethodResult };
//# sourceMappingURL=AuthMethodRegistrationChallengeMethodResult.mjs.map
