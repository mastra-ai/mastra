/* Copyright (c) 2018, Google Inc.
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

#include <openssl/bytestring.h>
#include <openssl/evp.h>
#include <openssl/pkcs8.h>
#include <openssl/x509.h>


extern "C" int LLVMFuzzerTestOneInput(const uint8_t *buf, size_t len) {
  bssl::UniquePtr<STACK_OF(X509)> certs(sk_X509_new_null());
  EVP_PKEY *key = nullptr;
  CBS cbs;
  CBS_init(&cbs, buf, len);
  PKCS12_get_key_and_certs(&key, certs.get(), &cbs, "foo");
  EVP_PKEY_free(key);
  return 0;
}
