# Changelog

## 17.3.0

### Minor Changes

- 6c2ff57: Bumps recast to allow parsing of Typescript type arguments on tagged template literals

## 17.2.0

### Minor Changes

- e5fe5be: Bumps recast to resolve a bug where JSX elements are wrapped in two pairs of parenthesis

## 17.1.2

### Patch Changes

- 8f60fbf: Enable async tranformers in test utils.
  All notable changes to this project will be documented in this file.

## [17.1.1] 2024-10-31

### Fixed

- Republished with `temp` dependency properly removed (#638, thanks @trivikr for reporting)

## [17.1.0] 2024-10-30

### Added

- `pkg.pr.new` will now be used to build an npm pakage for each commit to the repo, allowing you to more easily test changes or use new features before an official release is cut. (#622, @Aslemammad)

### Changed

- Replaced `temp` library with `tmp` (#633, @r4zendev)

### Fixed

- Removed old `docs` command from `package.json` since the new docs are in the `website` folder, which has instructions in its README.

## [17.0.0] 2024-08-06

We needed to go [from v0.x to a major release](https://github.com/facebook/jscodeshift/issues/593), and it may as well happen now. jscodeshift has been around for nine years though, so going to v1.0.0 didn't feel quite right. I've instead promoted the minor version number to a major version number, similar to what React did when it went from 0.14 to 15.0.

### Fixed

- Node.js 16 is now explicitly specified as the minimum required version. It was _already_ implicitly required due to some dependencies requiring it, but this wasn't explicitly specified until now. (#607, @trivikr)

### Added

- A new [jscodeshift website](https://jscodeshift.com/) has launched, thanks to the team at [Codemod](https://codemod.com/). (#592, @mohab-sameh with some tweaks by @morinokami)
- Added collection functions for import declarations, including finding imports and inserting new imports (#617, @danieldelcore)

### Changed

- Enabled TypeScript `importAttributes` (#585, @benasher44) and `decoratorAutoAccessors` (#594, @syi0808) plugins
- Removed or replaced various outdated and unused dependencies (#601, #605, #609, #613, @trivikr)
- Started using Corepack to manage Yarn version (#599, @trivikr)

## [0.16.1] 2024-06-25

### Fixed

- Removed old `babel-core` dependency that was unused but caused security scanners to flag vulnerabilities.

## [0.16.0] 2024-06-18

### Added

- Added a `--gitignore` flag to avoid transforming any files listed in `.gitignore` (#508, @ElonVolo)

### Changed

- Updated various dependencies to latest version (#588, @ElonVolo)

## [0.15.2] 2024-02-21

### Fixed

- Process all supported extensions by default (#584, @trivikr)

## [0.15.1] 2023-10-28

### Changed

- Upgraded to recast 0.23.3 (#564, @ashsearle)
- Enable `@babel/plugin-proposal-private-methods` in worker (#568, @sibelius)
- Upgraded Babel packages (#570, @dartess)

### Fixed

- Respect extensions cli option when filtering individual files (#562, @robcmills)
- Fixed unit test after #562 broke them (#575, @ElonVolo)

## [0.15.0] 2023-05-07

### Changed

- Upgraded to recast 0.23.1 (#544, @ryanrhee)
- Make @babel/preset-env optional (#480, @SimenB)

### Fixed

- Force LF line ending in bin/jscodeshift.sh (#555, @jakeboone02)
- Use transform's exported parser in testUitls (#528, @CrispyBacon12)
- Ensure jscodeshift doesn't load Babel config file (#460, @raon0211)

## [0.14.0] 2022-10-04

### Added

- Added a `defineSnapshotTestFromFixture` test util (#471, @shriuken)
- Added `renameTo` filters for Babel 6+ node types (#412 and #504, @elonvolo and @henryqdineen)
- Added `childNodesOfType` to JSX traversal methods (#415, @j13huang)

### Changed

- Bumped dependency versions
- Allow arguments in `--help` to be listed in an order other than alphabetically, so they can instead be grouped thematically (#507, @elonvolo)
- Allow the `j` shortcut in test utils (#515, @no23reason)

## [0.13.1] 2022-01-10

### Changed

- Switched from `colors` to `chalk` to mitigate a security vulnerability in `colors@1.4.1`.

## [0.13.0] 2021-06-26

### Added

- Added a `--fail-on-error` flag to return a `1` error code when errors were found (#416, @marcodejongh)
- Created `template.asyncExpression` (#405, @jedwards1211)

### Changed

- Removed lodash dependency from tsx parser (#432, @JHilker and @robyoder)

## [0.12.0] 2021-04-21

### Changed

- Allow transform to be a Promise (#237, @rektide)
- Support newer TypeScript syntax by upgrading to newer Babel parser (#410, @wdoug and @mfeckie)

## [0.11.0] 2020-09-01

### Changed

- Updated `recast` to latest

## [0.10.0] 2020-06-01

### Changed

- Updated `flow-parser` to latest, and enabled Flow Enums parsing by default when using Flow parser

## [0.8.0] 2020-05-03

### Changed

- Dropped support for Node versions 6 and 8

## [0.7.0] 2019-12-11

## Added

- Added jest snapshot utils (#297, @dogoku)

### Changed

- Moved from BSD to MIT license

### Fixed

- No longer throw an error when calling jscodeshift on a non-existent path (#334, @threepointone)
- Preserve the original file extension in remote files (#317, @samselikoff)

## [0.6.4] 2019-04-30

### Changed

- Allow writing tests in TypeScript ([PR #308](https://github.com/facebook/jscodeshift/pull/308))
- Better handling of `.gitingore` files: Ignore comments and support `\r\n` line breaks ([PR #306](https://github.com/facebook/jscodeshift/pull/306))

## [0.6.3] 2019-01-18

### Fixed

- Don't throw an error when jscodeshift processes an empty set of files (#295,
  @skovhus).
- `renameTo` should not rename class properties (#296, @henryqdineen).
- Custom/unknown CLI parameters are parsed as JSON, just like nomnom used to
  do.

## [0.6.2] 2018-12-05

### Changed

- `@babel/register`/`@babel/preset-env` is configured to not transpile any
  language features that the running Node process supports. That means if you use
  features in your transform code supported by the Node version you are running,
  they will be left as is. Most of ES2015 is actually supported since Node v6.
- Do not transpile object rest/spread in transform code if supported by running
  Node version.

### Fixed

- Presets and plugins passed to `@babel/register` are now properly named and
  loaded.

## [0.6.1] 2018-12-04

### Added

- Tranform files can be written in Typescript. If the file extension of the
  transform file is `.ts` or `.tsx`, `@babel/preset-typescript` is used to
  convert them. This requires the `--babel` option to be set (which it is by
  default). ( #287 , @brieb )

### Changed

- The preset and plugins for converting the transform file itself via babeljs
  have been updated to work with babel v7. This included removing
  `babel-preset-es2015` and `babel-preset-stage-1` in favor of
  `@babel/preset-env`. Only `@babel/proposal-class-properties` and
  `@babel/proposal-object-rest-spread` are enabled as experimental features. If
  you want to use other's in your transform file, please create a PR.

### Fixed

- Typescript parses use `@babel/parser` instead of Babylon ( #291, @elliottsj )

### Bumped

- `micromatch` => v3.1.10, which doesn't (indirectly) depend on `randomatic` <
  v3 anymore (see #292).
