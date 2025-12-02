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

#include <openssl/bytestring.h>
#include <openssl/ssl.h>
#include <openssl/span.h>

#include "../ssl/internal.h"


extern "C" int LLVMFuzzerTestOneInput(const uint8_t *buf, size_t len) {
  static bssl::UniquePtr<SSL_CTX> ctx(SSL_CTX_new(TLS_method()));
  static bssl::UniquePtr<SSL> ssl(SSL_new(ctx.get()));

  CBS reader(bssl::MakeConstSpan(buf, len));
  CBS encoded_client_hello_inner_cbs;

  if (!CBS_get_u24_length_prefixed(&reader, &encoded_client_hello_inner_cbs)) {
    return 0;
  }

  bssl::Array<uint8_t> encoded_client_hello_inner;
  if (!encoded_client_hello_inner.CopyFrom(encoded_client_hello_inner_cbs)) {
    return 0;
  }

  // Use the remaining bytes in |reader| as the ClientHelloOuter.
  SSL_CLIENT_HELLO client_hello_outer;
  if (!bssl::ssl_client_hello_init(ssl.get(), &client_hello_outer, reader)) {
    return 0;
  }

  // Recover the ClientHelloInner from the EncodedClientHelloInner and
  // ClientHelloOuter.
  uint8_t alert_unused;
  bssl::Array<uint8_t> client_hello_inner;
  bssl::ssl_decode_client_hello_inner(
      ssl.get(), &alert_unused, &client_hello_inner, encoded_client_hello_inner,
      &client_hello_outer);
  return 0;
}
