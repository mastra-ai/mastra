# CMake.js (MIT)

[![Node CI](https://github.com/cmake-js/cmake-js/actions/workflows/node.yaml/badge.svg)](https://github.com/cmake-js/cmake-js/actions/workflows/node.yaml)
[![npm](https://img.shields.io/npm/v/cmake-js)](https://www.npmjs.com/package/cmake-js)

## About

CMake.js is a Node.js native addon build tool which works (almost) _exactly_ like [node-gyp](https://github.com/TooTallNate/node-gyp), but instead of [gyp](http://en.wikipedia.org/wiki/GYP_%28software%29), it is based on [CMake](http://cmake.org) build system. It's compatible with the following runtimes:

- Node.js 14.15+ since CMake.js v7.0.0 (for older runtimes please use an earlier version of CMake.js). Newer versions can produce builds targeting older runtimes
- [NW.js](https://github.com/nwjs/nw.js): all CMake.js based native modules are compatible with NW.js out-of-the-box, there is no [nw-gyp like magic](https://github.com/nwjs/nw.js/wiki/Using-Node-modules#3rd-party-modules-with-cc-addons) required
- [Electron](https://github.com/electron/electron): out-of-the-box build support, [no post build steps required](https://github.com/electron/electron/blob/main/docs/tutorial/using-native-node-modules.md)

If you use `node-api` for your module instead of `nan` it should be able to run on all the runtimes above without needing to be built separately for each.

## Installation

```bash
npm install cmake-js
```

**Help:**

```bash
cmake-js --help
```

```
Usage: cmake-js [<command>] [options]

Commands:
  cmake-js install                Install Node.js distribution files if needed
  cmake-js configure              Configure CMake project
  cmake-js print-configure        Print the configuration command
  cmake-js print-cmakejs-src      Print the value of the CMAKE_JS_SRC variable
  cmake-js print-cmakejs-include  Print the value of the CMAKE_JS_INC variable
  cmake-js print-cmakejs-lib      Print the value of the CMAKE_JS_LIB variable
  cmake-js build                  Build the project (will configure first if
                                  required)
  cmake-js print-build            Print the build command
  cmake-js clean                  Clean the project directory
  cmake-js print-clean            Print the clean command
  cmake-js reconfigure            Clean the project directory then configure the
                                  project
  cmake-js rebuild                Clean the project directory then build the
                                  project
  cmake-js compile                Build the project, and if build fails, try a
                                  full rebuild

Options:
      --version          Show version number                           [boolean]
  -h, --help             Show help                                     [boolean]
  -l, --log-level        set log level (silly, verbose, info, http, warn,
                         error), default is info                        [string]
  -d, --directory        specify CMake project's directory (where CMakeLists.txt
                         located)                                       [string]
  -D, --debug            build debug configuration                     [boolean]
  -B, --config           specify build configuration (Debug, RelWithDebInfo,
                         Release), will ignore '--debug' if specified   [string]
  -c, --cmake-path       path of CMake executable                       [string]
  -m, --prefer-make      use Unix Makefiles even if Ninja is available (Posix)
                                                                       [boolean]
  -x, --prefer-xcode     use Xcode instead of Unix Makefiles           [boolean]
  -g, --prefer-gnu       use GNU compiler instead of default CMake compiler, if
                         available (Posix)                             [boolean]
  -G, --generator        use specified generator                        [string]
  -t, --toolset          use specified toolset                          [string]
  -A, --platform         use specified platform name                    [string]
  -T, --target           only build the specified target                [string]
  -C, --prefer-clang     use Clang compiler instead of default CMake compiler,
                         if available (Posix)                          [boolean]
      --cc               use the specified C compiler                   [string]
      --cxx              use the specified C++ compiler                 [string]
  -r, --runtime          the runtime to use                             [string]
  -v, --runtime-version  the runtime version to use                     [string]
  -a, --arch             the architecture to build in                   [string]
  -p, --parallel         the number of threads cmake can use            [number]
      --CD               Custom argument passed to CMake in format:
                         -D<your-arg-here>                              [string]
  -i, --silent           Prevents CMake.js to print to the stdio       [boolean]
  -O, --out              Specify the output directory to compile to, default is
                         projectRoot/build                              [string]
```

**Requirements:**

- [CMake](http://www.cmake.org/download/)
- A proper C/C++ compiler toolchain of the given platform
  - **Windows**:
    - [Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/). If you installed nodejs with the installer, you can install these when prompted.
    - An alternate way is to install the [Chocolatey package manager](https://chocolatey.org/install), and run `choco install visualstudio2017-workload-vctools` in an Administrator Powershell
    - If you have multiple versions installed, you can select a specific version with `npm config set msvs_version 2017` (Note: this will also affect `node-gyp`)
  - **Unix/Posix**:
    - Clang or GCC
    - Ninja or Make (Ninja will be picked if both present)

## Usage

### General

It is advised to use Node-API for new projects instead of NAN. It provides ABI stability making usage simpler and reducing maintainance.

In a nutshell. _(For more complete documentation please see [the first tutorial](https://github.com/unbornchikken/cmake-js/wiki/TUTORIAL-01-Creating-a-native-module-by-using-CMake.js-and-NAN).)_

- Install cmake-js for your module `npm install --save cmake-js`
- Put a CMakeLists.txt file into your module root with this minimal required content:

```cmake
cmake_minimum_required(VERSION 3.15...3.31)
project(your-addon-name-here)

add_compile_definitions(-DNAPI_VERSION=4)

file(GLOB SOURCE_FILES "your-source files-location-here")

add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")
target_include_directories(${PROJECT_NAME} PRIVATE ${CMAKE_JS_INC})
target_link_libraries(${PROJECT_NAME} PRIVATE ${CMAKE_JS_LIB})
target_compile_features(${PROJECT_NAME} PRIVATE cxx_std_17)

if(MSVC AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
  # Generate node.lib
  execute_process(COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS})
endif()
```

- Add the following into your package.json scripts section:

```json
"scripts": {
    "install": "cmake-js compile"
  }
```

- Add the following into your package.json, using the same NAPI_VERSION value you provided to cmake

```json
"binary": {
    "napi_versions": [7]
  },
```

#### Commandline

With cmake-js installed as a depdendency or devDependency of your module, you can access run commands directly with:

```
npx cmake-js --help
# OR
yarn cmake-js --help
```

Please refer to the `--help` for the lists of available commands (they are like commands in `node-gyp`).

You can override the project default runtimes via `--runtime` and `--runtime-version`, such as: `--runtime=electron --runtime-version=0.26.0`. See below for more info on runtimes.

### CMake Specific

`CMAKE_JS_VERSION` variable will reflect the actual CMake.js version. So CMake.js based builds could be detected, eg.:

```cmake
if (CMAKE_JS_VERSION)
    add_subdirectory(node_addon)
else()
    add_subdirectory(other_subproject)
endif()
```

### NPM Config Integration

You can set npm configuration options for CMake.js.

For all users (global):

```
npm config set cmake_<key> <value> --global
```

For current user:

```
npm config set cmake_<key> <value>
```

CMake.js will set a variable named `"<key>"` to `<value>` (by using `-D<key>="<value>"` option). User settings will **overwrite** globals.

UPDATE:

You can set CMake.js command line arguments with npm config using the following pattern:

```
npm config set cmake_js_G "Visual Studio 56 Win128"
```

Which sets the CMake generator, basically defaults to:

```
cmake-js -G "Visual Studio 56 Win128"
```

#### Example:

Enter at command prompt:

```
npm config set cmake_Foo="bar"
```

Then write to your CMakeLists.txt the following:

```cmake
message (STATUS ${Foo})
```

This will print during configure:

```
--- bar
```

### Custom CMake options

You can add custom CMake options by beginning option name with `CD`.

#### Example

In command prompt:

```
cmake-js compile --CDFOO="bar"
```

Then in your CMakeLists.txt:

```cmake
message (STATUS ${FOO})
```

This will print during configure:

```
--- bar
```

### Runtimes

#### Important

It is important to understand that this setting is to be configured in the **application's root package.json file**. If you're creating a native module targeting nw.js for example, then **do not specify anything** in your module's package.json. It's the actual application's decision to specify its runtime, your module's just compatible anything that was mentioned in the [About chapter](#about). Actually defining `cmake-js` key in your module's package.json file may lead to an error. Why? If you set it up to use nw.js 0.12.1 for example, then when it gets compiled during development time (to run its unit tests for example) it's gonna be compiled against io.js 1.2 runtime. But if you're having io.js 34.0.1 at the command line then, which is binary incompatible with 1.2, then your unit tests will fail for sure. So it is advised to not use cmake-js target settings in your module's package.json, because that way CMake.js will use that you have, and your tests will pass.

#### Configuration

If any of the `runtime`, `runtimeVersion`, or `arch` configuration parameters is not explicitly configured, sensible defaults will be auto-detected based on the JavaScript environment where CMake.js runs within.

You can configure runtimes for compiling target for all depending CMake.js modules in an application. Define a `cmake-js` key in the application's root `package.json` file, eg.:

```json
{
	"name": "ta-taram-taram",
	"description": "pa-param-pam-pam",
	"version": "1.0.0",
	"main": "app.js",
	"cmake-js": {
		"runtime": "node",
		"runtimeVersion": "0.12.0",
		"arch": "ia32"
	}
}
```

Available settings:

- **runtime**: application's target runtime, possible values are:
  - `node`: Node.js
  - `nw`: nw.js
  - `electron`: Electron
- **runtimeVersion**: version of the application's target runtime, for example: `0.12.1`
- **arch**: architecture of application's target runtime (eg: `x64`, `ia32`, `arm64`, `arm`). _Notice: on non-Windows systems the C++ toolset's architecture's gonna be used despite this setting. If you don't specify this on Windows, then architecture of the main node runtime is gonna be used, so you have to choose a matching nw.js runtime._

#### Node-API and `node-addon-api`

[ABI-stable Node.js API
(Node-API)](https://nodejs.org/api/n-api.html#n_api_node_api),
which was previously known as N-API, supplies a set of C
APIs that allow to compilation and loading of native modules by
different versions of Node.js that support Node-API which includes
all versions of Node.js v10.x and later.

To compile a native module that uses only the
[plain `C` Node-API calls](https://nodejs.org/api/n-api.html#n_api_node_api),
follow the directions for plain `node` native modules.

You must also add the following lines to your CMakeLists.txt, to allow for building on windows

```
if(MSVC AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
  # Generate node.lib
  execute_process(COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS})
endif()
```

To compile a native module that uses the header-only C++ wrapper
classes provided by
[`node-addon-api`](https://github.com/nodejs/node-addon-api),
you need to make your package depend on it with:

    npm install --save node-addon-api

cmake-js will then add it to the include search path automatically

You should add the following to your package.json, with the correct version number, so that cmake-js knows the module is node-api and that it can skip downloading the nodejs headers

```json
"binary": {
    "napi_versions": [7]
  },
```

#### Electron

On Windows, the [`win_delay_load_hook`](https://www.electronjs.org/docs/tutorial/using-native-node-modules#a-note-about-win_delay_load_hook) is required to be embedded in the module or it will fail to load in the render process.
cmake-js will add the hook if the CMakeLists.txt contains the library `${CMAKE_JS_SRC}`.

Without the hook, the module can only be called from the render process using the Electron [remote](https://github.com/electron/electron/blob/master/docs/api/remote.md) module.

#### Runtime options in CMakeLists.txt

The actual node runtime parameters are detectable in CMakeLists.txt files, the following variables are set:

- **NODE_RUNTIME**: `"node"`, `"nw"`, `"electron"`
- **NODE_RUNTIMEVERSION**: for example: `"0.12.1"`
- **NODE_ARCH**: `"x64"`, `"ia32"`, `"arm64"`, `"arm"`

#### NW.js

To make compatible your NW.js application with any NAN CMake.js based modules, write the following to your application's package.json file (this is not neccessary for node-api modules):

```json
{
	"cmake-js": {
		"runtime": "nw",
		"runtimeVersion": "nw.js-version-here",
		"arch": "whatever-setting-is-appropriate-for-your-application's-windows-build"
	}
}
```

That's it. There is nothing else to do either on the application's or on the module's side, CMake.js modules are compatible with NW.js out-of-the-box. For more complete documentation please see [the third tutorial](https://github.com/unbornchikken/cmake-js/wiki/TUTORIAL-03-Using-CMake.js-based-native-modules-with-nw.js).

#### Heroku

[Heroku](https://heroku.com) uses the concept of a [buildpack](https://devcenter.heroku.com/articles/buildpacks) to define
how an application should be prepared to run in a [dyno](https://devcenter.heroku.com/articles/dynos).
The typical buildpack for note-based applications,
[heroku/nodejs](https://github.com/heroku/heroku-buildpack-nodejs),
provides an environment capable of running [node-gyp](https://github.com/TooTallNate/node-gyp),
but not [CMake](http://cmake.org).

The least "painful" way of addressing this is to use heroku's multipack facility:

- Set the applications' buildpack to
  [https://github.com/heroku/heroku-buildpack-multi.git](https://github.com/heroku/heroku-buildpack-multi.git)

- In the root directory of the application,
  create a file called `.buildpacks` with these two lines:

          https://github.com/brave/heroku-cmake-buildpack.git
          https://github.com/heroku/heroku-buildpack-nodejs.git

- Deploy the application to have the changes take effect

The `heroku-buildpack-multi` will run each buildpack in order allowing the node application to reference CMake in the Heroku
build environment.

## Tutorials

- [TUTORIAL 01 Creating a native module by using CMake.js and NAN](https://github.com/unbornchikken/cmake-js/wiki/TUTORIAL-01-Creating-a-native-module-by-using-CMake.js-and-NAN)
- [TUTORIAL 02 Creating CMake.js based native addons with Qt Creator](https://github.com/unbornchikken/cmake-js/wiki/TUTORIAL-02-Creating-CMake.js-based-native-addons-with-QT-Creator)
- [TUTORIAL 03 Using CMake.js based native modules with NW.js](https://github.com/unbornchikken/cmake-js/wiki/TUTORIAL-03-Using-CMake.js-based-native-modules-with-nw.js)
- [TUTORIAL 04 Creating CMake.js based native modules with Boost dependency](https://github.com/unbornchikken/cmake-js/wiki/TUTORIAL-04-Creating-CMake.js-based-native-modules-with-Boost-dependency)

## Real examples

- [@julusian/jpeg-turbo](https://github.com/julusian/node-jpeg-turbo) - A Node-API wrapping around libjpeg-turbo. cmake-js was a good fit here, as libjpeg-turbo provides cmake files that can be used, and would be hard to replicate correctly in node-gyp
- [node-datachannel](https://github.com/murat-dogan/node-datachannel) - Easy to use WebRTC data channels and media transport
- [aws-iot-device-sdk-v2](https://github.com/aws/aws-iot-device-sdk-js-v2) AWS IoT Device SDK for JavaScript v2

Open a PR to add your own project here.

## Changelog

View [changelog.md](changelog.md)

## Credits

https://github.com/cmake-js/cmake-js/graphs/contributors

Ty all!
