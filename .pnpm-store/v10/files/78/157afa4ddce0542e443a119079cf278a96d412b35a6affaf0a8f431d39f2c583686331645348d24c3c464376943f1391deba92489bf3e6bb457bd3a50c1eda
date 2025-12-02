/* Copyright (c) 2017, Google Inc.
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

#include <openssl/bn.h>
#include <openssl/bytestring.h>
#include <openssl/span.h>

#define CHECK(expr)                 \
  do {                              \
    if (!(expr)) {                  \
      printf("%s failed\n", #expr); \
      abort();                      \
    }                               \
  } while (false)

extern "C" int LLVMFuzzerTestOneInput(const uint8_t *buf, size_t len) {
  CBS cbs, child0, child1;
  uint8_t sign0, sign1;
  CBS_init(&cbs, buf, len);
  if (!CBS_get_u16_length_prefixed(&cbs, &child0) ||
      !CBS_get_u8(&child0, &sign0) ||
      CBS_len(&child0) == 0 ||
      !CBS_get_u16_length_prefixed(&cbs, &child1) ||
      !CBS_get_u8(&child1, &sign1) ||
      CBS_len(&child1) == 0) {
    return 0;
  }

  bssl::UniquePtr<BIGNUM> numerator(
      BN_bin2bn(CBS_data(&child0), CBS_len(&child0), nullptr));
  BN_set_negative(numerator.get(), sign0 % 2);
  bssl::UniquePtr<BIGNUM> divisor(
      BN_bin2bn(CBS_data(&child1), CBS_len(&child1), nullptr));
  BN_set_negative(divisor.get(), sign1 % 2);

  if (BN_is_zero(divisor.get())) {
    return 0;
  }

  bssl::UniquePtr<BN_CTX> ctx(BN_CTX_new());
  bssl::UniquePtr<BIGNUM> result(BN_new());
  bssl::UniquePtr<BIGNUM> remainder(BN_new());
  CHECK(ctx);
  CHECK(result);
  CHECK(remainder);


  CHECK(BN_div(result.get(), remainder.get(), numerator.get(), divisor.get(),
               ctx.get()));
  CHECK(BN_ucmp(remainder.get(), divisor.get()) < 0);

  // Check that result*divisor+remainder = numerator.
  CHECK(BN_mul(result.get(), result.get(), divisor.get(), ctx.get()));
  CHECK(BN_add(result.get(), result.get(), remainder.get()));
  CHECK(BN_cmp(result.get(), numerator.get()) == 0);

  return 0;
}
