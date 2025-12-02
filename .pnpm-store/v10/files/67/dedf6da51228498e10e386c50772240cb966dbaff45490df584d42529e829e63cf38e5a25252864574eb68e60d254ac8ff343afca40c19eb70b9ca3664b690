/* Copyright (c) 2022, Google Inc.
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

#include <stdlib.h>
#include <string.h>

#include <openssl/bytestring.h>
#include <openssl/ecdsa.h>
#include <openssl/mem.h>


extern "C" int LLVMFuzzerTestOneInput(const uint8_t *buf, size_t len) {
  CBS cbs, body;
  CBS_ASN1_TAG tag;
  CBS_init(&cbs, buf, len);
  if (CBS_get_any_asn1(&cbs, &body, &tag)) {
    // DER has a unique encoding, so any parsed input should round-trip
    // correctly.
    size_t consumed = len - CBS_len(&cbs);
    bssl::ScopedCBB cbb;
    CBB body_cbb;
    if (!CBB_init(cbb.get(), consumed) ||
        !CBB_add_asn1(cbb.get(), &body_cbb, tag) ||
        !CBB_add_bytes(&body_cbb, CBS_data(&body), CBS_len(&body)) ||
        !CBB_flush(cbb.get()) ||
        CBB_len(cbb.get()) != consumed ||
        memcmp(CBB_data(cbb.get()), buf, consumed) != 0) {
      abort();
    }
  }

  ECDSA_SIG *sig = ECDSA_SIG_from_bytes(buf, len);
  if (sig != NULL) {
    uint8_t *enc;
    size_t enc_len;
    if (!ECDSA_SIG_to_bytes(&enc, &enc_len, sig) ||
        enc_len != len ||
        memcmp(buf, enc, len) != 0) {
      abort();
    }
    OPENSSL_free(enc);
    ECDSA_SIG_free(sig);
  }

  return 0;
}
