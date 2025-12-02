/*! firebase-admin v13.5.0 */
/*!
 * Copyright 2019 Google Inc.
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
import { BaseAuth, SessionCookieOptions } from './base-auth';
import { Tenant, CreateTenantRequest, UpdateTenantRequest } from './tenant';
import { DecodedIdToken } from './token-verifier';
/**
 * Interface representing the object returned from a
 * {@link TenantManager.listTenants}
 * operation.
 * Contains the list of tenants for the current batch and the next page token if available.
 */
export interface ListTenantsResult {
    /**
     * The list of {@link Tenant} objects for the downloaded batch.
     */
    tenants: Tenant[];
    /**
     * The next page token if available. This is needed for the next batch download.
     */
    pageToken?: string;
}
/**
 * Tenant-aware `Auth` interface used for managing users, configuring SAML/OIDC providers,
 * generating email links for password reset, email verification, etc for specific tenants.
 *
 * Multi-tenancy support requires Google Cloud's Identity Platform
 * (GCIP). To learn more about GCIP, including pricing and features,
 * see the {@link https://cloud.google.com/identity-platform | GCIP documentation}.
 *
 * Each tenant contains its own identity providers, settings and sets of users.
 * Using `TenantAwareAuth`, users for a specific tenant and corresponding OIDC/SAML
 * configurations can also be managed, ID tokens for users signed in to a specific tenant
 * can be verified, and email action links can also be generated for users belonging to the
 * tenant.
 *
 * `TenantAwareAuth` instances for a specific `tenantId` can be instantiated by calling
 * {@link TenantManager.authForTenant}.
 */
export declare class TenantAwareAuth extends BaseAuth {
    /**
     * The tenant identifier corresponding to this `TenantAwareAuth` instance.
     * All calls to the user management APIs, OIDC/SAML provider management APIs, email link
     * generation APIs, etc will only be applied within the scope of this tenant.
     */
    readonly tenantId: string;
    /**
     * {@inheritdoc BaseAuth.verifyIdToken}
     */
    verifyIdToken(idToken: string, checkRevoked?: boolean): Promise<DecodedIdToken>;
    /**
     * {@inheritdoc BaseAuth.createSessionCookie}
     */
    createSessionCookie(idToken: string, sessionCookieOptions: SessionCookieOptions): Promise<string>;
    /**
     * {@inheritdoc BaseAuth.verifySessionCookie}
     */
    verifySessionCookie(sessionCookie: string, checkRevoked?: boolean): Promise<DecodedIdToken>;
}
/**
 * Defines the tenant manager used to help manage tenant related operations.
 * This includes:
 * <ul>
 * <li>The ability to create, update, list, get and delete tenants for the underlying
 *     project.</li>
 * <li>Getting a `TenantAwareAuth` instance for running Auth related operations
 *     (user management, provider configuration management, token verification,
 *     email link generation, etc) in the context of a specified tenant.</li>
 * </ul>
 */
export declare class TenantManager {
    private readonly app;
    private readonly authRequestHandler;
    private readonly tenantsMap;
    /**
     * Returns a `TenantAwareAuth` instance bound to the given tenant ID.
     *
     * @param tenantId - The tenant ID whose `TenantAwareAuth` instance is to be returned.
     *
     * @returns The `TenantAwareAuth` instance corresponding to this tenant identifier.
     */
    authForTenant(tenantId: string): TenantAwareAuth;
    /**
     * Gets the tenant configuration for the tenant corresponding to a given `tenantId`.
     *
     * @param tenantId - The tenant identifier corresponding to the tenant whose data to fetch.
     *
     * @returns A promise fulfilled with the tenant configuration to the provided `tenantId`.
     */
    getTenant(tenantId: string): Promise<Tenant>;
    /**
     * Retrieves a list of tenants (single batch only) with a size of `maxResults`
     * starting from the offset as specified by `pageToken`. This is used to
     * retrieve all the tenants of a specified project in batches.
     *
     * @param maxResults - The page size, 1000 if undefined. This is also
     *   the maximum allowed limit.
     * @param pageToken - The next page token. If not specified, returns
     *   tenants starting without any offset.
     *
     * @returns A promise that resolves with
     *   a batch of downloaded tenants and the next page token.
     */
    listTenants(maxResults?: number, pageToken?: string): Promise<ListTenantsResult>;
    /**
     * Deletes an existing tenant.
     *
     * @param tenantId - The `tenantId` corresponding to the tenant to delete.
     *
     * @returns An empty promise fulfilled once the tenant has been deleted.
     */
    deleteTenant(tenantId: string): Promise<void>;
    /**
     * Creates a new tenant.
     * When creating new tenants, tenants that use separate billing and quota will require their
     * own project and must be defined as `full_service`.
     *
     * @param tenantOptions - The properties to set on the new tenant configuration to be created.
     *
     * @returns A promise fulfilled with the tenant configuration corresponding to the newly
     *   created tenant.
     */
    createTenant(tenantOptions: CreateTenantRequest): Promise<Tenant>;
    /**
     * Updates an existing tenant configuration.
     *
     * @param tenantId - The `tenantId` corresponding to the tenant to delete.
     * @param tenantOptions - The properties to update on the provided tenant.
     *
     * @returns A promise fulfilled with the update tenant data.
     */
    updateTenant(tenantId: string, tenantOptions: UpdateTenantRequest): Promise<Tenant>;
}
