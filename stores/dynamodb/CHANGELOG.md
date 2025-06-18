# @mastra/dynamodb

## 0.11.1-alpha.0

### Patch Changes

- d8f2d19: Add updateMessages API to storage classes (only support for PG and LibSQL for now) and to memory class. Additionally allow for metadata to be saved in the content field of a message.
- Updated dependencies [d8f2d19]
- Updated dependencies [9d52b17]
- Updated dependencies [8ba1b51]
  - @mastra/core@0.10.7-alpha.0

## 0.11.0

### Minor Changes

- 704d1ca: Thread Timestamp Auto-Update Enhancement
  Added automatic thread updatedAt timestamp updates when messages are saved across all storage providers
  Enhanced user experience: Threads now accurately reflect their latest activity with automatic timestamp updates when new messages are added
  Universal implementation: Consistent behavior across all 7 storage backends (ClickHouse, Cloudflare D1, DynamoDB, MongoDB, PostgreSQL, Upstash, LibSQL)
  Performance optimized: Updates execute in parallel with message saving operations for minimal performance impact
  Backwards compatible: No breaking changes - existing code continues to work unchanged
  Improved conversation ordering: Chat interfaces can now properly sort threads by actual last activity
  This enhancement resolves the issue where active conversations appeared stale due to outdated thread timestamps, providing better conversation management and user experience in chat applications.

### Patch Changes

- 4051477: dependencies updates:
  - Updated dependency [`@aws-sdk/client-dynamodb@^3.828.0` ↗︎](https://www.npmjs.com/package/@aws-sdk/client-dynamodb/v/3.828.0) (from `^3.826.0`, in `dependencies`)
  - Updated dependency [`@aws-sdk/lib-dynamodb@^3.828.0` ↗︎](https://www.npmjs.com/package/@aws-sdk/lib-dynamodb/v/3.828.0) (from `^3.826.0`, in `dependencies`)
- fdfed6c: dependencies updates:
  - Updated dependency [`@aws-sdk/client-dynamodb@^3.828.0` ↗︎](https://www.npmjs.com/package/@aws-sdk/client-dynamodb/v/3.828.0) (from `^3.826.0`, in `dependencies`)
  - Updated dependency [`@aws-sdk/lib-dynamodb@^3.828.0` ↗︎](https://www.npmjs.com/package/@aws-sdk/lib-dynamodb/v/3.828.0) (from `^3.826.0`, in `dependencies`)
- 63f6b7d: dependencies updates:
  - Updated dependency [`@aws-sdk/client-dynamodb@^3.826.0` ↗︎](https://www.npmjs.com/package/@aws-sdk/client-dynamodb/v/3.826.0) (from `^3.823.0`, in `dependencies`)
  - Updated dependency [`@aws-sdk/lib-dynamodb@^3.826.0` ↗︎](https://www.npmjs.com/package/@aws-sdk/lib-dynamodb/v/3.826.0) (from `^3.823.0`, in `dependencies`)
  - Updated dependency [`electrodb@^3.4.3` ↗︎](https://www.npmjs.com/package/electrodb/v/3.4.3) (from `^3.4.1`, in `dependencies`)
- 6c3e021: chore(deps): update mastra dynamodb to ^1.10.0
- Updated dependencies [63f6b7d]
- Updated dependencies [12a95fc]
- Updated dependencies [4b0f8a6]
- Updated dependencies [51264a5]
- Updated dependencies [8e6f677]
- Updated dependencies [d70c420]
- Updated dependencies [ee9af57]
- Updated dependencies [36f1c36]
- Updated dependencies [2a16996]
- Updated dependencies [10d352e]
- Updated dependencies [9589624]
- Updated dependencies [53d3c37]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/core@0.10.6

## 0.11.0-alpha.4

### Patch Changes

- 6c3e021: chore(deps): update mastra dynamodb to ^1.10.0

## 0.11.0-alpha.3

### Patch Changes

- 4051477: dependencies updates:
  - Updated dependency [`@aws-sdk/client-dynamodb@^3.828.0` ↗︎](https://www.npmjs.com/package/@aws-sdk/client-dynamodb/v/3.828.0) (from `^3.826.0`, in `dependencies`)
  - Updated dependency [`@aws-sdk/lib-dynamodb@^3.828.0` ↗︎](https://www.npmjs.com/package/@aws-sdk/lib-dynamodb/v/3.828.0) (from `^3.826.0`, in `dependencies`)
- Updated dependencies [d70c420]
- Updated dependencies [2a16996]
  - @mastra/core@0.10.6-alpha.3

## 0.11.0-alpha.2

### Patch Changes

- fdfed6c: dependencies updates:
  - Updated dependency [`@aws-sdk/client-dynamodb@^3.828.0` ↗︎](https://www.npmjs.com/package/@aws-sdk/client-dynamodb/v/3.828.0) (from `^3.826.0`, in `dependencies`)
  - Updated dependency [`@aws-sdk/lib-dynamodb@^3.828.0` ↗︎](https://www.npmjs.com/package/@aws-sdk/lib-dynamodb/v/3.828.0) (from `^3.826.0`, in `dependencies`)
- Updated dependencies [4b0f8a6]
  - @mastra/core@0.10.6-alpha.2

## 0.11.0-alpha.1

### Minor Changes

- 704d1ca: Thread Timestamp Auto-Update Enhancement
  Added automatic thread updatedAt timestamp updates when messages are saved across all storage providers
  Enhanced user experience: Threads now accurately reflect their latest activity with automatic timestamp updates when new messages are added
  Universal implementation: Consistent behavior across all 7 storage backends (ClickHouse, Cloudflare D1, DynamoDB, MongoDB, PostgreSQL, Upstash, LibSQL)
  Performance optimized: Updates execute in parallel with message saving operations for minimal performance impact
  Backwards compatible: No breaking changes - existing code continues to work unchanged
  Improved conversation ordering: Chat interfaces can now properly sort threads by actual last activity
  This enhancement resolves the issue where active conversations appeared stale due to outdated thread timestamps, providing better conversation management and user experience in chat applications.

## 0.10.5-alpha.0

### Patch Changes

- 63f6b7d: dependencies updates:
  - Updated dependency [`@aws-sdk/client-dynamodb@^3.826.0` ↗︎](https://www.npmjs.com/package/@aws-sdk/client-dynamodb/v/3.826.0) (from `^3.823.0`, in `dependencies`)
  - Updated dependency [`@aws-sdk/lib-dynamodb@^3.826.0` ↗︎](https://www.npmjs.com/package/@aws-sdk/lib-dynamodb/v/3.826.0) (from `^3.823.0`, in `dependencies`)
  - Updated dependency [`electrodb@^3.4.3` ↗︎](https://www.npmjs.com/package/electrodb/v/3.4.3) (from `^3.4.1`, in `dependencies`)
- Updated dependencies [63f6b7d]
- Updated dependencies [36f1c36]
- Updated dependencies [10d352e]
- Updated dependencies [53d3c37]
  - @mastra/core@0.10.6-alpha.0

## 0.10.4

### Patch Changes

- 35c2bac: dependencies updates:
  - Updated dependency [`@aws-sdk/client-dynamodb@^3.823.0` ↗︎](https://www.npmjs.com/package/@aws-sdk/client-dynamodb/v/3.823.0) (from `^3.0.0`, in `dependencies`)
  - Updated dependency [`@aws-sdk/lib-dynamodb@^3.823.0` ↗︎](https://www.npmjs.com/package/@aws-sdk/lib-dynamodb/v/3.823.0) (from `^3.0.0`, in `dependencies`)
- dffb67b: updated stores to add alter table and change tests
- 925ab94: added paginated functions to base class and added boilerplate and updated imports
- 66f4424: Update peerdeps
- c218b1c: fix(dynamodb): use upsert instead of create for persistWorkflowSnapshot
- Updated dependencies [d1ed912]
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [f1f1f1b]
- Updated dependencies [925ab94]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [f1309d3]
- Updated dependencies [14a2566]
- Updated dependencies [f7f8293]
- Updated dependencies [48eddb9]
  - @mastra/core@0.10.4

## 0.10.4-alpha.2

### Patch Changes

- 66f4424: Update peerdeps

## 0.10.4-alpha.1

### Patch Changes

- 925ab94: added paginated functions to base class and added boilerplate and updated imports
- c218b1c: fix(dynamodb): use upsert instead of create for persistWorkflowSnapshot
- Updated dependencies [925ab94]
  - @mastra/core@0.10.4-alpha.3

## 0.10.4-alpha.0

### Patch Changes

- 35c2bac: dependencies updates:
  - Updated dependency [`@aws-sdk/client-dynamodb@^3.823.0` ↗︎](https://www.npmjs.com/package/@aws-sdk/client-dynamodb/v/3.823.0) (from `^3.0.0`, in `dependencies`)
  - Updated dependency [`@aws-sdk/lib-dynamodb@^3.823.0` ↗︎](https://www.npmjs.com/package/@aws-sdk/lib-dynamodb/v/3.823.0) (from `^3.0.0`, in `dependencies`)
- dffb67b: updated stores to add alter table and change tests
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [f1309d3]
- Updated dependencies [f7f8293]
  - @mastra/core@0.10.4-alpha.1

## 0.10.3

### Patch Changes

- 786362a: fix(dynamodb): handle Date objects in createdAt/updatedAt fields
- Updated dependencies [2b0fc7e]
  - @mastra/core@0.10.3

## 0.10.3-alpha.0

### Patch Changes

- 786362a: fix(dynamodb): handle Date objects in createdAt/updatedAt fields
- Updated dependencies [2b0fc7e]
  - @mastra/core@0.10.3-alpha.0

## 0.10.2

### Patch Changes

- d980a1b: Fix getMessages to correctly return last n messages when `limit` is passed

## 0.10.2-alpha.0

### Patch Changes

- d980a1b: Fix getMessages to correctly return last n messages when `limit` is passed

## 0.10.1

### Patch Changes

- ee77e78: Type fixes for dynamodb and MessageList
- 05d3c89: Dynamo db type fix
- c5bf1ce: Add backwards compat code for new MessageList in storage
- f0d559f: Fix peerdeps for alpha channel
- Updated dependencies [ee77e78]
- Updated dependencies [592a2db]
- Updated dependencies [e5dc18d]
- Updated dependencies [ab5adbe]
- Updated dependencies [1e8bb40]
- Updated dependencies [1b5fc55]
- Updated dependencies [195c428]
- Updated dependencies [f73e11b]
- Updated dependencies [37643b8]
- Updated dependencies [99fd6cf]
- Updated dependencies [c5bf1ce]
- Updated dependencies [add596e]
- Updated dependencies [8dc94d8]
- Updated dependencies [ecebbeb]
- Updated dependencies [79d5145]
- Updated dependencies [12b7002]
- Updated dependencies [2901125]
  - @mastra/core@0.10.2

## 0.10.1-alpha.3

### Patch Changes

- 05d3c89: Dynamo db type fix
- Updated dependencies [37643b8]
- Updated dependencies [79d5145]
  - @mastra/core@0.10.2-alpha.8

## 0.10.1-alpha.2

### Patch Changes

- c5bf1ce: Add backwards compat code for new MessageList in storage
- Updated dependencies [c5bf1ce]
- Updated dependencies [12b7002]
  - @mastra/core@0.10.2-alpha.4

## 0.10.1-alpha.1

### Patch Changes

- f0d559f: Fix peerdeps for alpha channel
- Updated dependencies [1e8bb40]
  - @mastra/core@0.10.2-alpha.2

## 0.10.1-alpha.0

### Patch Changes

- ee77e78: Type fixes for dynamodb and MessageList
- Updated dependencies [ee77e78]
- Updated dependencies [2901125]
  - @mastra/core@0.10.2-alpha.1

## 0.10.0

### Patch Changes

- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- d2d4fe4: Add a DynamoDB storage connector using a single-table design pattern with ElectroDB.

  Features:

  - Efficient single-table design for all Mastra storage needs
  - Based on ElectroDB for type-safe DynamoDB access
  - Support for AWS credentials, regions, and endpoints
  - Compatible with AWS DynamoDB Local for development
  - Thread, Message, Trace, Eval, and Workflow operations
  - Useful for serverless environments

- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [f53a6ac]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [b2ae5aa]
- Updated dependencies [23f258c]
- Updated dependencies [a7292b0]
- Updated dependencies [0dcb9f0]
- Updated dependencies [2672a05]
  - @mastra/core@0.10.0

## 0.0.2-alpha.0

### Patch Changes

- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- d2d4fe4: Add a DynamoDB storage connector using a single-table design pattern with ElectroDB.

  Features:

  - Efficient single-table design for all Mastra storage needs
  - Based on ElectroDB for type-safe DynamoDB access
  - Support for AWS credentials, regions, and endpoints
  - Compatible with AWS DynamoDB Local for development
  - Thread, Message, Trace, Eval, and Workflow operations
  - Useful for serverless environments

- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [b2ae5aa]
- Updated dependencies [a7292b0]
- Updated dependencies [0dcb9f0]
  - @mastra/core@0.10.0-alpha.1
