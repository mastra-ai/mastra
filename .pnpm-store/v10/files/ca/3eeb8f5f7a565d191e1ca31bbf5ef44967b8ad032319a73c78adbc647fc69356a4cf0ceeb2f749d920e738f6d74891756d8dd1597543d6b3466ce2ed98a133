import { ConnectionType } from './connection-type.enum';
export interface ConnectionDomain {
    object: 'connection_domain';
    id: string;
    domain: string;
}
export interface Connection {
    object: 'connection';
    id: string;
    organizationId?: string;
    name: string;
    /**
     * @deprecated The connectionType parameter has been deprecated. Please use type.
     */
    connectionType: ConnectionType;
    state: 'draft' | 'active' | 'inactive' | 'validating';
    domains: ConnectionDomain[];
    type: ConnectionType;
    createdAt: string;
    updatedAt: string;
}
export interface ConnectionResponse {
    object: 'connection';
    id: string;
    organization_id?: string;
    name: string;
    connection_type: ConnectionType;
    state: 'draft' | 'active' | 'inactive' | 'validating';
    domains: ConnectionDomain[];
    created_at: string;
    updated_at: string;
}
