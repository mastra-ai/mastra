import type { PineconeConfiguration } from './types';
import { DataPlaneApi } from '../pinecone-generated-ts-fetch/data';
import type { HTTPHeaders } from '../pinecone-generated-ts-fetch/data';
export declare class DataOperationsProvider {
    private config;
    private indexName;
    private indexHostUrl?;
    private dataOperations?;
    private additionalHeaders?;
    constructor(config: PineconeConfiguration, indexName: string, indexHostUrl?: string, additionalHeaders?: HTTPHeaders);
    provide(): Promise<DataPlaneApi>;
    buildDataOperationsConfig(): DataPlaneApi;
}
