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

#include <openssl/rand.h>

#include "../fipsmodule/rand/internal.h"

#if defined(OPENSSL_RAND_TRUSTY)
#include <stdint.h>
#include <stdlib.h>

#include <sys/types.h>
#include <uapi/err.h>

#include <lib/rng/trusty_rng.h>

void CRYPTO_sysrand(uint8_t *out, size_t requested) {
  if (trusty_rng_hw_rand(out, requested) != NO_ERROR) {
    abort();
  }
}

void CRYPTO_sysrand_for_seed(uint8_t *out, size_t requested) {
  CRYPTO_sysrand(out, requested);
}

#endif  // OPENSSL_RAND_TRUSTY
