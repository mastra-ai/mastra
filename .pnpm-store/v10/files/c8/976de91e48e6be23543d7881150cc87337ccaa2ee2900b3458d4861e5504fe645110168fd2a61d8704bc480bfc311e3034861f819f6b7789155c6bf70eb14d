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

#include <openssl/cipher.h>

#include <assert.h>
#include <string.h>

#include <openssl/err.h>
#include <openssl/mem.h>
#include <openssl/nid.h>

#include "internal.h"
#include "../internal.h"


static const struct {
  int nid;
  const char *name;
  const EVP_CIPHER *(*func)(void);
} kCiphers[] = {
    {NID_aes_128_cbc, "aes-128-cbc", EVP_aes_128_cbc},
    {NID_aes_128_ctr, "aes-128-ctr", EVP_aes_128_ctr},
    {NID_aes_128_ecb, "aes-128-ecb", EVP_aes_128_ecb},
    {NID_aes_128_gcm, "aes-128-gcm", EVP_aes_128_gcm},
    {NID_aes_128_ofb128, "aes-128-ofb", EVP_aes_128_ofb},
    {NID_aes_192_cbc, "aes-192-cbc", EVP_aes_192_cbc},
    {NID_aes_192_ctr, "aes-192-ctr", EVP_aes_192_ctr},
    {NID_aes_192_ecb, "aes-192-ecb", EVP_aes_192_ecb},
    {NID_aes_192_gcm, "aes-192-gcm", EVP_aes_192_gcm},
    {NID_aes_192_ofb128, "aes-192-ofb", EVP_aes_192_ofb},
    {NID_aes_256_cbc, "aes-256-cbc", EVP_aes_256_cbc},
    {NID_aes_256_ctr, "aes-256-ctr", EVP_aes_256_ctr},
    {NID_aes_256_ecb, "aes-256-ecb", EVP_aes_256_ecb},
    {NID_aes_256_gcm, "aes-256-gcm", EVP_aes_256_gcm},
    {NID_aes_256_ofb128, "aes-256-ofb", EVP_aes_256_ofb},
    {NID_des_cbc, "des-cbc", EVP_des_cbc},
    {NID_des_ecb, "des-ecb", EVP_des_ecb},
    {NID_des_ede_cbc, "des-ede-cbc", EVP_des_ede_cbc},
    {NID_des_ede_ecb, "des-ede", EVP_des_ede},
    {NID_des_ede3_cbc, "des-ede3-cbc", EVP_des_ede3_cbc},
    {NID_rc2_cbc, "rc2-cbc", EVP_rc2_cbc},
    {NID_rc4, "rc4", EVP_rc4},
};

const EVP_CIPHER *EVP_get_cipherbynid(int nid) {
  for (size_t i = 0; i < OPENSSL_ARRAY_SIZE(kCiphers); i++) {
    if (kCiphers[i].nid == nid) {
      return kCiphers[i].func();
    }
  }
  return NULL;
}

const EVP_CIPHER *EVP_get_cipherbyname(const char *name) {
  if (name == NULL) {
    return NULL;
  }

  // This is not a name used by OpenSSL, but tcpdump registers it with
  // |EVP_add_cipher_alias|. Our |EVP_add_cipher_alias| is a no-op, so we
  // support the name here.
  if (OPENSSL_strcasecmp(name, "3des") == 0) {
    name = "des-ede3-cbc";
  }

  for (size_t i = 0; i < OPENSSL_ARRAY_SIZE(kCiphers); i++) {
    if (OPENSSL_strcasecmp(kCiphers[i].name, name) == 0) {
      return kCiphers[i].func();
    }
  }

  return NULL;
}
