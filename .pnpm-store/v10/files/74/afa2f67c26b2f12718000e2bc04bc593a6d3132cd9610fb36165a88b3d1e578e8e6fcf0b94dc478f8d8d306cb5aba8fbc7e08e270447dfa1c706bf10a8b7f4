import { WorkOS } from '../workos';
import { Resource, CheckBatchOptions, CheckOptions, CheckRequestOptions, CheckResult, CreateResourceOptions, DeleteResourceOptions, ListResourcesOptions, ListWarrantsRequestOptions, ListWarrantsOptions, QueryOptions, QueryRequestOptions, QueryResult, ResourceInterface, ResourceOptions, UpdateResourceOptions, WriteWarrantOptions, Warrant, WarrantToken, BatchWriteResourcesOptions } from './interfaces';
import { AutoPaginatable } from '../common/utils/pagination';
import { FgaPaginatable } from './utils/fga-paginatable';
export declare class FGA {
    private readonly workos;
    constructor(workos: WorkOS);
    check(checkOptions: CheckOptions, options?: CheckRequestOptions): Promise<CheckResult>;
    checkBatch(checkOptions: CheckBatchOptions, options?: CheckRequestOptions): Promise<CheckResult[]>;
    createResource(resource: CreateResourceOptions): Promise<Resource>;
    getResource(resource: ResourceInterface | ResourceOptions): Promise<Resource>;
    listResources(options?: ListResourcesOptions): Promise<AutoPaginatable<Resource>>;
    updateResource(options: UpdateResourceOptions): Promise<Resource>;
    deleteResource(resource: DeleteResourceOptions): Promise<void>;
    batchWriteResources(options: BatchWriteResourcesOptions): Promise<Resource[]>;
    writeWarrant(options: WriteWarrantOptions): Promise<WarrantToken>;
    batchWriteWarrants(options: WriteWarrantOptions[]): Promise<WarrantToken>;
    listWarrants(options?: ListWarrantsOptions, requestOptions?: ListWarrantsRequestOptions): Promise<AutoPaginatable<Warrant>>;
    query(options: QueryOptions, requestOptions?: QueryRequestOptions): Promise<FgaPaginatable<QueryResult>>;
}
