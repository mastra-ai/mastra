# Setup

Make sure to have cloned the [SDK repository](https://github.com/couchbase/couchnode.git) and have the submodules appropriately synced (`git submodule update --init --recursive`).

# Building

## Set CPM Cache
The C++ core utilizes the CMake Package Manager (CPM) to include depencies.  These can be set to a cache directory and can be used for future builds.  Periodically the dependencies should be updated.  So, in general it is good practice to configure the build environment by setting the CPM cache.

### Via npm command
```console
npm run prebuild -- --configure --set-cpm-cache --use-boringssl
```

### Available Options
>Note: Section under construction

### Via cmake-js

Set the cache directory `CXXCBC_CACHE_DIR`:
```console
export CXXCBC_CACHE_DIR=$PWD/deps/couchbase-cxx-cache
```

Remove the cache directory
```console
rm -rf $CXXCBC_CACHE_DIR
```

Configure the build:
```console
$ npx cmake-js configure \
--runtime node \
--runtime-version $(node --version) \
--CDUSE_STATIC_OPENSSL=OFF \
--CDCPM_DOWNLOAD_ALL=OFF \
--CDCPM_USE_NAMED_CACHE_DIRECTORIES=ON \
--CDCPM_USE_LOCAL_PACKAGES=OFF \
--CDCPM_SOURCE_CACHE=$CXXCBC_CACHE_DIR
```

## Build the client binary

### Via npm command
```console
npm run prebuild -- --use-boringssl
```

### Available Options
>Note: Section under construction

### Via cmake-js

>NOTE:  If using the `compile` command, the build will automatically clean and re-execute a build upon a failure.  Use the `build` command to only attempt a single build.

Set the cache directory (if it has not already been set) `CXXCBC_CACHE_DIR`:
```console
export CXXCBC_CACHE_DIR=$PWD/deps/couchbase-cxx-cache
```

```console
npx cmake-js compile \
--runtime node \
--runtime-version $(node --version) \
--CDUSE_STATIC_OPENSSL=OFF \
--CDCPM_DOWNLOAD_ALL=OFF \
--CDCPM_USE_NAMED_CACHE_DIRECTORIES=ON \
--CDCPM_USE_LOCAL_PACKAGES=OFF \
--CDCPM_SOURCE_CACHE=$CXXCBC_CACHE_DIR
```

# Autogen

>**IMPORTANT**: Autogen is only needed for maintainers of the library.  If not making updates to the core bindings, running the autogen tooling should *NOT* be required.

Move into the `tools` directory prior to running any autogen commands.

## Python Environment

>NOTE: Python >= 3.9 required

Setup virtual env:
```console
python3 -m venv <path to virtualenv>
```
Example: `python3 -m venv $(pwd)/couchnode`

Activate virtual env:
```console
source <path to virtualenv>/bin/activate
```
Example: `source $(pwd)/couchnode/bin/activate`

Install `clang` from PyPI:
```console
python3 -m pip install clang
```

Generate `bindings.json`.  If no arguments are passed in the binding generator will attempt to determine the necessary version, lib directory, include directory and system headers directory.
```console
python3 gen-bindings-json.py
```
Alternatively, options can be provided (or ENV variables may be set):
```console
python gen-bindings-json.py -v $(llvm-config --version) \
-i $(llvm-config --includedir) \
-l $(llvm-config --libdir) \
-s $(xcrun --show-sdk-path)
```

Available Environment Variables:
- `CN_LLVM_VERSION`: LLVM version
- `CN_LLVM_INCLUDE`: LLVM include directory path
- `CN_LLVM_LIB`:  LLVM lib directory path
- `CN_SYS_HEADERS`: System headers path

## Node.js

Populate SDK autogen code sections:
```console
node gen-bindings.js.js
```

## clean-up
### Format C++ source files.

On MacOS, make sure LLVM clang-format is used (configure the PATH appropriately):
```console
export PATH="/opt/homebrew/opt/llvm/bin:$PATH" 
```

>NOTE:  Be aware of the current working directory (commands below assume the CWD is `tools`).

```console
clang-format -i ../src/connection.cpp
clang-format -i ../src/connection.hpp
clang-format -i ../src/connection_autogen.cpp
clang-format -i ../src/constants.cpp
clang-format -i ../src/jstocbpp_autogen.hpp
```
### Format Node.js source files.

>NOTE:  Be aware of the current working directory (commands below assume the CWD is `tools`).

```console
npx prettier --write ../lib/binding.ts
```

### Remove bindings.json

```console
rm bindings.json
```

### Format autogen scripts.

This should rarely be needed (e.g. updating the autogen logic).

>NOTE:  Be aware of the current working directory (commands below assume the CWD is `tools`).

#### Python

Install `autopep8` from PyPI:
```console
python3 -m pip install autopep8
```

```console
autopep8 -i -a -a --max-line-length 120 gen-bindings-json.py
```

#### Node.js
```console
npx prettier --write gen-bindings-js.js
```

If a virtualenv was setup (hopefully it was ;)), deactivate and the environment
```console
deactivate
rm -rf <path to virtualenv>
```
Example: `deactivate && rm -rf $(pwd)/couchnode`