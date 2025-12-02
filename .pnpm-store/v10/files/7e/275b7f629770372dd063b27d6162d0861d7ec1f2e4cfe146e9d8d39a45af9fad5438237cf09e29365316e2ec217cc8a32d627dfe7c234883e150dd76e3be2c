# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.1] - 2019-12-11
### Fixed
- Fix typo on `isCursorHidden` call (https://github.com/jcarpanelli/spinnies/pull/20). Thanks @noriyotcp!

## [0.5.0] - 2019-08-25
### Added
- Add `indent` option to indent a spinner given a number of spaces (https://github.com/jcarpanelli/spinnies/pull/15). Thanks @rap2hpoutre!
- Add `remove` method to remove a spinner from the spinners list.

## [0.4.3] - 2019-07-02
### Fixed
- Use the Unicode dots animation when run inside a VSCode integrated terminal or Windows Terminal (https://github.com/jcarpanelli/spinnies/pull/12). Thanks @MLoughry!

## [0.4.2] - 2019-06-18
### Fixed
- Fix line breaks when a custom succeedPrefix/failPrefix is provided

## [0.4.1] - 2019-06-18
### Fixed
- Properly add line breaks in spinner texts when it has '\n' characters

## [0.4.0] - 2019-06-16
### Fixed
- Fix Windows default spinner and prefix (#8). Thanks @RedDuckss!
- Strip ANSI escape codes before cleaning the stream (https://github.com/jcarpanelli/spinnies/commit/574a1eb5a370c05e70d8d03ecf73e5292353468d)

### Added
- Add `succeedPrefix` and `failPrefix` (#8). Thanks @RedDuckss!

### Changed
- Set terminal color as default text color, and avoid using `chalk.white` (https://github.com/jcarpanelli/spinnies/commit/2da89d852fc6a89bb06715cccba94ccd632b4430)

### Removed
- Remove default non-spinnable text prefix (https://github.com/jcarpanelli/spinnies/commit/38e6637f79fbc3712889ee6cc59f94cd91d1da1e)

## [0.3.2] - 2019-06-09
### Fixed
- Print last stream without breaking lines manually

## [0.3.1] - 2019-06-01
### Fixed
- Handle spinner frame index globally to prevent the animation from restarting.
- Allow to override spin animation in any platform (https://github.com/jcarpanelli/spinnies/issues/1).
- Allow to import the default `dots` and `dashes` spinners.

## [0.3.0] - 2019-05-28
### Fixed
- Fix typo when assigning default spinner for `win32` platform.

### Added
- Add `status` argument to `stopAll()` method.

## [0.2.0] - 2019-05-28
### Fixed
- Fix cursor position in `clearStream` function.

### Added
- Add new spinner for win32 platform.
- Add non-tty/CI stream mode.

### Removed
- Remove enter key binds.

## [0.1.3] - 2019-05-21
### Fixed
- Fix cursor position jump in `stopAll` method.

### Added
- Add ability to enable/disable pressing the `enter` (`\n`, `\r`) key through the `preventLineBreaks` option.

### Changed
- Change package name, description and author info
## [0.1.2] - 2019-05-21
### Fixed
- Fix cursor position in `clearStream` function.

## [0.1.1] - 2019-05-20
### Fixed
- Forbid the ability to press the `enter` key and thus move the `stdout` cursor.

## [0.1.0] - 2019-05-20
### Added
- Added CircleCI builds.
- Added unit tests (~99% coverage).
- Added `stopAll()` method to stop all spinning spinners.
- Added ability to set a spinner efect when constructing the spinner.

### Fixed
- Fix color properties when updating a spinner (with the `update`, `success` and `fail` methods).

### Changed
- Changed MultiSpinner object to a regular class.
- Changed spinners array to an object.


