# Couchbase C++ Client

[![license](https://img.shields.io/github/license/couchbase/couchbase-cxx-client?color=brightgreen)](https://opensource.org/licenses/Apache-2.0)
[![linters](https://img.shields.io/github/actions/workflow/status/couchbase/couchbase-cxx-client/linters.yml?branch=main&label=linters)](https://github.com/couchbase/couchbase-cxx-client/actions?query=workflow%3Alinters+branch%3Amain)
[![sanitizers](https://img.shields.io/github/actions/workflow/status/couchbase/couchbase-cxx-client/sanitizers.yml?branch=main&label=sanitizers)](https://github.com/couchbase/couchbase-cxx-client/actions?query=workflow%3Asanitizers+branch%3Amain)
[![tests](https://img.shields.io/github/actions/workflow/status/couchbase/couchbase-cxx-client/tests.yml?branch=main&label=tests)](https://github.com/couchbase/couchbase-cxx-client/actions?query=workflow%3Atests+branch%3Amain)

* Documentation and User Guides: https://docs.couchbase.com/cxx-sdk/current/hello-world/start-using-sdk.html
* API Reference: https://docs.couchbase.com/sdk-api/couchbase-cxx-client
* Issue Tracker: https://issues.couchbase.com/projects/CXXCBC/issues
* Server Documentation: https://docs.couchbase.com/home/server.html

## Using with CPM.cmake

[CPM.cmake](https://github.com/cpm-cmake/CPM.cmake) makes it really easy to
include library into your project. Use the following snippet to update your
`CMakeLists.txt`:

```cmake
CPMAddPackage(
  NAME
  couchbase_cxx_client
  GIT_TAG
  1.2.0
  VERSION
  1.2.0
  GITHUB_REPOSITORY
  "couchbase/couchbase-cxx-client"
  OPTIONS
  "COUCHBASE_CXX_CLIENT_STATIC_BORINGSSL ON")
```

In case the library installed in the system using `install` target or package
management system, `FindPackage` could be used:

```cmake
cmake_minimum_required(VERSION 3.19)

project(minimal)

find_package(couchbase_cxx_client REQUIRED)

add_executable(minimal minimal.cxx)
target_link_libraries(minimal PRIVATE couchbase_cxx_client::couchbase_cxx_client)
```

## Building with CMake

This repo is being built with `CMake` so everything should build easily once the
basic dev dependencies are satisfied (C++17 compiler).

### Building (command-line)

```shell
git clone https://github.com/couchbase/couchbase-cxx-client.git
cd couchbase-cxx-client
mkdir build
cmake -S . -B build -DCOUCHBASE_CXX_CLIENT_STATIC_BORINGSSL=ON
cmake --build build
```

## Running Tests

The tests are located in the `/test` directory. More tests will be added and
this directory will be organized more in the near future to differentiate
between the common tests types that might be used for different types of testing
(e.g., `unit tests`, `integration tests`, `system tests`).

### Testing (command-line)

```shell
cd build
export TEST_CONNECTION_STRING=couchbase://127.0.0.1
export TEST_USERNAME=Administrator
export TEST_PASSWORD=password
export TEST_BUCKET=default
ctest
```
