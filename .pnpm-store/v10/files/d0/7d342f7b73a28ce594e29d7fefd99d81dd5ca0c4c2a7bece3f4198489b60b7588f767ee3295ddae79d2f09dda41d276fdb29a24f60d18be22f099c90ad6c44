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

#include <gtest/gtest.h>

#include <openssl/cipher.h>
#include <openssl/digest.h>
#include <openssl/evp.h>


// Node.js assumes every cipher in |EVP_CIPHER_do_all_sorted| is accessible via
// |EVP_get_cipherby*|.
TEST(EVPTest, CipherDoAll) {
  EVP_CIPHER_do_all_sorted(
      [](const EVP_CIPHER *cipher, const char *name, const char *unused,
         void *arg) {
        SCOPED_TRACE(name);
        EXPECT_EQ(cipher, EVP_get_cipherbyname(name));
        EXPECT_EQ(cipher, EVP_get_cipherbynid(EVP_CIPHER_nid(cipher)));
      },
      nullptr);
}

// Node.js assumes every digest in |EVP_MD_do_all_sorted| is accessible via
// |EVP_get_digestby*|.
TEST(EVPTest, MDDoAll) {
  EVP_MD_do_all_sorted(
      [](const EVP_MD *md, const char *name, const char *unused, void *arg) {
        SCOPED_TRACE(name);
        EXPECT_EQ(md, EVP_get_digestbyname(name));
        EXPECT_EQ(md, EVP_get_digestbynid(EVP_MD_nid(md)));
      },
      nullptr);
}
