/*! @azure/msal-browser v4.25.1 2025-10-17 */
'use strict';
import { AuthFlowResultBase } from '../../AuthFlowResultBase.mjs';
import { MfaRequestChallengeError } from '../error_type/MfaError.mjs';
import { MfaFailedState } from '../state/MfaFailedState.mjs';
import { MFA_VERIFICATION_REQUIRED_STATE_TYPE, MFA_FAILED_STATE_TYPE } from '../../AuthFlowStateTypes.mjs';

/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
/**
 * Result of requesting an MFA challenge.
 * Uses base state type to avoid circular dependencies.
 */
class MfaRequestChallengeResult extends AuthFlowResultBase {
    /**
     * Creates an MfaRequestChallengeResult with an error.
     * @param error The error that occurred.
     * @returns The MfaRequestChallengeResult with error.
     */
    static createWithError(error) {
        const result = new MfaRequestChallengeResult(new MfaFailedState());
        result.error = new MfaRequestChallengeError(MfaRequestChallengeResult.createErrorData(error));
        return result;
    }
    /**
     * Checks if the result indicates that verification is required.
     * @returns true if verification is required, false otherwise.
     * @warning This API is experimental. It may be changed in the future without notice. Do not use in production applications.
     */
    isVerificationRequired() {
        return this.state.stateType === MFA_VERIFICATION_REQUIRED_STATE_TYPE;
    }
    /**
     * Checks if the result is in a failed state.
     * @returns true if the result is failed, false otherwise.
     * @warning This API is experimental. It may be changed in the future without notice. Do not use in production applications.
     */
    isFailed() {
        return this.state.stateType === MFA_FAILED_STATE_TYPE;
    }
}

export { MfaRequestChallengeResult };
//# sourceMappingURL=MfaRequestChallengeResult.mjs.map
