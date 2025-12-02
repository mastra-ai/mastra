import { ResourceInterface, ResourceOptions } from './resource.interface';
import { PolicyContext, SerializedSubject, Subject } from './warrant.interface';
import { CheckOp } from './check-op.enum';
import { PostOptions } from '../../common/interfaces';
import { Warning } from './warning.interface';
export interface CheckWarrantOptions {
    resource: ResourceInterface | ResourceOptions;
    relation: string;
    subject: ResourceInterface | Subject;
    context?: PolicyContext;
}
export interface SerializedCheckWarrantOptions {
    resource_type: string;
    resource_id: string;
    relation: string;
    subject: SerializedSubject;
    context: PolicyContext;
}
export interface CheckOptions {
    op?: CheckOp;
    checks: CheckWarrantOptions[];
    debug?: boolean;
}
export interface CheckBatchOptions {
    checks: CheckWarrantOptions[];
    debug?: boolean;
}
export interface SerializedCheckOptions {
    op?: CheckOp;
    checks: SerializedCheckWarrantOptions[];
    debug?: boolean;
}
export interface SerializedCheckBatchOptions {
    op: 'batch';
    checks: SerializedCheckWarrantOptions[];
    debug?: boolean;
}
export interface CheckResultResponse {
    result: string;
    is_implicit: boolean;
    warrant_token: string;
    debug_info?: DebugInfoResponse;
    warnings?: Warning[];
}
export interface DebugInfo {
    processingTime: number;
    decisionTree: DecisionTreeNode;
}
export interface DecisionTreeNode {
    check: CheckWarrantOptions;
    policy?: string;
    decision: string;
    processingTime: number;
    children: DecisionTreeNode[];
}
export interface DebugInfoResponse {
    processing_time: number;
    decision_tree: DecisionTreeNodeResponse;
}
export interface DecisionTreeNodeResponse {
    check: SerializedCheckWarrantOptions;
    policy?: string;
    decision: string;
    processing_time: number;
    children: DecisionTreeNodeResponse[];
}
export interface CheckResultInterface {
    result: string;
    isImplicit: boolean;
    warrantToken: string;
    debugInfo?: DebugInfo;
    warnings?: Warning[];
}
export declare class CheckResult implements CheckResultInterface {
    result: string;
    isImplicit: boolean;
    warrantToken: string;
    debugInfo?: DebugInfo;
    warnings?: Warning[];
    constructor(json: CheckResultResponse);
    isAuthorized(): boolean;
}
export type CheckRequestOptions = Pick<PostOptions, 'warrantToken'>;
