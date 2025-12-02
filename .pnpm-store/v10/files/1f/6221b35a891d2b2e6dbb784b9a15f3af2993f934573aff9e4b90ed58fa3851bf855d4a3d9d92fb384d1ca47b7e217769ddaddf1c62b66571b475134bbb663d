/*! firebase-admin v13.5.0 */
/*!
 * @license
 * Copyright 2017 Google Inc.
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
import { App } from '../app/index';
import { UserImportOptions, UserImportRecord, UserImportResult } from './user-import-builder';
import { TenantServerResponse, CreateTenantRequest, UpdateTenantRequest } from './tenant';
import { ProjectConfigServerResponse, UpdateProjectConfigRequest } from './project-config';
/** List of reserved claims which cannot be provided when creating a custom token. */
export declare const RESERVED_CLAIMS: string[];
/** List of supported email action request types. */
export declare const EMAIL_ACTION_REQUEST_TYPES: string[];
/** Defines a base utility to help with resource URL construction. */
declare class AuthResourceUrlBuilder {
    protected app: App;
    protected version: string;
    protected urlFormat: string;
    private projectId;
    /**
     * The resource URL builder constructor.
     *
     * @param projectId - The resource project ID.
     * @param version - The endpoint API version.
     * @constructor
     */
    constructor(app: App, version?: string);
    /**
     * Returns the resource URL corresponding to the provided parameters.
     *
     * @param api - The backend API name.
     * @param params - The optional additional parameters to substitute in the
     *     URL path.
     * @returns The corresponding resource URL.
     */
    getUrl(api?: string, params?: object): Promise<string>;
    private getProjectId;
}
interface BatchDeleteErrorInfo {
    index?: number;
    localId?: string;
    message?: string;
}
export interface BatchDeleteAccountsResponse {
    errors?: BatchDeleteErrorInfo[];
}
/**
 * Utility for sending requests to Auth server that are Auth instance related. This includes user, tenant,
 * and project config management related APIs. This extends the BaseFirebaseAuthRequestHandler class and defines
 * additional tenant management related APIs.
 */
export declare class AuthRequestHandler extends AbstractAuthRequestHandler {
    protected readonly authResourceUrlBuilder: AuthResourceUrlBuilder;
    /**
     * The FirebaseAuthRequestHandler constructor used to initialize an instance using a FirebaseApp.
     *
     * @param app - The app used to fetch access tokens to sign API requests.
     * @constructor
     */
    constructor(app: App);
    /**
     * @returns A new Auth user management resource URL builder instance.
     */
    protected newAuthUrlBuilder(): AuthResourceUrlBuilder;
    /**
     * @returns A new project config resource URL builder instance.
     */
    protected newProjectConfigUrlBuilder(): AuthResourceUrlBuilder;
    /**
     * Get the current project's config
     * @returns A promise that resolves with the project config information.
     */
    getProjectConfig(): Promise<ProjectConfigServerResponse>;
    /**
     * Update the current project's config.
     * @returns A promise that resolves with the project config information.
     */
    updateProjectConfig(options: UpdateProjectConfigRequest): Promise<ProjectConfigServerResponse>;
    /**
     * Looks up a tenant by tenant ID.
     *
     * @param tenantId - The tenant identifier of the tenant to lookup.
     * @returns A promise that resolves with the tenant information.
     */
    getTenant(tenantId: string): Promise<TenantServerResponse>;
    /**
     * Exports the tenants (single batch only) with a size of maxResults and starting from
     * the offset as specified by pageToken.
     *
     * @param maxResults - The page size, 1000 if undefined. This is also the maximum
     *     allowed limit.
     * @param pageToken - The next page token. If not specified, returns tenants starting
     *     without any offset. Tenants are returned in the order they were created from oldest to
     *     newest, relative to the page token offset.
     * @returns A promise that resolves with the current batch of downloaded
     *     tenants and the next page token if available. For the last page, an empty list of tenants
     *     and no page token are returned.
     */
    listTenants(maxResults?: number, pageToken?: string): Promise<{
        tenants: TenantServerResponse[];
        nextPageToken?: string;
    }>;
    /**
     * Deletes a tenant identified by a tenantId.
     *
     * @param tenantId - The identifier of the tenant to delete.
     * @returns A promise that resolves when the tenant is deleted.
     */
    deleteTenant(tenantId: string): Promise<void>;
    /**
     * Creates a new tenant with the properties provided.
     *
     * @param tenantOptions - The properties to set on the new tenant to be created.
     * @returns A promise that resolves with the newly created tenant object.
     */
    createTenant(tenantOptions: CreateTenantRequest): Promise<TenantServerResponse>;
    /**
     * Updates an existing tenant with the properties provided.
     *
     * @param tenantId - The tenant identifier of the tenant to update.
     * @param tenantOptions - The properties to update on the existing tenant.
     * @returns A promise that resolves with the modified tenant object.
     */
    updateTenant(tenantId: string, tenantOptions: UpdateTenantRequest): Promise<TenantServerResponse>;
}
/**
 * Utility for sending requests to Auth server that are tenant Auth instance related. This includes user
 * management related APIs for specified tenants.
 * This extends the BaseFirebaseAuthRequestHandler class.
 */
export declare class TenantAwareAuthRequestHandler extends AbstractAuthRequestHandler {
    private readonly tenantId;
    /**
     * The FirebaseTenantRequestHandler constructor used to initialize an instance using a
     * FirebaseApp and a tenant ID.
     *
     * @param app - The app used to fetch access tokens to sign API requests.
     * @param tenantId - The request handler's tenant ID.
     * @constructor
     */
    constructor(app: App, tenantId: string);
    /**
     * @returns A new Auth user management resource URL builder instance.
     */
    protected newAuthUrlBuilder(): AuthResourceUrlBuilder;
    /**
     * @returns A new project config resource URL builder instance.
     */
    protected newProjectConfigUrlBuilder(): AuthResourceUrlBuilder;
    /**
     * Imports the list of users provided to Firebase Auth. This is useful when
     * migrating from an external authentication system without having to use the Firebase CLI SDK.
     * At most, 1000 users are allowed to be imported one at a time.
     * When importing a list of password users, UserImportOptions are required to be specified.
     *
     * Overrides the superclass methods by adding an additional check to match tenant IDs of
     * imported user records if present.
     *
     * @param users - The list of user records to import to Firebase Auth.
     * @param options - The user import options, required when the users provided
     *     include password credentials.
     * @returns A promise that resolves when the operation completes
     *     with the result of the import. This includes the number of successful imports, the number
     *     of failed uploads and their corresponding errors.
     */
    uploadAccount(users: UserImportRecord[], options?: UserImportOptions): Promise<UserImportResult>;
}
/**
 * When true the SDK should communicate with the Auth Emulator for all API
 * calls and also produce unsigned tokens.
 */
export declare function useEmulator(): boolean;
export {};
