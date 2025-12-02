import { PaginationOptions } from '../../common/interfaces/pagination-options.interface';
import { ResourceOp } from './resource-op.enum';
export interface ResourceInterface {
    getResourceType(): string;
    getResourceId(): string;
}
export interface ResourceOptions {
    resourceType: string;
    resourceId?: string;
}
export interface SerializedResourceOptions {
    resource_type: string;
    resource_id?: string;
}
export interface CreateResourceOptions {
    resource: ResourceInterface | ResourceOptions;
    meta?: {
        [key: string]: any;
    };
}
export interface SerializedCreateResourceOptions {
    resource_type: string;
    resource_id?: string;
    meta?: {
        [key: string]: any;
    };
}
export type GetResourceOptions = ResourceInterface | ResourceOptions;
export interface ListResourcesOptions extends PaginationOptions {
    resourceType?: string;
    search?: string;
}
export interface SerializedListResourcesOptions extends PaginationOptions {
    resource_type?: string;
    search?: string;
}
export interface UpdateResourceOptions {
    resource: ResourceInterface | ResourceOptions;
    meta: {
        [key: string]: any;
    };
}
export type DeleteResourceOptions = ResourceInterface | ResourceOptions;
export interface SerializedDeleteResourceOptions {
    resource_type: string;
    resource_id: string;
}
export interface Resource {
    resourceType: string;
    resourceId: string;
    meta?: {
        [key: string]: any;
    };
}
export interface ResourceResponse {
    resource_type: string;
    resource_id: string;
    meta?: {
        [key: string]: any;
    };
}
export interface BatchWriteResourcesOptions {
    op: ResourceOp;
    resources: CreateResourceOptions[] | DeleteResourceOptions[];
}
export interface SerializedBatchWriteResourcesOptions {
    op: string;
    resources: SerializedCreateResourceOptions[] | SerializedDeleteResourceOptions[];
}
export interface BatchWriteResourcesResponse {
    data: ResourceResponse[];
}
