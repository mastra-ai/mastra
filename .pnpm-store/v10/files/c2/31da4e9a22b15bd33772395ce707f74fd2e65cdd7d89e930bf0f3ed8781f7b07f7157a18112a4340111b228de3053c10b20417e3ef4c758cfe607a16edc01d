# @changesets/types

## 4.1.0

### Minor Changes

- [#690](https://github.com/changesets/changesets/pull/690) [`27a5a82`](https://github.com/changesets/changesets/commit/27a5a82188914570d192162f9d045dfd082a3c15) Thanks [@Andarist](https://github.com/Andarist)! - Add the new `fixed` property to the `Config` type.

## 4.0.2

### Patch Changes

- [#668](https://github.com/changesets/changesets/pull/668) [`9a993ba`](https://github.com/changesets/changesets/commit/9a993ba09629c1620d749432520470cec49d3a96) Thanks [@marcodejongh](https://github.com/marcodejongh)! - Add `resolutions` to the `PackageJSON` type.

## 4.0.1

### Patch Changes

- [#582](https://github.com/changesets/changesets/pull/582) [`e89e28a`](https://github.com/changesets/changesets/commit/e89e28a05f5fa43307db73812a6bcd269b62ddee) Thanks [@Andarist](https://github.com/Andarist)! - Add support for publishConfig.registry

## 4.0.0

### Major Changes

- [#542](https://github.com/changesets/changesets/pull/542) [`de2b4a5`](https://github.com/changesets/changesets/commit/de2b4a5a7b244a37d94625bcb70ecde9dde5b612) Thanks [@Andarist](https://github.com/Andarist)! - A new `updateInternalDependents` experimental option has been added. It can be used to add dependent packages to the release (if they are not already a part of it) with patch bumps. To use it you can add this to your config:

  ```json
  {
    "___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH": {
      "updateInternalDependents": "always"
    }
  }
  ```

  This option accepts two values - `"always"` and `"out-of-range"` (the latter matches the current default behavior).

## 3.3.0

### Minor Changes

- [`12f9a43`](https://github.com/changesets/changesets/commit/12f9a433a6c3ac38f9405fcd77c9108c423d7101) [#507](https://github.com/changesets/changesets/pull/507) Thanks [@zkochan](https://github.com/zkochan)! - New setting added: bumpVersionsWithWorkspaceProtocolOnly. When it is set to `true`, versions are bumped in `dependencies`, only if those versions are prefixed by the workspace protocol. For instance, `"foo": "workspace:^1.0.0"`.

## 3.2.0

### Minor Changes

- [`f4973a2`](https://github.com/changesets/changesets/commit/f4973a25ec6a837f36d64c1fb4b108ace3bc1f9d) [#467](https://github.com/changesets/changesets/pull/467) Thanks [@Andarist](https://github.com/Andarist)! - Exported a new `Linked` type for convenience - it's an alias for `ReadonlyArray<ReadonlyArray<string>>`.`

## 3.1.1

### Patch Changes

- [`a57d163`](https://github.com/changesets/changesets/commit/a57d16355ad7d67b18b768c8f79224d80afa507c) [#428](https://github.com/changesets/changesets/pull/428) Thanks [@dotansimha](https://github.com/dotansimha)! - Updated signature of `PackageJSON['publishConfig']` to include `directory?: string`.

## 3.1.0

### Minor Changes

- [`9dcc364`](https://github.com/changesets/changesets/commit/9dcc364bf19e48f8f2824ebaf967d9ef41b6fc04) [#371](https://github.com/changesets/changesets/pull/371) Thanks [@Feiyang1](https://github.com/Feiyang1)! - Add `ignore` config option to configure ignored packages. The versions of ignored packages will not be bumped during a release, but their dependencies will still be bumped normally.

### Patch Changes

- [`addd725`](https://github.com/changesets/changesets/commit/addd7256d9251d999251a7c16c0a0b068d557b5d) [#383](https://github.com/changesets/changesets/pull/383) Thanks [@Feiyang1](https://github.com/Feiyang1)! - Added an experimental flag `onlyUpdatePeerDependentsWhenOutOfRange`. When set to `true`, we only bump peer dependents when peerDependencies are leaving range.

## 3.0.0

### Major Changes

- [`2b49d66`](https://github.com/changesets/changesets/commit/2b49d668ecaa1333bc5c7c5be4648dda1b11528d) [#358](https://github.com/changesets/changesets/pull/358) Thanks [@Blasz](https://github.com/Blasz)! - Add new updateInternalDependencies config option to disable auto bumping of internal dependencies in the same release if the dependency was only patch bumped

## 2.0.1

### Patch Changes

- [`1706fb7`](https://github.com/changesets/changesets/commit/1706fb751ecc2f5a792c42f467b2063078d58716) [#321](https://github.com/changesets/changesets/pull/321) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Fix TypeScript declarations

## 2.0.0

### Major Changes

- [`011d57f`](https://github.com/changesets/changesets/commit/011d57f1edf9e37f75a8bef4f918e72166af096e) [#313](https://github.com/changesets/changesets/pull/313) Thanks [@zkochan](https://github.com/zkochan)! - Add in `none` as a potential option for bumpType in release plans. Note that this is experimental and is internal, not a possible user option

## 1.0.1

### Patch Changes

- [`04ddfd7`](https://github.com/changesets/changesets/commit/04ddfd7c3acbfb84ef9c92873fe7f9dea1f5145c) [#305](https://github.com/changesets/changesets/pull/305) Thanks [@Noviny](https://github.com/Noviny)! - Add link to changelog in readme

* [`e56928b`](https://github.com/changesets/changesets/commit/e56928bbd6f9096def06ac37487bdbf28efec9d1) [#298](https://github.com/changesets/changesets/pull/298) Thanks [@eps1lon](https://github.com/eps1lon)! - In changelog-github, throw more descriptive error when no options are provided.

## 1.0.0

### Major Changes

- [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20) [#290](https://github.com/changesets/changesets/pull/290) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Rename `ModCompWithWorkspace` to `ModCompWithPackage` and change `config` key with `packageJson`

* [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20) [#290](https://github.com/changesets/changesets/pull/290) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Remove `Workspace` type. You should use the `Package` type from `@manypkg/get-packages` instead.

### Minor Changes

- [`41e2e3d`](https://github.com/changesets/changesets/commit/41e2e3dd1053ff2f35a1a07e60793c9099f26997) [#292](https://github.com/changesets/changesets/pull/292) Thanks [@acheronfail](https://github.com/acheronfail)! - Add new `Changeset` type

### Patch Changes

- [`2363366`](https://github.com/changesets/changesets/commit/2363366756d1b15bddf6d803911baccfca03cbdf) [#291](https://github.com/changesets/changesets/pull/291) Thanks [@acheronfail](https://github.com/acheronfail)! - Add `baseBranch` to `Config` type

## 0.4.0

### Minor Changes

- [`8f0a1ef`](https://github.com/changesets/changesets/commit/8f0a1ef327563512f471677ef0ca99d30da009c0) [#183](https://github.com/changesets/changesets/pull/183) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Add `PreState` type and `preState` property to `ReleasePlan`

## 0.3.1

### Patch Changes

- [`a679b1d`](https://github.com/changesets/changesets/commit/a679b1dcdcb56652d31536e2d6326ba02a9dfe62) [#204](https://github.com/changesets/changesets/pull/204) Thanks [@Andarist](https://github.com/Andarist)! - Correctly handle the 'access' flag for packages

  Previously, we had access as "public" or "private", access "private" isn't valid. This was a confusing because there are three states for publishing a package:

  - `private: true` - the package will not be published to npm (worked)
  - `access: public` - the package will be publicly published to npm (even if it uses a scope) (worked)
  - `access: restricted` - the package will be published to npm, but only visible/accessible by those who are part of the scope. This technically worked, but we were passing the wrong bit of information in.

  Now, we pass the correct access options `public` or `restricted`.

## 0.3.0

### Minor Changes

- [1ff73b7](https://github.com/changesets/changesets/commit/1ff73b74f414031e49c6fd5a0f68e9974900d381) [#156](https://github.com/changesets/changesets/pull/156) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Remove `Changeset` type because it isn't used and make commit optional on NewChangesetWithCommit because the commit won't always exist

### Patch Changes

- [8c43fa0](https://github.com/changesets/changesets/commit/8c43fa061e2a5a01e4f32504ed351d261761c8dc) [#155](https://github.com/changesets/changesets/pull/155) Thanks [@Noviny](https://github.com/Noviny)! - Add Readme

## 0.2.0

### Minor Changes

- [296a6731](https://github.com/changesets/changesets/commit/296a6731) - Safety bump: Towards the end of preparing changesets v2, there was a lot of chaos - this bump is to ensure every package on npm matches what is found in the repository.

## 0.1.2

### Patch Changes

- [a15abbf9](https://github.com/changesets/changesets/commit/a15abbf9) - Previous release shipped unbuilt code - fixing that

## 0.1.0

### Minor Changes

- [6d119893](https://github.com/changesets/changesets/commit/6d119893) - Initial Release
- [519b4218](https://github.com/changesets/changesets/commit/519b4218) - Add WrittenConfig type and include all properties in Config type
