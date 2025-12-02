/* Copyright (c) 2020, Google Inc.
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

#include <stdio.h>
#include <string.h>

#include <string>

#include <openssl/base.h>
#include <openssl/aead.h>
#include <openssl/crypto.h>
#include <openssl/cipher.h>
#include <openssl/mem.h>

#include <gtest/gtest.h>

// Test that OPENSSL_VERSION_NUMBER and OPENSSL_VERSION_TEXT are consistent.
// Node.js parses the version out of OPENSSL_VERSION_TEXT instead of using
// OPENSSL_VERSION_NUMBER.
TEST(CryptoTest, Version) {
  char expected[512];
  snprintf(expected, sizeof(expected), "OpenSSL %d.%d.%d ",
           OPENSSL_VERSION_NUMBER >> 28, (OPENSSL_VERSION_NUMBER >> 20) & 0xff,
           (OPENSSL_VERSION_NUMBER >> 12) & 0xff);
  EXPECT_EQ(expected,
            std::string(OPENSSL_VERSION_TEXT).substr(0, strlen(expected)));
}

TEST(CryptoTest, Strndup) {
  bssl::UniquePtr<char> str(OPENSSL_strndup(nullptr, 0));
  EXPECT_TRUE(str);
  EXPECT_STREQ("", str.get());
}

#if defined(BORINGSSL_FIPS_COUNTERS)
using CounterArray = size_t[fips_counter_max + 1];

static void read_all_counters(CounterArray counters) {
  for (fips_counter_t counter = static_cast<fips_counter_t>(0);
       counter <= fips_counter_max;
       counter = static_cast<fips_counter_t>(counter + 1)) {
    counters[counter] = FIPS_read_counter(counter);
  }
}

static void expect_counter_delta_is_zero_except_for_a_one_at(
    CounterArray before, CounterArray after, fips_counter_t position) {
  for (fips_counter_t counter = static_cast<fips_counter_t>(0);
       counter <= fips_counter_max;
       counter = static_cast<fips_counter_t>(counter + 1)) {
    const size_t expected_delta = counter == position ? 1 : 0;
    EXPECT_EQ(after[counter], before[counter] + expected_delta) << counter;
  }
}

TEST(CryptoTest, FIPSCountersEVP) {
  constexpr struct {
    const EVP_CIPHER *(*cipher)();
    fips_counter_t counter;
  } kTests[] = {
      {
          EVP_aes_128_gcm,
          fips_counter_evp_aes_128_gcm,
      },
      {
          EVP_aes_256_gcm,
          fips_counter_evp_aes_256_gcm,
      },
      {
          EVP_aes_128_ctr,
          fips_counter_evp_aes_128_ctr,
      },
      {
          EVP_aes_256_ctr,
          fips_counter_evp_aes_256_ctr,
      },
  };

  uint8_t key[EVP_MAX_KEY_LENGTH] = {0};
  uint8_t iv[EVP_MAX_IV_LENGTH] = {1};
  CounterArray before, after;
  for (const auto &test : kTests) {
    read_all_counters(before);
    bssl::ScopedEVP_CIPHER_CTX ctx;
    ASSERT_TRUE(EVP_EncryptInit_ex(ctx.get(), test.cipher(), /*engine=*/nullptr,
                                   key, iv));
    read_all_counters(after);

    expect_counter_delta_is_zero_except_for_a_one_at(before, after,
                                                     test.counter);
  }
}

TEST(CryptoTest, FIPSCountersEVP_AEAD) {
  constexpr struct {
    const EVP_AEAD *(*aead)();
    unsigned key_len;
    fips_counter_t counter;
  } kTests[] = {
      {
          EVP_aead_aes_128_gcm,
          16,
          fips_counter_evp_aes_128_gcm,
      },
      {
          EVP_aead_aes_256_gcm,
          32,
          fips_counter_evp_aes_256_gcm,
      },
  };

  uint8_t key[EVP_AEAD_MAX_KEY_LENGTH] = {0};
  CounterArray before, after;
  for (const auto &test : kTests) {
    ASSERT_LE(test.key_len, sizeof(key));

    read_all_counters(before);
    bssl::ScopedEVP_AEAD_CTX ctx;
    ASSERT_TRUE(EVP_AEAD_CTX_init(ctx.get(), test.aead(), key, test.key_len,
                                  EVP_AEAD_DEFAULT_TAG_LENGTH,
                                  /*engine=*/nullptr));
    read_all_counters(after);

    expect_counter_delta_is_zero_except_for_a_one_at(before, after,
                                                     test.counter);
  }
}

#endif  // BORINGSSL_FIPS_COUNTERS

TEST(Crypto, QueryAlgorithmStatus) {
#if defined(BORINGSSL_FIPS)
  const bool is_fips_build = true;
#else
  const bool is_fips_build = false;
#endif

  EXPECT_EQ(FIPS_query_algorithm_status("AES-GCM"), is_fips_build);
  EXPECT_EQ(FIPS_query_algorithm_status("AES-ECB"), is_fips_build);

  EXPECT_FALSE(FIPS_query_algorithm_status("FakeEncrypt"));
  EXPECT_FALSE(FIPS_query_algorithm_status(""));
}

#if defined(BORINGSSL_FIPS) && !defined(OPENSSL_ASAN)
TEST(Crypto, OnDemandIntegrityTest) {
  BORINGSSL_integrity_test();
}
#endif

OPENSSL_DEPRECATED static void DeprecatedFunction() {}

OPENSSL_BEGIN_ALLOW_DEPRECATED
TEST(CryptoTest, DeprecatedFunction) {
  // This is deprecated, but should not trigger any warnings.
  DeprecatedFunction();
}
OPENSSL_END_ALLOW_DEPRECATED
