# @mastra/mssql

## 0.3.0-alpha.1

### Patch Changes

- 2871020: update safelyParseJSON to check for value of param when handling parse
- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- Updated dependencies [cb36de0]
- Updated dependencies [a82b851]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [4a406ec]
- Updated dependencies [5d377e5]
  - @mastra/core@0.13.0-alpha.2

## 0.3.0-alpha.0

### Minor Changes

- 8c5a2b0: feat(mssql): implement comprehensive scoring system, enhance storage operations & format storage into domains
  - Add full CRUD operations for scoring system (getScoreById, saveScore, getScoresByScorerId, etc.)
  - Implement message deletion functionality with thread timestamp updates
  - Enhance thread management with sorting options and improved pagination
  - Add batch trace insertion for improved performance
  - Implement proper storage domain initialization with all operation bindings
  - Enhance message parsing and formatting with better v1/v2 support
  - Improve table operations with better foreign key handling
  - Add float data type support in schema creation
  - Enhance timestamp handling with proper SQL DateTime2 usage
  - Update core dependency to latest version
  - Format storage into domains and separate these into different files

  BREAKING CHANGE: deleteMessages support is now enabled (was previously false)

### Patch Changes

- Updated dependencies [ea0c5f2]
- Updated dependencies [b0e43c1]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/core@0.13.0-alpha.1

## 0.2.3

### Patch Changes

- 4230a13: dependencies updates:
  - Updated dependency [`mssql@^10.0.4` ↗︎](https://www.npmjs.com/package/mssql/v/10.0.4) (from `^10.0.0`, in `dependencies`)
- f42c4c2: update peer deps for packages to latest core range
- Updated dependencies [510e2c8]
- Updated dependencies [2f72fb2]
- Updated dependencies [27cc97a]
- Updated dependencies [3f89307]
- Updated dependencies [9eda7d4]
- Updated dependencies [9d49408]
- Updated dependencies [41daa63]
- Updated dependencies [ad0a58b]
- Updated dependencies [254a36b]
- Updated dependencies [2ecf658]
- Updated dependencies [7a7754f]
- Updated dependencies [fc92d80]
- Updated dependencies [e0f73c6]
- Updated dependencies [0b89602]
- Updated dependencies [4d37822]
- Updated dependencies [23a6a7c]
- Updated dependencies [cda801d]
- Updated dependencies [a77c823]
- Updated dependencies [ff9c125]
- Updated dependencies [09bca64]
- Updated dependencies [b8efbb9]
- Updated dependencies [71466e7]
- Updated dependencies [0c99fbe]
  - @mastra/core@0.12.0

## 0.2.3-alpha.1

### Patch Changes

- f42c4c2: update peer deps for packages to latest core range
  - @mastra/core@0.12.0-alpha.5

## 0.2.3-alpha.0

### Patch Changes

- 4230a13: dependencies updates:
  - Updated dependency [`mssql@^10.0.4` ↗︎](https://www.npmjs.com/package/mssql/v/10.0.4) (from `^10.0.0`, in `dependencies`)
- Updated dependencies [27cc97a]
- Updated dependencies [41daa63]
- Updated dependencies [254a36b]
- Updated dependencies [0b89602]
- Updated dependencies [4d37822]
- Updated dependencies [ff9c125]
- Updated dependencies [b8efbb9]
- Updated dependencies [71466e7]
- Updated dependencies [0c99fbe]
  - @mastra/core@0.12.0-alpha.2

## 0.2.2

### Patch Changes

- ce088f5: Update all peerdeps to latest core
  - @mastra/core@0.11.1

## 0.2.1

### Patch Changes

- 7ba91fa: Throw mastra errors methods not implemented yet
- 03745fa: mssql provider
- Updated dependencies [f248d53]
- Updated dependencies [2affc57]
- Updated dependencies [66e13e3]
- Updated dependencies [edd9482]
- Updated dependencies [18344d7]
- Updated dependencies [9d372c2]
- Updated dependencies [40c2525]
- Updated dependencies [e473f27]
- Updated dependencies [032cb66]
- Updated dependencies [703ac71]
- Updated dependencies [a723d69]
- Updated dependencies [7827943]
- Updated dependencies [5889a31]
- Updated dependencies [bf1e7e7]
- Updated dependencies [65e3395]
- Updated dependencies [4933192]
- Updated dependencies [d1c77a4]
- Updated dependencies [bea9dd1]
- Updated dependencies [dcd4802]
- Updated dependencies [cbddd18]
- Updated dependencies [7ba91fa]
  - @mastra/core@0.11.0

## 0.2.1-alpha.1

### Patch Changes

- 7ba91fa: Throw mastra errors methods not implemented yet
- Updated dependencies [f248d53]
- Updated dependencies [2affc57]
- Updated dependencies [66e13e3]
- Updated dependencies [edd9482]
- Updated dependencies [18344d7]
- Updated dependencies [9d372c2]
- Updated dependencies [40c2525]
- Updated dependencies [e473f27]
- Updated dependencies [032cb66]
- Updated dependencies [703ac71]
- Updated dependencies [a723d69]
- Updated dependencies [5889a31]
- Updated dependencies [65e3395]
- Updated dependencies [4933192]
- Updated dependencies [d1c77a4]
- Updated dependencies [bea9dd1]
- Updated dependencies [dcd4802]
- Updated dependencies [7ba91fa]
  - @mastra/core@0.11.0-alpha.2

## 0.2.1-alpha.0

### Patch Changes

- 03745fa: mssql provider
- Updated dependencies [7827943]
- Updated dependencies [bf1e7e7]
- Updated dependencies [cbddd18]
  - @mastra/core@0.11.0-alpha.0

## 0.1.0

- Initial implementation
