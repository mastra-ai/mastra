Snappy, a fast compressor/decompressor.

[![Build Status](https://github.com/google/snappy/actions/workflows/build.yml/badge.svg)](https://github.com/google/snappy/actions/workflows/build.yml)

Introduction
============

Snappy is a compression/decompression library. It does not aim for maximum
compression, or compatibility with any other compression library; instead,
it aims for very high speeds and reasonable compression. For instance,
compared to the fastest mode of zlib, Snappy is an order of magnitude faster
for most inputs, but the resulting compressed files are anywhere from 20% to
100% bigger. (For more information, see "Performance", below.)

Snappy has the following properties:

 * Fast: Compression speeds at 250 MB/sec and beyond, with no assembler code.
   See "Performance" below.
 * Stable: Over the last few years, Snappy has compressed and decompressed
   petabytes of data in Google's production environment. The Snappy bitstream
   format is stable and will not change between versions.
 * Robust: The Snappy decompressor is designed not to crash in the face of
   corrupted or malicious input.
 * Free and open source software: Snappy is licensed under a BSD-type license.
   For more information, see the included COPYING file.

Snappy has previously been called "Zippy" in some Google presentations
and the like.


Performance
===========

Snappy is intended to be fast. On a single core of a Core i7 processor
in 64-bit mode, it compresses at about 250 MB/sec or more and decompresses at
about 500 MB/sec or more. (These numbers are for the slowest inputs in our
benchmark suite; others are much faster.) In our tests, Snappy usually
is faster than algorithms in the same class (e.g. LZO, LZF, QuickLZ,
etc.) while achieving comparable compression ratios.

Typical compression ratios (based on the benchmark suite) are about 1.5-1.7x
for plain text, about 2-4x for HTML, and of course 1.0x for JPEGs, PNGs and
other already-compressed data. Similar numbers for zlib in its fastest mode
are 2.6-2.8x, 3-7x and 1.0x, respectively. More sophisticated algorithms are
capable of achieving yet higher compression rates, although usually at the
expense of speed. Of course, compression ratio will vary significantly with
the input.

Although Snappy should be fairly portable, it is primarily optimized
for 64-bit x86-compatible processors, and may run slower in other environments.
In particular:

 - Snappy uses 64-bit operations in several places to process more data at
   once than would otherwise be possible.
 - Snappy assumes unaligned 32 and 64-bit loads and stores are cheap.
   On some platforms, these must be emulated with single-byte loads
   and stores, which is much slower.
 - Snappy assumes little-endian throughout, and needs to byte-swap data in
   several places if running on a big-endian platform.

Experience has shown that even heavily tuned code can be improved.
Performance optimizations, whether for 64-bit x86 or other platforms,
are of course most welcome; see "Contact", below.


Building
========

You need the CMake version specified in [CMakeLists.txt](./CMakeLists.txt)
or later to build:

```bash
git submodule update --init
mkdir build
cd build && cmake ../ && make
```

Usage
=====

Note that Snappy, both the implementation and the main interface,
is written in C++. However, several third-party bindings to other languages
are available; see the [home page](docs/README.md) for more information.
Also, if you want to use Snappy from C code, you can use the included C
bindings in snappy-c.h.

To use Snappy from your own C++ program, include the file "snappy.h" from
your calling file, and link against the compiled library.

There are many ways to call Snappy, but the simplest possible is

```c++
snappy::Compress(input.data(), input.size(), &output);
```

and similarly

```c++
snappy::Uncompress(input.data(), input.size(), &output);
```

where "input" and "output" are both instances of std::string.

There are other interfaces that are more flexible in various ways, including
support for custom (non-array) input sources. See the header file for more
information.


Tests and benchmarks
====================

When you compile Snappy, the following binaries are compiled in addition to the
library itself. You do not need them to use the compressor from your own
library, but they are useful for Snappy development.

* `snappy_benchmark` contains microbenchmarks used to tune compression and
  decompression performance.
* `snappy_unittests` contains unit tests, verifying correctness on your machine
  in various scenarios.
* `snappy_test_tool` can benchmark Snappy against a few other compression
  libraries (zlib, LZO, LZF, and QuickLZ), if they were detected at configure
  time. To benchmark using a given file, give the compression algorithm you want
  to test Snappy against (e.g. --zlib) and then a list of one or more file names
  on the command line.

If you want to change or optimize Snappy, please run the tests and benchmarks to
verify you have not broken anything.

The testdata/ directory contains the files used by the microbenchmarks, which
should provide a reasonably balanced starting point for benchmarking. (Note that
baddata[1-3].snappy are not intended as benchmarks; they are used to verify
correctness in the presence of corrupted data in the unit test.)

Contributing to the Snappy Project
==================================

In addition to the aims listed at the top of the [README](README.md) Snappy
explicitly supports the following:

1. C++11
2. Clang (gcc and MSVC are best-effort).
3. Low level optimizations (e.g. assembly or equivalent intrinsics) for:
     - [x86](https://en.wikipedia.org/wiki/X86)
     - [x86-64](https://en.wikipedia.org/wiki/X86-64)
     - ARMv7 (32-bit)
     - ARMv8 (AArch64)
4. Supports only the Snappy compression scheme as described in
  [format_description.txt](format_description.txt).
5. CMake for building

Changes adding features or dependencies outside of the core area of focus listed
above might not be accepted. If in doubt post a message to the
[Snappy discussion mailing list](https://groups.google.com/g/snappy-compression).

We are unlikely to accept contributions to the build configuration files, such
as `CMakeLists.txt`. We are focused on maintaining a build configuration that
allows us to test that the project works in a few supported configurations
inside Google. We are not currently interested in supporting other requirements,
such as different operating systems, compilers, or build systems.

Contact
=======

Snappy is distributed through GitHub. For the latest version and other
information, see https://github.com/google/snappy.
