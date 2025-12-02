# Pinecone Node.js SDK &middot; ![License](https://img.shields.io/github/license/pinecone-io/pinecone-ts-client?color=orange) ![npm](https://img.shields.io/npm/v/%40pinecone-database%2Fpinecone?link=https%3A%2F%2Fwww.npmjs.com%2Fpackage%2F%40pinecone-database%2Fpinecone) ![npm](https://img.shields.io/npm/dw/%40pinecone-database/pinecone?style=flat&color=blue&link=https%3A%2F%2Fwww.npmjs.com%2Fpackage%2F%40pinecone-database%2Fpinecone) ![GitHub Workflow Status (with event)](https://img.shields.io/github/actions/workflow/status/pinecone-io/pinecone-ts-client/merge.yml?label=CI&link=https%3A%2F%2Fgithub.com%2Fpinecone-io%2Fpinecone-ts-client%2Factions%2Fworkflows%2Fmerge.yml)

This is the official Node.js SDK for [Pinecone](https://www.pinecone.io), written in TypeScript.

## Documentation

- [**Reference Documentation**](https://sdk.pinecone.io/typescript/classes/Pinecone.html)
- If you are upgrading from `v0.x`, check out the [**v1 Migration Guide**](https://github.com/pinecone-io/pinecone-ts-client/blob/main/v1-migration.md).
- If you are upgrading from `v1.x`, check out the [**v2 Migration Guide**](https://github.com/pinecone-io/pinecone-ts-client/blob/main/v2-migration.md).

### Example code

The snippets shown in this README are intended to be concise. For more realistic examples, explore these examples:

- [Semantic search](https://github.com/pinecone-io/semantic-search-example)
- [Article recommender](https://github.com/pinecone-io/recommender-example-typescript)
- [Image search](https://github.com/pinecone-io/image-search-example)

## Upgrading the SDK

#### Upgrading from `2.x` to `3.x`

There is a breaking change involving the `configureIndex` operation in this update. The structure of the object passed
when configuring an index has changed to include `deletionProtection`. The `podType` and `replicas` fields can now be updated through the `spec.pod` object. See [Configure pod-based indexes](#configure-pod-based-indexes) for an example of the code.

#### Upgrading from older versions

- **Upgrading to `2.x`** : There were many changes made in this release to support Pinecone's new Serverless index offering. The changes are covered in detail in the [**v2 Migration Guide**](https://github.com/pinecone-io/pinecone-ts-client/blob/main/v2-migration.md). Serverless indexes are only available in `2.x` release versions or greater.
- **Upgrading to `1.x`** : This release officially moved the SDK out of beta, and there are a number of breaking changes that need to be addressed when upgrading from a `0.x` version. See the [**v1 Migration Guide**](https://github.com/pinecone-io/pinecone-ts-client/blob/main/v1-migration.md) for details.

## Prerequisites

The Pinecone TypeScript SDK is compatible with TypeScript >=4.1 and Node >=18.x.

## Installation

```
npm install @pinecone-database/pinecone
```

## Productionizing

The Pinecone Typescript SDK is intended for **server-side use only**. Using the SDK within a browser context can **expose
your API key(s)**. If you have deployed the SDK to production in a browser, **please rotate your API keys.**

## Usage

### Initializing the client

An API key is required to initialize the client. It can be passed using an environment variable or in code through a configuration object. Get an API key in the [console](https://app.pinecone.io).

#### Using environment variables

The environment variable used to configure the API key for the client is the following:

```bash
PINECONE_API_KEY="your_api_key"
```

`PINECONE_API_KEY` is the only required variable. When this environment variable is set, the client constructor does not require any additional arguments.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';

const pc = new Pinecone();
```

#### Using a configuration object

If you prefer to pass configuration in code, the constructor accepts a config object containing the `apiKey` value.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';

const pc = new Pinecone({
  apiKey: 'your_api_key',
});
```

## Indexes

### Create Index

#### Create a serverless index with minimal configuration

At a minimum, to create a serverless index you must specify a `name`, `dimension`, and `spec`. The `dimension` indicates the size of the records you intend to store in the index. For example, if your intention was to store and query embeddings generated with OpenAI's [textembedding-ada-002](https://platform.openai.com/docs/guides/embeddings/second-generation-models) model, you would need to create an index with dimension `1536` to match the output of that model.

The `spec` configures how the index should be deployed. For serverless indexes, you define only the cloud and region where the index should be hosted. For pod-based indexes, you define the environment where the index should be hosted, the pod type and size to use, and other index characteristics. For more information on serverless and regional availability, see [Understanding indexes](https://docs.pinecone.io/guides/indexes/understanding-indexes#serverless-indexes).

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();

await pc.createIndex({
  name: 'sample-index',
  dimension: 1536,
  spec: {
    serverless: {
      cloud: 'aws',
      region: 'us-west-2',
    },
  },
});
```

#### Create a pod-based index with optional configurations

To create a pod-based index, you define `pod` in the `spec` object which contains the `environment` where the index should be hosted, and the `podType` and `pods` size to use. Many optional configuration fields allow greater control over hardware resources and availability. To learn more about the purpose of these fields, see [Understanding indexes](https://docs.pinecone.io/guides/indexes/understanding-indexes) and [Scale pod-based indexes](https://docs.pinecone.io/guides/indexes/scale-pod-based-indexes).

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();

await pc.createIndex({
  name: 'sample-index-2',
  dimension: 1536,
  metric: 'dotproduct',
  spec: {
    pod: {
      environment: 'us-east4-gcp',
      pods: 2,
      podType: 'p1.x2',
      metadataConfig: {
        indexed: ['product_type'],
      },
    },
  },

  // This option tells the client not to throw if the index already exists.
  suppressConflicts: true,

  // This option tells the client not to resolve the promise until the
  // index is ready.
  waitUntilReady: true,
});
```

#### Checking the status of a newly created index

The `createIndex` method issues a create request to the API that returns quickly, but the resulting index is
not immediately ready for upserting, querying, or performing other data operations. You can use the
`describeIndex` method to find out the status of an index and see whether it is ready for use.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();

await pc.describeIndex('serverless-index');
// {
//    name: 'serverless-index',
//    dimension: 1536,
//    metric: 'cosine',
//    host: 'serverless-index-4zo0ijk.svc.us-west2-aws.pinecone.io',
//    deletionProtection: 'disabled',
//    spec: {
//       serverless: {
//          cloud: 'aws',
//          region: 'us-west-2'
//       }
//    },
//    status: {
//       ready: false,
//       state: 'Initializing'
//    }
// }
```

#### Waiting until the index is ready

If you pass the `waitUntilReady` option, the client will handle polling for status updates on a newly created index. The promise returned by `createIndex` will not be resolved until the index status indicates it is ready to handle data operations. This can be especially useful for integration testing, where index creation in a setup step will be immediately followed by data operations.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();

await pc.createIndex({
  name: 'serverless-index',
  dimension: 1536,
  spec: {
    serverless: {
      cloud: 'aws',
      region: 'us-west-2',
    },
  },
  waitUntilReady: true,
});
```

#### Create a pod-based index from a Pinecone collection

> ℹ️ **Note**
>
> Serverless and starter indexes do not support collections.

As you use Pinecone for more things, you may wish to explore different index configurations with the same vector data. [Collections](https://docs.pinecone.io/guides/indexes/understanding-collections) provide an easy way to do this. See other client methods for working with collections [here](https://github.com/pinecone-io/pinecone-ts-client#collections).

Given that you have an existing collection:

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();

await pc.describeCollection('product-description-embeddings');
// {
//   name: 'product-description-embeddings',
//   size: 543427063,
//   status: 'Ready',
//   dimension: 2,
//   vectorCount: 10001498,
//   environment: 'us-east4-gcp'
// }
```

**Note:** For pod-based indexes, you can specify a `sourceCollection` from which to create an index. The
collection must be in the same environment as the index.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();

await pc.createIndex({
  name: 'product-description-p1x1',
  dimension: 256,
  metric: 'cosine',
  spec: {
    pod: {
      environment: 'us-east4-gcp',
      pods: 1,
      podType: 'p1.x1',
      sourceCollection: 'product-description-embeddings',
    },
  },
});
```

When the new index is ready, it should contain all the data that was in the collection, ready to be queried.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();

await pc.index('product-description-p2x2').describeIndexStats();
// {
//   namespaces: { '': { recordCount: 78000 } },
//   dimension: 256,
//   indexFullness: 0.9,
//   totalRecordCount: 78000
// }
```

#### Create or configure an index with deletion protection

You can configure both serverless and pod indexes with `deletionProtection`. Any index with this property set to `'enabled'` will be unable to be deleted. By default, `deletionProtection` will be set to `'disabled'` if not provided as a part of the `createIndex` request. To enable `deletionProtection` you can pass the value while calling `createIndex`.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();

await pc.createIndex({
  name: 'deletion-protected-index',
  dimension: 1536,
  metric: 'cosine',
  deletionProtection: 'enabled',
  spec: {
    serverless: {
      cloud: 'aws',
      region: 'us-west-2',
    },
  },
});
```

To disable deletion protection, you can use the `configureIndex` operation.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();

await pc.configureIndex('deletion-protected-index', {
  deletionProtection: 'disabled',
});
```

### Describe Index

You can fetch the description of any index by name using `describeIndex`.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();

await pc.describeIndex('serverless-index');
// {
//    name: 'serverless-index',
//    dimension: 1536,
//    metric: 'cosine',
//    host: 'serverless-index-4zo0ijk.svc.us-west2-aws.pinecone.io',
//    deletionProtection: 'disabled',
//    spec: {
//       serverless: {
//          cloud: 'aws',
//          region: 'us-west-2'
//       },
//    },
//    status: {
//       ready: true,
//       state: 'Ready'
//    }
// }
```

### Configure pod-based indexes

> ℹ️ **Note**
>
> This section applies to [pod-based indexes](https://docs.pinecone.io/guides/indexes/understanding-indexes#pod-based-indexes) only. With serverless indexes, you don't configure any compute or storage resources. Instead, serverless indexes scale automatically based on usage.

You can adjust the number of replicas or scale to a larger pod size (specified with `podType`). See [Scale pod-based indexes](https://docs.pinecone.io/guides/indexes/scale-pod-based-indexes). You cannot downgrade pod size or change the base pod type.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();
await pc.configureIndex('pod-index', {
  spec: {
    pod: {
      replicas: 2,
      podType: 'p1.x4',
    },
  },
});
const config = await pc.describeIndex('pod-index');
// {
//    name: 'pod-index',
//    dimension: 1536,
//    metric: 'cosine',
//    host: 'pod-index-4zo0ijk.svc.us-east1-gcp.pinecone.io',
//    deletionProtection: 'disabled',
//    spec: {
//       pod: {
//         environment: 'us-east1-gcp',
//         replicas: 2,
//         shards: 2,
//         podType: 'p1.x4',
//         pods: 4,
//         metadataConfig: [Object],
//         sourceCollection: undefined
//       }
//    },
//    status: {
//       ready: true,
//       state: 'ScalingUpPodSize'
//    }
// }
```

### Delete Index

Indexes are deleted by name.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();

await pc.deleteIndex('sample-index');
```

### List Indexes

The `listIndexes` command returns an object with an array of index models under `indexes`.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();

await pc.listIndexes();
// {
//   indexes: [
//     {
//       name: 'serverless-index',
//       dimension: 1536,
//       metric: 'cosine',
//       host: 'serverless-index-4zo0ijk.svc.us-west2-aws.pinecone.io',
//       deletionProtection: 'disabled',
//       spec: {
//         serverless: {
//           cloud: 'aws',
//           region: 'us-west-2',
//         },
//       },
//       status: {
//         ready: true,
//         state: 'Ready',
//       },
//     },
//     {
//       name: 'pod-index',
//       dimension: 1536,
//       metric: 'cosine',
//       host: 'pod-index-4zo0ijk.svc.us-west2-aws.pinecone.io',
//       deletionProtection: 'disabled',
//       spec: {
//         pod: {
//           environment: 'us-west2-aws',
//           replicas: 1,
//           shards: 1,
//           podType: 'p1.x1',
//           pods: 1,
//         },
//       },
//       status: {
//         ready: true,
//         state: 'Ready',
//       },
//     },
//   ],
// }
```

## Collections

> ℹ️ **Note**
>
> Serverless and starter indexes do not support collections.

A collection is a static copy of a pod-based index that may be used to create backups, to create copies of indexes, or to perform experiments with different index configurations. To learn more about Pinecone collections, see [Understanding collections](https://docs.pinecone.io/guides/indexes/understanding-collections).

### Create Collection

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();

await pc.createCollection({
  name: 'collection-name',
  source: 'index-name',
});
```

This API call should return quickly, but the creation of a collection can take from minutes to hours depending on the size of the source index and the index's configuration. Use `describeCollection` to check the status of a collection.

### Delete Collection

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();

await pc.deleteCollection('collection-name');
```

You can use `listCollections` to confirm the deletion.

### Describe Collection

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();

const describeCollection = await pc.describeCollection('collection3');
// {
//   name: 'collection3',
//   size: 3126700,
//   status: 'Ready',
//   dimension: 3,
//   vectorCount: 1234,
//   environment: 'us-east1-gcp',
// }
```

### List Collections

The `listCollections` command returns an object with an array of collection models under `collections`.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();

const list = await pc.listCollections();
// {
//   collections: [
//     {
//       name: 'collection1',
//       size: 3089687,
//       status: 'Ready',
//       dimension: 3,
//       vectorCount: 17378,
//       environment: 'us-west1-gcp',
//     },
//     {
//       name: 'collection2',
//       size: 208309,
//       status: 'Ready',
//       dimension: 3,
//       vectorCount: 1000,
//       environment: 'us-east4-gcp',
//     },
//   ];
// }
```

## Index operations

Pinecone indexes support operations for working with vector data using operations such as upsert, query, fetch, and delete.

### Targeting an index

To perform data operations on an index, you target it using the `index` method.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();
const index = pc.index('test-index');

// Now perform index operations
await index.fetch(['1']);
```

The first argument is the name of the index you are targeting. There's an optional second argument for providing an
index host override. Providing this second argument allows you to bypass the SDK's default behavior of resolving
your index host via the provided index name. You can find your index host in the [Pinecone console](https://app.pinecone.io), or by using the `describeIndex` or `listIndexes` operations.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();
const index = pc.index('test-index', 'my-index-host-1532-svc.io');

// Now perform index operations against: https://my-index-host-1532-svc.io
await index.fetch(['1']);
```

### Targeting an index, with metadata typing

If you are storing metadata alongside your vector values, you can pass a type parameter to `index()` in order to get proper TypeScript typechecking.

```typescript
import { Pinecone, PineconeRecord } from '@pinecone-database/pinecone';
const pc = new Pinecone();

type MovieMetadata = {
    title: string,
    runtime: number,
    genre: 'comedy' | 'horror' | 'drama' | 'action'
}

// Specify a custom metadata type while targeting the index
const index = pc.index<MovieMetadata>('test-index');

// Now you get type errors if upserting malformed metadata
await index.upsert([{
        id: '1234',
        values: [
            .... // embedding values
    ],
    metadata: {
    genre: 'Gone with the Wind',
        runtime: 238,
        genre: 'drama',
        // @ts-expect-error because category property not in MovieMetadata
        category: 'classic'
}
}])

const results = await index.query({
    vector: [
        ... // query embedding
    ],
    filter: { genre: { '$eq': 'drama' }}
})
const movie = results.matches[0];

if (movie.metadata) {
    // Since we passed the MovieMetadata type parameter above,
    // we can interact with metadata fields without having to
    // do any typecasting.
    const { title, runtime, genre } = movie.metadata;
    console.log(`The best match in drama was ${title}`)
}
```

### Targeting a namespace

By default, all data operations take place inside the default namespace of `''`. If you are working with other non-default namespaces, you can target the namespace by chaining a call to `namespace()`.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();
const index = pc.index('test-index').namespace('ns1');

// Now perform index operations in the targeted index and namespace
await index.fetch(['1']);
```

See [Use namespaces](https://docs.pinecone.io/guides/indexes/use-namespaces) for more information.

### Upsert records

Pinecone expects records inserted into indexes to have the following form:

```typescript
type PineconeRecord = {
  id: string;
  values: Array<number>;
  sparseValues?: Array<number>;
  metadata?: object;
};
```

To upsert some records, you can use the client like so:

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();

// Target an index
const index = pc.index('sample-index');

// Prepare your data. The length of each array
// of vector values must match the dimension of
// the index where you plan to store them.
const records = [
  {
    id: '1',
    values: [0.236, 0.971, 0.559],
    sparseValues: { indices: [0, 1], values: [0.236, 0.34] }, // Optional; for hybrid search
  },
  {
    id: '2',
    values: [0.685, 0.111, 0.857],
    sparseValues: { indices: [0, 1], values: [0.345, 0.98] }, // Optional; for hybrid search
  },
];

// Upsert the data into your index
await index.upsert(records);
```

### Seeing index statistics

When experimenting with data operations, it's sometimes helpful to know how many records are stored in each namespace. In that case,
target the index and use the `describeIndexStats()` command.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();
const index = pc.index('example-index');

await index.describeIndexStats();
// {
//   namespaces: {
//     '': { recordCount: 10 }
//     foo: { recordCount: 2000 },
//     bar: { recordCount: 2000 }
//   },
//   dimension: 1536,
//   indexFullness: 0,
//   totalRecordCount: 4010
// }
```

### Querying

#### Querying with vector values

The query method accepts a large number of options. The dimension of the query vector must match the dimension of your index.

```typescript
type QueryOptions = {
  topK: number; // number of results desired
  vector?: Array<number>; // must match dimension of index
  sparseVector?: {
    indices: Array<integer>; // indices must fall within index dimension
    values: Array<number>; // indices and values arrays must have same length
  };
  id?: string;
  includeMetadata: boolean;
  includeValues: boolean;
};
```

For example, to query by vector values you would pass the `vector` param in the options configuration. For brevity sake this example query vector is tiny (dimension 2), but in a more realistic use case this query vector would be an embedding outputted by a model. Look at the [Example code](#example-code) to see more realistic examples of how to use `query`.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();
const index = pc.index('my-index');

await index.query({ topK: 3, vector: [0.22, 0.66] });
// {
//   matches: [
//     {
//       id: '556',
//       score: 1.00000012,
//       values: [],
//       sparseValues: undefined,
//       metadata: undefined
//     },
//     {
//       id: '137',
//       score: 1.00000012,
//       values: [],
//       sparseValues: undefined,
//       metadata: undefined
//     },
//     {
//       id: '129',
//       score: 1.00000012,
//       values: [],
//       sparseValues: undefined,
//       metadata: undefined
//     }
//   ],
//   namespace: '',
//   usage: {
//     readUnits: 5
//   }
// }
```

You include options to `includeMetadata: true` or `includeValues: true` if you need this information. By default,
these are not returned to keep the response payload small.

Remember that data operations take place within the context of a `namespace`, so if you are working with namespaces and do not see expected results you should check that you are targeting the correct namespace with your query.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();

// Target the index and namespace
const index = pc.index('my-index').namespace('my-namespace');

const results = await index.query({ topK: 3, vector: [0.22, 0.66] });
```

#### Querying by record id

You can query using the vector values of an existing record in the index by passing a record id.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();
const index = pc.index('my-index');

const results = await index.query({ topK: 10, id: '1' });
```

#### Hybrid search with sparseVector

If you are working with [sparse-dense vectors](https://docs.pinecone.io/guides/data/understanding-hybrid-search#sparse-dense-workflow), you can add sparse vector values to perform a hybrid search.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();

await pc.createIndex({
    name: 'hyrbid-image-search',
    metric: 'dotproduct',
    dimension: 512,
    spec: {
        pod: {
            environment: 'us-west4-gcp',
            pods: 1,
            podType: 's1.x1',
        }
    },
    waitUntilReady: true
});
const index = pc.index('hybrid-image-search');

// Create some vector embeddings using your model of choice.
const records = [...]

// Upsert data
await index.upsert(records)

// Prepare query values. In a more realistic example, these would both come out of a model.
const vector = [
    // The dimension of this index needs to match the index dimension.
    // Pretend this is a 512 dimension vector.
]
const sparseVector = {
    indices: [23, 399, 251, 17],
    values: [ 0.221, 0.967, 0.016, 0.572]
}

// Execute the query
const results = await index.query({ topK: 10, vector, sparseVector, includeMetadata: true })
```

### Update a record

You may want to update vector `values`, `sparseValues`, or `metadata`. Specify the id and the attribute value you want to update.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();
const index = pc.index('imdb-movies');

await index.update({
  id: '18593',
  metadata: { genre: 'romance' },
});
```

### List records

The `listPaginated` method can be used to list record ids matching a particular id prefix in a paginated format. With clever assignment
of record ids, this can be used to help model hierarchical relationships between different records such as when there are embeddings for multiple chunks or fragments related to the same document.

```typescript
const pc = new Pinecone();
const index = pc.index('my-index').namespace('my-namespace');
const results = await index.listPaginated({ prefix: 'doc1#' });
console.log(results);
// {
//   vectors: [
//     { id: 'doc1#01' }, { id: 'doc1#02' }, { id: 'doc1#03' },
//     { id: 'doc1#04' }, { id: 'doc1#05' },  { id: 'doc1#06' },
//     { id: 'doc1#07' }, { id: 'doc1#08' }, { id: 'doc1#09' },
//     ...
//   ],
//   pagination: {
//     next: 'eyJza2lwX3Bhc3QiOiJwcmVUZXN0LS04MCIsInByZWZpeCI6InByZVRlc3QifQ=='
//   },
//   namespace: 'my-namespace',
//   usage: { readUnits: 1 }
// }

// Fetch the next page of results
await index.listPaginated({
  prefix: 'doc1#',
  paginationToken: results.pagination?.next,
});
```

### Fetch records by their IDs

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();
const index = pc.index('my-index');

const fetchResult = await index.fetch(['id-1', 'id-2']);
```

### Delete records

For convenience there are several delete-related methods. You can verify the results of a delete operation by trying to `fetch()` a record or looking at the index summary with `describeIndexStats()`

#### Delete one

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();
const index = pc.index('my-index');

await index.deleteOne('id-to-delete');
```

#### Delete many by id

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();
const index = pc.index('my-index');

await index.deleteMany(['id-1', 'id-2', 'id-3']);
```

### Delete many by metadata filter

**Note:** deletion by metadata filter only applies to pod-based indexes.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();
const index = pc.index('albums-database');

await index.deleteMany({ genre: 'rock' });
```

#### Delete all records in a namespace

> ℹ️ **NOTE**
>
> Indexes in the [gcp-starter environment](https://docs.pinecone.io/guides/indexes/convert-a-gcp-starter-index-to-serverless) do not support namespaces.

To nuke everything in the targeted namespace, use the `deleteAll` method.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
const pc = new Pinecone();
const index = pc.index('my-index');

await index.namespace('foo-namespace').deleteAll();
```

If you do not specify a namespace, the records in the default namespace `''` will be deleted.

## Inference

Interact with Pinecone's Inference API (currently in public preview). The Pinecone Inference API is a service that gives
you access to embedding models hosted on Pinecone's infrastructure. Read more at [Understanding Pinecone Inference](https://docs.pinecone.io/guides/inference/understanding-inference).

**Notes:**

Models currently supported:

- [multilingual-e5-large](https://arxiv.org/pdf/2402.05672)

## Create embeddings

Send text to Pinecone's Inference API to generate embeddings for documents and queries.

```typescript
import { Pinecone } from '@pinecone-database/pinecone';

const client = new Pinecone({ apiKey: '<Your API key from app.pinecone.io>' });

const embeddingModel = 'multilingual-e5-large';

const documents = [
  'Turkey is a classic meat to eat at American Thanksgiving.',
  'Many people enjoy the beautiful mosques in Turkey.',
];
const docParameters = {
  inputType: 'passage',
  truncate: 'END',
};
async function generateDocEmbeddings() {
  try {
    return await client.inference.embed(
      embeddingModel,
      documents,
      docParameters
    );
  } catch (error) {
    console.error('Error generating embeddings:', error);
  }
}
generateDocEmbeddings().then((embeddingsResponse) => {
  if (embeddingsResponse) {
    console.log(embeddingsResponse);
  }
});

// << Upsert documents into Pinecone >>

const userQuery = ['How should I prepare my turkey?'];
const queryParameters = {
  inputType: 'query',
  truncate: 'END',
};
async function generateQueryEmbeddings() {
  try {
    return await client.inference.embed(
      embeddingModel,
      userQuery,
      queryParameters
    );
  } catch (error) {
    console.error('Error generating embeddings:', error);
  }
}
generateQueryEmbeddings().then((embeddingsResponse) => {
  if (embeddingsResponse) {
    console.log(embeddingsResponse);
  }
});

// << Send query to Pinecone to retrieve similar documents >>
```
