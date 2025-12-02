# @changesets/assemble-release-plan

## 6.0.9

### Patch Changes

- [#1693](https://github.com/changesets/changesets/pull/1693) [`6352819`](https://github.com/changesets/changesets/commit/6352819685369daecf31f72e948d0fe92ff33485) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `workspace:^` and `workspace:~` dependency ranges not being semantically treated as, respectively, `^CURRENT_VERSION` and `~CURRENT_VERSION`. This led to dependent packages being, at times, bumped too often when their dependencies with those ranges were bumped.

## 6.0.8

### Patch Changes

- [#1668](https://github.com/changesets/changesets/pull/1668) [`65d6632`](https://github.com/changesets/changesets/commit/65d663278867b0495d49e9e3e9c5c4c0158b8627) Thanks [@Andarist](https://github.com/Andarist)! - Fixed a crash in pre mode when trying to version private packages when tagging for private package is disabled

## 6.0.7

### Patch Changes

- [#1589](https://github.com/changesets/changesets/pull/1589) [`de8bebc`](https://github.com/changesets/changesets/commit/de8bebc93b81cb333c3c7e1ed8a3687926b7fcd8) Thanks [@remorses](https://github.com/remorses), [@vzt7](https://github.com/vzt7)! - Fixed a crash in prerelease mode when a package misses the version field in its `package.json`

## 6.0.6

### Patch Changes

- Updated dependencies [[`84a4a1b`](https://github.com/changesets/changesets/commit/84a4a1b1d399bfd0a58677b0182b9c053194febf)]:
  - @changesets/types@6.1.0
  - @changesets/get-dependents-graph@2.1.3
  - @changesets/should-skip-package@0.1.2

## 6.0.5

### Patch Changes

- [#1508](https://github.com/changesets/changesets/pull/1508) [`26c8ba9`](https://github.com/changesets/changesets/commit/26c8ba9f58d3b123a19106771b4bdcb2800235cc) Thanks [@stevethedev](https://github.com/stevethedev)! - Add error-reporting for when a changeset references a non-existent package

## 6.0.4

### Patch Changes

- [#1445](https://github.com/changesets/changesets/pull/1445) [`52c302a`](https://github.com/changesets/changesets/commit/52c302a48a662f71585f18f91dad3cbe49d75890) Thanks [@bluwy](https://github.com/bluwy)! - Remove unused `@babel/runtime` dependency

- Updated dependencies [[`bc75c1a`](https://github.com/changesets/changesets/commit/bc75c1a74c2d46e08620c7aa0e9f4f5ef40a9b55), [`52c302a`](https://github.com/changesets/changesets/commit/52c302a48a662f71585f18f91dad3cbe49d75890)]:
  - @changesets/get-dependents-graph@2.1.2
  - @changesets/should-skip-package@0.1.1

## 6.0.3

### Patch Changes

- Updated dependencies [[`dd6e5bb`](https://github.com/changesets/changesets/commit/dd6e5bbf74e246d7a742aa50424989462679b0ca)]:
  - @changesets/get-dependents-graph@2.1.1

## 6.0.2

### Patch Changes

- Updated dependencies [[`5e9d33a`](https://github.com/changesets/changesets/commit/5e9d33a2e659abdcf26f204a76a9465cf4b26d6b)]:
  - @changesets/get-dependents-graph@2.1.0

## 6.0.1

### Patch Changes

- [#1361](https://github.com/changesets/changesets/pull/1361) [`954a16a`](https://github.com/changesets/changesets/commit/954a16aa1d118a0f7fa745ffe0d19b304f685d4c) Thanks [@jakebailey](https://github.com/jakebailey)! - Version 2.25.0 introduced the `privatePackage` configuration option with default `{ version: false, tag: false }`; due to a bug, these options were not respected in all commands, leading to commands like `changeset tag` still tagging private packages. This has been fixed, and all packages now respect this option.

## 6.0.0

### Major Changes

- [#1185](https://github.com/changesets/changesets/pull/1185) [`a971652`](https://github.com/changesets/changesets/commit/a971652ec1403aab3fb89eb2f1640bd5012b895a) Thanks [@Andarist](https://github.com/Andarist)! - `package.json#exports` have been added to limit what (and how) code might be imported from the package.

### Patch Changes

- Updated dependencies [[`a971652`](https://github.com/changesets/changesets/commit/a971652ec1403aab3fb89eb2f1640bd5012b895a)]:
  - @changesets/get-dependents-graph@2.0.0
  - @changesets/errors@0.2.0
  - @changesets/types@6.0.0

## 5.2.4

### Patch Changes

- [#1176](https://github.com/changesets/changesets/pull/1176) [`41988ce`](https://github.com/changesets/changesets/commit/41988ceb8c1cedd3857c939448bf3965494ff0a4) Thanks [@joshwooding](https://github.com/joshwooding)! - Bump [`semver`](https://github.com/npm/node-semver) dependency to v7.5.3

- Updated dependencies [[`41988ce`](https://github.com/changesets/changesets/commit/41988ceb8c1cedd3857c939448bf3965494ff0a4)]:
  - @changesets/get-dependents-graph@1.3.6

## 5.2.3

### Patch Changes

- Updated dependencies [[`521205d`](https://github.com/changesets/changesets/commit/521205dc8c70fe71b181bd3c4bb7c9c6d2e721d2)]:
  - @changesets/types@5.2.1
  - @changesets/get-dependents-graph@1.3.5

## 5.2.2

### Patch Changes

- [#949](https://github.com/changesets/changesets/pull/949) [`64585ea`](https://github.com/changesets/changesets/commit/64585ea4323c4cf51a23b0635990b568d1f58b2b) Thanks [@Andarist](https://github.com/Andarist), [@BPScott](https://github.com/BPScott)! - Fixed the issue that caused transitive dependents of dev dependents to be bumped when a package got bumped and when using `___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH.updateInternalDependents: "always"`. To illustrate this with an example:

  ```
  pkg-a - version: 1.0.0
  pkg-b - devDependencies['pkg-a']: 1.0.0
  pkg-c - dependencies['pkg-b']: 1.0.0
  ```

  With a changeset for `pkg-a` the `pkg-c` could have been sometimes incorrectly released.

- Updated dependencies [[`8c08469`](https://github.com/changesets/changesets/commit/8c0846977597ddaf51aaeb35f1f0f9428bf8ba14)]:
  - @changesets/types@5.2.0
  - @changesets/get-dependents-graph@1.3.4

## 5.2.1

### Patch Changes

- [#914](https://github.com/changesets/changesets/pull/914) [`b023e4b`](https://github.com/changesets/changesets/commit/b023e4b3d1ad793a5dd1187b720e8103cebfb937) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with the `assembleReleasePlan`'s signature not being compatible with the old shape of the `config` and `snapshot` parameters. This could have caused runtime errors during snapshot releases when only some of the Changesets transitive dependencies were updated without other ones.

## 5.2.0

### Minor Changes

- [#858](https://github.com/changesets/changesets/pull/858) [`dd9b76f`](https://github.com/changesets/changesets/commit/dd9b76f162a546ae8b412e0cb10277f971f3585e) Thanks [@dotansimha](https://github.com/dotansimha)! - Added a new config option: `snapshot.prereleaseTemplate` for customizing the way snapshot release numbers are being composed.

### Patch Changes

- Updated dependencies [[`dd9b76f`](https://github.com/changesets/changesets/commit/dd9b76f162a546ae8b412e0cb10277f971f3585e)]:
  - @changesets/types@5.1.0
  - @changesets/get-dependents-graph@1.3.3

## 5.1.3

### Patch Changes

- [#767](https://github.com/changesets/changesets/pull/767) [`d6bfcc5`](https://github.com/changesets/changesets/commit/d6bfcc5052dcba18c521a20d62e2e67a81819112) Thanks [@Andarist](https://github.com/Andarist)! - Improve the error message when a package referenced in a changeset can't be found. The message will now also include the changeset's ID.

## 5.1.2

### Patch Changes

- Updated dependencies [[`c87eba6`](https://github.com/changesets/changesets/commit/c87eba6f80a34563b7382f87472c29f6dafb546c)]:
  - @changesets/types@5.0.0
  - @changesets/get-dependents-graph@1.3.2

## 5.1.1

### Patch Changes

- [#769](https://github.com/changesets/changesets/pull/769) [`3e8e672`](https://github.com/changesets/changesets/commit/3e8e6721d31f80fff28826e0fad2c14216c3d94f) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an infinite loop involving a fixed group of packages and a package within that group that was both ignored and dependent on another package from that group.

## 5.1.0

### Minor Changes

- [#690](https://github.com/changesets/changesets/pull/690) [`27a5a82`](https://github.com/changesets/changesets/commit/27a5a82188914570d192162f9d045dfd082a3c15) Thanks [@Andarist](https://github.com/Andarist)! - Added handling of the `fixed` config option. This adds all the packages from the `fixed` group to the assembled release and added releases end up having the same version.

### Patch Changes

- [#706](https://github.com/changesets/changesets/pull/706) [`0812858`](https://github.com/changesets/changesets/commit/0812858996045e602d22f2b7dd13e8673e3b36b0) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with `"none"` releases causing package versions being bumped during snapshot releases. In addition to when you create `"none"` release types explicitly Changesets might create them implicitly in some situations, for example under some circumstances this issue caused snapshot releases to be created sometimes for ignored packages.

- [#751](https://github.com/changesets/changesets/pull/751) [`59c7ebc`](https://github.com/changesets/changesets/commit/59c7ebc7a5e75f69f5487e95a85cd1b7062ac39d) Thanks [@Rugvip](https://github.com/Rugvip)! - Fixed an issue where dependent packages would sometimes not get bumped properly when exiting prerelease mode.

- [#703](https://github.com/changesets/changesets/pull/703) [`15c461d`](https://github.com/changesets/changesets/commit/15c461d5de94a274ccc8b33755a133a513339b0a) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with dependant packages being always bumped when their `*` dependency was bumped.

- Updated dependencies [[`27a5a82`](https://github.com/changesets/changesets/commit/27a5a82188914570d192162f9d045dfd082a3c15)]:
  - @changesets/types@4.1.0
  - @changesets/get-dependents-graph@1.3.1

## 5.0.5

### Patch Changes

- [#693](https://github.com/changesets/changesets/pull/693) [`1be201f`](https://github.com/changesets/changesets/commit/1be201fc27903cb2f42137400b5484c4ccad3812) Thanks [@luciaquirke](https://github.com/luciaquirke)! - Fixed an issue with `none` release type sometimes overriding other release types and thus preventing a release from happening.

- Updated dependencies [[`6f9c9d6`](https://github.com/changesets/changesets/commit/6f9c9d60c0e02c79d555c48deb01559057f1d252)]:
  - @changesets/get-dependents-graph@1.3.0

## 5.0.4

### Patch Changes

- [#692](https://github.com/changesets/changesets/pull/692) [`e4c4b29`](https://github.com/changesets/changesets/commit/e4c4b2934beee9b25a927b4ae1b7280f4323d4ff) Thanks [@jakubmazanec](https://github.com/jakubmazanec)! - Fix snapshot timestamp so its date part contains the correct date and the timestamp can be used for collation.

## 5.0.3

### Patch Changes

- [#667](https://github.com/changesets/changesets/pull/667) [`fe8db75`](https://github.com/changesets/changesets/commit/fe8db7500f81caea9064f8bec02bcb77e0fd8fce) Thanks [@fz6m](https://github.com/fz6m)! - Upgraded `@manypkg/get-packages` dependency to fix getting correct packages in pnpm workspaces with exclude rules.

- Updated dependencies [[`fe8db75`](https://github.com/changesets/changesets/commit/fe8db7500f81caea9064f8bec02bcb77e0fd8fce), [`9a993ba`](https://github.com/changesets/changesets/commit/9a993ba09629c1620d749432520470cec49d3a96)]:
  - @changesets/get-dependents-graph@1.2.4
  - @changesets/types@4.0.2

## 5.0.2

### Patch Changes

- Updated dependencies [[`74dda8c`](https://github.com/changesets/changesets/commit/74dda8c0d8bd1741ca7b19f0ccb37b2330dc9549)]:
  - @changesets/get-dependents-graph@1.2.3

## 5.0.1

### Patch Changes

- Updated dependencies [[`e89e28a`](https://github.com/changesets/changesets/commit/e89e28a05f5fa43307db73812a6bcd269b62ddee)]:
  - @changesets/types@4.0.1
  - @changesets/get-dependents-graph@1.2.2

## 5.0.0

### Major Changes

- [#542](https://github.com/changesets/changesets/pull/542) [`de2b4a5`](https://github.com/changesets/changesets/commit/de2b4a5a7b244a37d94625bcb70ecde9dde5b612) Thanks [@Andarist](https://github.com/Andarist)! - The accepted `Config` type has been changed - a new experimental option (`updateInternalDependents`) was added to it.

### Patch Changes

- Updated dependencies [[`de2b4a5`](https://github.com/changesets/changesets/commit/de2b4a5a7b244a37d94625bcb70ecde9dde5b612)]:
  - @changesets/types@4.0.0
  - @changesets/get-dependents-graph@1.2.1

## 4.1.1

### Patch Changes

- [#441](https://github.com/changesets/changesets/pull/441) [`8b9ac07`](https://github.com/changesets/changesets/commit/8b9ac076a87eaf9556ec5ede0222a75182095662) Thanks [@joshlartz](https://github.com/joshlartz)! - Fixed an issue with including dependents in the release plan for dependencies using `workspace:` protocol that had a `none` changeset for them.

## 4.1.0

### Minor Changes

- [`12f9a43`](https://github.com/changesets/changesets/commit/12f9a433a6c3ac38f9405fcd77c9108c423d7101) [#507](https://github.com/changesets/changesets/pull/507) Thanks [@zkochan](https://github.com/zkochan)! - New setting added: bumpVersionsWithWorkspaceProtocolOnly. When it is set to `true`, versions are bumped in `dependencies`, only if those versions are prefixed by the workspace protocol. For instance, `"foo": "workspace:^1.0.0"`.

### Patch Changes

- Updated dependencies [[`12f9a43`](https://github.com/changesets/changesets/commit/12f9a433a6c3ac38f9405fcd77c9108c423d7101)]:
  - @changesets/get-dependents-graph@1.2.0
  - @changesets/types@3.3.0

## 4.0.1

### Patch Changes

- [`e92cc01`](https://github.com/changesets/changesets/commit/e92cc0138bfbc041c77e6c7d054f2aa101cece5a) [#482](https://github.com/changesets/changesets/pull/482) Thanks [@jonathanmorley](https://github.com/jonathanmorley)! - Fixed an issue with bumping a peer dependency using a `"none"` changeset type resulting in the dependent package being major bumped.

## 4.0.0

### Major Changes

- [`ab98fe3`](https://github.com/changesets/changesets/commit/ab98fe33814867ba740fc04733602be80771915c) [#454](https://github.com/changesets/changesets/pull/454) Thanks [@Andarist](https://github.com/Andarist)! - Returned releases in pre mode will have type of the highest bump type within the current release now, instead of having the highest bump type from among all changesets within this pre mode. So if you release a new prerelease including a major bump and later release the same package with a minor bump the assembled release will be of type minor - the final computed version will, of course, still be the next one for a major bump.

### Patch Changes

- [`d1d987c`](https://github.com/changesets/changesets/commit/d1d987c42cddff8be5d7f04d3ebb5a262779fa9f) [#455](https://github.com/changesets/changesets/pull/455) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with linked package being assigned a non-none release type when another package from the linked set has been added to current releases and the package had just a none release type.

- [`9d99bd1`](https://github.com/changesets/changesets/commit/9d99bd16f2b6b3ab4fe820358d4c9f313cb2ae76) [#446](https://github.com/changesets/changesets/pull/446) Thanks [@Andarist](https://github.com/Andarist)! - Fixed an issue with dependent packages not being updated to their highest bump type in pre mode sometimes. This could happen when dependent packages were only versioned because of their dependencies being upgraded and not because of a dedicated changeset for those dependent packages.

  For the very same reason linked packages were also not always bumped correctly in pre mode to the highest bump type in a linked group.

## 3.0.1

### Patch Changes

- [`d531dbd`](https://github.com/changesets/changesets/commit/d531dbdc9ac22faccb20356e9ea1313e5095cf9d) [#412](https://github.com/changesets/changesets/pull/412) Thanks [@Feiyang1](https://github.com/Feiyang1)! - Fixed an issue with the same package specified as a different dependency type with different range types not being updated correctly for all of them.

## 3.0.0

### Major Changes

- [`addd725`](https://github.com/changesets/changesets/commit/addd7256d9251d999251a7c16c0a0b068d557b5d) [#383](https://github.com/changesets/changesets/pull/383) Thanks [@Feiyang1](https://github.com/Feiyang1)! - Added an experimental flag `onlyUpdatePeerDependentsWhenOutOfRange`. When set to `true`, we only bump peer dependents when peerDependencies are leaving range.

### Minor Changes

- [`9dcc364`](https://github.com/changesets/changesets/commit/9dcc364bf19e48f8f2824ebaf967d9ef41b6fc04) [#371](https://github.com/changesets/changesets/pull/371) Thanks [@Feiyang1](https://github.com/Feiyang1)! - Added support for ignoring packages in the `version` command. The version of ignored packages will not be bumped, but their dependencies will still be bumped normally. This is useful when you have private packages, e.g. packages under development. It allows you to make releases for the public packages without changing the version of your private packages. To use the feature, you can define the `ignore` array in the config file with the name of the packages:

  ```
  {
    ...
    "ignore": ["pkg-a", "pkg-b"]
    ...
  }
  ```

  or you can pass the package names to the `--ignore` flag when using cli:

  ```
  yarn changeset version --ignore pkg-a --ignore --pkg-b
  ```

### Patch Changes

- [`00e768e`](https://github.com/changesets/changesets/commit/00e768e4af921a894debb900f944d4c9a4e27997) [#382](https://github.com/changesets/changesets/pull/382) Thanks [@Feiyang1](https://github.com/Feiyang1)! - Fix a bug where packages that shouldn't get released get patch releases when the pre mode is exit

- Updated dependencies [[`addd725`](https://github.com/changesets/changesets/commit/addd7256d9251d999251a7c16c0a0b068d557b5d), [`9dcc364`](https://github.com/changesets/changesets/commit/9dcc364bf19e48f8f2824ebaf967d9ef41b6fc04)]:
  - @changesets/types@3.1.0

## 2.1.0

### Minor Changes

- [`6d0790a`](https://github.com/changesets/changesets/commit/6d0790a7aa9f00e350e9394f419e4b3c7ee7ca6a) [#359](https://github.com/changesets/changesets/pull/359) Thanks [@ajaymathur](https://github.com/ajaymathur)! - Add support for snapshot flag to version command. Usage: `changeset version --snapshot [tag]`. The updated version of the packages looks like `0.0.0[-tag]-YYYYMMDDHHMMSS` where YYYY, MM, DD, HH, MM, and SS is the date and time of when the snapshot version is created. You can use this feature with the tag option in the publish command to publish packages under experimental tags from feature branches. To publish a snapshot version of a package under an experimental tag you can do:

  ```
  # Version packages to snapshot version
  changeset version --snapshot
  # Publish packages under experimental tag, keeping next and latest tag clean
  changeset publish --tag experimental
  ```

## 2.0.4

### Patch Changes

- Updated dependencies [[`2b49d66`](https://github.com/changesets/changesets/commit/2b49d668ecaa1333bc5c7c5be4648dda1b11528d)]:
  - @changesets/types@3.0.0
  - @changesets/get-dependents-graph@1.1.3

## 2.0.3

### Patch Changes

- [`8469636`](https://github.com/changesets/changesets/commit/8469636414cb2475547bba3140e3df1927b5926b) [#344](https://github.com/changesets/changesets/pull/344) Thanks [@zkochan](https://github.com/zkochan)! - When both a dev dep and a prod dep of a dependent package are published, the version of the dependent package should be bumped. This fixes a regression introduced by #313.

## 2.0.2

### Patch Changes

- [`d678da5`](https://github.com/changesets/changesets/commit/d678da5e9936862bb66e5edb538c5b8be23d4ffe) [#324](https://github.com/changesets/changesets/pull/324) Thanks [@zkochan](https://github.com/zkochan)! - Dev dependencies that are installed via the link or file protocol are ignored.

- Updated dependencies [[`d678da5`](https://github.com/changesets/changesets/commit/d678da5e9936862bb66e5edb538c5b8be23d4ffe)]:
  - @changesets/get-dependents-graph@1.1.2

## 2.0.1

### Patch Changes

- [`1706fb7`](https://github.com/changesets/changesets/commit/1706fb751ecc2f5a792c42f467b2063078d58716) [#321](https://github.com/changesets/changesets/pull/321) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Fix TypeScript declarations

- Updated dependencies [[`1706fb7`](https://github.com/changesets/changesets/commit/1706fb751ecc2f5a792c42f467b2063078d58716)]:
  - @changesets/errors@0.1.4
  - @changesets/get-dependents-graph@1.1.1
  - @changesets/types@2.0.1

## 2.0.0

### Major Changes

- [`011d57f`](https://github.com/changesets/changesets/commit/011d57f1edf9e37f75a8bef4f918e72166af096e) [#313](https://github.com/changesets/changesets/pull/313) Thanks [@zkochan](https://github.com/zkochan)! - When the released package is only used as a dev dependency, the dependent package's version should not be bumped.

### Patch Changes

- Updated dependencies [[`c3cc232`](https://github.com/changesets/changesets/commit/c3cc23204c6cb80487aced1b37ebe8ffde0e2111), [`011d57f`](https://github.com/changesets/changesets/commit/011d57f1edf9e37f75a8bef4f918e72166af096e)]:
  - @changesets/get-dependents-graph@1.1.0
  - @changesets/types@2.0.0

## 1.0.1

### Patch Changes

- [`04ddfd7`](https://github.com/changesets/changesets/commit/04ddfd7c3acbfb84ef9c92873fe7f9dea1f5145c) [#305](https://github.com/changesets/changesets/pull/305) Thanks [@Noviny](https://github.com/Noviny)! - Add link to changelog in readme

- [`b49e1cf`](https://github.com/changesets/changesets/commit/b49e1cff65dca7fe9e341a35aa91704aa0e51cb3) [#306](https://github.com/changesets/changesets/pull/306) Thanks [@Andarist](https://github.com/Andarist)! - Ignore `node_modules` when glob searching for packages. This fixes an issue with package cycles.

- Updated dependencies [[`04ddfd7`](https://github.com/changesets/changesets/commit/04ddfd7c3acbfb84ef9c92873fe7f9dea1f5145c), [`e56928b`](https://github.com/changesets/changesets/commit/e56928bbd6f9096def06ac37487bdbf28efec9d1), [`b49e1cf`](https://github.com/changesets/changesets/commit/b49e1cff65dca7fe9e341a35aa91704aa0e51cb3)]:
  - @changesets/config@1.0.1
  - @changesets/errors@0.1.3
  - @changesets/get-dependents-graph@1.0.1
  - @changesets/types@1.0.1

## 1.0.0

### Major Changes

- [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20) [#290](https://github.com/changesets/changesets/pull/290) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Accept `Packages` object instead of `Workspace[]` and remove `dependentsGraph` argument

### Patch Changes

- Updated dependencies [[`41e2e3d`](https://github.com/changesets/changesets/commit/41e2e3dd1053ff2f35a1a07e60793c9099f26997), [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20), [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20), [`2363366`](https://github.com/changesets/changesets/commit/2363366756d1b15bddf6d803911baccfca03cbdf), [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20), [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20)]:
  - @changesets/types@1.0.0
  - @changesets/get-dependents-graph@1.0.0
  - @changesets/config@1.0.0

## 0.3.1

### Patch Changes

- [`1282ef6`](https://github.com/changesets/changesets/commit/1282ef698761c1f634fb409842cc7de6b4d03da4) [#263](https://github.com/changesets/changesets/pull/263) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Fixed a bug where only the unreleased pre-release changesets were taken into account when calculating the new version, not previously released changesets.

## 0.3.0

### Minor Changes

- [`8f0a1ef`](https://github.com/changesets/changesets/commit/8f0a1ef327563512f471677ef0ca99d30da009c0) [#183](https://github.com/changesets/changesets/pull/183) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Add support for prereleases. For more information, see [the docs on prereleases](https://github.com/changesets/changesets/blob/main/docs/prereleases.md).

### Patch Changes

- Updated dependencies [[`8f0a1ef`](https://github.com/changesets/changesets/commit/8f0a1ef327563512f471677ef0ca99d30da009c0), [`8f0a1ef`](https://github.com/changesets/changesets/commit/8f0a1ef327563512f471677ef0ca99d30da009c0), [`8f0a1ef`](https://github.com/changesets/changesets/commit/8f0a1ef327563512f471677ef0ca99d30da009c0)]:
  - @changesets/types@0.4.0
  - @changesets/errors@0.1.2
  - @changesets/config@0.2.3

## 0.2.1

### Patch Changes

- [8c43fa0](https://github.com/changesets/changesets/commit/8c43fa061e2a5a01e4f32504ed351d261761c8dc) [#155](https://github.com/changesets/changesets/pull/155) Thanks [@Noviny](https://github.com/Noviny)! - Add Readme

- Updated dependencies [8c43fa0, 1ff73b7]:
  - @changesets/types@0.3.0
  - @changesets/config@0.2.1

## 0.2.0

### Minor Changes

- [296a6731](https://github.com/changesets/changesets/commit/296a6731) - Safety bump: Towards the end of preparing changesets v2, there was a lot of chaos - this bump is to ensure every package on npm matches what is found in the repository.

### Patch Changes

- Updated dependencies [296a6731]:
  - @changesets/config@0.2.0
  - @changesets/types@0.2.0

## 0.1.2

### Patch Changes

- [a15abbf9](https://github.com/changesets/changesets/commit/a15abbf9) - Previous release shipped unbuilt code - fixing that

## 0.1.0

### Minor Changes

- [84aeb37f](https://github.com/changesets/changesets/commit/84aeb37f) - Initial release

### Patch Changes

- [519b4218](https://github.com/changesets/changesets/commit/519b4218) - Use new Config type which makes linked required

- Updated dependencies [519b4218]:
- Updated dependencies [519b4218]:
  - @changesets/config@0.1.0
  - @changesets/types@0.1.0
