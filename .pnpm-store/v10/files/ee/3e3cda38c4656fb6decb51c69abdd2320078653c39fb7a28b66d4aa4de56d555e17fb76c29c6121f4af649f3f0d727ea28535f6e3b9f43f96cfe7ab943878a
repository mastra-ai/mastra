/* Copyright (c) 2021, Google Inc.
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

#include <openssl/blake2.h>

#include <gtest/gtest.h>

#include "../test/file_test.h"
#include "../test/test_util.h"

TEST(BLAKE2B256Test, ABC) {
  // https://tools.ietf.org/html/rfc7693#appendix-A, except updated for the
  // 256-bit hash output.
  const uint8_t kExpected[] = {
      0xbd, 0xdd, 0x81, 0x3c, 0x63, 0x42, 0x39, 0x72, 0x31, 0x71, 0xef,
      0x3f, 0xee, 0x98, 0x57, 0x9b, 0x94, 0x96, 0x4e, 0x3b, 0xb1, 0xcb,
      0x3e, 0x42, 0x72, 0x62, 0xc8, 0xc0, 0x68, 0xd5, 0x23, 0x19,
  };

  uint8_t digest[BLAKE2B256_DIGEST_LENGTH];
  BLAKE2B256((const uint8_t *)"abc", 3, digest);
  EXPECT_EQ(Bytes(kExpected), Bytes(digest));
}

TEST(BLAKE2B256Test, TestVectors) {
  FileTestGTest("crypto/blake2/blake2b256_tests.txt", [](FileTest *t) {
    std::vector<uint8_t> msg, expected;
    ASSERT_TRUE(t->GetBytes(&msg, "IN"));
    ASSERT_TRUE(t->GetBytes(&expected, "HASH"));

    uint8_t digest[BLAKE2B256_DIGEST_LENGTH];
    BLAKE2B256(msg.data(), msg.size(), digest);
    EXPECT_EQ(Bytes(digest), Bytes(expected)) << msg.size();

    OPENSSL_memset(digest, 0, sizeof(digest));
    BLAKE2B_CTX b2b;
    BLAKE2B256_Init(&b2b);
    for (uint8_t b : msg) {
      BLAKE2B256_Update(&b2b, &b, 1);
    }
    BLAKE2B256_Final(digest, &b2b);
    EXPECT_EQ(Bytes(digest), Bytes(expected)) << msg.size();
  });
}
