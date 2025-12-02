# @manypkg/get-packages

## 1.1.3

### Patch Changes

- [#122](https://github.com/Thinkmill/manypkg/pull/122) [`7bd4f34`](https://github.com/Thinkmill/manypkg/commit/7bd4f344e1024e880a2de6b571d556adf200f0b6) Thanks [@fz6m](https://github.com/fz6m)! - Fixed getting correct packages in pnpm workspaces with exclude rules.

## 1.1.2

### Patch Changes

- [#110](https://github.com/Thinkmill/manypkg/pull/110) [`c521941`](https://github.com/Thinkmill/manypkg/commit/c52194151630eb56cd21af471afe877cf42c6884) Thanks [@maraisr](https://github.com/maraisr)! - Includes types dependencies for PackageJson type

## 1.1.1

### Patch Changes

- [`35fcc9c`](https://github.com/Thinkmill/manypkg/commit/35fcc9cba7ccec6667826da84ed02dff166c50a3) [#70](https://github.com/Thinkmill/manypkg/pull/70) Thanks [@jesstelford](https://github.com/jesstelford)! - Add missing license field

## 1.1.0

### Minor Changes

- [`a4db72a`](https://github.com/Thinkmill/manypkg/commit/a4db72a8b272f1b642fa751639d7840f4fa3658c) [#63](https://github.com/Thinkmill/manypkg/pull/63) Thanks [@evocateur](https://github.com/evocateur)! - Add support for Lerna monorepos

### Patch Changes

- Updated dependencies [[`a4db72a`](https://github.com/Thinkmill/manypkg/commit/a4db72a8b272f1b642fa751639d7840f4fa3658c)]:
  - @manypkg/find-root@1.1.0

## 1.0.1

### Patch Changes

- [`596d821`](https://github.com/Thinkmill/manypkg/commit/596d82108bfb2debdfd6c82569ae5efb5b5ed587) [#55](https://github.com/Thinkmill/manypkg/pull/55) Thanks [@Andarist](https://github.com/Andarist)! - Ignore `node_modules` when glob searching for packages. This fixes an issue with package cycles.

## 1.0.0

### Major Changes

- [`72a0112`](https://github.com/Thinkmill/manypkg/commit/72a01127a5804cc8b881ab1a67e83a6149944ade) [#47](https://github.com/Thinkmill/manypkg/pull/47) Thanks [@tarang9211](https://github.com/tarang9211)! - Initial release of `@manypkg/get-packages`. If you're migrating from `get-workspaces`, the most important changes are:

  - getPackages is a named export
  - getPackages only accepts a single argument which is the directory to search from
  - getPackages returns an object which has `tool`, `packages` and `root`
  - getPackages will search up from the directory passed in to find a project root rather than requiring the project root to be passed in
  - the package objects no longer have a `name` field and the `config` property has been renamed to `packageJson`

  See the README for more information on the new API

### Patch Changes

- Updated dependencies [[`72a0112`](https://github.com/Thinkmill/manypkg/commit/72a01127a5804cc8b881ab1a67e83a6149944ade)]:
  - @manypkg/find-root@1.0.0
