/* Copyright (c) 2017, Google Inc.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 * SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 * OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 * CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE. */

#include <limits.h>
#include <stdint.h>

#include <type_traits>

#include <gtest/gtest.h>

#include "test/test_util.h"


template <typename T>
static void CheckRepresentation(T value) {
  SCOPED_TRACE(value);

  // Convert to the corresponding two's-complement unsigned value. We use an
  // unsigned value so the right-shift below has defined value. Right-shifts of
  // negative numbers in C are implementation defined.
  //
  // If |T| is already unsigned, this is a no-op, as desired.
  //
  // If |T| is signed, conversion to unsigned is defined to repeatedly add or
  // subtract (numerically, not within |T|) one more than the unsigned type's
  // maximum value until it fits (this must be a power of two). This is the
  // conversion we want.
  using UnsignedT = typename std::make_unsigned<T>::type;
  UnsignedT value_u = static_cast<UnsignedT>(value);
  EXPECT_EQ(sizeof(UnsignedT), sizeof(T));

  // Integers must be little-endian.
  uint8_t expected[sizeof(UnsignedT)];
  for (size_t i = 0; i < sizeof(UnsignedT); i++) {
    expected[i] = static_cast<uint8_t>(value_u);
    // Divide instead of right-shift to appease compilers that warn if |T| is a
    // char. The explicit cast is also needed to appease MSVC if integer
    // promotion happened.
    value_u = static_cast<UnsignedT>(value_u / 256);
  }
  EXPECT_EQ(0u, value_u);

  // Check that |value| has the expected representation.
  EXPECT_EQ(Bytes(expected),
            Bytes(reinterpret_cast<const uint8_t *>(&value), sizeof(value)));
}

TEST(CompilerTest, IntegerRepresentation) {
  static_assert(CHAR_BIT == 8, "BoringSSL only supports 8-bit chars");
  static_assert(UCHAR_MAX == 0xff, "BoringSSL only supports 8-bit chars");

  // Require that |unsigned char| and |uint8_t| be the same type. We require
  // that type-punning through |uint8_t| is not a strict aliasing violation. In
  // principle, type-punning should be done with |memcpy|, which would make this
  // moot.
  //
  // However, C made too many historical mistakes with the types and signedness
  // of character strings. As a result, aliasing between all variations on 8-bit
  // chars are a practical necessity for all real C code. We do not support
  // toolchains that break this assumption.
  static_assert(
      std::is_same<unsigned char, uint8_t>::value,
      "BoringSSL requires uint8_t and unsigned char be the same type");
  uint8_t u8 = 0;
  unsigned char *ptr = &u8;
  (void)ptr;

  // Sized integers have the expected size.
  static_assert(sizeof(uint8_t) == 1u, "uint8_t has the wrong size");
  static_assert(sizeof(uint16_t) == 2u, "uint16_t has the wrong size");
  static_assert(sizeof(uint32_t) == 4u, "uint32_t has the wrong size");
  static_assert(sizeof(uint64_t) == 8u, "uint64_t has the wrong size");

  // size_t does not exceed uint64_t.
  static_assert(sizeof(size_t) <= 8u, "size_t must not exceed uint64_t");

  // Require that |int| be exactly 32 bits. OpenSSL historically mixed up
  // |unsigned| and |uint32_t|, so we require it be at least 32 bits. Requiring
  // at most 32-bits is a bit more subtle. C promotes arithemetic operands to
  // |int| when they fit. But this means, if |int| is 2N bits wide, multiplying
  // two maximum-sized |uintN_t|s is undefined by integer overflow!
  //
  // We attempt to handle this for |uint16_t|, assuming a 32-bit |int|, but we
  // make no attempts to correct for this with |uint32_t| for a 64-bit |int|.
  // Thus BoringSSL does not support ILP64 platforms.
  //
  // This test is on |INT_MAX| and |INT32_MAX| rather than sizeof because it is
  // theoretically allowed for sizeof(int) to be 4 but include padding bits.
  static_assert(INT_MAX == INT32_MAX, "BoringSSL requires int be 32-bit");
  static_assert(UINT_MAX == UINT32_MAX,
                "BoringSSL requires unsigned be 32-bit");

  CheckRepresentation(static_cast<signed char>(127));
  CheckRepresentation(static_cast<signed char>(1));
  CheckRepresentation(static_cast<signed char>(0));
  CheckRepresentation(static_cast<signed char>(-1));
  CheckRepresentation(static_cast<signed char>(-42));
  CheckRepresentation(static_cast<signed char>(-128));

  CheckRepresentation(static_cast<int>(INT_MAX));
  CheckRepresentation(static_cast<int>(0x12345678));
  CheckRepresentation(static_cast<int>(1));
  CheckRepresentation(static_cast<int>(0));
  CheckRepresentation(static_cast<int>(-1));
  CheckRepresentation(static_cast<int>(-0x12345678));
  CheckRepresentation(static_cast<int>(INT_MIN));

  CheckRepresentation(static_cast<unsigned>(UINT_MAX));
  CheckRepresentation(static_cast<unsigned>(0x12345678));
  CheckRepresentation(static_cast<unsigned>(1));
  CheckRepresentation(static_cast<unsigned>(0));

  CheckRepresentation(static_cast<long>(LONG_MAX));
  CheckRepresentation(static_cast<long>(0x12345678));
  CheckRepresentation(static_cast<long>(1));
  CheckRepresentation(static_cast<long>(0));
  CheckRepresentation(static_cast<long>(-1));
  CheckRepresentation(static_cast<long>(-0x12345678));
  CheckRepresentation(static_cast<long>(LONG_MIN));

  CheckRepresentation(static_cast<unsigned long>(ULONG_MAX));
  CheckRepresentation(static_cast<unsigned long>(0x12345678));
  CheckRepresentation(static_cast<unsigned long>(1));
  CheckRepresentation(static_cast<unsigned long>(0));

  CheckRepresentation(static_cast<int16_t>(0x7fff));
  CheckRepresentation(static_cast<int16_t>(0x1234));
  CheckRepresentation(static_cast<int16_t>(1));
  CheckRepresentation(static_cast<int16_t>(0));
  CheckRepresentation(static_cast<int16_t>(-1));
  CheckRepresentation(static_cast<int16_t>(-0x7fff - 1));

  CheckRepresentation(static_cast<uint16_t>(0xffff));
  CheckRepresentation(static_cast<uint16_t>(0x1234));
  CheckRepresentation(static_cast<uint16_t>(1));
  CheckRepresentation(static_cast<uint16_t>(0));

  CheckRepresentation(static_cast<int32_t>(0x7fffffff));
  CheckRepresentation(static_cast<int32_t>(0x12345678));
  CheckRepresentation(static_cast<int32_t>(1));
  CheckRepresentation(static_cast<int32_t>(0));
  CheckRepresentation(static_cast<int32_t>(-1));
  CheckRepresentation(static_cast<int32_t>(-0x7fffffff - 1));

  CheckRepresentation(static_cast<uint32_t>(0xffffffff));
  CheckRepresentation(static_cast<uint32_t>(0x12345678));
  CheckRepresentation(static_cast<uint32_t>(1));
  CheckRepresentation(static_cast<uint32_t>(0));

  CheckRepresentation(static_cast<int64_t>(0x7fffffffffffffff));
  CheckRepresentation(static_cast<int64_t>(0x123456789abcdef0));
  CheckRepresentation(static_cast<int64_t>(1));
  CheckRepresentation(static_cast<int64_t>(0));
  CheckRepresentation(static_cast<int64_t>(-1));
  CheckRepresentation(static_cast<int64_t>(-0x7fffffffffffffff - 1));

  CheckRepresentation(static_cast<uint64_t>(0xffffffffffffffff));
  CheckRepresentation(static_cast<uint64_t>(0x12345678abcdef0));
  CheckRepresentation(static_cast<uint64_t>(1));
  CheckRepresentation(static_cast<uint64_t>(0));
}

TEST(CompilerTest, PointerRepresentation) {
  // Converting pointers to integers and doing arithmetic on those values are
  // both defined. Converting those values back into pointers is undefined,
  // but, for aliasing checks, we require that the implementation-defined
  // result of that computation commutes with pointer arithmetic.
  char chars[256];
  for (size_t i = 0; i < sizeof(chars); i++) {
    EXPECT_EQ(reinterpret_cast<uintptr_t>(chars) + i,
              reinterpret_cast<uintptr_t>(chars + i));
  }

  int ints[256];
  for (size_t i = 0; i < OPENSSL_ARRAY_SIZE(ints); i++) {
    EXPECT_EQ(reinterpret_cast<uintptr_t>(ints) + i * sizeof(int),
              reinterpret_cast<uintptr_t>(ints + i));
  }

  // nullptr must be represented by all zeros in memory. This is necessary so
  // structs may be initialized by memset(0).
  int *null = nullptr;
  uint8_t bytes[sizeof(null)] = {0};
  EXPECT_EQ(Bytes(bytes),
            Bytes(reinterpret_cast<uint8_t *>(&null), sizeof(null)));
}
