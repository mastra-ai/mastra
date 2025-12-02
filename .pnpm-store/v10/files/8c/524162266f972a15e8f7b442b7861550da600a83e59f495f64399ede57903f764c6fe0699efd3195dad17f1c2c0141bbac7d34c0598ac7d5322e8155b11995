# Changelog

<!-- http://keepachangelog.com/en/1.0.0/
Added       for new features.
Changed     for changes in existing functionality.
Deprecated  for once-stable features removed in upcoming releases.
Removed     for deprecated features removed in this release.
Fixed       for any bug fixes.
Security    to invite users to upgrade in case of vulnerabilities.
-->

## 2.6.0 - 2023/12/26

### Changed

- Revert the `--location=global` flag translation on npm, [the warning message was fixed and deprecated](https://github.com/npm/statusboard/issues/518)

### Updated

- Bump package versions

## 2.5.2 - 2023/10/31

## Fixed

- volta version detection when not installed
- if volta was not installed don't take in care the volta pin version on `package.json`

## 2.5.1 - 2023/10/19

### Fixed

- get repository url when using ssh uri

### Added

- repository helpers unit test

## 2.5.0 - 2023/10/19

### Changed

- typescript strict configuration
- bump package versions

### Fixed

- `--global` flag position on `yarn` and `yarn@berry` with `interactive` command

### Added

- e2e testing for complete set of commands and aliases

## 2.4.0 - 2023/10/16

### Added

- prompt to continue excluding incompatible flags
- e2e testing for `install` and `add` commands

### Fixed

- `global` flag position on `yarn` and `yarn@berry`
- `package` parameter on `add` command

## 2.3.1 - 2023/10/04

### Fixed

- avoid `open` and `clean` finish as package manager translation

## 2.3.0 - 2023/09/26

### Added

- `bun` command and flags included in new version

## 2.2.1 - 2023/09/26

### Fixed

- Readme title

## 2.2.0 - 2023/09/26

### Changed

- `--use` and `--pin` flag now ask to the user if want to run the `set version` command for `yarn`

## 2.1.0 - 2023/09/25

### Added

- `open` command to easy access the file explorer or open repository urls in the browser

## 2.0.0 - 2023/09/21

### Changed

- full migration from JavaScript to TypeScript
- frozen translation for `bun` package manager
- priority order detection giving priority to `lock` file of `global` environment

### Fixed

- sequential delete folder and files previous install packages when are called from alias with multiple commands
- `info` flag also works when no package manager was detected

### Added

- ask to transform `install` to `add` command when `install` is used to add packages
- spinner progress when deleting folders or files using the `clean` command
- unit test on helpers files and functions
- `unpin` flag
- check if pinned package manager is already installed

## 1.12.1 - 2023/09/01

### Fixed

- beta wrong publishing

## 1.12.0 - 2023/08/26

### Added

- `--mute` flag to hide the command translation

### Changed

- update packages versions

## 1.11.0 - 2023/07/14

### Added

- `--fresh` flag on clean command
- `scf` alias to run `clean --fresh` command follow by `swpm install --frozen`

### Changed

- update packages versions

## 1.10.8 - 2023/06/20

### Security

- update semver to prevent a secure vulnerability

## 1.10.7 - 2023/06/13

### Fixed

- Problem execution on `sx` command

## 1.10.6 - 2023/06/06

### Security

- fix danger versions

## 1.10.5 - 2023/05/27

### Fixed

- delete modules path
- code smell reported by sonar

## 1.10.4 - 2023/05/22

### Fixed

- sync spread commands

## 1.10.3 - 2023/05/21

### Fixed

- auto update message

### Added

- unit tests for auto update message

## 1.10.2 - 2023/05/19

### Fixed

- alias command list

## 1.10.1 - 2023/05/08

### Fixed

- search for lock file false positives detection

## 1.10.0 - 2023/04/28

### Added

- yarn classic and berry support
- automatic set yarn version for pin and use flags
- added pin yarn@berry and clean+install alias
- alternatives on readme

### Changed

- chaining commands using promises
- clean command including the yarn@berry files and folders

## 1.9.1 - 2023/04/10

### Fixed

- Readme command for global and alias pin

### Changed

- Performance improvement. Changing the command execution for each Package Manager directly on `swpx` process before the `showCommand` and `runCommand` methods

## 1.9.0 - 2023/04/11

### Added

- Run `swpm` commands from subdirectories and workspace packages by [@TylerBarnes](https://github.com/TylerBarnes)

### Changed

- Update some package versions

### Fixed

- `--frozen` flag translation on `install` command
- add new filter for `--global` flag on `install` command
- undefined value on update current version message

## 1.8.0 - 2023/03/28

### Added

- `--dist` flag to `clean` command

## 1.7.2 - 2023/03/12

### Changed

- `sc` command alias to `scr` to avoid conflicts with the `sc` command for the Service Control Manger

## 1.7.1 - 2023/03/08

### Fixed

- Auto update message

## 1.7.0 - 2023/03/08

### Added

- `sc` alias for create
- install command on each package manager

### Changed

- example image adding bun
- auto update interval verification and global flag

### Fixed

- install global packages with volta, check if is installed and not if is pinned

## 1.6.0 - 2023/03/08

### Added

- `srg` alias for remove global

## 1.5.1 - 2023/03/07

### Fixed

- added a patch to avoid issue on [volta](https://github.com/volta-cli/volta/issues/1457) when install or uninstall global packages
- revert `add` command transformed to `install` on npm package
- volta pin detection including the same package validation

## 1.5.0 - 2023/02/28

### Changed

- ignoring files to shrink the final build

### Added

- `pack` command example on README

## 1.4.3 - 2023/02/28

### Fixed

- `add` command transformed to `install` on npm package, because with volta add works different than install with global flag

## 1.4.2 - 2023/02/24

### Removed

- `sci` alias

## 1.4.1 - 2023/02/18

### Fixed

- Documentation alias on README

## 1.4.0 - 2023/02/06

### Added

- install frozen, update, upgrade and interactive aliases

## 1.3.0 - 2023/02/06

### Added

- remove and pin aliases

## 1.2.0 - 2023/02/05

### Added

- Automatic add positional separator for `create` and `run` commands on `npm`

## 1.1.0 - 2023/02/04

### Added

- `--alias` flag to get a help with the available aliases

## 1.0.3 - 2023/02/03

### Fixed

- `spawn` command failure on Win11

## 1.0.2 - 2023/02/02

### Fixed

- Info command when not found the package
- Automatic year update on epilog message

## 1.0.1 - 2023/01/19

### Fixed

- `bunx` command documentation

## 1.0.0 - 2023/01/19

### Added

- command aliases
- `bunx` support

### Changed

- Upgrade `node` version to 19

## 0.14.1 - 2022/12/14

### Fixed

- Sponsors url

## 0.14.0 - 2022/12/13

### Added

- `swpx` to run packages remotely without installing

### Fixed

- OS compatibility for command exists on `--info` flag

## 0.13.2 - 2022/12/13

### Fixed

- Readme with no available commands and args for bun

## 0.13.1 - 2022/12/12

### Fixed

- Published npm version

## 0.13.0 - 2022/12/12

### Added

- Support basic `bun` commands as package manager
- `--package-lock` flag for `install` command

### Changed

- Replace `--frozen-lock` to `--immutable` on yarn
- Alias for `--frozen-lock` and `package-lock` for `install` command

### Fixed

- Not compatible flag warning message

## 0.12.2 - 2022/12/09

### Fixed

- Clarification about how to use a package manager by default

## 0.12.1 - 2022/07/25

### Fixed

- `main` property on package

## 0.12.0 - 2022/07/01

### Changed

- security update on `update-notifier` package

## 0.11.3 - 2022/06/02

### Fixed

- clean flags used for `swpm` on translated command

## 0.11.2 - 2022/06/02

### Fixed

- `interactive` command not requires a package parameter
- add missing `latest` flag to `interactive` command

## 0.11.1 - 2022/06/02

### Fixed

- update notifier

## 0.11.0 - 2022/06/01

### Added

- `update`, `upgrade` and `interactive` command

### Changed

- `debug` now use inspect to print the full depth object

## 0.10.2 - 2022/06/01

### Fixed

- get package manager from environment variable or lock files

## 0.10.1 - 2022/06/01

### Fixed

- avoid duplications when use flag and alias
- update deprecated `--global` flag on `npm`

## 0.10.0 - 2022/06/01

### Added

- `clean` command

### Fixed

- `info` command not using volta
- conflicts commands and flags exclusion

## 0.9.1 - 2022/05/27

### Fixed

- update notifier message with ESM compatibility
- not available flags message warning

## 0.9.0 - 2022/05/26

### Added

- `args` helpers unit testing
- update notifier message

### Changed

- `eslint` and `vitest` versions

## 0.8.0 - 2022/05/25

### Added

- `swpx` command for testing purpose

### Changed

- refactor code removing `globalThis`

## 0.7.1 - 2022/05/23

### Fixed

- `remove` command alias

## 0.7.0 - 2022/05/23

### Added

- `--save-optional` and `--save-peer` flags to `add` command
- `remove` command

### Fixed

- No `<package>` validations on `install` command

## 0.6.1 - 2022/05/22

### Fixed

- not showing icons with `--use` flag

## 0.6.0 - 2022/05/22

### Added

- prefix command with an icon, showing the source of the package manager detection

## 0.5.0 - 2022/05/21

### Added

- `SWPM` environment variable configuration to use a default package manager

## 0.4.2 - 2022/05/21

### Fixed

- [volta](https://volta.sh/) detection for `--use` flag
- add volta detection to `--info` flag

## 0.4.1 - 2022/05/20

### Fixed

- [volta](https://volta.sh/) pinned compatibility
- `--save-*` flags exclusion on `add` command

### Added

- supported shared commands to documentation

## 0.4.0 - 2022/05/20

### Added

- first version that translate commands `install` [`--frozen-lockfile`] and `add` [`--global`, `--save-dev`, `--save-exact`] commands

### Changed

- `--frozen-lockfile` flag was replaced for `--frozen` on install command
- yargs refactor
- structure project reorder

## 0.3.2 - 2022/05/19

### Fixed

- version name on message

## 0.3.1 - 2022/05/19

### Changed

- tweet action to support twitter API v2

## 0.3.0 - 2022/05/19

### Added

- github action to tween on publishing

## 0.2.3 - 2022/05/18

### Changed

- options to flags

## 0.2.2 - 2022/05/18

### Fixed

- current package manager from `packageManager` property

## 0.2.1 - 2022/05/18

### Changed

- folder structure

## 0.2.0 - 2022/05/18

### Added

- add `packageManager` property to `getCurrentPackageManager` method

## 0.1.2 - 2022/05/18

### Changed

- add `engine` and `packageManager` properties

## 0.1.1 - 2022/05/18

### Fixed

- github actions
- readme commands

## 0.1.0 - 2022/05/17

### Added

- yargs middleware to reprocesses the Package Manager to use
- yargs `install` and `add` commands
- `common-tags` library to stylize output messages

### Changed

- `see` option renamed to `test`
- `version` option was renamed and merged with `info` option

### Fixed

- get selected Package Manager configuration one time
- `fileExists` validation problem with `async` calls

## 0.0.5 - 2022/05/17

### Fixed

- local path with ESM
- file existing validation

## 0.0.4 - 2022/05/17

### Fixed

- get command

## 0.0.3 - 2022/05/17

### Fixed

- readme help command and link

### Changed

- social image preview
- show command with the package color

## 0.0.2 - 2022/05/16

### Added

- Icons, social and logos

## 0.0.1 - 2022/05/15

### Added

- Main project structure
- Package Manager detection
- `pin`, `use`, `get`, `see` and `info` options
- Pinned validation
