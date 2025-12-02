# @changesets/get-dependents-graph

## 2.1.3

### Patch Changes

- Updated dependencies [[`84a4a1b`](https://github.com/changesets/changesets/commit/84a4a1b1d399bfd0a58677b0182b9c053194febf)]:
  - @changesets/types@6.1.0

## 2.1.2

### Patch Changes

- [#1417](https://github.com/changesets/changesets/pull/1417) [`bc75c1a`](https://github.com/changesets/changesets/commit/bc75c1a74c2d46e08620c7aa0e9f4f5ef40a9b55) Thanks [@trivikr](https://github.com/trivikr)! - Replace `chalk` with `picocolors` to reduce install size

- [#1445](https://github.com/changesets/changesets/pull/1445) [`52c302a`](https://github.com/changesets/changesets/commit/52c302a48a662f71585f18f91dad3cbe49d75890) Thanks [@bluwy](https://github.com/bluwy)! - Remove unused `@babel/runtime` dependency

## 2.1.1

### Patch Changes

- [#1400](https://github.com/changesets/changesets/pull/1400) [`dd6e5bb`](https://github.com/changesets/changesets/commit/dd6e5bbf74e246d7a742aa50424989462679b0ca) Thanks [@Andarist](https://github.com/Andarist)! - Fixed a crash in `getDependentsGraph` in a scenario when a workspace depends on the root workspace

## 2.1.0

### Minor Changes

- [#1370](https://github.com/changesets/changesets/pull/1370) [`5e9d33a`](https://github.com/changesets/changesets/commit/5e9d33a2e659abdcf26f204a76a9465cf4b26d6b) Thanks [@Andarist](https://github.com/Andarist)! - Added a new `ignoreDevDependencies` option

## 2.0.0

### Major Changes

- [#1185](https://github.com/changesets/changesets/pull/1185) [`a971652`](https://github.com/changesets/changesets/commit/a971652ec1403aab3fb89eb2f1640bd5012b895a) Thanks [@Andarist](https://github.com/Andarist)! - `package.json#exports` have been added to limit what (and how) code might be imported from the package.

### Patch Changes

- Updated dependencies [[`a971652`](https://github.com/changesets/changesets/commit/a971652ec1403aab3fb89eb2f1640bd5012b895a)]:
  - @changesets/types@6.0.0

## 1.3.6

### Patch Changes

- [#1176](https://github.com/changesets/changesets/pull/1176) [`41988ce`](https://github.com/changesets/changesets/commit/41988ceb8c1cedd3857c939448bf3965494ff0a4) Thanks [@joshwooding](https://github.com/joshwooding)! - Bump [`semver`](https://github.com/npm/node-semver) dependency to v7.5.3

## 1.3.5

### Patch Changes

- Updated dependencies [[`521205d`](https://github.com/changesets/changesets/commit/521205dc8c70fe71b181bd3c4bb7c9c6d2e721d2)]:
  - @changesets/types@5.2.1

## 1.3.4

### Patch Changes

- Updated dependencies [[`8c08469`](https://github.com/changesets/changesets/commit/8c0846977597ddaf51aaeb35f1f0f9428bf8ba14)]:
  - @changesets/types@5.2.0

## 1.3.3

### Patch Changes

- Updated dependencies [[`dd9b76f`](https://github.com/changesets/changesets/commit/dd9b76f162a546ae8b412e0cb10277f971f3585e)]:
  - @changesets/types@5.1.0

## 1.3.2

### Patch Changes

- Updated dependencies [[`c87eba6`](https://github.com/changesets/changesets/commit/c87eba6f80a34563b7382f87472c29f6dafb546c)]:
  - @changesets/types@5.0.0

## 1.3.1

### Patch Changes

- Updated dependencies [[`27a5a82`](https://github.com/changesets/changesets/commit/27a5a82188914570d192162f9d045dfd082a3c15)]:
  - @changesets/types@4.1.0

## 1.3.0

### Minor Changes

- [#704](https://github.com/changesets/changesets/pull/704) [`6f9c9d6`](https://github.com/changesets/changesets/commit/6f9c9d60c0e02c79d555c48deb01559057f1d252) Thanks [@Andarist](https://github.com/Andarist)! - Dependencies specified using a tag will no longer mark the graph as invalid. With such dependencies the user's intent is to fetch those from the registry even if otherwise they could be linked locally.

## 1.2.4

### Patch Changes

- [#667](https://github.com/changesets/changesets/pull/667) [`fe8db75`](https://github.com/changesets/changesets/commit/fe8db7500f81caea9064f8bec02bcb77e0fd8fce) Thanks [@fz6m](https://github.com/fz6m)! - Upgraded `@manypkg/get-packages` dependency to fix getting correct packages in pnpm workspaces with exclude rules.

- Updated dependencies [[`9a993ba`](https://github.com/changesets/changesets/commit/9a993ba09629c1620d749432520470cec49d3a96)]:
  - @changesets/types@4.0.2

## 1.2.3

### Patch Changes

- [#585](https://github.com/changesets/changesets/pull/585) [`74dda8c`](https://github.com/changesets/changesets/commit/74dda8c0d8bd1741ca7b19f0ccb37b2330dc9549) Thanks [@javier-garcia-meteologica](https://github.com/javier-garcia-meteologica)! - Add support for `workspace:^` and `workspace:~` dependency ranges.

## 1.2.2

### Patch Changes

- Updated dependencies [[`e89e28a`](https://github.com/changesets/changesets/commit/e89e28a05f5fa43307db73812a6bcd269b62ddee)]:
  - @changesets/types@4.0.1

## 1.2.1

### Patch Changes

- Updated dependencies [[`de2b4a5`](https://github.com/changesets/changesets/commit/de2b4a5a7b244a37d94625bcb70ecde9dde5b612)]:
  - @changesets/types@4.0.0

## 1.2.0

### Minor Changes

- [`12f9a43`](https://github.com/changesets/changesets/commit/12f9a433a6c3ac38f9405fcd77c9108c423d7101) [#507](https://github.com/changesets/changesets/pull/507) Thanks [@zkochan](https://github.com/zkochan)! - New setting added: bumpVersionsWithWorkspaceProtocolOnly. When it is set to `true`, versions are bumped in `dependencies`, only if those versions are prefixed by the workspace protocol. For instance, `"foo": "workspace:^1.0.0"`.

### Patch Changes

- Updated dependencies [[`12f9a43`](https://github.com/changesets/changesets/commit/12f9a433a6c3ac38f9405fcd77c9108c423d7101)]:
  - @changesets/types@3.3.0

## 1.1.3

### Patch Changes

- Updated dependencies [[`2b49d66`](https://github.com/changesets/changesets/commit/2b49d668ecaa1333bc5c7c5be4648dda1b11528d)]:
  - @changesets/types@3.0.0

## 1.1.2

### Patch Changes

- [`d678da5`](https://github.com/changesets/changesets/commit/d678da5e9936862bb66e5edb538c5b8be23d4ffe) [#324](https://github.com/changesets/changesets/pull/324) Thanks [@zkochan](https://github.com/zkochan)! - Dev dependencies that are installed via the link or file protocol are ignored.

## 1.1.1

### Patch Changes

- [`1706fb7`](https://github.com/changesets/changesets/commit/1706fb751ecc2f5a792c42f467b2063078d58716) [#321](https://github.com/changesets/changesets/pull/321) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Fix TypeScript declarations

- Updated dependencies [[`1706fb7`](https://github.com/changesets/changesets/commit/1706fb751ecc2f5a792c42f467b2063078d58716)]:
  - @changesets/types@2.0.1

## 1.1.0

### Minor Changes

- [`c3cc232`](https://github.com/changesets/changesets/commit/c3cc23204c6cb80487aced1b37ebe8ffde0e2111) [#311](https://github.com/changesets/changesets/pull/311) Thanks [@zkochan](https://github.com/zkochan)! - Added support for workspace ranges. Package graph validation understands them now and allows them to satisfy dependents' required ranges.

### Patch Changes

- Updated dependencies [[`011d57f`](https://github.com/changesets/changesets/commit/011d57f1edf9e37f75a8bef4f918e72166af096e)]:
  - @changesets/types@2.0.0

## 1.0.1

### Patch Changes

- [`04ddfd7`](https://github.com/changesets/changesets/commit/04ddfd7c3acbfb84ef9c92873fe7f9dea1f5145c) [#305](https://github.com/changesets/changesets/pull/305) Thanks [@Noviny](https://github.com/Noviny)! - Add link to changelog in readme

- [`b49e1cf`](https://github.com/changesets/changesets/commit/b49e1cff65dca7fe9e341a35aa91704aa0e51cb3) [#306](https://github.com/changesets/changesets/pull/306) Thanks [@Andarist](https://github.com/Andarist)! - Ignore `node_modules` when glob searching for packages. This fixes an issue with package cycles.

- Updated dependencies [[`04ddfd7`](https://github.com/changesets/changesets/commit/04ddfd7c3acbfb84ef9c92873fe7f9dea1f5145c), [`e56928b`](https://github.com/changesets/changesets/commit/e56928bbd6f9096def06ac37487bdbf28efec9d1)]:
  - @changesets/types@1.0.1

## 1.0.0

### Major Changes

- [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20) [#290](https://github.com/changesets/changesets/pull/290) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Initial release of `@changesets/get-dependents-graph`. If you're migrating from `get-dependents-graph`, you will need to pass the `Packages` object(which is returned from `@manypkg/get-packages`) to `getDependentsGraph` and also import `getDependentsGraph` as a named export instead of a default export.

### Patch Changes

- Updated dependencies [[`41e2e3d`](https://github.com/changesets/changesets/commit/41e2e3dd1053ff2f35a1a07e60793c9099f26997), [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20), [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20), [`2363366`](https://github.com/changesets/changesets/commit/2363366756d1b15bddf6d803911baccfca03cbdf)]:
  - @changesets/types@1.0.0
