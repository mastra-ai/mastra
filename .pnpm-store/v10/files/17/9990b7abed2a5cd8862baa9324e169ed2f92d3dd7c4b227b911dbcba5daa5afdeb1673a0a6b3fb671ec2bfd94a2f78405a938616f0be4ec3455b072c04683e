# GSL: Guidelines Support Library
[![Build Status](https://dev.azure.com/cppstat/GSL/_apis/build/status/microsoft.GSL?branchName=main)](https://dev.azure.com/cppstat/GSL/_build/latest?definitionId=1&branchName=main)

The Guidelines Support Library (GSL) contains functions and types that are suggested for use by the
[C++ Core Guidelines](https://github.com/isocpp/CppCoreGuidelines) maintained by the [Standard C++ Foundation](https://isocpp.org).
This repo contains Microsoft's implementation of GSL.

The entire implementation is provided inline in the headers under the [gsl](./include/gsl) directory. The implementation generally assumes a platform that implements C++14 support.

While some types have been broken out into their own headers (e.g. [gsl/span](./include/gsl/span)),
it is simplest to just include [gsl/gsl](./include/gsl/gsl) and gain access to the entire library.

> NOTE: We encourage contributions that improve or refine any of the types in this library as well as ports to
other platforms. Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for more information about contributing.

# Project Code of Conduct
This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

# Usage of Third Party Libraries
This project makes use of the [Google Test](https://github.com/google/googletest) testing library. Please see the [ThirdPartyNotices.txt](./ThirdPartyNotices.txt) file for details regarding the licensing of Google Test.

# Supported features
## Microsoft GSL implements the following from the C++ Core Guidelines:

Feature                            | Supported? | Description
-----------------------------------|:----------:|-------------
[**1. Views**][cg-views]           |            |
owner                              | &#x2611;   | an alias for a raw pointer
not_null                           | &#x2611;   | restricts a pointer / smart pointer to hold non-null values
span                               | &#x2611;   | a view over a contiguous sequence of memory. Based on the standardized verison of `std::span`, however `gsl::span` enforces bounds checking. See the [wiki](https://github.com/microsoft/GSL/wiki/gsl::span-and-std::span) for additional information.
span_p                             | &#x2610;   | spans a range starting from a pointer to the first place for which the predicate is true
basic_zstring                      | &#x2611;   | A pointer to a C-string (zero-terminated array) with a templated char type
zstring                            | &#x2611;   | An alias to `basic_zstring` with dynamic extent and a char type of char
czstring                           | &#x2611;   | An alias to `basic_zstring` with dynamic extent and a char type of const char
wzstring                           | &#x2611;   | An alias to `basic_zstring` with dynamic extent and a char type of wchar_t
cwzstring                          | &#x2611;   | An alias to `basic_zstring` with dynamic extent and a char type of const wchar_t
u16zstring                         | &#x2611;   | An alias to `basic_zstring` with dynamic extent and a char type of char16_t
cu16zstring                        | &#x2611;   | An alias to `basic_zstring` with dynamic extent and a char type of const char16_t
u32zstring                         | &#x2611;   | An alias to `basic_zstring` with dynamic extent and a char type of char32_t
cu32zstring                        | &#x2611;   | An alias to `basic_zstring` with dynamic extent and a char type of const char32_t
[**2. Owners**][cg-owners]         |            |
unique_ptr                         | &#x2611;   | an alias to `std::unique_ptr`
shared_ptr                         | &#x2611;   | an alias to `std::shared_ptr`
stack_array                        | &#x2610;   | a stack-allocated array
dyn_array                          | &#x2610;   | a heap-allocated array
[**3. Assertions**][cg-assertions] |            |
Expects                            | &#x2611;   | a precondition assertion; on failure it terminates
Ensures                            | &#x2611;   | a postcondition assertion; on failure it terminates
[**4. Utilities**][cg-utilities]   |            |
move_owner                         | &#x2610;   | a helper function that moves one `owner` to the other
byte                               | &#x2611;   | either an alias to std::byte or a byte type
final_action                       | &#x2611;   | a RAII style class that invokes a functor on its destruction
finally                            | &#x2611;   | a helper function instantiating `final_action`
GSL_SUPPRESS                       | &#x2611;   | a macro that takes an argument and turns it into `[[gsl::suppress(x)]]` or `[[gsl::suppress("x")]]`
[[implicit]]                       | &#x2610;   | a "marker" to put on single-argument constructors to explicitly make them non-explicit
index                              | &#x2611;   | a type to use for all container and array indexing (currently an alias for std::ptrdiff_t)
joining_thread                     | &#x2610;   | a RAII style version of `std::thread` that joins
narrow                             | &#x2611;   | a checked version of narrow_cast; it can throw `narrowing_error`
narrow_cast                        | &#x2611;   | a narrowing cast for values and a synonym for static_cast
narrowing_error                    | &#x2611;   | a custom exception type thrown by `narrow()`
[**5. Concepts**][cg-concepts]     | &#x2610;   |

## The following features do not exist in or have been removed from the C++ Core Guidelines:
Feature                            | Supported? | Description
-----------------------------------|:----------:|-------------
strict_not_null                    | &#x2611;   | A stricter version of `not_null` with explicit constructors
multi_span                         | &#x2610;   | Deprecated. Multi-dimensional span.
strided_span                       | &#x2610;   | Deprecated. Support for this type has been discontinued.
basic_string_span                  | &#x2610;   | Deprecated. Like `span` but for strings with a templated char type
string_span                        | &#x2610;   | Deprecated. An alias to `basic_string_span` with a char type of char
cstring_span                       | &#x2610;   | Deprecated. An alias to `basic_string_span` with a char type of const char
wstring_span                       | &#x2610;   | Deprecated. An alias to `basic_string_span` with a char type of wchar_t
cwstring_span                      | &#x2610;   | Deprecated. An alias to `basic_string_span` with a char type of const wchar_t
u16string_span                     | &#x2610;   | Deprecated. An alias to `basic_string_span` with a char type of char16_t
cu16string_span                    | &#x2610;   | Deprecated. An alias to `basic_string_span` with a char type of const char16_t
u32string_span                     | &#x2610;   | Deprecated. An alias to `basic_string_span` with a char type of char32_t
cu32string_span                    | &#x2610;   | Deprecated. An alias to `basic_string_span` with a char type of const char32_t

This is based on [CppCoreGuidelines semi-specification](https://github.com/isocpp/CppCoreGuidelines/blob/master/CppCoreGuidelines.md#gsl-guidelines-support-library).

[cg-views]: https://github.com/isocpp/CppCoreGuidelines/blob/master/CppCoreGuidelines.md#gslview-views
[cg-owners]: https://github.com/isocpp/CppCoreGuidelines/blob/master/CppCoreGuidelines.md#gslowner-ownership-pointers
[cg-assertions]: https://github.com/isocpp/CppCoreGuidelines/blob/master/CppCoreGuidelines.md#gslassert-assertions
[cg-utilities]: https://github.com/isocpp/CppCoreGuidelines/blob/master/CppCoreGuidelines.md#gslutil-utilities
[cg-concepts]: https://github.com/isocpp/CppCoreGuidelines/blob/master/CppCoreGuidelines.md#gslconcept-concepts

# Quick Start
## Supported Compilers / Toolsets
The GSL officially supports the latest and previous major versions of VS with MSVC & LLVM, GCC, Clang, and XCode with Apple-Clang.
Within these two major versions, we try to target the latest minor updates / revisions (although this may be affected by
delays between a toolchain's release and when it becomes widely available for use).
Below is a table showing the versions currently being tested.

Compiler |Toolset Versions Currently Tested
:------- |--:
 XCode | 13.2.1 & 12.5.1
 GCC | 11[^1] & 10[^2]
 Clang | 12[^2] & 11[^2]
 Visual Studio with MSVC | VS2022[^3] & VS2019[^4]
 Visual Studio with LLVM | VS2022[^3] & VS2019[^4]


[^1]: Precise version may be found in the [latest CI results](https://dev.azure.com/cppstat/GSL/_build?definitionId=1&branchFilter=26).
[^2]: Precise version may be found in the [latest CI results](https://dev.azure.com/cppstat/GSL/_build?definitionId=1&branchFilter=26). Should be the version specified [here](https://github.com/actions/virtual-environments/blob/main/images/linux/Ubuntu2004-Readme.md#language-and-runtime).
[^3]: Precise version may be found in the [latest CI results](https://dev.azure.com/cppstat/GSL/_build?definitionId=1&branchFilter=26). Should be the version specified [here](https://github.com/actions/virtual-environments/blob/main/images/win/Windows2022-Readme.md#visual-studio-enterprise-2022).
[^4]: Precise version may be found in the [latest CI results](https://dev.azure.com/cppstat/GSL/_build?definitionId=1&branchFilter=26). Should be the version specified [here](https://github.com/actions/virtual-environments/blob/main/images/win/Windows2019-Readme.md#visual-studio-enterprise-2019).

---
If you successfully port GSL to another platform, we would love to hear from you!
- Submit an issue specifying the platform and target.
- Consider contributing your changes by filing a pull request with any necessary changes.
- If at all possible, add a CI/CD step and add the button to the table below!

Target | CI/CD Status
:------- | -----------:
iOS | ![CI_iOS](https://github.com/microsoft/GSL/workflows/CI_iOS/badge.svg)
Android | ![CI_Android](https://github.com/microsoft/GSL/workflows/CI_Android/badge.svg)

Note: These CI/CD steps are run with each pull request, however failures in them are non-blocking.

## Building the tests
To build the tests, you will require the following:

* [CMake](http://cmake.org), version 3.1.3 (3.2.3 for AppleClang) or later to be installed and in your PATH.

These steps assume the source code of this repository has been cloned into a directory named `c:\GSL`.

1. Create a directory to contain the build outputs for a particular architecture (we name it c:\GSL\build-x86 in this example).

        cd GSL
        md build-x86
        cd build-x86

2. Configure CMake to use the compiler of your choice (you can see a list by running `cmake --help`).

        cmake -G "Visual Studio 15 2017" c:\GSL

3. Build the test suite (in this case, in the Debug configuration, Release is another good choice).

        cmake --build . --config Debug

4. Run the test suite.

        ctest -C Debug

All tests should pass - indicating your platform is fully supported and you are ready to use the GSL types!

## Building GSL - Using vcpkg

You can download and install GSL using the [vcpkg](https://github.com/Microsoft/vcpkg) dependency manager:

    git clone https://github.com/Microsoft/vcpkg.git
    cd vcpkg
    ./bootstrap-vcpkg.sh
    ./vcpkg integrate install
    vcpkg install ms-gsl

The GSL port in vcpkg is kept up to date by Microsoft team members and community contributors. If the version is out of date, please [create an issue or pull request](https://github.com/Microsoft/vcpkg) on the vcpkg repository.

## Using the libraries
As the types are entirely implemented inline in headers, there are no linking requirements.

You can copy the [gsl](./include/gsl) directory into your source tree so it is available
to your compiler, then include the appropriate headers in your program.

Alternatively set your compiler's *include path* flag to point to the GSL development folder (`c:\GSL\include` in the example above) or installation folder (after running the install). Eg.

MSVC++

    /I c:\GSL\include

GCC/clang

    -I$HOME/dev/GSL/include

Include the library using:

    #include <gsl/gsl>

## Usage in CMake

The library provides a Config file for CMake, once installed it can be found via

    find_package(Microsoft.GSL CONFIG)

Which, when successful, will add library target called `Microsoft.GSL::GSL` which you can use via the usual
`target_link_libraries` mechanism.

### FetchContent

If you are using cmake version 3.11+ you can use the offical FetchContent module.
This allows you to easily incorporate GSL into your project.

```cmake
# NOTE: This example uses cmake version 3.14 (FetchContent_MakeAvailable).
# Since it streamlines the FetchContent process
cmake_minimum_required(VERSION 3.14)

include(FetchContent)

# In this example we are picking a specific tag.
# You can also pick a specific commit, if you need to.
FetchContent_Declare(GSL
    GIT_REPOSITORY "https://github.com/microsoft/GSL"
    GIT_TAG "v3.1.0"
)

FetchContent_MakeAvailable(GSL)

# Now you can link against the GSL interface library
add_executable(foobar)

# Link against the interface library (IE header only library)
target_link_libraries(foobar PRIVATE GSL)
```

## Debugging visualization support
For Visual Studio users, the file [GSL.natvis](./GSL.natvis) in the root directory of the repository can be added to your project if you would like more helpful visualization of GSL types in the Visual Studio debugger than would be offered by default.

If you are using cmake this will be done automatically for you.
See 'GSL_VS_ADD_NATIVE_VISUALIZERS'
