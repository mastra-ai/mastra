/* Copyright (c) 2015, Google Inc.
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

#include "internal.h"

#include <assert.h>
#include <stdlib.h>


// See comment above the typedef of CRYPTO_refcount_t about these tests.
static_assert(alignof(CRYPTO_refcount_t) == alignof(CRYPTO_atomic_u32),
              "CRYPTO_refcount_t does not match CRYPTO_atomic_u32 alignment");
static_assert(sizeof(CRYPTO_refcount_t) == sizeof(CRYPTO_atomic_u32),
              "CRYPTO_refcount_t does not match CRYPTO_atomic_u32 size");

static_assert((CRYPTO_refcount_t)-1 == CRYPTO_REFCOUNT_MAX,
              "CRYPTO_REFCOUNT_MAX is incorrect");

void CRYPTO_refcount_inc(CRYPTO_refcount_t *in_count) {
  CRYPTO_atomic_u32 *count = (CRYPTO_atomic_u32 *)in_count;
  uint32_t expected = CRYPTO_atomic_load_u32(count);

  while (expected != CRYPTO_REFCOUNT_MAX) {
    uint32_t new_value = expected + 1;
    if (CRYPTO_atomic_compare_exchange_weak_u32(count, &expected, new_value)) {
      break;
    }
  }
}

int CRYPTO_refcount_dec_and_test_zero(CRYPTO_refcount_t *in_count) {
  CRYPTO_atomic_u32 *count = (CRYPTO_atomic_u32 *)in_count;
  uint32_t expected = CRYPTO_atomic_load_u32(count);

  for (;;) {
    if (expected == 0) {
      abort();
    } else if (expected == CRYPTO_REFCOUNT_MAX) {
      return 0;
    } else {
      const uint32_t new_value = expected - 1;
      if (CRYPTO_atomic_compare_exchange_weak_u32(count, &expected,
                                                  new_value)) {
        return new_value == 0;
      }
    }
  }
}
