/* Copyright (c) 2023, Google Inc.
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

#if !defined(_DEFAULT_SOURCE)
#define _DEFAULT_SOURCE  // Needed for getentropy on musl and glibc
#endif

#include <openssl/rand.h>

#include "../fipsmodule/rand/internal.h"

#if defined(OPENSSL_RAND_GETENTROPY)

#include <unistd.h>

#include <errno.h>

#if defined(OPENSSL_MACOS) || defined(OPENSSL_FUCHSIA)
#include <sys/random.h>
#endif

#include <gtest/gtest.h>

#include <openssl/span.h>

#include "../test/test_util.h"

// This test is, strictly speaking, flaky, but we use large enough buffers
// that the probability of failing when we should pass is negligible.

TEST(GetEntropyTest, NotObviouslyBroken) {
  static const uint8_t kZeros[256] = {0};

  uint8_t buf1[256], buf2[256];

  EXPECT_EQ(getentropy(buf1, sizeof(buf1)), 0);
  EXPECT_EQ(getentropy(buf2, sizeof(buf2)), 0);
  EXPECT_NE(Bytes(buf1), Bytes(buf2));
  EXPECT_NE(Bytes(buf1), Bytes(kZeros));
  EXPECT_NE(Bytes(buf2), Bytes(kZeros));
  uint8_t buf3[256];
  // Ensure that the implementation is not simply returning the memory unchanged.
  memcpy(buf3, buf1, sizeof(buf3));
  EXPECT_EQ(getentropy(buf1, sizeof(buf1)), 0);
  EXPECT_NE(Bytes(buf1), Bytes(buf3));
  errno = 0;
  uint8_t toobig[257];
  // getentropy should fail returning -1 and setting errno to EIO if you request
  // more than 256 bytes of entropy. macOS's man page says EIO but it actually
  // returns EINVAL, so we accept either.
  EXPECT_EQ(getentropy(toobig, 257), -1);
  EXPECT_TRUE(errno == EIO || errno == EINVAL);
}
#endif
