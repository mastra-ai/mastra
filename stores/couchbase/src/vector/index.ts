import { MastraVector } from '@mastra/core/vector';
import type {
    QueryResult,
    IndexStats,
    CreateIndexParams,
    UpsertVectorParams,
    QueryVectorParams,
    ParamsToArgs,
} from '@mastra/core/vector';
import { Bucket, Cluster, Collection, connect, SearchRequest, VectorQuery, VectorSearch, Scope } from 'couchbase';

const metricsInMastra = ['cosine', 'euclidean', 'dotproduct'] as const;
type MastraMetric = typeof metricsInMastra[number];
const metricsInCouchbase = ['cosine', 'l2_norm', 'dot_product'] as const;
type CouchbaseMetric = typeof metricsInCouchbase[number];
export const DISTANCE_MAPPING: Record<MastraMetric, CouchbaseMetric> = {
    cosine: 'cosine',
    euclidean: 'l2_norm',
    dotproduct: 'dot_product',
};

export class CouchbaseVector extends MastraVector {
    private clusterPromise: Promise<Cluster>;
    private cluster: Cluster;
    private bucketName: string;
    private collectionName: string;
    private scopeName: string;
    private collection: Collection;
    private bucket: Bucket;
    private scope: Scope;
    private vector_dimension: number;

    constructor(cnn_string: string, username: string, password: string, bucketName: string, scopeName: string, collectionName: string) {
        super();

        const baseClusterPromise = connect(cnn_string, {
            username,
            password,
            configProfile: 'wanDevelopment'
        });

        const telemetry = this.__getTelemetry();
        this.clusterPromise =
            telemetry?.traceClass(baseClusterPromise, {
                spanNamePrefix: 'couchbase-vector',
                attributes: {
                    'vector.type': 'couchbase',
                },
            }) ?? baseClusterPromise;
        this.cluster = null as unknown as Cluster;
        this.bucketName = bucketName;
        this.collectionName = collectionName;
        this.scopeName = scopeName;
        this.collection = null as unknown as Collection;
        this.bucket = null as unknown as Bucket;
        this.scope = null as unknown as Scope;
        this.vector_dimension = null as unknown as number;
    }

    async getCollection() {
        if (!this.cluster) {
            this.cluster = await this.clusterPromise;
        }

        if (!this.collection) {
            this.bucket = this.cluster.bucket(this.bucketName);
            this.scope = this.bucket.scope(this.scopeName);
            this.collection = this.scope.collection(this.collectionName);
        }

        return this.collection;
    }

    /*
    ALTERNATE:
    async createIndex2(params: CreateIndexParams): Promise<void> {...}
    */
    // TODO: Do we need this at all? It says in `mastra/packages/core/dist/chunk-ZABXT2MN.js` that the individual arguments are deprecated. And so object needs to be passed directly.
    async createIndex(...args: ParamsToArgs<CreateIndexParams>): Promise<void> {
        const params = this.normalizeArgs<CreateIndexParams>('createIndex', args);
        const { indexName, dimension, metric = 'dotproduct' as MastraMetric } = params;
        await this.getCollection();

        if (!Number.isInteger(dimension) || dimension <= 0) {
            throw new Error('Dimension must be a positive integer');
        }

        await this.scope.searchIndexes().upsertIndex(
            {
                name: indexName,
                sourceName: this.bucketName,
                type: 'fulltext-index',
                params: {
                    "doc_config": {
                        "docid_prefix_delim": "",
                        "docid_regexp": "",
                        "mode": "scope.collection.type_field",
                        "type_field": "type"
                    },
                    "mapping": {
                        "default_analyzer": "standard",
                        "default_datetime_parser": "dateTimeOptional",
                        "default_field": "_all",
                        "default_mapping": {
                            "dynamic": true,
                            "enabled": false
                        },
                        "default_type": "_default",
                        "docvalues_dynamic": true, // [Doc](https://docs.couchbase.com/server/current/search/search-index-params.html#params) mentions this attribute is required for vector search to return the indexed field
                        "index_dynamic": true,
                        "store_dynamic": true, // [Doc](https://docs.couchbase.com/server/current/search/search-index-params.html#params) mentions this attribute is required for vector search to return the indexed field
                        "type_field": "_type",
                        "types": {
                            [`${this.scopeName}.${this.collectionName}`]: {
                                "dynamic": true,
                                "enabled": true,
                                "properties": {
                                    "embedding": {
                                        "enabled": true,
                                        "fields": [
                                            {
                                                "dims": dimension,
                                                "index": true,
                                                "name": "embedding",
                                                "similarity": DISTANCE_MAPPING[metric],
                                                "type": "vector",
                                                "vector_index_optimized_for": "recall",
                                                "store": true, // CHANGED due to https://docs.couchbase.com/server/current/search/search-index-params.html#fields
                                                "docvalues": true, // CHANGED due to https://docs.couchbase.com/server/current/search/search-index-params.html#fields
                                                "include_term_vectors": true // CHANGED due to https://docs.couchbase.com/server/current/search/search-index-params.html#fields
                                            }
                                        ]
                                    },
                                    "content": {
                                        "enabled": true,
                                        "fields": [
                                            {
                                                "index": true,
                                                "name": "content",
                                                "store": true,
                                                "type": "text"
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    },
                    "store": {
                        "indexType": "scorch",
                        "segmentVersion": 16
                    }
                },
                sourceUuid: "",
                sourceParams: {},
                sourceType: "gocbcore",
                planParams: {
                    "maxPartitionsPerPIndex": 64,
                    "indexPartitions": 16,
                    "numReplicas": 0,
                },
            }
        );
        this.vector_dimension = dimension;
    }

    async upsert(...args: ParamsToArgs<UpsertVectorParams>): Promise<string[]> {
        const params = this.normalizeArgs<UpsertVectorParams>('upsert', args);
        const { indexName, vectors, metadata, ids } = params;
        await this.getCollection();

        if (!vectors || vectors.length === 0) {
            throw new Error('No vectors provided');
        }
        if (this.vector_dimension) {
            for (const vector of vectors) {
                if (!vector || this.vector_dimension !== vector.length) {
                    throw new Error('Vector dimension mismatch');
                }
            }
        }

        const pointIds = ids || vectors.map(() => crypto.randomUUID());
        const records = vectors.map((vector, i) => {
            const metadataObj = metadata?.[i] || {};
            const record: Record<string, any> = {
                embedding: vector,
                metadata: metadataObj,
            };
            // If metadata has a text field, save it as content
            if (metadataObj.text) {
                record.content = metadataObj.text;
            }
            return record;
        });

        const allPromises = [];
        for (let i = 0; i < records.length; i++) {
            allPromises.push(this.collection.upsert(pointIds[i]!, records[i]));
        }
        await Promise.all(allPromises);

        return pointIds;
    }

    async query(...args: ParamsToArgs<QueryVectorParams>): Promise<QueryResult[]> {
        const params = this.normalizeArgs<QueryVectorParams>('query', args);
        const { indexName, queryVector, topK = 10, filter, includeVector = false } = params;

        await this.getCollection();

        const index_stats = await this.describeIndex(indexName);
        if (queryVector.length !== index_stats.dimension) {
            throw new Error(`Query vector dimension mismatch. Expected ${index_stats.dimension}, got ${queryVector.length}`);
        }

        let request = SearchRequest.create(
            VectorSearch.fromVectorQuery(
                VectorQuery.create("embedding", queryVector).numCandidates(topK)
            )
        );
        const results = await this.scope.search(
            indexName,
            request,
            {
                fields: ["*"],
            }
        );

        if (includeVector) {
            throw new Error('Including vectors in search results is not yet supported by the Couchbase vector store');
        }
        const output = [];
        for (const match of results.rows) {
            const cleanedMetadata: Record<string, any> = {};
            const fields = match.fields as Record<string, any> || {}; // Ensure fields is an object
            for (const key in fields) {
                if (Object.prototype.hasOwnProperty.call(fields, key)) {
                    const newKey = key.startsWith('metadata.') ? key.substring('metadata.'.length) : key;
                    cleanedMetadata[newKey] = fields[key];
                }
            }
            output.push({
                id: match.id as string,
                score: match.score as number || 0,
                metadata: cleanedMetadata, // Use the cleaned metadata object
            });
        }
        return output;
    }

    async listIndexes(): Promise<string[]> {
        await this.getCollection();
        const indexes = await this.scope.searchIndexes().getAllIndexes();
        return indexes?.map(index => index.name) || [];
    }

    async describeIndex(indexName: string): Promise<IndexStats> {
        await this.getCollection();
        if (!(await this.listIndexes()).includes(indexName)) {
            throw new Error(`Index ${indexName} does not exist`);
        }
        const index = await this.scope.searchIndexes().getIndex(indexName);
        const dimensions = index.params.mapping?.types?.[`${this.scopeName}.${this.collectionName}`]?.properties?.embedding?.fields?.[0]?.dims;
        const count = -1; // Not added support yet for adding a count of documents covered by an index
        const metric = index.params.mapping?.types?.[`${this.scopeName}.${this.collectionName}`]?.properties?.embedding?.fields?.[0]?.similarity as CouchbaseMetric;
        return {
            dimension: dimensions,
            count: count,
            metric: (Object.keys(DISTANCE_MAPPING).find(key => DISTANCE_MAPPING[key as MastraMetric] === metric)) as MastraMetric
        };
    }

    async deleteIndex(indexName: string): Promise<void> {
        await this.getCollection();
        if (!(await this.listIndexes()).includes(indexName)) {
            throw new Error(`Index ${indexName} does not exist`);
        }
        await this.scope.searchIndexes().dropIndex(indexName);
        this.vector_dimension = null as unknown as number;
    }
}
