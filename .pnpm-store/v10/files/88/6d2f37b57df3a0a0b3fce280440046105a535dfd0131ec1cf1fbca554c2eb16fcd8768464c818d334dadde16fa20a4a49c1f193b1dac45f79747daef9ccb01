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

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

#if defined(OPENSSL_MACOS) || defined(OPENSSL_FUCHSIA)
#include <sys/random.h>
#endif

// CRYPTO_sysrand puts |requested| random bytes into |out|.
void CRYPTO_sysrand(uint8_t *out, size_t requested) {
  while (requested > 0) {
    // |getentropy| can only request 256 bytes at a time.
    size_t todo = requested <= 256 ? requested : 256;
    if (getentropy(out, todo) != 0) {
      perror("getentropy() failed");
      abort();
    }

    out += todo;
    requested -= todo;
  }
}

void CRYPTO_sysrand_for_seed(uint8_t *out, size_t requested) {
  CRYPTO_sysrand(out, requested);
}

#endif  // OPENSSL_RAND_GETENTROPY
