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

#ifndef OPENSSL_HEADER_DSA_INTERNAL_H
#define OPENSSL_HEADER_DSA_INTERNAL_H

#include <openssl/dsa.h>

#include <openssl/thread.h>

#include "../internal.h"

#if defined(__cplusplus)
extern "C" {
#endif


struct dsa_st {
  BIGNUM *p;
  BIGNUM *q;
  BIGNUM *g;

  BIGNUM *pub_key;
  BIGNUM *priv_key;

  // Normally used to cache montgomery values
  CRYPTO_MUTEX method_mont_lock;
  BN_MONT_CTX *method_mont_p;
  BN_MONT_CTX *method_mont_q;
  CRYPTO_refcount_t references;
  CRYPTO_EX_DATA ex_data;
};

// dsa_check_key performs cheap self-checks on |dsa|, and ensures it is within
// DoS bounds. It returns one on success and zero on error.
int dsa_check_key(const DSA *dsa);


#if defined(__cplusplus)
}  // extern C
#endif

#endif  // OPENSSL_HEADER_DSA_INTERNAL_H
