# Welcome to taoJSON

[![Windows CI](https://github.com/taocpp/json/workflows/Windows/badge.svg)](https://github.com/taocpp/json/actions?query=workflow%3AWindows)
[![macOS CI](https://github.com/taocpp/json/workflows/macOS/badge.svg)](https://github.com/taocpp/json/actions?query=workflow%3AmacOS)
[![Linux CI](https://github.com/taocpp/json/workflows/Linux/badge.svg)](https://github.com/taocpp/json/actions?query=workflow%3ALinux)
[![Android CI](https://github.com/taocpp/json/workflows/Android/badge.svg)](https://github.com/taocpp/json/actions?query=workflow%3AAndroid)
<br>
[![clang-analyze](https://github.com/taocpp/json/workflows/clang-analyze/badge.svg)](https://github.com/taocpp/json/actions?query=workflow%3Aclang-analyze)
[![clang-tidy](https://github.com/taocpp/json/workflows/clang-tidy/badge.svg)](https://github.com/taocpp/json/actions?query=workflow%3Aclang-tidy)
[![Sanitizer](https://github.com/taocpp/json/workflows/Sanitizer/badge.svg)](https://github.com/taocpp/json/actions?query=workflow%3ASanitizer)
[![CodeQL](https://github.com/taocpp/json/workflows/CodeQL/badge.svg)](https://github.com/taocpp/json/actions?query=workflow%3ACodeQL)
[![Code Coverage](https://codecov.io/gh/taocpp/json/branch/main/graph/badge.svg?token=ykWa8RRdyk)](https://codecov.io/gh/taocpp/json)

taoJSON is a C++ header-only JSON library that provides a generic [Value Class](doc/Value-Class.md), uses [Type Traits](doc/Type-Traits.md) to interoperate with C++ types, uses an [Events Interface](doc/Events-Interface.md) to convert from and to JSON, JAXN, CBOR, MsgPack and UBJSON, and much more...

## Documentation

* [Version 1.x](doc/README.md) (requires C++17)

*Warning: The documentation is currently not quite keeping pace with what will hopefully be the last large pre-1.0.0 development burst.*

## Contact

For questions and suggestions regarding taoJSON, success or failure stories, and any other kind of feedback, please feel free to open a [discussion](https://github.com/taocpp/json/discussions), an [issue](https://github.com/taocpp/json/issues) or a [pull request](https://github.com/taocpp/json/pulls) on GitHub or contact the authors at `taocpp(at)icemx.net`.

## Features

* Supported Standards

  * [RFC8259], [ECMA-404]: The JavaScript Object Notation (JSON) Data Interchange Format.
  * Achieves a **100%** conformance score in the [Native JSON Benchmark] tests.
  * [RFC6901]: JavaScript Object Notation (JSON) Pointer.
  * [RFC6902]: JavaScript Object Notation (JSON) Patch.
  * [RFC7049]: Concise Binary Object Representation ([CBOR]).
  * [JAXN]: Relaxed JSON.
  * [MsgPack]: MessagePack binary format (without extensions).
  * [UBJSON]: Universal Binary JSON.

* [Value Class](doc/Value-Class.md)

  * JSON data model extended with non-finite number values and binary data.
  * Construction of objects and arrays via `std::initializer_list`.
  * Conversion from and to arbitrary *user-defined types* via [Type Traits](doc/Type-Traits.md).
  * Built around STL containers `std::variant`, `std::string`, `std::map`, `std::vector`, etc.
  * No memory allocations by the Value class itself (the wrapped containers allocate normally).
  * Instance sharing for string, binary, Value, and *user-defined types* via non-owning pointers.
  * C++11 literal operator for Values, including binary data.
  * Optional [Base class for Values](doc/Advanced-Use-Cases.md#custom-base-class-for-values) (e.g. to [annotate (sub-)values with file and line](doc/Advanced-Use-Cases.md#annotate-with-filename-and-line-number)).

* [Events Interface](doc/Events-Interface.md)

  * Simple, straightforward and flexible Events API.
  * Events-to-Value and Value-to-Events interfaces.
  * Parse JSON & JAXN string representation to Events.
  * Stream Events to (prettified) JSON & JAXN string representation.
  * Conversion from and to binary formats, currently [CBOR], [UBJSON], [MsgPack].
  * Conversion from and to *other* JSON libraries (e.g. [`contrib/nlohmann.cpp`](contrib/nlohmann.cpp)).
  * Events comparison, hashing, counting, and schema validation.
  * Events Transformers to manipulate Events on-the-fly.

## Status

The library is stable as in "works correctly" over months of multiple real-world applications.

The library is not stable as in "under construction"; some parts of the API are under discussion and development and might change and/or be extended before version 1.0.

This library also serves as a real-world example application of the [Parsing Expression Grammar Template Library (PEGTL)], which is used for parsing the JSON and JAXN representation formats.

## Package Managers

You can download and install taoJSON using the [Conan](https://github.com/conan-io/conan) package manager:

    conan install taocpp-json/1.0.0-beta.11@

The taocpp-json package in conan is kept up to date by Conan team members and community contributors.
If the version is out-of-date, please [create an issue or pull request](https://github.com/conan-io/conan-center-index) on the Conan Center Index repository.

## Thank You

* Niels Lohmann and his [JSON library](https://github.com/nlohmann/json) for the inspiration.
* Milo Yip and his [Native JSON Benchmark] for a reference to measure progress against.

## The Art of C++

taoJSON is part of [The Art of C++](https://taocpp.github.io/).

[<img alt="colinh" src="https://avatars.githubusercontent.com/u/113184" width="120">](https://github.com/colinh)
[<img alt="d-frey" src="https://avatars.githubusercontent.com/u/3956325" width="120">](https://github.com/d-frey)
[<img alt="uilianries" src="https://avatars.githubusercontent.com/u/4870173" width="120">](https://github.com/uilianries)

## License

<a href="https://opensource.org/licenses/MIT"><img align="right" src="https://opensource.org/wp-content/uploads/2009/06/OSIApproved.svg" width="150" hspace="20" alt="Open Source Initiative"></a>

taoJSON is certified [Open Source] software.
It may be used for any purpose, including commercial purposes, at absolutely no cost.
It is distributed under the terms of the [MIT license] reproduced here.

> Copyright (c) 2015-2023 Dr. Colin Hirsch and Daniel Frey
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Additional Licenses

taoJSON contains modified portions of the [double-conversion library](https://github.com/google/double-conversion) which is licensed as follows:

> Copyright 2006-2011, the V8 project authors. All rights reserved. Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
>
> * Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
> * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
> * Neither the name of Google Inc. nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
>
> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

taoJSON contains modified portions of [James Edward Anhalt III's itoa library](https://github.com/jeaiii/itoa) which is licensed as follows:

> Copyright (c) 2017 James Edward Anhalt III - https://github.com/jeaiii/itoa
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

taoJSON contains modified portions of [Ulf Adams' Ryu implementation](https://github.com/ulfjack/ryu) which is licensed as follows:

> Copyright 2018 Ulf Adams
>
> The contents of this file may be used under the terms of the Apache License, Version 2.0.
>
>    (See accompanying file LICENSE.ryu or copy at
>     http://www.apache.org/licenses/LICENSE-2.0)
>
> Alternatively, the contents of this file may be used under the terms of the Boost Software License, Version 1.0.
>    (See accompanying file LICENSE-Boost or copy at
>     https://www.boost.org/LICENSE_1_0.txt)
>
> Unless required by applicable law or agreed to in writing, this software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

[CBOR]: http://cbor.io
[ECMA-404]: http://www.ecma-international.org/publications/standards/Ecma-404.htm
[JAXN]: https://github.com/stand-art/jaxn
[JSON Reference]: https://tools.ietf.org/html/draft-pbryan-zyp-json-ref-03
[JSON Schema]: http://json-schema.org/documentation.html
[MsgPack]: http://msgpack.org
[MIT license]: http://www.opensource.org/licenses/mit-license.html
[Native JSON Benchmark]: https://github.com/miloyip/nativejson-benchmark
[Open Source]: http://www.opensource.org/docs/definition.html
[Parsing Expression Grammar Template Library (PEGTL)]: https://github.com/taocpp/PEGTL
[RFC6901]: https://tools.ietf.org/html/rfc6901
[RFC6902]: https://tools.ietf.org/html/rfc6902
[RFC7049]: https://tools.ietf.org/html/rfc7049
[RFC8259]: https://tools.ietf.org/html/rfc8259
[UBJSON]: http://ubjson.org
