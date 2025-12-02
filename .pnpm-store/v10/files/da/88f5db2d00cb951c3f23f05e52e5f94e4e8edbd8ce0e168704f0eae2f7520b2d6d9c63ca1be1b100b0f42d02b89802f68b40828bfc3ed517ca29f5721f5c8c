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

#include <stdio.h>

#include <openssl/mem.h>
#include <openssl/ssl.h>

struct GlobalState {
  GlobalState() : ctx(SSL_CTX_new(TLS_method())) {}

  bssl::UniquePtr<SSL_CTX> ctx;
};

static GlobalState g_state;

extern "C" int LLVMFuzzerTestOneInput(const uint8_t *buf, size_t len) {
  // Parse in our session.
  bssl::UniquePtr<SSL_SESSION> session(
      SSL_SESSION_from_bytes(buf, len, g_state.ctx.get()));

  // If the format was invalid, just return.
  if (!session) {
    return 0;
  }

  // Stress the encoder.
  size_t encoded_len;
  uint8_t *encoded;
  if (!SSL_SESSION_to_bytes(session.get(), &encoded, &encoded_len)) {
    fprintf(stderr, "SSL_SESSION_to_bytes failed.\n");
    return 1;
  }

  OPENSSL_free(encoded);
  return 0;
}
