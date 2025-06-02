# @mastra/dynamodb

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
