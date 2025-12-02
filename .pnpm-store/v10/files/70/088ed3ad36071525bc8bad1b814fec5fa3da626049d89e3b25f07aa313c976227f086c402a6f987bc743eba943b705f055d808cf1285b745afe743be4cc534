/* DTLS implementation written by Nagendra Modadugu
 * (nagendra@cs.stanford.edu) for the OpenSSL project 2005. */
/* ====================================================================
 * Copyright (c) 1998-2005 The OpenSSL Project.  All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in
 *    the documentation and/or other materials provided with the
 *    distribution.
 *
 * 3. All advertising materials mentioning features or use of this
 *    software must display the following acknowledgment:
 *    "This product includes software developed by the OpenSSL Project
 *    for use in the OpenSSL Toolkit. (http://www.openssl.org/)"
 *
 * 4. The names "OpenSSL Toolkit" and "OpenSSL Project" must not be used to
 *    endorse or promote products derived from this software without
 *    prior written permission. For written permission, please contact
 *    openssl-core@openssl.org.
 *
 * 5. Products derived from this software may not be called "OpenSSL"
 *    nor may "OpenSSL" appear in their names without prior written
 *    permission of the OpenSSL Project.
 *
 * 6. Redistributions of any form whatsoever must retain the following
 *    acknowledgment:
 *    "This product includes software developed by the OpenSSL Project
 *    for use in the OpenSSL Toolkit (http://www.openssl.org/)"
 *
 * THIS SOFTWARE IS PROVIDED BY THE OpenSSL PROJECT ``AS IS'' AND ANY
 * EXPRESSED OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE OpenSSL PROJECT OR
 * ITS CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 * NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
 * STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
 * OF THE POSSIBILITY OF SUCH DAMAGE.
 * ====================================================================
 *
 * This product includes cryptographic software written by Eric Young
 * (eay@cryptsoft.com).  This product includes software written by Tim
 * Hudson (tjh@cryptsoft.com).
 *
 */
/* Copyright (C) 1995-1998 Eric Young (eay@cryptsoft.com)
 * All rights reserved.
 *
 * This package is an SSL implementation written
 * by Eric Young (eay@cryptsoft.com).
 * The implementation was written so as to conform with Netscapes SSL.
 *
 * This library is free for commercial and non-commercial use as long as
 * the following conditions are aheared to.  The following conditions
 * apply to all code found in this distribution, be it the RC4, RSA,
 * lhash, DES, etc., code; not just the SSL code.  The SSL documentation
 * included with this distribution is covered by the same copyright terms
 * except that the holder is Tim Hudson (tjh@cryptsoft.com).
 *
 * Copyright remains Eric Young's, and as such any Copyright notices in
 * the code are not to be removed.
 * If this package is used in a product, Eric Young should be given attribution
 * as the author of the parts of the library used.
 * This can be in the form of a textual message at program startup or
 * in documentation (online or textual) provided with the package.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. All advertising materials mentioning features or use of this software
 *    must display the following acknowledgement:
 *    "This product includes cryptographic software written by
 *     Eric Young (eay@cryptsoft.com)"
 *    The word 'cryptographic' can be left out if the rouines from the library
 *    being used are not cryptographic related :-).
 * 4. If you include any Windows specific code (or a derivative thereof) from
 *    the apps directory (application code) you must include an acknowledgement:
 *    "This product includes software written by Tim Hudson (tjh@cryptsoft.com)"
 *
 * THIS SOFTWARE IS PROVIDED BY ERIC YOUNG ``AS IS'' AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
 * OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
 * OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
 * SUCH DAMAGE.
 *
 * The licence and distribution terms for any publically available version or
 * derivative of this code cannot be changed.  i.e. this code cannot simply be
 * copied and put under another distribution licence
 * [including the GNU Public Licence.] */

#include <openssl/ssl.h>

#include <assert.h>
#include <string.h>

#include <openssl/bytestring.h>
#include <openssl/err.h>

#include "internal.h"
#include "../crypto/internal.h"


BSSL_NAMESPACE_BEGIN

// dtls1_bitmap_should_discard returns one if |seq_num| has been seen in
// |bitmap| or is stale. Otherwise it returns zero.
static bool dtls1_bitmap_should_discard(DTLS1_BITMAP *bitmap,
                                        uint64_t seq_num) {
  const unsigned kWindowSize = sizeof(bitmap->map) * 8;

  if (seq_num > bitmap->max_seq_num) {
    return false;
  }
  uint64_t idx = bitmap->max_seq_num - seq_num;
  return idx >= kWindowSize || (bitmap->map & (((uint64_t)1) << idx));
}

// dtls1_bitmap_record updates |bitmap| to record receipt of sequence number
// |seq_num|. It slides the window forward if needed. It is an error to call
// this function on a stale sequence number.
static void dtls1_bitmap_record(DTLS1_BITMAP *bitmap, uint64_t seq_num) {
  const unsigned kWindowSize = sizeof(bitmap->map) * 8;

  // Shift the window if necessary.
  if (seq_num > bitmap->max_seq_num) {
    uint64_t shift = seq_num - bitmap->max_seq_num;
    if (shift >= kWindowSize) {
      bitmap->map = 0;
    } else {
      bitmap->map <<= shift;
    }
    bitmap->max_seq_num = seq_num;
  }

  uint64_t idx = bitmap->max_seq_num - seq_num;
  if (idx < kWindowSize) {
    bitmap->map |= ((uint64_t)1) << idx;
  }
}

enum ssl_open_record_t dtls_open_record(SSL *ssl, uint8_t *out_type,
                                        Span<uint8_t> *out,
                                        size_t *out_consumed,
                                        uint8_t *out_alert, Span<uint8_t> in) {
  *out_consumed = 0;
  if (ssl->s3->read_shutdown == ssl_shutdown_close_notify) {
    return ssl_open_record_close_notify;
  }

  if (in.empty()) {
    return ssl_open_record_partial;
  }

  CBS cbs = CBS(in);

  // Decode the record.
  uint8_t type;
  uint16_t version;
  uint8_t sequence_bytes[8];
  CBS body;
  if (!CBS_get_u8(&cbs, &type) ||
      !CBS_get_u16(&cbs, &version) ||
      !CBS_copy_bytes(&cbs, sequence_bytes, sizeof(sequence_bytes)) ||
      !CBS_get_u16_length_prefixed(&cbs, &body) ||
      CBS_len(&body) > SSL3_RT_MAX_ENCRYPTED_LENGTH) {
    // The record header was incomplete or malformed. Drop the entire packet.
    *out_consumed = in.size();
    return ssl_open_record_discard;
  }

  bool version_ok;
  if (ssl->s3->aead_read_ctx->is_null_cipher()) {
    // Only check the first byte. Enforcing beyond that can prevent decoding
    // version negotiation failure alerts.
    version_ok = (version >> 8) == DTLS1_VERSION_MAJOR;
  } else {
    version_ok = version == ssl->s3->aead_read_ctx->RecordVersion();
  }

  if (!version_ok) {
    // The record header was incomplete or malformed. Drop the entire packet.
    *out_consumed = in.size();
    return ssl_open_record_discard;
  }

  Span<const uint8_t> header = in.subspan(0, DTLS1_RT_HEADER_LENGTH);
  ssl_do_msg_callback(ssl, 0 /* read */, SSL3_RT_HEADER, header);

  uint64_t sequence = CRYPTO_load_u64_be(sequence_bytes);
  uint16_t epoch = static_cast<uint16_t>(sequence >> 48);
  if (epoch != ssl->d1->r_epoch ||
      dtls1_bitmap_should_discard(&ssl->d1->bitmap, sequence)) {
    // Drop this record. It's from the wrong epoch or is a replay. Note that if
    // |epoch| is the next epoch, the record could be buffered for later. For
    // simplicity, drop it and expect retransmit to handle it later; DTLS must
    // handle packet loss anyway.
    *out_consumed = in.size() - CBS_len(&cbs);
    return ssl_open_record_discard;
  }

  // discard the body in-place.
  if (!ssl->s3->aead_read_ctx->Open(
          out, type, version, sequence, header,
          MakeSpan(const_cast<uint8_t *>(CBS_data(&body)), CBS_len(&body)))) {
    // Bad packets are silently dropped in DTLS. See section 4.2.1 of RFC 6347.
    // Clear the error queue of any errors decryption may have added. Drop the
    // entire packet as it must not have come from the peer.
    //
    // TODO(davidben): This doesn't distinguish malloc failures from encryption
    // failures.
    ERR_clear_error();
    *out_consumed = in.size() - CBS_len(&cbs);
    return ssl_open_record_discard;
  }
  *out_consumed = in.size() - CBS_len(&cbs);

  // Check the plaintext length.
  if (out->size() > SSL3_RT_MAX_PLAIN_LENGTH) {
    OPENSSL_PUT_ERROR(SSL, SSL_R_DATA_LENGTH_TOO_LONG);
    *out_alert = SSL_AD_RECORD_OVERFLOW;
    return ssl_open_record_error;
  }

  dtls1_bitmap_record(&ssl->d1->bitmap, sequence);

  // TODO(davidben): Limit the number of empty records as in TLS? This is only
  // useful if we also limit discarded packets.

  if (type == SSL3_RT_ALERT) {
    return ssl_process_alert(ssl, out_alert, *out);
  }

  ssl->s3->warning_alert_count = 0;

  *out_type = type;
  return ssl_open_record_success;
}

static const SSLAEADContext *get_write_aead(const SSL *ssl,
                                            enum dtls1_use_epoch_t use_epoch) {
  if (use_epoch == dtls1_use_previous_epoch) {
    assert(ssl->d1->w_epoch >= 1);
    return ssl->d1->last_aead_write_ctx.get();
  }

  return ssl->s3->aead_write_ctx.get();
}

size_t dtls_max_seal_overhead(const SSL *ssl,
                              enum dtls1_use_epoch_t use_epoch) {
  return DTLS1_RT_HEADER_LENGTH + get_write_aead(ssl, use_epoch)->MaxOverhead();
}

size_t dtls_seal_prefix_len(const SSL *ssl, enum dtls1_use_epoch_t use_epoch) {
  return DTLS1_RT_HEADER_LENGTH +
         get_write_aead(ssl, use_epoch)->ExplicitNonceLen();
}

bool dtls_seal_record(SSL *ssl, uint8_t *out, size_t *out_len, size_t max_out,
                      uint8_t type, const uint8_t *in, size_t in_len,
                      enum dtls1_use_epoch_t use_epoch) {
  const size_t prefix = dtls_seal_prefix_len(ssl, use_epoch);
  if (buffers_alias(in, in_len, out, max_out) &&
      (max_out < prefix || out + prefix != in)) {
    OPENSSL_PUT_ERROR(SSL, SSL_R_OUTPUT_ALIASES_INPUT);
    return false;
  }

  // Determine the parameters for the current epoch.
  uint16_t epoch = ssl->d1->w_epoch;
  SSLAEADContext *aead = ssl->s3->aead_write_ctx.get();
  uint64_t *seq = &ssl->s3->write_sequence;
  if (use_epoch == dtls1_use_previous_epoch) {
    assert(ssl->d1->w_epoch >= 1);
    epoch = ssl->d1->w_epoch - 1;
    aead = ssl->d1->last_aead_write_ctx.get();
    seq = &ssl->d1->last_write_sequence;
  }

  if (max_out < DTLS1_RT_HEADER_LENGTH) {
    OPENSSL_PUT_ERROR(SSL, SSL_R_BUFFER_TOO_SMALL);
    return false;
  }

  out[0] = type;

  uint16_t record_version = ssl->s3->aead_write_ctx->RecordVersion();
  out[1] = record_version >> 8;
  out[2] = record_version & 0xff;

  // Ensure the sequence number update does not overflow.
  const uint64_t kMaxSequenceNumber = (uint64_t{1} << 48) - 1;
  if (*seq + 1 > kMaxSequenceNumber) {
    OPENSSL_PUT_ERROR(SSL, ERR_R_OVERFLOW);
    return false;
  }

  uint64_t seq_with_epoch = (uint64_t{epoch} << 48) | *seq;
  CRYPTO_store_u64_be(&out[3], seq_with_epoch);

  size_t ciphertext_len;
  if (!aead->CiphertextLen(&ciphertext_len, in_len, 0)) {
    OPENSSL_PUT_ERROR(SSL, SSL_R_RECORD_TOO_LARGE);
    return false;
  }
  out[11] = ciphertext_len >> 8;
  out[12] = ciphertext_len & 0xff;
  Span<const uint8_t> header = MakeConstSpan(out, DTLS1_RT_HEADER_LENGTH);

  size_t len_copy;
  if (!aead->Seal(out + DTLS1_RT_HEADER_LENGTH, &len_copy,
                  max_out - DTLS1_RT_HEADER_LENGTH, type, record_version,
                  seq_with_epoch, header, in, in_len)) {
    return false;
  }
  assert(ciphertext_len == len_copy);

  (*seq)++;
  *out_len = DTLS1_RT_HEADER_LENGTH + ciphertext_len;
  ssl_do_msg_callback(ssl, 1 /* write */, SSL3_RT_HEADER, header);
  return true;
}

BSSL_NAMESPACE_END
