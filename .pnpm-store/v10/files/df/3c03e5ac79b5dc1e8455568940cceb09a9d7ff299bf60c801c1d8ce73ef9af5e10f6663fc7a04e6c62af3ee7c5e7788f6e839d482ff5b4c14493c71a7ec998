/*! firebase-admin v13.5.0 */
/*!
 * @license
 * Copyright 2024 Google Inc.
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
import { DecodedIdToken } from '../auth/token-verifier';
/**
 * Interface representing a Data Connect connector configuration.
 */
export interface ConnectorConfig {
    /**
     * Location ID of the Data Connect service.
     */
    location: string;
    /**
     * Service ID of the Data Connect service.
     */
    serviceId: string;
}
/**
 * Interface representing GraphQL response.
 */
export interface ExecuteGraphqlResponse<GraphqlResponse> {
    /**
     * Data payload of the GraphQL response.
     */
    data: GraphqlResponse;
}
/**
 * Interface representing GraphQL options.
 */
export interface GraphqlOptions<Variables> {
    /**
     * Values for GraphQL variables provided in this query or mutation.
     */
    variables?: Variables;
    /**
     * The name of the GraphQL operation. Required only if `query` contains multiple operations.
     */
    operationName?: string;
    /**
     * If set, impersonate a request with given Firebase Auth context and evaluate the auth
     * policies on the operation. If omitted, bypass any defined auth policies.
     */
    impersonate?: ImpersonateAuthenticated | ImpersonateUnauthenticated;
}
/**
 * Type representing the partial claims of a Firebase Auth token used to evaluate the
 * Data Connect auth policy.
 */
export type AuthClaims = Partial<DecodedIdToken>;
/**
 * Interface representing the impersonation of an authenticated user.
 */
export interface ImpersonateAuthenticated {
    /**
     * Evaluate the auth policy with a customized JWT auth token. Should follow the Firebase Auth token format.
     * https://firebase.google.com/docs/data-connect/cel-reference#auth-token-contents
     *
     * @example A verified user may have the following `authClaims`:
     * ```json
     * { "sub": "uid", "email_verified": true }
     * ```
     */
    authClaims: AuthClaims;
    /**
     * Both `authClaims` and `unauthenticated` are mutually exclusive fields and should not be both set.
     */
    unauthenticated?: never;
}
/**
 * Interface representing the impersonation of an unauthenticated user.
 */
export interface ImpersonateUnauthenticated {
    /**
     * Both `authClaims` and `unauthenticated` are mutually exclusive fields and should not be both set.
     */
    authClaims?: never;
    /**
     * Evaluates the auth policy as an unauthenticated request. Can only be set to true.
     */
    unauthenticated: true;
}
