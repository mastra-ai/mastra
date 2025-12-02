/* Copyright (c) 2016, Google Inc.
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

#include <openssl/err.h>
#include <openssl/mem.h>
#include <openssl/x509.h>

#include "../crypto/x509v3/internal.h"

extern "C" int LLVMFuzzerTestOneInput(const uint8_t *buf, size_t len) {
  X509 *x509 = d2i_X509(NULL, &buf, len);
  if (x509 != NULL) {
    // Extract the public key.
    EVP_PKEY_free(X509_get_pubkey(x509));

    // Fuzz some deferred parsing.
    x509v3_cache_extensions(x509);

    // Reserialize the structure.
    uint8_t *der = NULL;
    i2d_X509(x509, &der);
    OPENSSL_free(der);

    BIO *bio = BIO_new(BIO_s_mem());
    X509_print(bio, x509);
    BIO_free(bio);
  }
  X509_free(x509);
  ERR_clear_error();
  return 0;
}
