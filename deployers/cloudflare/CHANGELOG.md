# @mastra/deployer-cloudflare

## 0.11.4-alpha.0

### Patch Changes

- Updated dependencies [94f4812]
- Updated dependencies [e202b82]
- Updated dependencies [e00f6a0]
  - @mastra/core@0.12.2-alpha.0
  - @mastra/deployer@0.12.2-alpha.0

## 0.11.3

### Patch Changes

- Updated dependencies [33dcb07]
- Updated dependencies [d0d9500]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [07fe7a2]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1
  - @mastra/deployer@0.12.1

## 0.11.3-alpha.0

### Patch Changes

- Updated dependencies [33dcb07]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [07fe7a2]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1-alpha.0
  - @mastra/deployer@0.12.1-alpha.0

## 0.11.2

### Patch Changes

- 832691b: dependencies updates:
  - Updated dependency [`@babel/core@^7.28.0` ↗︎](https://www.npmjs.com/package/@babel/core/v/7.28.0) (from `^7.27.7`, in `dependencies`)
- 9881232: dependencies updates:
  - Updated dependency [`cloudflare@^4.5.0` ↗︎](https://www.npmjs.com/package/cloudflare/v/4.5.0) (from `^4.4.1`, in `dependencies`)
- bc6b44a: Extract tools import from `createHonoServer`; the function now receives tools via a prop on the `options` parameter.
- f42c4c2: update peer deps for packages to latest core range
- Updated dependencies [510e2c8]
- Updated dependencies [2f72fb2]
- Updated dependencies [27cc97a]
- Updated dependencies [832691b]
- Updated dependencies [557bb9d]
- Updated dependencies [27cc97a]
- Updated dependencies [3f89307]
- Updated dependencies [9eda7d4]
- Updated dependencies [9d49408]
- Updated dependencies [bc6b44a]
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
- Updated dependencies [9802f42]
- Updated dependencies [d5cc460]
- Updated dependencies [f42c4c2]
- Updated dependencies [b8efbb9]
- Updated dependencies [71466e7]
- Updated dependencies [0c99fbe]
  - @mastra/core@0.12.0
  - @mastra/deployer@0.12.0

## 0.11.2-alpha.2

### Patch Changes

- f42c4c2: update peer deps for packages to latest core range
- Updated dependencies [f42c4c2]
  - @mastra/deployer@0.12.0-alpha.5
  - @mastra/core@0.12.0-alpha.5

## 0.11.2-alpha.1

### Patch Changes

- 9881232: dependencies updates:
  - Updated dependency [`cloudflare@^4.5.0` ↗︎](https://www.npmjs.com/package/cloudflare/v/4.5.0) (from `^4.4.1`, in `dependencies`)
- Updated dependencies [27cc97a]
- Updated dependencies [27cc97a]
- Updated dependencies [41daa63]
- Updated dependencies [254a36b]
- Updated dependencies [0b89602]
- Updated dependencies [4d37822]
- Updated dependencies [ff9c125]
- Updated dependencies [d5cc460]
- Updated dependencies [b8efbb9]
- Updated dependencies [71466e7]
- Updated dependencies [0c99fbe]
  - @mastra/core@0.12.0-alpha.2
  - @mastra/deployer@0.12.0-alpha.2

## 0.11.2-alpha.0

### Patch Changes

- 832691b: dependencies updates:
  - Updated dependency [`@babel/core@^7.28.0` ↗︎](https://www.npmjs.com/package/@babel/core/v/7.28.0) (from `^7.27.7`, in `dependencies`)
- bc6b44a: Extract tools import from `createHonoServer`; the function now receives tools via a prop on the `options` parameter.
- Updated dependencies [510e2c8]
- Updated dependencies [2f72fb2]
- Updated dependencies [832691b]
- Updated dependencies [557bb9d]
- Updated dependencies [3f89307]
- Updated dependencies [9eda7d4]
- Updated dependencies [9d49408]
- Updated dependencies [bc6b44a]
- Updated dependencies [2ecf658]
- Updated dependencies [7a7754f]
- Updated dependencies [fc92d80]
- Updated dependencies [23a6a7c]
- Updated dependencies [09bca64]
  - @mastra/core@0.12.0-alpha.0
  - @mastra/deployer@0.12.0-alpha.0

## 0.11.1

### Patch Changes

- 1a45f3a: Fix peerdeps

## 0.11.0

### Minor Changes

- d83392d: Remove scope, auth, and cloudflare client from CloudflareDeployer

  BREAKING CHANGES:
  - Remove `scope` property and constructor parameter
  - Remove `auth` parameter from constructor
  - Remove private `cloudflare` client property and initialization
  - Update `tagWorker` method to throw error directing users to Cloudflare dashboard
  - Remove unused Cloudflare import

  This simplifies the CloudflareDeployer API by removing external dependencies and authentication requirements. Users should now use the Cloudflare dashboard or API directly for operations that previously required the cloudflare client.

### Patch Changes

- 7983e53: Revert cloudflare omit install deps step
- Updated dependencies [f248d53]
- Updated dependencies [82c6860]
- Updated dependencies [2affc57]
- Updated dependencies [66e13e3]
- Updated dependencies [edd9482]
- Updated dependencies [0938991]
- Updated dependencies [18344d7]
- Updated dependencies [7ba91fa]
- Updated dependencies [a512ede]
- Updated dependencies [35b1155]
- Updated dependencies [9d372c2]
- Updated dependencies [45469c5]
- Updated dependencies [40c2525]
- Updated dependencies [e473f27]
- Updated dependencies [032cb66]
- Updated dependencies [6f50efd]
- Updated dependencies [24eb25c]
- Updated dependencies [bf6903e]
- Updated dependencies [703ac71]
- Updated dependencies [a723d69]
- Updated dependencies [7827943]
- Updated dependencies [4c06f06]
- Updated dependencies [5889a31]
- Updated dependencies [bf1e7e7]
- Updated dependencies [65e3395]
- Updated dependencies [9de6f58]
- Updated dependencies [4933192]
- Updated dependencies [d1c77a4]
- Updated dependencies [bea9dd1]
- Updated dependencies [7983e53]
- Updated dependencies [dcd4802]
- Updated dependencies [cbddd18]
- Updated dependencies [7ba91fa]
- Updated dependencies [15ce274]
  - @mastra/core@0.11.0
  - @mastra/deployer@0.11.0

## 0.11.0-alpha.2

### Minor Changes

- d83392d: Remove scope, auth, and cloudflare client from CloudflareDeployer

  BREAKING CHANGES:
  - Remove `scope` property and constructor parameter
  - Remove `auth` parameter from constructor
  - Remove private `cloudflare` client property and initialization
  - Update `tagWorker` method to throw error directing users to Cloudflare dashboard
  - Remove unused Cloudflare import

  This simplifies the CloudflareDeployer API by removing external dependencies and authentication requirements. Users should now use the Cloudflare dashboard or API directly for operations that previously required the cloudflare client.

### Patch Changes

- Updated dependencies [f248d53]
- Updated dependencies [82c6860]
- Updated dependencies [2affc57]
- Updated dependencies [66e13e3]
- Updated dependencies [edd9482]
- Updated dependencies [18344d7]
- Updated dependencies [7ba91fa]
- Updated dependencies [a512ede]
- Updated dependencies [35b1155]
- Updated dependencies [9d372c2]
- Updated dependencies [45469c5]
- Updated dependencies [40c2525]
- Updated dependencies [e473f27]
- Updated dependencies [032cb66]
- Updated dependencies [24eb25c]
- Updated dependencies [703ac71]
- Updated dependencies [a723d69]
- Updated dependencies [4c06f06]
- Updated dependencies [5889a31]
- Updated dependencies [65e3395]
- Updated dependencies [9de6f58]
- Updated dependencies [4933192]
- Updated dependencies [d1c77a4]
- Updated dependencies [bea9dd1]
- Updated dependencies [dcd4802]
- Updated dependencies [7ba91fa]
- Updated dependencies [15ce274]
  - @mastra/core@0.11.0-alpha.2
  - @mastra/deployer@0.11.0-alpha.2

## 0.10.16-alpha.1

### Patch Changes

- 7983e53: Revert cloudflare omit install deps step
- Updated dependencies [7983e53]
  - @mastra/deployer@0.11.0-alpha.1
  - @mastra/core@0.11.0-alpha.1

## 0.10.16-alpha.0

### Patch Changes

- Updated dependencies [0938991]
- Updated dependencies [6f50efd]
- Updated dependencies [bf6903e]
- Updated dependencies [7827943]
- Updated dependencies [bf1e7e7]
- Updated dependencies [cbddd18]
  - @mastra/deployer@0.11.0-alpha.0
  - @mastra/core@0.11.0-alpha.0

## 0.10.15

### Patch Changes

- 7776324: dependencies updates:
  - Updated dependency [`rollup@^4.45.0` ↗︎](https://www.npmjs.com/package/rollup/v/4.45.0) (from `^4.44.2`, in `dependencies`)
- fe4bbd4: Turn off installDependencies for cloudflare deployer build
- Updated dependencies [7776324]
- Updated dependencies [0b56518]
- Updated dependencies [db5cc15]
- Updated dependencies [2ba5b76]
- Updated dependencies [7b57e2c]
- Updated dependencies [5237998]
- Updated dependencies [c3a30de]
- Updated dependencies [37c1acd]
- Updated dependencies [1aa60b1]
- Updated dependencies [89ec9d4]
- Updated dependencies [cf3a184]
- Updated dependencies [fe4bbd4]
- Updated dependencies [d6bfd60]
- Updated dependencies [626b0f4]
- Updated dependencies [c22a91f]
- Updated dependencies [f7403ab]
- Updated dependencies [6c89d7f]
  - @mastra/deployer@0.10.15
  - @mastra/core@0.10.15

## 0.10.15-alpha.1

### Patch Changes

- fe4bbd4: Turn off installDependencies for cloudflare deployer build
- Updated dependencies [0b56518]
- Updated dependencies [2ba5b76]
- Updated dependencies [c3a30de]
- Updated dependencies [cf3a184]
- Updated dependencies [fe4bbd4]
- Updated dependencies [d6bfd60]
  - @mastra/core@0.10.15-alpha.1
  - @mastra/deployer@0.10.15-alpha.1

## 0.10.15-alpha.0

### Patch Changes

- 7776324: dependencies updates:
  - Updated dependency [`rollup@^4.45.0` ↗︎](https://www.npmjs.com/package/rollup/v/4.45.0) (from `^4.44.2`, in `dependencies`)
- Updated dependencies [7776324]
- Updated dependencies [db5cc15]
- Updated dependencies [7b57e2c]
- Updated dependencies [5237998]
- Updated dependencies [37c1acd]
- Updated dependencies [1aa60b1]
- Updated dependencies [89ec9d4]
- Updated dependencies [626b0f4]
- Updated dependencies [c22a91f]
- Updated dependencies [f7403ab]
- Updated dependencies [6c89d7f]
  - @mastra/deployer@0.10.15-alpha.0
  - @mastra/core@0.10.15-alpha.0

## 0.10.14

### Patch Changes

- 71907f3: Pin rollup to fix breaking change
- Updated dependencies [400dbf0]
  - @mastra/deployer@0.10.14
  - @mastra/core@0.10.14

## 0.10.12

### Patch Changes

- Updated dependencies [b4a9811]
- Updated dependencies [4d5583d]
- Updated dependencies [53e3f58]
  - @mastra/core@0.10.12
  - @mastra/deployer@0.10.12

## 0.10.12-alpha.0

### Patch Changes

- Updated dependencies [b4a9811]
- Updated dependencies [53e3f58]
  - @mastra/core@0.10.12-alpha.0
  - @mastra/deployer@0.10.12-alpha.0

## 0.10.11

### Patch Changes

- bc40cdd: dependencies updates:
  - Updated dependency [`@babel/core@^7.27.7` ↗︎](https://www.npmjs.com/package/@babel/core/v/7.27.7) (from `^7.27.4`, in `dependencies`)
- d9b26b5: dependencies updates:
  - Updated dependency [`rollup@^4.44.2` ↗︎](https://www.npmjs.com/package/rollup/v/4.44.2) (from `^4.43.0`, in `dependencies`)
- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [bc40cdd]
- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [d9b26b5]
- Updated dependencies [f8ce2cc]
- Updated dependencies [8c846b6]
- Updated dependencies [c7bbf1e]
- Updated dependencies [8722d53]
- Updated dependencies [565cc0c]
- Updated dependencies [b790fd1]
- Updated dependencies [132027f]
- Updated dependencies [0c85311]
- Updated dependencies [d7ed04d]
- Updated dependencies [18ca936]
- Updated dependencies [cb16baf]
- Updated dependencies [40cd025]
- Updated dependencies [f36e4f1]
- Updated dependencies [7f6e403]
  - @mastra/core@0.10.11
  - @mastra/deployer@0.10.11

## 0.10.11-alpha.1

### Patch Changes

- d9b26b5: dependencies updates:
  - Updated dependency [`rollup@^4.44.2` ↗︎](https://www.npmjs.com/package/rollup/v/4.44.2) (from `^4.43.0`, in `dependencies`)
- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [d9b26b5]
- Updated dependencies [565cc0c]
- Updated dependencies [18ca936]
  - @mastra/core@0.10.11-alpha.2
  - @mastra/deployer@0.10.11-alpha.2

## 0.10.11-alpha.0

### Patch Changes

- bc40cdd: dependencies updates:
  - Updated dependency [`@babel/core@^7.27.7` ↗︎](https://www.npmjs.com/package/@babel/core/v/7.27.7) (from `^7.27.4`, in `dependencies`)
- Updated dependencies [bc40cdd]
- Updated dependencies [f8ce2cc]
- Updated dependencies [8c846b6]
- Updated dependencies [b790fd1]
- Updated dependencies [d7ed04d]
- Updated dependencies [f36e4f1]
  - @mastra/deployer@0.10.11-alpha.0
  - @mastra/core@0.10.11-alpha.0

## 0.10.10

### Patch Changes

- Updated dependencies [6e13b80]
- Updated dependencies [6997af1]
- Updated dependencies [4d3fbdf]
  - @mastra/deployer@0.10.10
  - @mastra/core@0.10.10

## 0.10.10-alpha.0

### Patch Changes

- Updated dependencies [6e13b80]
- Updated dependencies [4d3fbdf]
  - @mastra/deployer@0.10.10-alpha.0
  - @mastra/core@0.10.10-alpha.0

## 0.10.9

### Patch Changes

- Updated dependencies [9dda1ac]
- Updated dependencies [9dda1ac]
- Updated dependencies [c984582]
- Updated dependencies [7e801dd]
- Updated dependencies [a606c75]
- Updated dependencies [7aa70a4]
- Updated dependencies [764f86a]
- Updated dependencies [1760a1c]
- Updated dependencies [038e5ae]
- Updated dependencies [7dda16a]
- Updated dependencies [6f87544]
- Updated dependencies [5ebfcdd]
- Updated dependencies [81a1b3b]
- Updated dependencies [b2d0c91]
- Updated dependencies [4e809ad]
- Updated dependencies [57929df]
- Updated dependencies [7e801dd]
- Updated dependencies [b7852ed]
- Updated dependencies [6320a61]
  - @mastra/core@0.10.9
  - @mastra/deployer@0.10.9

## 0.10.9-alpha.0

### Patch Changes

- Updated dependencies [9dda1ac]
- Updated dependencies [9dda1ac]
- Updated dependencies [c984582]
- Updated dependencies [7e801dd]
- Updated dependencies [a606c75]
- Updated dependencies [7aa70a4]
- Updated dependencies [764f86a]
- Updated dependencies [1760a1c]
- Updated dependencies [038e5ae]
- Updated dependencies [7dda16a]
- Updated dependencies [6f87544]
- Updated dependencies [5ebfcdd]
- Updated dependencies [81a1b3b]
- Updated dependencies [b2d0c91]
- Updated dependencies [4e809ad]
- Updated dependencies [57929df]
- Updated dependencies [7e801dd]
- Updated dependencies [b7852ed]
- Updated dependencies [6320a61]
  - @mastra/core@0.10.9-alpha.0
  - @mastra/deployer@0.10.9-alpha.0

## 0.10.8

### Patch Changes

- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [a344ac7]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8
  - @mastra/deployer@0.10.8

## 0.10.8-alpha.1

### Patch Changes

- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8-alpha.1
  - @mastra/deployer@0.10.8-alpha.1

## 0.10.8-alpha.0

### Patch Changes

- Updated dependencies [a344ac7]
  - @mastra/deployer@0.10.8-alpha.0
  - @mastra/core@0.10.8-alpha.0

## 0.10.7

### Patch Changes

- 8e1b6e9: dependencies updates:
  - Updated dependency [`zod@^3.25.67` ↗︎](https://www.npmjs.com/package/zod/v/3.25.67) (from `^3.25.57`, in `dependencies`)
- 8e6b8e5: dependencies updates:
  - Updated dependency [`cloudflare@^4.4.1` ↗︎](https://www.npmjs.com/package/cloudflare/v/4.4.1) (from `^4.3.0`, in `dependencies`)
- Updated dependencies [8e1b6e9]
- Updated dependencies [36cd0f1]
- Updated dependencies [2eab82b]
- Updated dependencies [15e9d26]
- Updated dependencies [d1baedb]
- Updated dependencies [d8f2d19]
- Updated dependencies [9bf1d55]
- Updated dependencies [4d21bf2]
- Updated dependencies [914684e]
- Updated dependencies [07d6d88]
- Updated dependencies [9d52b17]
- Updated dependencies [2097952]
- Updated dependencies [792c4c0]
- Updated dependencies [5d74aab]
- Updated dependencies [5d74aab]
- Updated dependencies [17903a3]
- Updated dependencies [a8b194f]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [502fe05]
- Updated dependencies [144eb0b]
- Updated dependencies [8ba1b51]
- Updated dependencies [10a4f10]
- Updated dependencies [4efcfa0]
- Updated dependencies [0e17048]
  - @mastra/deployer@0.10.7
  - @mastra/core@0.10.7

## 0.10.7-alpha.6

### Patch Changes

- 8e6b8e5: dependencies updates:
  - Updated dependency [`cloudflare@^4.4.1` ↗︎](https://www.npmjs.com/package/cloudflare/v/4.4.1) (from `^4.3.0`, in `dependencies`)

## 0.10.7-alpha.5

### Patch Changes

- @mastra/core@0.10.7-alpha.5
- @mastra/deployer@0.10.7-alpha.5

## 0.10.7-alpha.4

### Patch Changes

- Updated dependencies [a8b194f]
  - @mastra/core@0.10.7-alpha.4
  - @mastra/deployer@0.10.7-alpha.4

## 0.10.7-alpha.3

### Patch Changes

- Updated dependencies [792c4c0]
- Updated dependencies [502fe05]
- Updated dependencies [10a4f10]
- Updated dependencies [4efcfa0]
  - @mastra/core@0.10.7-alpha.3
  - @mastra/deployer@0.10.7-alpha.3

## 0.10.7-alpha.2

### Patch Changes

- 8e1b6e9: dependencies updates:
  - Updated dependency [`zod@^3.25.67` ↗︎](https://www.npmjs.com/package/zod/v/3.25.67) (from `^3.25.57`, in `dependencies`)
- Updated dependencies [8e1b6e9]
- Updated dependencies [36cd0f1]
- Updated dependencies [2eab82b]
- Updated dependencies [15e9d26]
- Updated dependencies [9bf1d55]
- Updated dependencies [914684e]
- Updated dependencies [07d6d88]
- Updated dependencies [5d74aab]
- Updated dependencies [5d74aab]
- Updated dependencies [17903a3]
- Updated dependencies [144eb0b]
  - @mastra/deployer@0.10.7-alpha.2
  - @mastra/core@0.10.7-alpha.2

## 0.10.7-alpha.1

### Patch Changes

- Updated dependencies [d1baedb]
- Updated dependencies [4d21bf2]
- Updated dependencies [2097952]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [0e17048]
  - @mastra/core@0.10.7-alpha.1
  - @mastra/deployer@0.10.7-alpha.1

## 0.10.7-alpha.0

### Patch Changes

- Updated dependencies [d8f2d19]
- Updated dependencies [9d52b17]
- Updated dependencies [8ba1b51]
  - @mastra/core@0.10.7-alpha.0
  - @mastra/deployer@0.10.7-alpha.0

## 0.10.6

### Patch Changes

- 2d12edd: dependencies updates:
  - Updated dependency [`rollup@^4.43.0` ↗︎](https://www.npmjs.com/package/rollup/v/4.43.0) (from `^4.42.0`, in `dependencies`)
- 63f6b7d: dependencies updates:
  - Updated dependency [`rollup@^4.42.0` ↗︎](https://www.npmjs.com/package/rollup/v/4.42.0) (from `^4.41.1`, in `dependencies`)
  - Updated dependency [`zod@^3.25.57` ↗︎](https://www.npmjs.com/package/zod/v/3.25.57) (from `^3.25.56`, in `dependencies`)
  - Removed dependency [`wrangler@^4.19.1` ↗︎](https://www.npmjs.com/package/wrangler/v/4.19.1) (from `dependencies`)
- Updated dependencies [63f6b7d]
- Updated dependencies [4051477]
- Updated dependencies [2d12edd]
- Updated dependencies [63f6b7d]
- Updated dependencies [c28ed65]
- Updated dependencies [12a95fc]
- Updated dependencies [79b9909]
- Updated dependencies [4b0f8a6]
- Updated dependencies [51264a5]
- Updated dependencies [8e6f677]
- Updated dependencies [d70c420]
- Updated dependencies [ee9af57]
- Updated dependencies [ec7f824]
- Updated dependencies [36f1c36]
- Updated dependencies [084f6aa]
- Updated dependencies [2a16996]
- Updated dependencies [10d352e]
- Updated dependencies [9589624]
- Updated dependencies [3270d9d]
- Updated dependencies [53d3c37]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/core@0.10.6
  - @mastra/deployer@0.10.6

## 0.10.6-alpha.5

### Patch Changes

- Updated dependencies [12a95fc]
- Updated dependencies [51264a5]
- Updated dependencies [8e6f677]
  - @mastra/core@0.10.6-alpha.5
  - @mastra/deployer@0.10.6-alpha.5

## 0.10.6-alpha.4

### Patch Changes

- Updated dependencies [79b9909]
- Updated dependencies [084f6aa]
- Updated dependencies [9589624]
  - @mastra/deployer@0.10.6-alpha.4
  - @mastra/core@0.10.6-alpha.4

## 0.10.6-alpha.3

### Patch Changes

- Updated dependencies [4051477]
- Updated dependencies [c28ed65]
- Updated dependencies [d70c420]
- Updated dependencies [2a16996]
  - @mastra/deployer@0.10.6-alpha.3
  - @mastra/core@0.10.6-alpha.3

## 0.10.6-alpha.2

### Patch Changes

- Updated dependencies [4b0f8a6]
- Updated dependencies [ec7f824]
  - @mastra/core@0.10.6-alpha.2
  - @mastra/deployer@0.10.6-alpha.2

## 0.10.6-alpha.1

### Patch Changes

- Updated dependencies [ee9af57]
- Updated dependencies [3270d9d]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/deployer@0.10.6-alpha.1
  - @mastra/core@0.10.6-alpha.1

## 0.10.6-alpha.0

### Patch Changes

- 2d12edd: dependencies updates:
  - Updated dependency [`rollup@^4.43.0` ↗︎](https://www.npmjs.com/package/rollup/v/4.43.0) (from `^4.42.0`, in `dependencies`)
- 63f6b7d: dependencies updates:
  - Updated dependency [`rollup@^4.42.0` ↗︎](https://www.npmjs.com/package/rollup/v/4.42.0) (from `^4.41.1`, in `dependencies`)
  - Updated dependency [`zod@^3.25.57` ↗︎](https://www.npmjs.com/package/zod/v/3.25.57) (from `^3.25.56`, in `dependencies`)
  - Removed dependency [`wrangler@^4.19.1` ↗︎](https://www.npmjs.com/package/wrangler/v/4.19.1) (from `dependencies`)
- Updated dependencies [63f6b7d]
- Updated dependencies [2d12edd]
- Updated dependencies [63f6b7d]
- Updated dependencies [36f1c36]
- Updated dependencies [10d352e]
- Updated dependencies [53d3c37]
  - @mastra/core@0.10.6-alpha.0
  - @mastra/deployer@0.10.6-alpha.0

## 0.10.5

### Patch Changes

- Updated dependencies [8725d02]
- Updated dependencies [13c97f9]
- Updated dependencies [105f872]
  - @mastra/deployer@0.10.5
  - @mastra/core@0.10.5

## 0.10.4

### Patch Changes

- f595975: dependencies updates:
  - Updated dependency [`rollup@^4.41.1` ↗︎](https://www.npmjs.com/package/rollup/v/4.41.1) (from `^4.35.0`, in `dependencies`)
- d90c49f: dependencies updates:
  - Updated dependency [`@babel/core@^7.27.4` ↗︎](https://www.npmjs.com/package/@babel/core/v/7.27.4) (from `^7.26.10`, in `dependencies`)
  - Updated dependency [`cloudflare@^4.3.0` ↗︎](https://www.npmjs.com/package/cloudflare/v/4.3.0) (from `^4.1.0`, in `dependencies`)
  - Updated dependency [`wrangler@^4.19.1` ↗︎](https://www.npmjs.com/package/wrangler/v/4.19.1) (from `^4.4.0`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- Updated dependencies [d1ed912]
- Updated dependencies [d1ed912]
- Updated dependencies [f595975]
- Updated dependencies [d90c49f]
- Updated dependencies [1ccccff]
- Updated dependencies [1ccccff]
- Updated dependencies [afd9fda]
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [f1f1f1b]
- Updated dependencies [925ab94]
- Updated dependencies [9597ee5]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [69f6101]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [514fdde]
- Updated dependencies [f1309d3]
- Updated dependencies [bebd27c]
- Updated dependencies [14a2566]
- Updated dependencies [f7f8293]
- Updated dependencies [48eddb9]
  - @mastra/core@0.10.4
  - @mastra/deployer@0.10.4

## 0.10.4-alpha.3

### Patch Changes

- Updated dependencies [925ab94]
  - @mastra/core@0.10.4-alpha.3
  - @mastra/deployer@0.10.4-alpha.3

## 0.10.4-alpha.2

### Patch Changes

- Updated dependencies [48eddb9]
  - @mastra/core@0.10.4-alpha.2
  - @mastra/deployer@0.10.4-alpha.2

## 0.10.4-alpha.1

### Patch Changes

- d90c49f: dependencies updates:
  - Updated dependency [`@babel/core@^7.27.4` ↗︎](https://www.npmjs.com/package/@babel/core/v/7.27.4) (from `^7.26.10`, in `dependencies`)
  - Updated dependency [`cloudflare@^4.3.0` ↗︎](https://www.npmjs.com/package/cloudflare/v/4.3.0) (from `^4.1.0`, in `dependencies`)
  - Updated dependency [`wrangler@^4.19.1` ↗︎](https://www.npmjs.com/package/wrangler/v/4.19.1) (from `^4.4.0`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- Updated dependencies [d90c49f]
- Updated dependencies [1ccccff]
- Updated dependencies [1ccccff]
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [9597ee5]
- Updated dependencies [514fdde]
- Updated dependencies [f1309d3]
- Updated dependencies [bebd27c]
- Updated dependencies [f7f8293]
  - @mastra/deployer@0.10.4-alpha.1
  - @mastra/core@0.10.4-alpha.1

## 0.10.4-alpha.0

### Patch Changes

- f595975: dependencies updates:
  - Updated dependency [`rollup@^4.41.1` ↗︎](https://www.npmjs.com/package/rollup/v/4.41.1) (from `^4.35.0`, in `dependencies`)
- Updated dependencies [d1ed912]
- Updated dependencies [d1ed912]
- Updated dependencies [f595975]
- Updated dependencies [afd9fda]
- Updated dependencies [f1f1f1b]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [69f6101]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [14a2566]
  - @mastra/core@0.10.4-alpha.0
  - @mastra/deployer@0.10.4-alpha.0

## 0.10.3

### Patch Changes

- Updated dependencies [2b0fc7e]
  - @mastra/core@0.10.3
  - @mastra/deployer@0.10.3

## 0.10.3-alpha.0

### Patch Changes

- Updated dependencies [2b0fc7e]
  - @mastra/core@0.10.3-alpha.0
  - @mastra/deployer@0.10.3-alpha.0

## 0.10.2

### Patch Changes

- f0d559f: Fix peerdeps for alpha channel
- Updated dependencies [ee77e78]
- Updated dependencies [592a2db]
- Updated dependencies [e5dc18d]
- Updated dependencies [ab5adbe]
- Updated dependencies [e8d2aff]
- Updated dependencies [1e8bb40]
- Updated dependencies [1b5fc55]
- Updated dependencies [195c428]
- Updated dependencies [f73e11b]
- Updated dependencies [37643b8]
- Updated dependencies [99fd6cf]
- Updated dependencies [1fcc048]
- Updated dependencies [c5bf1ce]
- Updated dependencies [f946acf]
- Updated dependencies [add596e]
- Updated dependencies [8dc94d8]
- Updated dependencies [ecebbeb]
- Updated dependencies [4187ed4]
- Updated dependencies [79d5145]
- Updated dependencies [12b7002]
- Updated dependencies [f0d559f]
- Updated dependencies [2901125]
  - @mastra/core@0.10.2
  - @mastra/deployer@0.10.2

## 0.10.2-alpha.8

### Patch Changes

- Updated dependencies [37643b8]
- Updated dependencies [79d5145]
  - @mastra/core@0.10.2-alpha.8
  - @mastra/deployer@0.10.2-alpha.8

## 0.10.2-alpha.7

### Patch Changes

- @mastra/deployer@0.10.2-alpha.7
- @mastra/core@0.10.2-alpha.7

## 0.10.2-alpha.6

### Patch Changes

- Updated dependencies [99fd6cf]
- Updated dependencies [1fcc048]
- Updated dependencies [8dc94d8]
  - @mastra/core@0.10.2-alpha.6
  - @mastra/deployer@0.10.2-alpha.6

## 0.10.2-alpha.5

### Patch Changes

- Updated dependencies [1b5fc55]
- Updated dependencies [add596e]
- Updated dependencies [ecebbeb]
  - @mastra/core@0.10.2-alpha.5
  - @mastra/deployer@0.10.2-alpha.5

## 0.10.2-alpha.4

### Patch Changes

- Updated dependencies [c5bf1ce]
- Updated dependencies [12b7002]
  - @mastra/core@0.10.2-alpha.4
  - @mastra/deployer@0.10.2-alpha.4

## 0.10.2-alpha.3

### Patch Changes

- Updated dependencies [ab5adbe]
- Updated dependencies [195c428]
- Updated dependencies [f73e11b]
- Updated dependencies [f946acf]
  - @mastra/core@0.10.2-alpha.3
  - @mastra/deployer@0.10.2-alpha.3

## 0.10.2-alpha.2

### Patch Changes

- f0d559f: Fix peerdeps for alpha channel
- Updated dependencies [e8d2aff]
- Updated dependencies [1e8bb40]
- Updated dependencies [4187ed4]
- Updated dependencies [f0d559f]
  - @mastra/deployer@0.10.2-alpha.2
  - @mastra/core@0.10.2-alpha.2

## 0.10.2-alpha.1

### Patch Changes

- Updated dependencies [ee77e78]
- Updated dependencies [2901125]
  - @mastra/core@0.10.2-alpha.1
  - @mastra/deployer@0.10.2-alpha.1

## 0.10.2-alpha.0

### Patch Changes

- Updated dependencies [592a2db]
- Updated dependencies [e5dc18d]
  - @mastra/core@0.10.2-alpha.0
  - @mastra/deployer@0.10.2-alpha.0

## 0.10.1

### Patch Changes

- d70b807: Improve storage.init
- 5c41100: Added binding support for cloudflare deployers, added cloudflare kv namespace changes, and removed randomUUID from buildExecutionGraph
- Updated dependencies [d70b807]
- Updated dependencies [6d16390]
- Updated dependencies [1e4a421]
- Updated dependencies [200d0da]
- Updated dependencies [bed0916]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [38aee50]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
- Updated dependencies [fe68410]
- Updated dependencies [6015bdf]
  - @mastra/core@0.10.1
  - @mastra/deployer@0.10.1

## 0.10.1-alpha.3

### Patch Changes

- d70b807: Improve storage.init
- Updated dependencies [d70b807]
  - @mastra/core@0.10.1-alpha.3
  - @mastra/deployer@0.10.1-alpha.3

## 0.10.1-alpha.2

### Patch Changes

- Updated dependencies [fe68410]
- Updated dependencies [6015bdf]
  - @mastra/deployer@0.10.1-alpha.2
  - @mastra/core@0.10.1-alpha.2

## 0.10.1-alpha.1

### Patch Changes

- 5c41100: Added binding support for cloudflare deployers, added cloudflare kv namespace changes, and removed randomUUID from buildExecutionGraph
- Updated dependencies [200d0da]
- Updated dependencies [bed0916]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [38aee50]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
  - @mastra/core@0.10.1-alpha.1
  - @mastra/deployer@0.10.1-alpha.1

## 0.10.1-alpha.0

### Patch Changes

- Updated dependencies [6d16390]
- Updated dependencies [1e4a421]
  - @mastra/deployer@0.10.1-alpha.0
  - @mastra/core@0.10.1-alpha.0

## 0.10.0

### Minor Changes

- 83da932: Move @mastra/core to peerdeps

### Patch Changes

- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [83da932]
- Updated dependencies [f53a6ac]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [8d9feae]
- Updated dependencies [aaf0e48]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [b2ae5aa]
- Updated dependencies [48e5910]
- Updated dependencies [23f258c]
- Updated dependencies [a7292b0]
- Updated dependencies [0dcb9f0]
- Updated dependencies [2672a05]
  - @mastra/deployer@0.10.0
  - @mastra/core@0.10.0

## 0.2.0-alpha.1

### Minor Changes

- 83da932: Move @mastra/core to peerdeps

### Patch Changes

- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [83da932]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [8d9feae]
- Updated dependencies [b2ae5aa]
- Updated dependencies [a7292b0]
- Updated dependencies [0dcb9f0]
  - @mastra/deployer@0.4.0-alpha.1
  - @mastra/core@0.10.0-alpha.1

## 0.1.24-alpha.0

### Patch Changes

- Updated dependencies [f53a6ac]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [aaf0e48]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [48e5910]
- Updated dependencies [23f258c]
- Updated dependencies [2672a05]
  - @mastra/core@0.9.5-alpha.0
  - @mastra/deployer@0.3.5-alpha.0

## 0.1.23

### Patch Changes

- Updated dependencies [396be50]
- Updated dependencies [ab80e7e]
- Updated dependencies [5c70b8a]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [a5810ce]
- Updated dependencies [3e9c131]
- Updated dependencies [3171b5b]
- Updated dependencies [03c40d1]
- Updated dependencies [cb1f698]
- Updated dependencies [973e5ac]
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
- Updated dependencies [9e1eff5]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4
  - @mastra/deployer@0.3.4

## 0.1.23-alpha.4

### Patch Changes

- Updated dependencies [5c70b8a]
- Updated dependencies [3e9c131]
  - @mastra/deployer@0.3.4-alpha.4
  - @mastra/core@0.9.4-alpha.4

## 0.1.23-alpha.3

### Patch Changes

- Updated dependencies [396be50]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [a5810ce]
  - @mastra/core@0.9.4-alpha.3
  - @mastra/deployer@0.3.4-alpha.3

## 0.1.23-alpha.2

### Patch Changes

- Updated dependencies [3171b5b]
- Updated dependencies [03c40d1]
- Updated dependencies [973e5ac]
- Updated dependencies [9e1eff5]
  - @mastra/core@0.9.4-alpha.2
  - @mastra/deployer@0.3.4-alpha.2

## 0.1.23-alpha.1

### Patch Changes

- Updated dependencies [ab80e7e]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4-alpha.1
  - @mastra/deployer@0.3.4-alpha.1

## 0.1.23-alpha.0

### Patch Changes

- Updated dependencies [cb1f698]
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
  - @mastra/deployer@0.3.4-alpha.0
  - @mastra/core@0.9.4-alpha.0

## 0.1.22

### Patch Changes

- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [526c570]
- Updated dependencies [d7a6a33]
- Updated dependencies [9cd1a46]
- Updated dependencies [b5d2de0]
- Updated dependencies [644f8ad]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3
  - @mastra/deployer@0.3.3

## 0.1.22-alpha.1

### Patch Changes

- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [9cd1a46]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3-alpha.1
  - @mastra/deployer@0.3.3-alpha.1

## 0.1.22-alpha.0

### Patch Changes

- Updated dependencies [526c570]
- Updated dependencies [b5d2de0]
- Updated dependencies [644f8ad]
  - @mastra/core@0.9.3-alpha.0
  - @mastra/deployer@0.3.3-alpha.0

## 0.1.21

### Patch Changes

- 2cf3b8f: dependencies updates:
  - Updated dependency [`zod@^3.24.3` ↗︎](https://www.npmjs.com/package/zod/v/3.24.3) (from `^3.24.2`, in `dependencies`)
- 8607972: Introduce Mastra lint cli command
- Updated dependencies [2cf3b8f]
- Updated dependencies [6052aa6]
- Updated dependencies [967b41c]
- Updated dependencies [3d2fb5c]
- Updated dependencies [26738f4]
- Updated dependencies [4155f47]
- Updated dependencies [254f5c3]
- Updated dependencies [7eeb2bc]
- Updated dependencies [b804723]
- Updated dependencies [8607972]
- Updated dependencies [a798090]
- Updated dependencies [ccef9f9]
- Updated dependencies [0097d50]
- Updated dependencies [7eeb2bc]
- Updated dependencies [17826a9]
- Updated dependencies [7d8b7c7]
- Updated dependencies [fba031f]
- Updated dependencies [3a5f1e1]
- Updated dependencies [51e6923]
- Updated dependencies [8398d89]
  - @mastra/deployer@0.3.2
  - @mastra/core@0.9.2

## 0.1.21-alpha.6

### Patch Changes

- Updated dependencies [6052aa6]
- Updated dependencies [a798090]
- Updated dependencies [7d8b7c7]
- Updated dependencies [3a5f1e1]
- Updated dependencies [8398d89]
  - @mastra/core@0.9.2-alpha.6
  - @mastra/deployer@0.3.2-alpha.6

## 0.1.21-alpha.5

### Patch Changes

- 8607972: Introduce Mastra lint cli command
- Updated dependencies [3d2fb5c]
- Updated dependencies [7eeb2bc]
- Updated dependencies [8607972]
- Updated dependencies [7eeb2bc]
- Updated dependencies [fba031f]
  - @mastra/core@0.9.2-alpha.5
  - @mastra/deployer@0.3.2-alpha.5

## 0.1.21-alpha.4

### Patch Changes

- Updated dependencies [ccef9f9]
- Updated dependencies [51e6923]
  - @mastra/core@0.9.2-alpha.4
  - @mastra/deployer@0.3.2-alpha.4

## 0.1.21-alpha.3

### Patch Changes

- Updated dependencies [967b41c]
- Updated dependencies [4155f47]
- Updated dependencies [17826a9]
  - @mastra/core@0.9.2-alpha.3
  - @mastra/deployer@0.3.2-alpha.3

## 0.1.21-alpha.2

### Patch Changes

- Updated dependencies [26738f4]
  - @mastra/core@0.9.2-alpha.2
  - @mastra/deployer@0.3.2-alpha.2

## 0.1.21-alpha.1

### Patch Changes

- Updated dependencies [254f5c3]
- Updated dependencies [b804723]
  - @mastra/deployer@0.3.2-alpha.1
  - @mastra/core@0.9.2-alpha.1

## 0.1.21-alpha.0

### Patch Changes

- Updated dependencies [0097d50]
  - @mastra/core@0.9.2-alpha.0
  - @mastra/deployer@0.3.2-alpha.0

## 0.1.20

### Patch Changes

- 530ced1: Fix cloudflare deployer by removing import.meta.url reference
- Updated dependencies [e7c2881]
- Updated dependencies [0ccb8b4]
- Updated dependencies [92c598d]
- Updated dependencies [405b63d]
- Updated dependencies [81fb7f6]
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
- Updated dependencies [ebdb781]
- Updated dependencies [a90a082]
- Updated dependencies [2d17c73]
- Updated dependencies [61e92f5]
- Updated dependencies [35955b0]
- Updated dependencies [6262bd5]
- Updated dependencies [c1409ef]
- Updated dependencies [3e7b69d]
- Updated dependencies [e4943b8]
- Updated dependencies [11d4485]
- Updated dependencies [479f490]
- Updated dependencies [530ced1]
- Updated dependencies [c23a81c]
- Updated dependencies [611aa4a]
- Updated dependencies [2d4001d]
- Updated dependencies [c71013a]
- Updated dependencies [1d3b1cd]
  - @mastra/deployer@0.3.1
  - @mastra/core@0.9.1

## 0.1.20-alpha.8

### Patch Changes

- Updated dependencies [2d17c73]
  - @mastra/core@0.9.1-alpha.8
  - @mastra/deployer@0.3.1-alpha.8

## 0.1.20-alpha.7

### Patch Changes

- Updated dependencies [1d3b1cd]
  - @mastra/core@0.9.1-alpha.7
  - @mastra/deployer@0.3.1-alpha.7

## 0.1.20-alpha.6

### Patch Changes

- Updated dependencies [c23a81c]
  - @mastra/core@0.9.1-alpha.6
  - @mastra/deployer@0.3.1-alpha.6

## 0.1.20-alpha.5

### Patch Changes

- Updated dependencies [3e7b69d]
  - @mastra/core@0.9.1-alpha.5
  - @mastra/deployer@0.3.1-alpha.5

## 0.1.20-alpha.4

### Patch Changes

- Updated dependencies [e4943b8]
- Updated dependencies [479f490]
  - @mastra/core@0.9.1-alpha.4
  - @mastra/deployer@0.3.1-alpha.4

## 0.1.20-alpha.3

### Patch Changes

- Updated dependencies [6262bd5]
  - @mastra/deployer@0.3.1-alpha.3
  - @mastra/core@0.9.1-alpha.3

## 0.1.20-alpha.2

### Patch Changes

- Updated dependencies [405b63d]
- Updated dependencies [61e92f5]
- Updated dependencies [c71013a]
  - @mastra/core@0.9.1-alpha.2
  - @mastra/deployer@0.3.1-alpha.2

## 0.1.20-alpha.1

### Patch Changes

- 530ced1: Fix cloudflare deployer by removing import.meta.url reference
- Updated dependencies [e7c2881]
- Updated dependencies [0ccb8b4]
- Updated dependencies [92c598d]
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
- Updated dependencies [ebdb781]
- Updated dependencies [a90a082]
- Updated dependencies [35955b0]
- Updated dependencies [c1409ef]
- Updated dependencies [11d4485]
- Updated dependencies [530ced1]
- Updated dependencies [611aa4a]
- Updated dependencies [2d4001d]
  - @mastra/deployer@0.3.1-alpha.1
  - @mastra/core@0.9.1-alpha.1

## 0.1.20-alpha.0

### Patch Changes

- Updated dependencies [81fb7f6]
  - @mastra/core@0.9.1-alpha.0
  - @mastra/deployer@0.3.1-alpha.0

## 0.1.19

### Patch Changes

- 7e92011: Include tools with deployment builds
- 16a8648: Disable swaggerUI, playground for production builds, mastra instance server build config to enable swaggerUI, apiReqLogs, openAPI documentation for prod builds
- Updated dependencies [b9122b0]
- Updated dependencies [000a6d4]
- Updated dependencies [08bb78e]
- Updated dependencies [3527610]
- Updated dependencies [ed2f549]
- Updated dependencies [7e92011]
- Updated dependencies [9ee4293]
- Updated dependencies [03f3cd0]
- Updated dependencies [c0f22b4]
- Updated dependencies [71d9444]
- Updated dependencies [157c741]
- Updated dependencies [8a8a73b]
- Updated dependencies [0a033fa]
- Updated dependencies [fe3ae4d]
- Updated dependencies [2538066]
- Updated dependencies [9c26508]
- Updated dependencies [63fe16a]
- Updated dependencies [0f4eae3]
- Updated dependencies [3f9d151]
- Updated dependencies [735ead7]
- Updated dependencies [16a8648]
- Updated dependencies [6f92295]
  - @mastra/deployer@0.3.0
  - @mastra/core@0.9.0

## 0.1.19-alpha.9

### Patch Changes

- 16a8648: Disable swaggerUI, playground for production builds, mastra instance server build config to enable swaggerUI, apiReqLogs, openAPI documentation for prod builds
- Updated dependencies [b9122b0]
- Updated dependencies [000a6d4]
- Updated dependencies [ed2f549]
- Updated dependencies [c0f22b4]
- Updated dependencies [0a033fa]
- Updated dependencies [2538066]
- Updated dependencies [9c26508]
- Updated dependencies [0f4eae3]
- Updated dependencies [16a8648]
  - @mastra/deployer@0.3.0-alpha.9
  - @mastra/core@0.9.0-alpha.8

## 0.1.19-alpha.8

### Patch Changes

- Updated dependencies [71d9444]
  - @mastra/core@0.9.0-alpha.7
  - @mastra/deployer@0.3.0-alpha.8

## 0.1.19-alpha.7

### Patch Changes

- Updated dependencies [157c741]
- Updated dependencies [63fe16a]
- Updated dependencies [735ead7]
  - @mastra/core@0.9.0-alpha.6
  - @mastra/deployer@0.3.0-alpha.7

## 0.1.19-alpha.6

### Patch Changes

- Updated dependencies [08bb78e]
- Updated dependencies [3f9d151]
  - @mastra/core@0.9.0-alpha.5
  - @mastra/deployer@0.3.0-alpha.6

## 0.1.19-alpha.5

### Patch Changes

- 7e92011: Include tools with deployment builds
- Updated dependencies [7e92011]
  - @mastra/deployer@0.3.0-alpha.5
  - @mastra/core@0.9.0-alpha.4

## 0.1.19-alpha.4

### Patch Changes

- Updated dependencies [fe3ae4d]
  - @mastra/deployer@0.3.0-alpha.4
  - @mastra/core@0.9.0-alpha.3

## 0.1.19-alpha.3

### Patch Changes

- Updated dependencies [9ee4293]
  - @mastra/core@0.8.4-alpha.2
  - @mastra/deployer@0.2.10-alpha.3

## 0.1.19-alpha.2

### Patch Changes

- Updated dependencies [3527610]
  - @mastra/deployer@0.2.10-alpha.2

## 0.1.19-alpha.1

### Patch Changes

- Updated dependencies [8a8a73b]
- Updated dependencies [6f92295]
  - @mastra/core@0.8.4-alpha.1
  - @mastra/deployer@0.2.10-alpha.1

## 0.1.19-alpha.0

### Patch Changes

- Updated dependencies [03f3cd0]
  - @mastra/core@0.8.4-alpha.0
  - @mastra/deployer@0.2.10-alpha.0

## 0.1.18

### Patch Changes

- 37bb612: Add Elastic-2.0 licensing for packages
- Updated dependencies [d72318f]
- Updated dependencies [0bcc862]
- Updated dependencies [10a8caf]
- Updated dependencies [359b089]
- Updated dependencies [9f6f6dd]
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
- Updated dependencies [1ebbfbf]
- Updated dependencies [67aff42]
- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3
  - @mastra/deployer@0.2.9

## 0.1.18-alpha.7

### Patch Changes

- Updated dependencies [d72318f]
  - @mastra/core@0.8.3-alpha.5
  - @mastra/deployer@0.2.9-alpha.7

## 0.1.18-alpha.6

### Patch Changes

- Updated dependencies [67aff42]
  - @mastra/deployer@0.2.9-alpha.6

## 0.1.18-alpha.5

### Patch Changes

- Updated dependencies [9f6f6dd]
  - @mastra/deployer@0.2.9-alpha.5

## 0.1.18-alpha.4

### Patch Changes

- Updated dependencies [1ebbfbf]
- Updated dependencies [7f1b291]
  - @mastra/deployer@0.2.9-alpha.4
  - @mastra/core@0.8.3-alpha.4

## 0.1.18-alpha.3

### Patch Changes

- Updated dependencies [10a8caf]
  - @mastra/core@0.8.3-alpha.3
  - @mastra/deployer@0.2.9-alpha.3

## 0.1.18-alpha.2

### Patch Changes

- Updated dependencies [0bcc862]
  - @mastra/core@0.8.3-alpha.2
  - @mastra/deployer@0.2.9-alpha.2

## 0.1.18-alpha.1

### Patch Changes

- 37bb612: Add Elastic-2.0 licensing for packages
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
  - @mastra/deployer@0.2.9-alpha.1
  - @mastra/core@0.8.3-alpha.1

## 0.1.18-alpha.0

### Patch Changes

- Updated dependencies [359b089]
  - @mastra/core@0.8.3-alpha.0
  - @mastra/deployer@0.2.9-alpha.0

## 0.1.17

### Patch Changes

- Updated dependencies [a06aadc]
- Updated dependencies [ae6c5ce]
- Updated dependencies [94cd5c1]
  - @mastra/core@0.8.2
  - @mastra/deployer@0.2.8

## 0.1.17-alpha.1

### Patch Changes

- Updated dependencies [94cd5c1]
  - @mastra/deployer@0.2.8-alpha.1

## 0.1.17-alpha.0

### Patch Changes

- Updated dependencies [a06aadc]
- Updated dependencies [ae6c5ce]
  - @mastra/core@0.8.2-alpha.0
  - @mastra/deployer@0.2.8-alpha.0

## 0.1.16

### Patch Changes

- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1
  - @mastra/deployer@0.2.7

## 0.1.16-alpha.0

### Patch Changes

- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1-alpha.0
  - @mastra/deployer@0.2.7-alpha.0

## 0.1.15

### Patch Changes

- 9b24aeb: Enable process env syncing to cloudflare workers
- Updated dependencies [56c31b7]
- Updated dependencies [619c39d]
- Updated dependencies [2135c81]
- Updated dependencies [5ae0180]
- Updated dependencies [05d58cc]
- Updated dependencies [fe56be0]
- Updated dependencies [93875ed]
- Updated dependencies [107bcfe]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [5b4e19f]
- Updated dependencies [4c98129]
- Updated dependencies [4c65a57]
- Updated dependencies [dbbbf80]
- Updated dependencies [a0967a0]
- Updated dependencies [84fe241]
- Updated dependencies [fca3b21]
- Updated dependencies [88fa727]
- Updated dependencies [dfb0601]
- Updated dependencies [f37f535]
- Updated dependencies [789bef3]
- Updated dependencies [a3f0e90]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
- Updated dependencies [84fe241]
- Updated dependencies [99d43b9]
- Updated dependencies [32ba03c]
- Updated dependencies [d7e08e8]
- Updated dependencies [3c6ae54]
- Updated dependencies [febc8a6]
- Updated dependencies [0deb356]
- Updated dependencies [7599d77]
- Updated dependencies [0118361]
- Updated dependencies [619c39d]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [8df4a77]
- Updated dependencies [304397c]
  - @mastra/core@0.8.0
  - @mastra/deployer@0.2.6

## 0.1.15-alpha.10

### Patch Changes

- Updated dependencies [2135c81]
- Updated dependencies [8df4a77]
  - @mastra/deployer@0.2.6-alpha.10
  - @mastra/core@0.8.0-alpha.8

## 0.1.15-alpha.9

### Patch Changes

- Updated dependencies [3c6ae54]
- Updated dependencies [febc8a6]
  - @mastra/deployer@0.2.6-alpha.9
  - @mastra/core@0.8.0-alpha.7

## 0.1.15-alpha.8

### Patch Changes

- 9b24aeb: Enable process env syncing to cloudflare workers
- Updated dependencies [4c65a57]
- Updated dependencies [a3f0e90]
  - @mastra/deployer@0.2.6-alpha.8
  - @mastra/core@0.8.0-alpha.6

## 0.1.15-alpha.7

### Patch Changes

- Updated dependencies [93875ed]
  - @mastra/core@0.8.0-alpha.5
  - @mastra/deployer@0.2.6-alpha.7

## 0.1.15-alpha.6

### Patch Changes

- Updated dependencies [d7e08e8]
  - @mastra/core@0.8.0-alpha.4
  - @mastra/deployer@0.2.6-alpha.6

## 0.1.15-alpha.5

### Patch Changes

- Updated dependencies [32ba03c]
  - @mastra/deployer@0.2.6-alpha.5

## 0.1.15-alpha.4

### Patch Changes

- Updated dependencies [5ae0180]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [88fa727]
- Updated dependencies [dfb0601]
- Updated dependencies [f37f535]
- Updated dependencies [789bef3]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
  - @mastra/core@0.8.0-alpha.3
  - @mastra/deployer@0.2.6-alpha.4

## 0.1.15-alpha.3

### Patch Changes

- Updated dependencies [0deb356]
  - @mastra/deployer@0.2.6-alpha.3

## 0.1.15-alpha.2

### Patch Changes

- Updated dependencies [56c31b7]
- Updated dependencies [4c98129]
- Updated dependencies [dbbbf80]
- Updated dependencies [84fe241]
- Updated dependencies [84fe241]
- Updated dependencies [99d43b9]
  - @mastra/core@0.8.0-alpha.2
  - @mastra/deployer@0.2.6-alpha.2

## 0.1.15-alpha.1

### Patch Changes

- Updated dependencies [619c39d]
- Updated dependencies [fe56be0]
- Updated dependencies [a0967a0]
- Updated dependencies [fca3b21]
- Updated dependencies [0118361]
- Updated dependencies [619c39d]
  - @mastra/core@0.8.0-alpha.1
  - @mastra/deployer@0.2.6-alpha.1

## 0.1.15-alpha.0

### Patch Changes

- Updated dependencies [05d58cc]
- Updated dependencies [107bcfe]
- Updated dependencies [5b4e19f]
- Updated dependencies [7599d77]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [304397c]
  - @mastra/deployer@0.2.6-alpha.0
  - @mastra/core@0.7.1-alpha.0

## 0.1.14

### Patch Changes

- cdc0498: Fix process.versions.node.split in cloudflare deployer
- Updated dependencies [cdc0498]
- Updated dependencies [b4fbc59]
- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [0b54522]
- Updated dependencies [b3b34f5]
- Updated dependencies [1af25d5]
- Updated dependencies [a4686e8]
- Updated dependencies [6530ad1]
- Updated dependencies [0b496ff]
- Updated dependencies [27439ad]
  - @mastra/deployer@0.2.5
  - @mastra/core@0.7.0

## 0.1.14-alpha.3

### Patch Changes

- Updated dependencies [b3b34f5]
- Updated dependencies [a4686e8]
  - @mastra/core@0.7.0-alpha.3
  - @mastra/deployer@0.2.5-alpha.3

## 0.1.14-alpha.2

### Patch Changes

- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [6530ad1]
  - @mastra/core@0.7.0-alpha.2
  - @mastra/deployer@0.2.5-alpha.2

## 0.1.14-alpha.1

### Patch Changes

- cdc0498: Fix process.versions.node.split in cloudflare deployer
- Updated dependencies [cdc0498]
- Updated dependencies [0b54522]
- Updated dependencies [1af25d5]
- Updated dependencies [0b496ff]
- Updated dependencies [27439ad]
  - @mastra/deployer@0.2.5-alpha.1
  - @mastra/core@0.7.0-alpha.1

## 0.1.14-alpha.0

### Patch Changes

- Updated dependencies [b4fbc59]
  - @mastra/core@0.6.5-alpha.0
  - @mastra/deployer@0.2.5-alpha.0

## 0.1.13

### Patch Changes

- 85a2461: Fix cloudflare deployer
- Updated dependencies [e764fd1]
- Updated dependencies [6794797]
- Updated dependencies [709aa2c]
- Updated dependencies [fb68a80]
- Updated dependencies [e764fd1]
- Updated dependencies [05ef3e0]
- Updated dependencies [95c5745]
- Updated dependencies [b56a681]
- Updated dependencies [85a2461]
- Updated dependencies [248cb07]
  - @mastra/deployer@0.2.4
  - @mastra/core@0.6.4

## 0.1.13-alpha.1

### Patch Changes

- 85a2461: Fix cloudflare deployer
- Updated dependencies [6794797]
- Updated dependencies [709aa2c]
- Updated dependencies [85a2461]
  - @mastra/core@0.6.4-alpha.1
  - @mastra/deployer@0.2.4-alpha.1

## 0.1.13-alpha.0

### Patch Changes

- Updated dependencies [e764fd1]
- Updated dependencies [fb68a80]
- Updated dependencies [e764fd1]
- Updated dependencies [05ef3e0]
- Updated dependencies [95c5745]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/deployer@0.2.4-alpha.0
  - @mastra/core@0.6.4-alpha.0

## 0.1.12

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
- Updated dependencies [3bce733]
  - @mastra/deployer@0.2.3
  - @mastra/core@0.6.3

## 0.1.12-alpha.1

### Patch Changes

- Updated dependencies [3bce733]
  - @mastra/core@0.6.3-alpha.1
  - @mastra/deployer@0.2.3-alpha.1

## 0.1.12-alpha.0

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
  - @mastra/deployer@0.2.3-alpha.0
  - @mastra/core@0.6.3-alpha.0

## 0.1.11

### Patch Changes

- Updated dependencies [4e6732b]
- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/deployer@0.2.2
  - @mastra/core@0.6.2

## 0.1.11-alpha.1

### Patch Changes

- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2-alpha.0
  - @mastra/deployer@0.2.2-alpha.1

## 0.1.11-alpha.0

### Patch Changes

- Updated dependencies [4e6732b]
  - @mastra/deployer@0.2.2-alpha.0

## 0.1.10

### Patch Changes

- Updated dependencies [cc7f392]
- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [0850b4c]
- Updated dependencies [7bcfaee]
- Updated dependencies [da8d9bb]
- Updated dependencies [44631b1]
- Updated dependencies [9116d70]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
- Updated dependencies [61ad5a4]
  - @mastra/deployer@0.2.1
  - @mastra/core@0.6.1

## 0.1.10-alpha.2

### Patch Changes

- Updated dependencies [cc7f392]
- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [0850b4c]
- Updated dependencies [da8d9bb]
- Updated dependencies [9116d70]
  - @mastra/deployer@0.2.1-alpha.2
  - @mastra/core@0.6.1-alpha.2

## 0.1.10-alpha.1

### Patch Changes

- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [44631b1]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
- Updated dependencies [61ad5a4]
  - @mastra/core@0.6.1-alpha.1
  - @mastra/deployer@0.2.1-alpha.1

## 0.1.10-alpha.0

### Patch Changes

- Updated dependencies [7bcfaee]
  - @mastra/core@0.6.1-alpha.0
  - @mastra/deployer@0.2.1-alpha.0

## 0.1.9

### Patch Changes

- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [3729dbd]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0
  - @mastra/deployer@0.2.0

## 0.1.9-alpha.1

### Patch Changes

- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0-alpha.1
  - @mastra/deployer@0.2.0-alpha.1

## 0.1.9-alpha.0

### Patch Changes

- Updated dependencies [3729dbd]
  - @mastra/core@0.5.1-alpha.0
  - @mastra/deployer@0.1.9-alpha.0

## 0.1.8

### Patch Changes

- fe11c20: have cloudflare wrangler point to correct entry point file
- 52e0418: Split up action types between tools and workflows
- fd4a1d7: Update cjs bundling to make sure files are split
- Updated dependencies [a910463]
- Updated dependencies [59df7b6]
- Updated dependencies [22643eb]
- Updated dependencies [6feb23f]
- Updated dependencies [f2d6727]
- Updated dependencies [7a7a547]
- Updated dependencies [29f3a82]
- Updated dependencies [3d0e290]
- Updated dependencies [e9fbac5]
- Updated dependencies [301e4ee]
- Updated dependencies [ee667a2]
- Updated dependencies [dfbe4e9]
- Updated dependencies [dab255b]
- Updated dependencies [1e8bcbc]
- Updated dependencies [f6678e4]
- Updated dependencies [9e81f35]
- Updated dependencies [c93798b]
- Updated dependencies [a85ab24]
- Updated dependencies [dbd9f2d]
- Updated dependencies [59df7b6]
- Updated dependencies [caefaa2]
- Updated dependencies [c151ae6]
- Updated dependencies [52e0418]
- Updated dependencies [d79aedf]
- Updated dependencies [8deb34c]
- Updated dependencies [c2dde91]
- Updated dependencies [5d41958]
- Updated dependencies [144b3d5]
- Updated dependencies [03236ec]
- Updated dependencies [3764e71]
- Updated dependencies [df982db]
- Updated dependencies [a171b37]
- Updated dependencies [506f1d5]
- Updated dependencies [02ffb7b]
- Updated dependencies [731dd8a]
- Updated dependencies [0461849]
- Updated dependencies [2259379]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
- Updated dependencies [358f069]
- Updated dependencies [fd4a1d7]
- Updated dependencies [960690d]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0
  - @mastra/deployer@0.1.8

## 0.1.8-alpha.12

### Patch Changes

- Updated dependencies [a85ab24]
  - @mastra/core@0.5.0-alpha.12
  - @mastra/deployer@0.1.8-alpha.12

## 0.1.8-alpha.11

### Patch Changes

- fd4a1d7: Update cjs bundling to make sure files are split
- Updated dependencies [7a7a547]
- Updated dependencies [c93798b]
- Updated dependencies [dbd9f2d]
- Updated dependencies [8deb34c]
- Updated dependencies [5d41958]
- Updated dependencies [a171b37]
- Updated dependencies [fd4a1d7]
  - @mastra/deployer@0.1.8-alpha.11
  - @mastra/core@0.5.0-alpha.11

## 0.1.8-alpha.10

### Patch Changes

- Updated dependencies [a910463]
  - @mastra/core@0.5.0-alpha.10
  - @mastra/deployer@0.1.8-alpha.10

## 0.1.8-alpha.9

### Patch Changes

- Updated dependencies [e9fbac5]
- Updated dependencies [1e8bcbc]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
  - @mastra/deployer@0.1.8-alpha.9
  - @mastra/core@0.5.0-alpha.9

## 0.1.8-alpha.8

### Patch Changes

- Updated dependencies [506f1d5]
  - @mastra/core@0.5.0-alpha.8
  - @mastra/deployer@0.1.8-alpha.8

## 0.1.8-alpha.7

### Patch Changes

- Updated dependencies [ee667a2]
  - @mastra/core@0.5.0-alpha.7
  - @mastra/deployer@0.1.8-alpha.7

## 0.1.8-alpha.6

### Patch Changes

- Updated dependencies [f6678e4]
  - @mastra/core@0.5.0-alpha.6
  - @mastra/deployer@0.1.8-alpha.6

## 0.1.8-alpha.5

### Patch Changes

- fe11c20: have cloudflare wrangler point to correct entry point file
- 52e0418: Split up action types between tools and workflows
- Updated dependencies [22643eb]
- Updated dependencies [6feb23f]
- Updated dependencies [f2d6727]
- Updated dependencies [301e4ee]
- Updated dependencies [dfbe4e9]
- Updated dependencies [9e81f35]
- Updated dependencies [caefaa2]
- Updated dependencies [c151ae6]
- Updated dependencies [52e0418]
- Updated dependencies [03236ec]
- Updated dependencies [3764e71]
- Updated dependencies [df982db]
- Updated dependencies [0461849]
- Updated dependencies [2259379]
- Updated dependencies [358f069]
  - @mastra/core@0.5.0-alpha.5
  - @mastra/deployer@0.1.8-alpha.5

## 0.1.8-alpha.4

### Patch Changes

- Updated dependencies [d79aedf]
- Updated dependencies [144b3d5]
  - @mastra/core@0.5.0-alpha.4
  - @mastra/deployer@0.1.8-alpha.4

## 0.1.8-alpha.3

### Patch Changes

- Updated dependencies [3d0e290]
  - @mastra/core@0.5.0-alpha.3
  - @mastra/deployer@0.1.8-alpha.3

## 0.1.8-alpha.2

### Patch Changes

- Updated dependencies [02ffb7b]
  - @mastra/core@0.5.0-alpha.2
  - @mastra/deployer@0.1.8-alpha.2

## 0.1.8-alpha.1

### Patch Changes

- Updated dependencies [dab255b]
  - @mastra/core@0.5.0-alpha.1
  - @mastra/deployer@0.1.8-alpha.1

## 0.1.8-alpha.0

### Patch Changes

- Updated dependencies [59df7b6]
- Updated dependencies [29f3a82]
- Updated dependencies [59df7b6]
- Updated dependencies [c2dde91]
- Updated dependencies [731dd8a]
- Updated dependencies [960690d]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0-alpha.0
  - @mastra/deployer@0.1.8-alpha.0

## 0.1.7

### Patch Changes

- Updated dependencies [1da20e7]
- Updated dependencies [30a4c29]
- Updated dependencies [e1e2705]
  - @mastra/core@0.4.4
  - @mastra/deployer@0.1.7

## 0.1.7-alpha.0

### Patch Changes

- Updated dependencies [1da20e7]
- Updated dependencies [30a4c29]
- Updated dependencies [e1e2705]
  - @mastra/core@0.4.4-alpha.0
  - @mastra/deployer@0.1.7-alpha.0

## 0.1.6

### Patch Changes

- bb4f447: Add support for commonjs
- Updated dependencies [0d185b1]
- Updated dependencies [ed55f1d]
- Updated dependencies [06aa827]
- Updated dependencies [80cdd76]
- Updated dependencies [0fd78ac]
- Updated dependencies [2512a93]
- Updated dependencies [e62de74]
- Updated dependencies [0d25b75]
- Updated dependencies [fd14a3f]
- Updated dependencies [8d13b14]
- Updated dependencies [3f369a2]
- Updated dependencies [3ee4831]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
- Updated dependencies [108793c]
- Updated dependencies [5f28f44]
- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3
  - @mastra/deployer@0.1.6

## 0.1.6-alpha.4

### Patch Changes

- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3-alpha.4
  - @mastra/deployer@0.1.6-alpha.4

## 0.1.6-alpha.3

### Patch Changes

- bb4f447: Add support for commonjs
- Updated dependencies [0fd78ac]
- Updated dependencies [0d25b75]
- Updated dependencies [fd14a3f]
- Updated dependencies [3f369a2]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
  - @mastra/deployer@0.1.6-alpha.3
  - @mastra/core@0.4.3-alpha.3

## 0.1.6-alpha.2

### Patch Changes

- Updated dependencies [2512a93]
- Updated dependencies [e62de74]
  - @mastra/core@0.4.3-alpha.2
  - @mastra/deployer@0.1.6-alpha.2

## 0.1.6-alpha.1

### Patch Changes

- Updated dependencies [0d185b1]
- Updated dependencies [ed55f1d]
- Updated dependencies [80cdd76]
- Updated dependencies [8d13b14]
- Updated dependencies [3ee4831]
- Updated dependencies [108793c]
- Updated dependencies [5f28f44]
  - @mastra/core@0.4.3-alpha.1
  - @mastra/deployer@0.1.6-alpha.1

## 0.1.6-alpha.0

### Patch Changes

- Updated dependencies [06aa827]
  - @mastra/core@0.4.3-alpha.0
  - @mastra/deployer@0.1.6-alpha.0

## 0.1.5

### Patch Changes

- Updated dependencies [7fceae1]
- Updated dependencies [e4ee56c]
- Updated dependencies [8d94c3e]
- Updated dependencies [2d68431]
- Updated dependencies [99dcdb5]
- Updated dependencies [6cb63e0]
- Updated dependencies [f626fbb]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2
  - @mastra/deployer@0.1.5

## 0.1.5-alpha.3

### Patch Changes

- Updated dependencies [8d94c3e]
- Updated dependencies [99dcdb5]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2-alpha.2
  - @mastra/deployer@0.1.5-alpha.3

## 0.1.5-alpha.2

### Patch Changes

- Updated dependencies [6cb63e0]
  - @mastra/core@0.4.2-alpha.1
  - @mastra/deployer@0.1.5-alpha.2

## 0.1.5-alpha.1

### Patch Changes

- Updated dependencies [2d68431]
  - @mastra/deployer@0.1.5-alpha.1

## 0.1.5-alpha.0

### Patch Changes

- Updated dependencies [7fceae1]
- Updated dependencies [e4ee56c]
- Updated dependencies [f626fbb]
  - @mastra/core@0.4.2-alpha.0
  - @mastra/deployer@0.1.5-alpha.0

## 0.1.4

### Patch Changes

- Updated dependencies [ce44b9b]
- Updated dependencies [967da43]
- Updated dependencies [b405f08]
  - @mastra/core@0.4.1
  - @mastra/deployer@0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies [5297264]
- Updated dependencies [2fc618f]
- Updated dependencies [fe0fd01]
  - @mastra/deployer@0.1.3
  - @mastra/core@0.4.0

## 0.1.3-alpha.1

### Patch Changes

- Updated dependencies [fe0fd01]
  - @mastra/core@0.4.0-alpha.1
  - @mastra/deployer@0.1.3-alpha.1

## 0.1.3-alpha.0

### Patch Changes

- Updated dependencies [5297264]
- Updated dependencies [2fc618f]
  - @mastra/deployer@0.1.3-alpha.0
  - @mastra/core@0.4.0-alpha.0

## 0.1.2

### Patch Changes

- Updated dependencies [f205ede]
  - @mastra/core@0.3.0
  - @mastra/deployer@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [d59f1a8]
- Updated dependencies [936dc26]
- Updated dependencies [91ef439]
- Updated dependencies [4a25be4]
- Updated dependencies [bf2e88f]
- Updated dependencies [2f0d707]
- Updated dependencies [aac1667]
  - @mastra/core@0.2.1
  - @mastra/deployer@0.1.1

## 0.1.1-alpha.0

### Patch Changes

- Updated dependencies [d59f1a8]
- Updated dependencies [936dc26]
- Updated dependencies [91ef439]
- Updated dependencies [4a25be4]
- Updated dependencies [bf2e88f]
- Updated dependencies [2f0d707]
- Updated dependencies [aac1667]
  - @mastra/core@0.2.1-alpha.0
  - @mastra/deployer@0.1.1-alpha.0

## 0.1.0

### Minor Changes

- 4d4f6b6: Update deployer
- 5916f9d: Update deps from fixed to ^
- 8b416d9: Breaking changes

### Patch Changes

- 2b75edf: mastra deployers tsup bundling
- 44c7c26: Rebuild
- e27fe69: Add dir to deployer
- 32d15ec: Fix cloudflareDeployer build
- bdaf834: publish packages
- b97ca96: Tracing into default storage
- 026ca5d: Optional dispatcher namespace configuration for cloudflare deployments
- a9b5ddf: Publish new versions
- 9066f95: CF deployer fixes
- 1944807: Unified logger and major step in better logs
- 88600bc: Deployer fixes
- 9c10484: update all packages
- 70dabd9: Fix broken publish
- 0d5a03d: Vector store modules
- 9625602: Use mastra core splitted bundles in other packages
- a291824: Deployer fixes
- c7abf8e: Optional CF worker tagging
- 38b7f66: Update deployer logic
- 4f1d1a1: Enforce types ann cleanup package.json
- Updated dependencies [2ab57d6]
- Updated dependencies [a1774e7]
- Updated dependencies [f537e33]
- Updated dependencies [291fe57]
- Updated dependencies [6f2c0f5]
- Updated dependencies [e4d4ede]
- Updated dependencies [0be7181]
- Updated dependencies [dd6d87f]
- Updated dependencies [9029796]
- Updated dependencies [6fa4bd2]
- Updated dependencies [f031a1f]
- Updated dependencies [8151f44]
- Updated dependencies [d7d465a]
- Updated dependencies [4d4f6b6]
- Updated dependencies [73d112c]
- Updated dependencies [592e3cf]
- Updated dependencies [9d1796d]
- Updated dependencies [e897f1c]
- Updated dependencies [4a54c82]
- Updated dependencies [e27fe69]
- Updated dependencies [3967e69]
- Updated dependencies [8ae2bbc]
- Updated dependencies [246f06c]
- Updated dependencies [ac8c61a]
- Updated dependencies [82a6d53]
- Updated dependencies [e9d1b47]
- Updated dependencies [bdaf834]
- Updated dependencies [016493a]
- Updated dependencies [bc40916]
- Updated dependencies [93a3719]
- Updated dependencies [7d83b92]
- Updated dependencies [9fb3039]
- Updated dependencies [8fa48b9]
- Updated dependencies [d5e12de]
- Updated dependencies [e1dd94a]
- Updated dependencies [07c069d]
- Updated dependencies [5cdfb88]
- Updated dependencies [837a288]
- Updated dependencies [685108a]
- Updated dependencies [c8ff2f5]
- Updated dependencies [5fdc87c]
- Updated dependencies [ae7bf94]
- Updated dependencies [8e7814f]
- Updated dependencies [66a03ec]
- Updated dependencies [5916f9d]
- Updated dependencies [7d87a15]
- Updated dependencies [b97ca96]
- Updated dependencies [ad2cd74]
- Updated dependencies [23dcb23]
- Updated dependencies [033eda6]
- Updated dependencies [7babd5c]
- Updated dependencies [a9b5ddf]
- Updated dependencies [9066f95]
- Updated dependencies [4139b43]
- Updated dependencies [8105fae]
- Updated dependencies [e097800]
- Updated dependencies [ab01c53]
- Updated dependencies [1944807]
- Updated dependencies [30322ce]
- Updated dependencies [8aec8b7]
- Updated dependencies [1874f40]
- Updated dependencies [685108a]
- Updated dependencies [f7d1131]
- Updated dependencies [79acad0]
- Updated dependencies [7a19083]
- Updated dependencies [382f4dc]
- Updated dependencies [1ebd071]
- Updated dependencies [0b74006]
- Updated dependencies [2f17a5f]
- Updated dependencies [f368477]
- Updated dependencies [7892533]
- Updated dependencies [9c10484]
- Updated dependencies [b726bf5]
- Updated dependencies [88f18d7]
- Updated dependencies [70dabd9]
- Updated dependencies [21fe536]
- Updated dependencies [1a41fbf]
- Updated dependencies [176bc42]
- Updated dependencies [391d5ea]
- Updated dependencies [401a4d9]
- Updated dependencies [2e099d2]
- Updated dependencies [0b826f6]
- Updated dependencies [8329f1a]
- Updated dependencies [d68b532]
- Updated dependencies [75bf3f0]
- Updated dependencies [e6d8055]
- Updated dependencies [e2e76de]
- Updated dependencies [a18e96c]
- Updated dependencies [ccbc581]
- Updated dependencies [5950de5]
- Updated dependencies [b425845]
- Updated dependencies [fe3dcb0]
- Updated dependencies [0696eeb]
- Updated dependencies [6780223]
- Updated dependencies [78eec7c]
- Updated dependencies [a8a459a]
- Updated dependencies [0b96376]
- Updated dependencies [0be7181]
- Updated dependencies [7b87567]
- Updated dependencies [b524c22]
- Updated dependencies [d7d465a]
- Updated dependencies [df843d3]
- Updated dependencies [cfb966f]
- Updated dependencies [4534e77]
- Updated dependencies [d6d8159]
- Updated dependencies [0bd142c]
- Updated dependencies [9625602]
- Updated dependencies [72d1990]
- Updated dependencies [f6ba259]
- Updated dependencies [2712098]
- Updated dependencies [a291824]
- Updated dependencies [eedb829]
- Updated dependencies [8ea426a]
- Updated dependencies [c5f2d50]
- Updated dependencies [5285356]
- Updated dependencies [74b3078]
- Updated dependencies [cb290ee]
- Updated dependencies [b4d7416]
- Updated dependencies [e608d8c]
- Updated dependencies [7064554]
- Updated dependencies [06b2c0a]
- Updated dependencies [002d6d8]
- Updated dependencies [e448a26]
- Updated dependencies [8b416d9]
- Updated dependencies [fd494a3]
- Updated dependencies [dc90663]
- Updated dependencies [c872875]
- Updated dependencies [3c4488b]
- Updated dependencies [72c280b]
- Updated dependencies [a7b016d]
- Updated dependencies [fd75f3c]
- Updated dependencies [7f24c29]
- Updated dependencies [2017553]
- Updated dependencies [b80ea8d]
- Updated dependencies [a10b7a3]
- Updated dependencies [42a2e69]
- Updated dependencies [cf6d825]
- Updated dependencies [963c15a]
- Updated dependencies [28dceab]
- Updated dependencies [7365b6c]
- Updated dependencies [5ee67d3]
- Updated dependencies [a5604c4]
- Updated dependencies [d38f7a6]
- Updated dependencies [38b7f66]
- Updated dependencies [2fa7f53]
- Updated dependencies [1420ae2]
- Updated dependencies [b9c7047]
- Updated dependencies [4a328af]
- Updated dependencies [f6da688]
- Updated dependencies [3700be1]
- Updated dependencies [9ade36e]
- Updated dependencies [10870bc]
- Updated dependencies [2b01511]
- Updated dependencies [a870123]
- Updated dependencies [ccf115c]
- Updated dependencies [04434b6]
- Updated dependencies [5811de6]
- Updated dependencies [9f3ab05]
- Updated dependencies [66a5392]
- Updated dependencies [4b1ce2c]
- Updated dependencies [14064f2]
- Updated dependencies [f5dfa20]
- Updated dependencies [327ece7]
- Updated dependencies [da2e8d3]
- Updated dependencies [95a4697]
- Updated dependencies [d5fccfb]
- Updated dependencies [3427b95]
- Updated dependencies [538a136]
- Updated dependencies [e66643a]
- Updated dependencies [b5393f1]
- Updated dependencies [d2cd535]
- Updated dependencies [c2dd6b5]
- Updated dependencies [67637ba]
- Updated dependencies [836f4e3]
- Updated dependencies [5ee2e78]
- Updated dependencies [cd02c56]
- Updated dependencies [01502b0]
- Updated dependencies [16e5b04]
- Updated dependencies [d9c8dd0]
- Updated dependencies [9fb59d6]
- Updated dependencies [a9345f9]
- Updated dependencies [f1e3105]
- Updated dependencies [99f1847]
- Updated dependencies [04f3171]
- Updated dependencies [8769a62]
- Updated dependencies [d5ec619]
- Updated dependencies [27275c9]
- Updated dependencies [ae7bf94]
- Updated dependencies [4f1d1a1]
- Updated dependencies [ee4de15]
- Updated dependencies [202d404]
- Updated dependencies [a221426]
  - @mastra/deployer@0.1.0
  - @mastra/core@0.2.0

## 0.1.0-alpha.68

### Patch Changes

- Updated dependencies [391d5ea]
  - @mastra/deployer@0.1.0-alpha.63

## 0.1.0-alpha.67

### Patch Changes

- Updated dependencies [016493a]
- Updated dependencies [382f4dc]
- Updated dependencies [176bc42]
- Updated dependencies [d68b532]
- Updated dependencies [fe3dcb0]
- Updated dependencies [e448a26]
- Updated dependencies [fd75f3c]
- Updated dependencies [ccf115c]
- Updated dependencies [a221426]
  - @mastra/core@0.2.0-alpha.110
  - @mastra/deployer@0.1.0-alpha.62

## 0.1.0-alpha.66

### Patch Changes

- Updated dependencies [b9c7047]
  - @mastra/deployer@0.1.0-alpha.61

## 0.1.0-alpha.65

### Patch Changes

- Updated dependencies [d5fccfb]
  - @mastra/core@0.2.0-alpha.109
  - @mastra/deployer@0.1.0-alpha.60

## 0.1.0-alpha.64

### Patch Changes

- Updated dependencies [5ee67d3]
- Updated dependencies [95a4697]
  - @mastra/core@0.2.0-alpha.108
  - @mastra/deployer@0.1.0-alpha.59

## 0.1.0-alpha.63

### Patch Changes

- Updated dependencies [8fa48b9]
- Updated dependencies [66a5392]
  - @mastra/deployer@0.1.0-alpha.58
  - @mastra/core@0.2.0-alpha.107

## 0.1.0-alpha.62

### Patch Changes

- Updated dependencies [6f2c0f5]
- Updated dependencies [a8a459a]
- Updated dependencies [4a328af]
  - @mastra/core@0.2.0-alpha.106
  - @mastra/deployer@0.1.0-alpha.57

## 0.1.0-alpha.61

### Patch Changes

- Updated dependencies [246f06c]
  - @mastra/deployer@0.1.0-alpha.56

## 0.1.0-alpha.60

### Patch Changes

- Updated dependencies [1420ae2]
- Updated dependencies [99f1847]
  - @mastra/core@0.2.0-alpha.105
  - @mastra/deployer@0.1.0-alpha.55

## 0.1.0-alpha.59

### Patch Changes

- b97ca96: Tracing into default storage
- Updated dependencies [5fdc87c]
- Updated dependencies [b97ca96]
- Updated dependencies [6780223]
- Updated dependencies [72d1990]
- Updated dependencies [cf6d825]
- Updated dependencies [10870bc]
  - @mastra/core@0.2.0-alpha.104
  - @mastra/deployer@0.1.0-alpha.54

## 0.1.0-alpha.58

### Patch Changes

- Updated dependencies [4534e77]
  - @mastra/core@0.2.0-alpha.103
  - @mastra/deployer@0.1.0-alpha.53

## 0.1.0-alpha.57

### Patch Changes

- Updated dependencies [a9345f9]
  - @mastra/core@0.2.0-alpha.102
  - @mastra/deployer@0.1.0-alpha.52

## 0.1.0-alpha.56

### Patch Changes

- 4f1d1a1: Enforce types ann cleanup package.json
- Updated dependencies [66a03ec]
- Updated dependencies [4f1d1a1]
  - @mastra/core@0.2.0-alpha.101
  - @mastra/deployer@0.1.0-alpha.51

## 0.1.0-alpha.55

### Patch Changes

- Updated dependencies [9d1796d]
  - @mastra/deployer@0.1.0-alpha.50
  - @mastra/core@0.2.0-alpha.100

## 0.1.0-alpha.54

### Patch Changes

- Updated dependencies [7d83b92]
  - @mastra/deployer@0.1.0-alpha.49
  - @mastra/core@0.2.0-alpha.99

## 0.1.0-alpha.53

### Patch Changes

- Updated dependencies [8aec8b7]
  - @mastra/deployer@0.1.0-alpha.48

## 0.1.0-alpha.52

### Patch Changes

- 70dabd9: Fix broken publish
- Updated dependencies [70dabd9]
- Updated dependencies [202d404]
  - @mastra/core@0.2.0-alpha.98
  - @mastra/deployer@0.1.0-alpha.47

## 0.1.0-alpha.51

### Patch Changes

- Updated dependencies [07c069d]
- Updated dependencies [7892533]
- Updated dependencies [e6d8055]
- Updated dependencies [a18e96c]
- Updated dependencies [5950de5]
- Updated dependencies [df843d3]
- Updated dependencies [a870123]
- Updated dependencies [f1e3105]
  - @mastra/core@0.2.0-alpha.97
  - @mastra/deployer@0.1.0-alpha.46

## 0.1.0-alpha.50

### Patch Changes

- Updated dependencies [74b3078]
  - @mastra/core@0.2.0-alpha.96
  - @mastra/deployer@0.1.0-alpha.45

## 0.1.0-alpha.49

### Patch Changes

- Updated dependencies [9fb59d6]
  - @mastra/deployer@0.1.0-alpha.44
  - @mastra/core@0.2.0-alpha.95

## 0.1.0-alpha.48

### Minor Changes

- 8b416d9: Breaking changes

### Patch Changes

- 9c10484: update all packages
- Updated dependencies [9c10484]
- Updated dependencies [8b416d9]
  - @mastra/core@0.2.0-alpha.94
  - @mastra/deployer@0.1.0-alpha.43

## 0.1.0-alpha.47

### Patch Changes

- Updated dependencies [5285356]
- Updated dependencies [42a2e69]
  - @mastra/core@0.2.0-alpha.93
  - @mastra/deployer@0.1.0-alpha.42

## 0.1.0-alpha.46

### Patch Changes

- Updated dependencies [0b96376]
  - @mastra/deployer@0.1.0-alpha.41

## 0.1.0-alpha.45

### Patch Changes

- Updated dependencies [8329f1a]
  - @mastra/deployer@0.1.0-alpha.40

## 0.1.0-alpha.44

### Patch Changes

- Updated dependencies [8ea426a]
  - @mastra/deployer@0.1.0-alpha.39

## 0.1.0-alpha.43

### Patch Changes

- Updated dependencies [b80ea8d]
  - @mastra/deployer@0.1.0-alpha.34

## 0.1.0-alpha.42

### Minor Changes

- 4d4f6b6: Update deployer

### Patch Changes

- Updated dependencies [4d4f6b6]
  - @mastra/deployer@0.1.0-alpha.38
  - @mastra/core@0.2.0-alpha.92

## 0.1.0-alpha.41

### Patch Changes

- Updated dependencies [d7d465a]
- Updated dependencies [d7d465a]
- Updated dependencies [2017553]
- Updated dependencies [a10b7a3]
- Updated dependencies [16e5b04]
  - @mastra/core@0.2.0-alpha.91
  - @mastra/deployer@0.1.0-alpha.37

## 0.1.0-alpha.40

### Patch Changes

- Updated dependencies [8151f44]
- Updated dependencies [e897f1c]
- Updated dependencies [82a6d53]
- Updated dependencies [3700be1]
  - @mastra/core@0.2.0-alpha.90
  - @mastra/deployer@0.1.0-alpha.36

## 0.1.0-alpha.39

### Patch Changes

- Updated dependencies [27275c9]
  - @mastra/core@0.2.0-alpha.89
  - @mastra/deployer@0.1.0-alpha.35

## 0.1.0-alpha.38

### Patch Changes

- Updated dependencies [ab01c53]
- Updated dependencies [ccbc581]
  - @mastra/deployer@0.1.0-alpha.34
  - @mastra/core@0.2.0-alpha.88

## 0.1.0-alpha.37

### Patch Changes

- Updated dependencies [7365b6c]
  - @mastra/core@0.2.0-alpha.87
  - @mastra/deployer@0.1.0-alpha.33

## 0.1.0-alpha.36

### Minor Changes

- 5916f9d: Update deps from fixed to ^

### Patch Changes

- Updated dependencies [6fa4bd2]
- Updated dependencies [5916f9d]
- Updated dependencies [e2e76de]
- Updated dependencies [7f24c29]
- Updated dependencies [67637ba]
- Updated dependencies [04f3171]
  - @mastra/core@0.2.0-alpha.86
  - @mastra/deployer@0.1.0-alpha.32

## 0.0.1-alpha.35

### Patch Changes

- Updated dependencies [e9d1b47]
- Updated dependencies [c5f2d50]
  - @mastra/core@0.2.0-alpha.85
  - @mastra/deployer@0.0.1-alpha.31

## 0.0.1-alpha.34

### Patch Changes

- 32d15ec: Fix cloudflareDeployer build

## 0.0.1-alpha.33

### Patch Changes

- e27fe69: Add dir to deployer
- Updated dependencies [e27fe69]
  - @mastra/deployer@0.0.1-alpha.30

## 0.0.1-alpha.32

### Patch Changes

- 38b7f66: Update deployer logic
- Updated dependencies [2f17a5f]
- Updated dependencies [0696eeb]
- Updated dependencies [cb290ee]
- Updated dependencies [b4d7416]
- Updated dependencies [38b7f66]
  - @mastra/core@0.2.0-alpha.84
  - @mastra/deployer@0.0.1-alpha.29

## 0.0.1-alpha.31

### Patch Changes

- 9625602: Use mastra core splitted bundles in other packages
- Updated dependencies [2ab57d6]
- Updated dependencies [30322ce]
- Updated dependencies [78eec7c]
- Updated dependencies [9625602]
- Updated dependencies [8769a62]
  - @mastra/deployer@0.0.1-alpha.28
  - @mastra/core@0.2.0-alpha.83

## 0.0.1-alpha.30

### Patch Changes

- Updated dependencies [73d112c]
- Updated dependencies [ac8c61a]
  - @mastra/deployer@0.0.1-alpha.27
  - @mastra/core@0.1.27-alpha.82

## 0.0.1-alpha.29

### Patch Changes

- Updated dependencies [9fb3039]
  - @mastra/core@0.1.27-alpha.81
  - @mastra/deployer@0.0.1-alpha.26

## 0.0.1-alpha.28

### Patch Changes

- Updated dependencies [327ece7]
  - @mastra/core@0.1.27-alpha.80
  - @mastra/deployer@0.0.1-alpha.25

## 0.0.1-alpha.27

### Patch Changes

- Updated dependencies [21fe536]
  - @mastra/core@0.1.27-alpha.79
  - @mastra/deployer@0.0.1-alpha.24

## 0.0.1-alpha.26

### Patch Changes

- Updated dependencies [88f18d7]
  - @mastra/deployer@0.0.1-alpha.23

## 0.0.1-alpha.25

### Patch Changes

- 44c7c26: Rebuild

## 0.0.1-alpha.24

### Patch Changes

- Updated dependencies [685108a]
- Updated dependencies [685108a]
  - @mastra/deployer@0.0.1-alpha.22
  - @mastra/core@0.1.27-alpha.78

## 0.0.1-alpha.23

### Patch Changes

- 2b75edf: mastra deployers tsup bundling
- Updated dependencies [8105fae]
- Updated dependencies [cfb966f]
  - @mastra/core@0.1.27-alpha.77
  - @mastra/deployer@0.0.1-alpha.21

## 0.0.1-alpha.22

### Patch Changes

- Updated dependencies [ae7bf94]
- Updated dependencies [ae7bf94]
  - @mastra/deployer@0.0.1-alpha.20
  - @mastra/core@0.1.27-alpha.76

## 0.0.1-alpha.21

### Patch Changes

- Updated dependencies [23dcb23]
- Updated dependencies [7064554]
  - @mastra/core@0.1.27-alpha.75
  - @mastra/deployer@0.0.1-alpha.19

## 0.0.1-alpha.20

### Patch Changes

- Updated dependencies [7b87567]
  - @mastra/core@0.1.27-alpha.74
  - @mastra/deployer@0.0.1-alpha.18

## 0.0.1-alpha.19

### Patch Changes

- Updated dependencies [3427b95]
  - @mastra/core@0.1.27-alpha.73
  - @mastra/deployer@0.0.1-alpha.17

## 0.0.1-alpha.18

### Patch Changes

- Updated dependencies [e4d4ede]
- Updated dependencies [06b2c0a]
  - @mastra/core@0.1.27-alpha.72
  - @mastra/deployer@0.0.1-alpha.16

## 0.0.1-alpha.17

### Patch Changes

- Updated dependencies [d9c8dd0]
  - @mastra/deployer@0.0.1-alpha.15
  - @mastra/core@0.1.27-alpha.71

## 0.0.1-alpha.16

### Patch Changes

- Updated dependencies [ad2cd74]
  - @mastra/deployer@0.0.1-alpha.14

## 0.0.1-alpha.15

### Patch Changes

- Updated dependencies [a1774e7]
  - @mastra/deployer@0.0.1-alpha.13

## 0.0.1-alpha.14

### Patch Changes

- Updated dependencies [28dceab]
  - @mastra/deployer@0.0.1-alpha.12

## 0.0.1-alpha.13

### Patch Changes

- bdaf834: publish packages
- Updated dependencies [bdaf834]
  - @mastra/deployer@0.0.1-alpha.11

## 0.0.1-alpha.12

### Patch Changes

- Updated dependencies [dd6d87f]
- Updated dependencies [04434b6]
  - @mastra/core@0.1.27-alpha.70
  - @mastra/deployer@0.0.1-alpha.10

## 0.0.1-alpha.11

### Patch Changes

- 9066f95: CF deployer fixes
- Updated dependencies [9066f95]
  - @mastra/deployer@0.0.1-alpha.9

## 0.0.1-alpha.10

### Patch Changes

- 0d5a03d: Vector store modules

## 0.0.1-alpha.9

### Patch Changes

- Updated dependencies [b425845]
  - @mastra/deployer@0.0.1-alpha.8

## 0.0.1-alpha.8

### Patch Changes

- 1944807: Unified logger and major step in better logs
- c7abf8e: Optional CF worker tagging
- Updated dependencies [1944807]
- Updated dependencies [9ade36e]
  - @mastra/deployer@0.0.1-alpha.7
  - @mastra/core@0.1.27-alpha.69

## 0.0.1-alpha.7

### Patch Changes

- Updated dependencies [291fe57]
- Updated dependencies [1a41fbf]
  - @mastra/deployer@0.0.1-alpha.6

## 0.0.1-alpha.6

### Patch Changes

- Updated dependencies [0be7181]
- Updated dependencies [0be7181]
  - @mastra/core@0.1.27-alpha.68
  - @mastra/deployer@0.0.1-alpha.5

## 0.0.1-alpha.5

### Patch Changes

- Updated dependencies [7babd5c]
  - @mastra/deployer@0.0.1-alpha.4

## 0.0.1-alpha.4

### Patch Changes

- 026ca5d: Optional dispatcher namespace configuration for cloudflare deployments

## 0.0.1-alpha.3

### Patch Changes

- a291824: Deployer fixes
- Updated dependencies [c8ff2f5]
- Updated dependencies [a291824]
  - @mastra/core@0.1.27-alpha.67
  - @mastra/deployer@0.0.1-alpha.3

## 0.0.1-alpha.2

### Patch Changes

- 88600bc: Deployer fixes

## 0.0.1-alpha.1

### Patch Changes

- a9b5ddf: Publish new versions
- Updated dependencies [a9b5ddf]
- Updated dependencies [72c280b]
  - @mastra/deployer@0.0.1-alpha.2

## 0.0.1-alpha.0

### Patch Changes

- Updated dependencies [4139b43]
- Updated dependencies [a5604c4]
  - @mastra/deployer@0.0.1-alpha.0
