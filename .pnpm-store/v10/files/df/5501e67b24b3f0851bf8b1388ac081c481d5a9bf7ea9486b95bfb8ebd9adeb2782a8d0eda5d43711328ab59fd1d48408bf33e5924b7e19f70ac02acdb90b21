import { GetOptions } from '../../common/interfaces';
import { ResourceInterface, ResourceOptions } from './resource.interface';
import { WarrantOp } from './warrant-op.enum';
export interface ListWarrantsOptions {
    resourceType?: string;
    resourceId?: string;
    relation?: string;
    subjectType?: string;
    subjectId?: string;
    subjectRelation?: string;
    limit?: number;
    after?: string;
}
export interface SerializedListWarrantsOptions {
    resource_type?: string;
    resource_id?: string;
    relation?: string;
    subject_type?: string;
    subject_id?: string;
    subject_relation?: string;
    limit?: number;
    after?: string;
}
export interface PolicyContext {
    [key: string]: any;
}
export interface Subject {
    resourceType: string;
    resourceId: string;
    relation?: string;
}
export interface SerializedSubject {
    resource_type: string;
    resource_id: string;
    relation?: string;
}
export interface Warrant {
    resourceType: string;
    resourceId: string;
    relation: string;
    subject: Subject;
    policy?: string;
}
export interface WriteWarrantOptions {
    op?: WarrantOp;
    resource: ResourceInterface | ResourceOptions;
    relation: string;
    subject: ResourceInterface | Subject;
    policy?: string;
}
export interface SerializedWriteWarrantOptions {
    op?: WarrantOp;
    resource_type: string;
    resource_id: string;
    relation: string;
    subject: SerializedSubject;
    policy?: string;
}
export type ListWarrantsRequestOptions = Pick<GetOptions, 'warrantToken'>;
export interface WarrantResponse {
    resource_type: string;
    resource_id: string;
    relation: string;
    subject: SerializedSubject;
    policy?: string;
}
