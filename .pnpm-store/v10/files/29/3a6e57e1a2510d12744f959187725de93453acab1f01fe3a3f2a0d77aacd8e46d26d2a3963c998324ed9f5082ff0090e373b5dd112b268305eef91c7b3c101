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

#include <openssl/obj.h>

#include "../internal.h"


typedef struct {
  int sign_nid;
  int digest_nid;
  int pkey_nid;
} nid_triple;

static const nid_triple kTriples[] = {
    // RSA PKCS#1.
    {NID_md4WithRSAEncryption, NID_md4, NID_rsaEncryption},
    {NID_md5WithRSAEncryption, NID_md5, NID_rsaEncryption},
    {NID_sha1WithRSAEncryption, NID_sha1, NID_rsaEncryption},
    {NID_sha224WithRSAEncryption, NID_sha224, NID_rsaEncryption},
    {NID_sha256WithRSAEncryption, NID_sha256, NID_rsaEncryption},
    {NID_sha384WithRSAEncryption, NID_sha384, NID_rsaEncryption},
    {NID_sha512WithRSAEncryption, NID_sha512, NID_rsaEncryption},
    // DSA.
    {NID_dsaWithSHA1, NID_sha1, NID_dsa},
    {NID_dsaWithSHA1_2, NID_sha1, NID_dsa_2},
    {NID_dsa_with_SHA224, NID_sha224, NID_dsa},
    {NID_dsa_with_SHA256, NID_sha256, NID_dsa},
    // ECDSA.
    {NID_ecdsa_with_SHA1, NID_sha1, NID_X9_62_id_ecPublicKey},
    {NID_ecdsa_with_SHA224, NID_sha224, NID_X9_62_id_ecPublicKey},
    {NID_ecdsa_with_SHA256, NID_sha256, NID_X9_62_id_ecPublicKey},
    {NID_ecdsa_with_SHA384, NID_sha384, NID_X9_62_id_ecPublicKey},
    {NID_ecdsa_with_SHA512, NID_sha512, NID_X9_62_id_ecPublicKey},
    // The following algorithms use more complex (or simpler) parameters. The
    // digest "undef" indicates the caller should handle this explicitly.
    {NID_rsassaPss, NID_undef, NID_rsaEncryption},
    {NID_ED25519, NID_undef, NID_ED25519},
};

int OBJ_find_sigid_algs(int sign_nid, int *out_digest_nid, int *out_pkey_nid) {
  for (size_t i = 0; i < OPENSSL_ARRAY_SIZE(kTriples); i++) {
    if (kTriples[i].sign_nid == sign_nid) {
      if (out_digest_nid != NULL) {
        *out_digest_nid = kTriples[i].digest_nid;
      }
      if (out_pkey_nid != NULL) {
        *out_pkey_nid = kTriples[i].pkey_nid;
      }
      return 1;
    }
  }

  return 0;
}

int OBJ_find_sigid_by_algs(int *out_sign_nid, int digest_nid, int pkey_nid) {
  for (size_t i = 0; i < OPENSSL_ARRAY_SIZE(kTriples); i++) {
    if (kTriples[i].digest_nid == digest_nid &&
        kTriples[i].pkey_nid == pkey_nid) {
      if (out_sign_nid != NULL) {
        *out_sign_nid = kTriples[i].sign_nid;
      }
      return 1;
    }
  }

  return 0;
}
