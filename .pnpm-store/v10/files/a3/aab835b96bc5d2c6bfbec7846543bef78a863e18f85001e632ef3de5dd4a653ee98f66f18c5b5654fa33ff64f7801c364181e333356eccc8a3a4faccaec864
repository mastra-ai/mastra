# @changesets/git

## 3.0.4

### Patch Changes

- [#1636](https://github.com/changesets/changesets/pull/1636) [`f73f84a`](https://github.com/changesets/changesets/commit/f73f84ac2d84d3ccf5ff55c0fc78aaaf3f3da20d) Thanks [@Netail](https://github.com/Netail)! - Correctly resolve new changesets with `since` option when the `.changeset` directory is not directly in the git root

## 3.0.3

### Patch Changes

- [#1620](https://github.com/changesets/changesets/pull/1620) [`b15e629`](https://github.com/changesets/changesets/commit/b15e6291c3e7e780ee9e58101d3069f2382569ae) Thanks [@Netail](https://github.com/Netail)! - Make sure that git diff always returns the paths relative to the git root in case diff.relative has been set to true in the git config

## 3.0.2

### Patch Changes

- [#1487](https://github.com/changesets/changesets/pull/1487) [`7323704`](https://github.com/changesets/changesets/commit/7323704dff6e76f488370db384579b86c95c866f) Thanks [@bluwy](https://github.com/bluwy)! - Bump `micromatch` dependency to ^4.0.8 to prevent installing version with vulnerability

- [#1514](https://github.com/changesets/changesets/pull/1514) [`962ab91`](https://github.com/changesets/changesets/commit/962ab918bc2deb89012a0cefce10387997cc54ed) Thanks [@nicoalonsop](https://github.com/nicoalonsop)! - Update spawndamnit to fix [cross-spawn vulnerability](https://security.snyk.io/vuln/SNYK-JS-CROSSSPAWN-8303230)

## 3.0.1

### Patch Changes

- [#1445](https://github.com/changesets/changesets/pull/1445) [`52c302a`](https://github.com/changesets/changesets/commit/52c302a48a662f71585f18f91dad3cbe49d75890) Thanks [@bluwy](https://github.com/bluwy)! - Remove unused `@babel/runtime` dependency

## 3.0.0

### Major Changes

- [#1185](https://github.com/changesets/changesets/pull/1185) [`a971652`](https://github.com/changesets/changesets/commit/a971652ec1403aab3fb89eb2f1640bd5012b895a) Thanks [@Andarist](https://github.com/Andarist)! - `package.json#exports` have been added to limit what (and how) code might be imported from the package.

### Patch Changes

- Updated dependencies [[`a971652`](https://github.com/changesets/changesets/commit/a971652ec1403aab3fb89eb2f1640bd5012b895a)]:
  - @changesets/errors@0.2.0
  - @changesets/types@6.0.0

## 2.0.0

### Major Changes

- [#1029](https://github.com/changesets/changesets/pull/1029) [`598136a`](https://github.com/changesets/changesets/commit/598136a32a00b620c9521d7a7151fbbc721c17d7) Thanks [@Andarist](https://github.com/Andarist)! - `getCommitsThatAddFiles` accepts an options object argument now where you can use `cwd` option.

  ```diff
  -getCommitsThatAddFiles(paths, cwd);
  +getCommitsThatAddFiles(paths, { cwd });
  ```

- [#1029](https://github.com/changesets/changesets/pull/1029) [`598136a`](https://github.com/changesets/changesets/commit/598136a32a00b620c9521d7a7151fbbc721c17d7) Thanks [@Andarist](https://github.com/Andarist)! - `getCurrentCommitId` and `getCommitsThatAddFiles` return full commit hashes now instead of short ones. You can get short ones by using the `short: true` option.

- [#1029](https://github.com/changesets/changesets/pull/1029) [`598136a`](https://github.com/changesets/changesets/commit/598136a32a00b620c9521d7a7151fbbc721c17d7) Thanks [@Andarist](https://github.com/Andarist)! - Previously deprecated `getCommitThatAddsFile` has been removed while `getCommitsThatAddFiles` is still available.

### Minor Changes

- [#1033](https://github.com/changesets/changesets/pull/1033) [`521205d`](https://github.com/changesets/changesets/commit/521205dc8c70fe71b181bd3c4bb7c9c6d2e721d2) Thanks [@Andarist](https://github.com/Andarist)! - `getChangedPackagesSinceRef` accepts now a new `changedFilePatterns` option. It can be used to determine which packages should be classified as changed. You can pass an array of glob patterns to it.

### Patch Changes

- Updated dependencies [[`521205d`](https://github.com/changesets/changesets/commit/521205dc8c70fe71b181bd3c4bb7c9c6d2e721d2)]:
  - @changesets/types@5.2.1

## 1.5.0

### Minor Changes

- [#662](https://github.com/changesets/changesets/pull/662) [`8c08469`](https://github.com/changesets/changesets/commit/8c0846977597ddaf51aaeb35f1f0f9428bf8ba14) Thanks [@JakeGinnivan](https://github.com/JakeGinnivan)! - Add `tagExists` & `remoteTagExists` git helpers

### Patch Changes

- Updated dependencies [[`8c08469`](https://github.com/changesets/changesets/commit/8c0846977597ddaf51aaeb35f1f0f9428bf8ba14)]:
  - @changesets/types@5.2.0

## 1.4.1

### Patch Changes

- [#889](https://github.com/changesets/changesets/pull/889) [`f64bc1b`](https://github.com/changesets/changesets/commit/f64bc1bb33457918eae34b22f214174ba3cf4504) Thanks [@jakubmazanec](https://github.com/jakubmazanec)! - Fixed `getCurrentCommitId` so that the returned value doesn't contain quotation marks on some Windows machines.

## 1.4.0

### Minor Changes

- [#858](https://github.com/changesets/changesets/pull/858) [`dd9b76f`](https://github.com/changesets/changesets/commit/dd9b76f162a546ae8b412e0cb10277f971f3585e) Thanks [@dotansimha](https://github.com/dotansimha)! - Added a new helper function: `getCurrentCommitId`

### Patch Changes

- Updated dependencies [[`dd9b76f`](https://github.com/changesets/changesets/commit/dd9b76f162a546ae8b412e0cb10277f971f3585e)]:
  - @changesets/types@5.1.0

## 1.3.2

### Patch Changes

- [#770](https://github.com/changesets/changesets/pull/770) [`eb86652`](https://github.com/changesets/changesets/commit/eb86652cbd21c49f90d2a03caa9a578593c4d102) Thanks [@alizeait](https://github.com/alizeait)! - `getChangedFilesSince` and `getChangedPackagesSinceRef` will now return the correct absolute paths of the changed files when the passed `cwd` is different from the repository's root.

- Updated dependencies [[`c87eba6`](https://github.com/changesets/changesets/commit/c87eba6f80a34563b7382f87472c29f6dafb546c)]:
  - @changesets/types@5.0.0

## 1.3.1

### Patch Changes

- Updated dependencies [[`27a5a82`](https://github.com/changesets/changesets/commit/27a5a82188914570d192162f9d045dfd082a3c15)]:
  - @changesets/types@4.1.0

## 1.3.0

### Minor Changes

- [#725](https://github.com/changesets/changesets/pull/725) [`77c1cef`](https://github.com/changesets/changesets/commit/77c1ceff402f390c1ededec358d914ba68a31d0d) Thanks [@RoystonS](https://github.com/RoystonS), [@Andarist](https://github.com/Andarist)! - New public utilities have been added: `deepenCloneBy` and `isRepoShallow`.

## 1.2.1

### Patch Changes

- [#667](https://github.com/changesets/changesets/pull/667) [`fe8db75`](https://github.com/changesets/changesets/commit/fe8db7500f81caea9064f8bec02bcb77e0fd8fce) Thanks [@fz6m](https://github.com/fz6m)! - Upgraded `@manypkg/get-packages` dependency to fix getting correct packages in pnpm workspaces with exclude rules.

- Updated dependencies [[`9a993ba`](https://github.com/changesets/changesets/commit/9a993ba09629c1620d749432520470cec49d3a96)]:
  - @changesets/types@4.0.2

## 1.2.0

### Minor Changes

- [#634](https://github.com/changesets/changesets/pull/634) [`2b49c39`](https://github.com/changesets/changesets/commit/2b49c390a7cf24ce859ac932b432eb6d8f55c98b) Thanks [@joeldenning](https://github.com/joeldenning)! - A new `getAllTags` utility has been added.

## 1.1.2

### Patch Changes

- Updated dependencies [[`e89e28a`](https://github.com/changesets/changesets/commit/e89e28a05f5fa43307db73812a6bcd269b62ddee)]:
  - @changesets/types@4.0.1

## 1.1.1

### Patch Changes

- Updated dependencies [[`de2b4a5`](https://github.com/changesets/changesets/commit/de2b4a5a7b244a37d94625bcb70ecde9dde5b612)]:
  - @changesets/types@4.0.0

## 1.1.0

### Minor Changes

- [`24d7bc9`](https://github.com/changesets/changesets/commit/24d7bc9e56a6dce7c64b39e8f73e50e21762faac) [#495](https://github.com/changesets/changesets/pull/495) Thanks [@RoystonS](https://github.com/RoystonS)! - Automatically deepen shallow clones in order to determine the correct commit at which changesets were added.

- [`24d7bc9`](https://github.com/changesets/changesets/commit/24d7bc9e56a6dce7c64b39e8f73e50e21762faac) [#495](https://github.com/changesets/changesets/pull/495) Thanks [@RoystonS](https://github.com/RoystonS)! - Deprecate the `getCommitThatAddsFile` function. It's replaced with a bulk `getCommitsThatAddFiles` operation which will safely deepen a
  shallow repo whilst processing multiple filenames simultaneously.

## 1.0.6

### Patch Changes

- [`1dd3117`](https://github.com/changesets/changesets/commit/1dd311708c65321e1a1c99d36129190f940435ed) [#418](https://github.com/changesets/changesets/pull/418) Thanks [@jonathanmorley](https://github.com/jonathanmorley)! - Don't return paths for unchanged packages

- Updated dependencies [[`a57d163`](https://github.com/changesets/changesets/commit/a57d16355ad7d67b18b768c8f79224d80afa507c)]:
  - @changesets/types@3.1.1

## 1.0.5

### Patch Changes

- [`89f0c49`](https://github.com/changesets/changesets/commit/89f0c497ac21b8d008da67caff8032947836c7b1) [#352](https://github.com/changesets/changesets/pull/352) Thanks [@MichaelKapustey](https://github.com/MichaelKapustey)! - Previously packages nested inside of other packages would show both the nested package and the outer package as changed. Now, only the nested package will show as changed.

- [`09f62f9`](https://github.com/changesets/changesets/commit/09f62f9c822f31899a48cbd93c7801d72a80b97e) [#355](https://github.com/changesets/changesets/pull/355) Thanks [@acheronfail](https://github.com/acheronfail)! - Fix an issue where refs that didn't exist were silently ignored

- Updated dependencies [[`2b49d66`](https://github.com/changesets/changesets/commit/2b49d668ecaa1333bc5c7c5be4648dda1b11528d)]:
  - @changesets/types@3.0.0

## 1.0.4

### Patch Changes

- [`aa840db`](https://github.com/changesets/changesets/commit/aa840db824c321159e3b1c66ea663b4036084bd7) [#336](https://github.com/changesets/changesets/pull/336) Thanks [@MichaelKapustey](https://github.com/MichaelKapustey)! - Changed packages detection fixed on Windows.

## 1.0.3

### Patch Changes

- [`1706fb7`](https://github.com/changesets/changesets/commit/1706fb751ecc2f5a792c42f467b2063078d58716) [#321](https://github.com/changesets/changesets/pull/321) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Fix TypeScript declarations

- Updated dependencies [[`1706fb7`](https://github.com/changesets/changesets/commit/1706fb751ecc2f5a792c42f467b2063078d58716)]:
  - @changesets/errors@0.1.4
  - @changesets/types@2.0.1

## 1.0.2

### Patch Changes

- Updated dependencies [[`011d57f`](https://github.com/changesets/changesets/commit/011d57f1edf9e37f75a8bef4f918e72166af096e)]:
  - @changesets/types@2.0.0

## 1.0.1

### Patch Changes

- [`04ddfd7`](https://github.com/changesets/changesets/commit/04ddfd7c3acbfb84ef9c92873fe7f9dea1f5145c) [#305](https://github.com/changesets/changesets/pull/305) Thanks [@Noviny](https://github.com/Noviny)! - Add link to changelog in readme

- [`b49e1cf`](https://github.com/changesets/changesets/commit/b49e1cff65dca7fe9e341a35aa91704aa0e51cb3) [#306](https://github.com/changesets/changesets/pull/306) Thanks [@Andarist](https://github.com/Andarist)! - Ignore `node_modules` when glob searching for packages. This fixes an issue with package cycles.

- Updated dependencies [[`04ddfd7`](https://github.com/changesets/changesets/commit/04ddfd7c3acbfb84ef9c92873fe7f9dea1f5145c), [`e56928b`](https://github.com/changesets/changesets/commit/e56928bbd6f9096def06ac37487bdbf28efec9d1)]:
  - @changesets/errors@0.1.3
  - @changesets/types@1.0.1

## 1.0.0

### Major Changes

- [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20) [#290](https://github.com/changesets/changesets/pull/290) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Use `@manypkg/get-packages` instead of `get-workspaces` in `getChangedPackagesSinceRef`. This means `getChangedPackagesSinceRef` now returns `Promise<Package[]>`(where `Package` is from `@manypkg/get-packages`) rather than `Promise<Workspace[]>`(where `Workspace` is from `get-workspaces`). The notable change is that `config` was renamed to `packageJson` and the package objects don't have a `name` field(use `packageJson.name` instead).

### Patch Changes

- Updated dependencies [[`41e2e3d`](https://github.com/changesets/changesets/commit/41e2e3dd1053ff2f35a1a07e60793c9099f26997), [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20), [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20), [`2363366`](https://github.com/changesets/changesets/commit/2363366756d1b15bddf6d803911baccfca03cbdf)]:
  - @changesets/types@1.0.0

## 0.4.0

### Minor Changes

- [`fe0d9192`](https://github.com/changesets/changesets/commit/fe0d9192544646e1a755202b87dfe850c1c200a3) [#236](https://github.com/changesets/changesets/pull/236) Thanks [@Andarist](https://github.com/Andarist)! - Read also pnpm workspace packages when searching for packages.

### Patch Changes

- Updated dependencies [[`fe0d9192`](https://github.com/changesets/changesets/commit/fe0d9192544646e1a755202b87dfe850c1c200a3), [`fe0d9192`](https://github.com/changesets/changesets/commit/fe0d9192544646e1a755202b87dfe850c1c200a3)]:
  - get-workspaces@0.6.0

## 0.3.0

### Minor Changes

- [`bca8865`](https://github.com/changesets/changesets/commit/bca88652d38caa31e789c4564230ba0b49562ad2) [#221](https://github.com/changesets/changesets/pull/221) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Removed `getChangedPackagesSinceMaster` and `getChangedChangesetFilesSinceMaster` and replace them with `getChangedPackagesSinceRef` and `getChangedChangesetFilesSinceRef`. The new methods along with `getChangedFilesSince` also now require arguments as an object with `cwd` and `ref` properties to avoid accidentally passing `cwd` as `ref` and vice versa

## 0.2.5

### Patch Changes

- [`b17ed74`](https://github.com/changesets/changesets/commit/b17ed7411ea57e38b20e646321d5053b213d198a) [#216](https://github.com/changesets/changesets/pull/216) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Get commit from the creation of a changeset rather than the last modification

## 0.2.4

### Patch Changes

- Updated dependencies [[`8f0a1ef`](https://github.com/changesets/changesets/commit/8f0a1ef327563512f471677ef0ca99d30da009c0), [`8f0a1ef`](https://github.com/changesets/changesets/commit/8f0a1ef327563512f471677ef0ca99d30da009c0), [`8f0a1ef`](https://github.com/changesets/changesets/commit/8f0a1ef327563512f471677ef0ca99d30da009c0)]:
  - @changesets/types@0.4.0
  - @changesets/errors@0.1.2
  - get-workspaces@0.5.2

## 0.2.3

### Patch Changes

- Updated dependencies [[`94de7c1`](https://github.com/changesets/changesets/commit/94de7c1df278d63f98b599c08271ba4ef26bc3f8)]:
  - @changesets/errors@0.1.0

## 0.2.2

### Patch Changes

- [89c0894](https://github.com/changesets/changesets/commit/89c08944fac84f71241305e359e9717ad4ec1b62) [#167](https://github.com/changesets/changesets/pull/167) Thanks [@Noviny](https://github.com/Noviny)! - Fix broken `sinceMaster` arg - which was not working with v2 changesets

## 0.2.1

### Patch Changes

- [8c43fa0](https://github.com/changesets/changesets/commit/8c43fa061e2a5a01e4f32504ed351d261761c8dc) [#155](https://github.com/changesets/changesets/pull/155) Thanks [@Noviny](https://github.com/Noviny)! - Add Readme

- [0320391](https://github.com/changesets/changesets/commit/0320391699a73621d0e51ce031062a06cbdefadc) [#163](https://github.com/changesets/changesets/pull/163) Thanks [@Noviny](https://github.com/Noviny)! - Reordered dependencies in the package json (this should have no impact)

- Updated dependencies [8c43fa0, 1ff73b7]:
  - @changesets/types@0.3.0

## 0.2.0

### Minor Changes

- [296a6731](https://github.com/changesets/changesets/commit/296a6731) - Safety bump: Towards the end of preparing changesets v2, there was a lot of chaos - this bump is to ensure every package on npm matches what is found in the repository.

### Patch Changes

- Updated dependencies [296a6731]:
  - get-workspaces@0.5.0
  - @changesets/types@0.2.0

## 0.1.2

### Patch Changes

- [a15abbf9](https://github.com/changesets/changesets/commit/a15abbf9) - Previous release shipped unbuilt code - fixing that

## 0.1.0

### Minor Changes

- [6d119893](https://github.com/changesets/changesets/commit/6d119893) - Initial Release

### Patch Changes

- [c46e9ee7](https://github.com/changesets/changesets/commit/c46e9ee7) - Use 'spawndamnit' package for all new process spawning
