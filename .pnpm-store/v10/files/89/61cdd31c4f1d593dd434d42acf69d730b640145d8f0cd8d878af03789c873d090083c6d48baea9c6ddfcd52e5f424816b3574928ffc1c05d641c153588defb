# v7.3.1 - 17/04/25

- fix(windows): support windows arm64 (Thanks to @jaycex)
- fix(windows): support newer visual studio installations

# v7.3.0 - 15/01/24

- feat(windows): replace custom libnode.def generation with version from node-api-headers
- fix: support for vs2015 with nodejs 18 and older (#317)
- fix(windows): always remove Path if PATH is also defined (#319)
- fix: Cmake arguments got converted to numbers (#314)
- fix: update node-api-headers
- chore: update dependencies

# v7.2.1 - 14/02/23

- fix: support Windows11SDK

# v7.2.0 - 12/02/23

- fix: `-DCMAKE_JS_VERSION=undefined` (#298)
- fix: Only add build type to `CMAKE_LIBRARY_OUTPUT_DIRECTORY` if needed (#299)
- feat: Forward extra arguments to CMake commands (#297)

# v7.1.1 - 15/12/22

- fix build errors on windows

# v7.1.0 - 14/12/22

- add commands for retrieving cmake-js include and lib directories
- fix win delay hook issues with electron
- fix missing js_native_api_symbols in windows node.lib

# v7.0.0 - 08/10/22

- update dependencies
- replace some dependencies with modern language features
- follow node-gyp behaviour for visual-studio version detection and selection
- automatically locate node-addon-api and add to include paths
- avoid downloads when building for node-api
- encourage use of MT builds with MSVC, rather than MD

# v6.3.1 - 05/06/22

- add missing bluebird dependency
- fix platform detection for visual studio 2019 and newer
- fix platform detection for macos

# v6.3.0 - 26/11/21

- add offline mode: https://github.com/cmake-js/cmake-js/pull/260
- handle missing buildSystem.log: https://github.com/cmake-js/cmake-js/pull/259
- Add config flag: https://github.com/cmake-js/cmake-js/pull/251
- Remove escaped quotes from windows registry queries: https://github.com/cmake-js/cmake-js/pull/250

# v6.2.1 - 20/07/21

- EOL hotfix (Thx Windows!)

# v6.2.0 - 19/07/21

- various fixes

# v6.1.0 - 27/02/20

- Add support for "-A/--platform" option to make target platform selectable for Visual Studio 2019 generator: https://github.com/cmake-js/cmake-js/pull/201

# v6.0.0 - 30/09/19

- Dropped compatibility of old Node.js runtimes (<10.0.0)
- --cc and --cxx flags for overriding compiler detection: https://github.com/cmake-js/cmake-js/pull/191

# v5.3.2 - 21/08/19

- Visual Studio detection fixes

# v5.3.1 - 18/07/19

- VS 2019 Support fix: https://github.com/cmake-js/cmake-js/pull/187

# v5.3.0 - 09/07/19

- VS 2019 Support: https://github.com/cmake-js/cmake-js/pull/178/, https://github.com/cmake-js/cmake-js/pull/184/

# v5.2.1 - 10/04/19

- Win delay load hook: https://github.com/cmake-js/cmake-js/pull/165/

# v5.1.1 - 02/04/19

- CMake 3.14 support fixed - https://github.com/cmake-js/cmake-js/pull/161

# v5.1.0 - 14/02/19

- CMake 3.14 support - https://github.com/cmake-js/cmake-js/pull/159

# v5.0.1 - 24/01/19

- Linux line ending hotfix (I hate Windows!)

# v5.0.0 - 24/01/19

- [semver major] Add case sensitive NPM config integration https://github.com/cmake-js/cmake-js/pull/151
- better npm config integration, all CMake.js commandline argument could be set by using npm config: https://github.com/cmake-js/cmake-js#npm-config-integration
- support for Electron v4+ https://github.com/cmake-js/cmake-js/pull/152

# v4.0.1 - 03/10/18

- log argument hotfix https://github.com/cmake-js/cmake-js/pull/145

# v4.0.0 - 14/09/18

BREAKING CHANGES:

- -s/--std (along with -o/--prec11 option removed, you have to specify compiler standard in CMakeLists.txt files https://github.com/cmake-js/cmake-js/issues/72
- Implicit -w compiler flag doesn't get added on OSX https://github.com/cmake-js/cmake-js/pull/133

# v3.7.3 - 16/05/18

- npm config hotfix https://github.com/cmake-js/cmake-js/pull/123

# v3.7.2 - 16/05/18

- do not use, breaks ES5 compatibility

# v3.7.1 - 07/05/18

- Linux line ending hotfix (wat)

# v3.7.0 - 07/05/18

- PR: replace unzip with unzipper https://github.com/cmake-js/cmake-js/pull/120
- PR: replace npmconf with rc https://github.com/cmake-js/cmake-js/pull/119
- PR: update to modern fs-extras https://github.com/cmake-js/cmake-js/pull/118
- PR: Adds toolset command line flag https://github.com/cmake-js/cmake-js/pull/115

# v3.6.2 - 17/02/18

- use https distribution download urls
- custom cmake options made case sensitive

# v3.6.1 - 11/01/18

- Detect 2017 Windows Build Tools

# v3.6.0 - 11/27/17

- "T" option for building specified target: https://github.com/cmake-js/cmake-js/pull/98

# v3.5.0 - 06/21/17

- Added Visual Studio 2017 compatibility: https://github.com/cmake-js/cmake-js/pull/78

# v3.4.1 - 02/4/17

- FIX: test output instead of guessing by platform: https://github.com/cmake-js/cmake-js/pull/77

# v3.4.0 - 01/12/17

- "G" option to set custom generators: https://github.com/cmake-js/cmake-js/pull/64

# v3.3.1 - 09/13/16

- fix of default parameters: https://github.com/cmake-js/cmake-js/pull/57

# v3.3.0 - 09/02/16

- silent option (https://github.com/cmake-js/cmake-js/pull/54)
- out option (https://github.com/cmake-js/cmake-js/pull/53)

# v3.2.3 - 08/17/16

- Line endings

# v3.2.2 - 12/08/16

- Multi directory support for Windows/MSVC build

# v3.2.1 - 25/04/16

- Linux line ending hotfix

# v3.2.0 - 25/04/16

- Added NW.js 0.13+ compatibility
- Node v0.10.x support fixed (https://github.com/cmake-js/cmake-js/pull/45, https://github.com/cmake-js/cmake-js/issues/50)
- CMAKE_JS_VERSION defined (https://github.com/cmake-js/cmake-js/issues/48)

# v3.1.2 - 03/02/16

- Fixed cmake-js binary ES5 compatibility.

# v3.1.1 - 03/02/16

- Fixed line endings

# v3.1.0 - 03/02/16

- Custom CMake parameter support (https://github.com/gerhardberger)

# v3.0.0 - 20/11/15

- Visual C++ Build Tools support
- std option introduced
- better unit test coverage

# v2.1.0 - 29/10/15

- explicit options for use GNU or Clang compiler instead of CMake's default (see --help for details)

# v2.0.2 - 22/10/15

- Fix: print-\* commands report "undefined"

# v2.0.0 - 17/10/15

- Fix: distribution files only gets downloaded if needed (4.0.0+)
- option to generate Xcode project (-x, --prefer-xcode) - by https://github.com/javedulu
- compile command for fast module compilation during npm updates (instead of rebuild)
- codebase switched to ECMAScript 2015

# v1.1.1 - 06/10/15

- Hotfix for build NW.js correctly.

# v1.1.0 - 05/10/15

- Node.js 4.0.0+ support
- Downloads the small, header only tarball for Node.js 4+
