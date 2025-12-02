/* ====================================================================
 * Copyright (c) 2006 The OpenSSL Project.  All rights reserved.
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
 *    for use in the OpenSSL Toolkit. (http://www.OpenSSL.org/)"
 *
 * 4. The names "OpenSSL Toolkit" and "OpenSSL Project" must not be used to
 *    endorse or promote products derived from this software without
 *    prior written permission. For written permission, please contact
 *    licensing@OpenSSL.org.
 *
 * 5. Products derived from this software may not be called "OpenSSL"
 *    nor may "OpenSSL" appear in their names without prior written
 *    permission of the OpenSSL Project.
 *
 * 6. Redistributions of any form whatsoever must retain the following
 *    acknowledgment:
 *    "This product includes software developed by the OpenSSL Project
 *    for use in the OpenSSL Toolkit (http://www.OpenSSL.org/)"
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
 * Hudson (tjh@cryptsoft.com). */

#include <openssl/evp.h>

#include <openssl/bio.h>
#include <openssl/bn.h>
#include <openssl/dsa.h>
#include <openssl/ec.h>
#include <openssl/ec_key.h>
#include <openssl/mem.h>
#include <openssl/rsa.h>

#include "../internal.h"
#include "../fipsmodule/rsa/internal.h"


static int print_hex(BIO *bp, const uint8_t *data, size_t len, int off) {
  for (size_t i = 0; i < len; i++) {
    if ((i % 15) == 0) {
      if (BIO_puts(bp, "\n") <= 0 ||  //
          !BIO_indent(bp, off + 4, 128)) {
        return 0;
      }
    }
    if (BIO_printf(bp, "%02x%s", data[i], (i + 1 == len) ? "" : ":") <= 0) {
      return 0;
    }
  }
  if (BIO_write(bp, "\n", 1) <= 0) {
    return 0;
  }
  return 1;
}

static int bn_print(BIO *bp, const char *name, const BIGNUM *num, int off) {
  if (num == NULL) {
    return 1;
  }

  if (!BIO_indent(bp, off, 128)) {
    return 0;
  }
  if (BN_is_zero(num)) {
    if (BIO_printf(bp, "%s 0\n", name) <= 0) {
      return 0;
    }
    return 1;
  }

  uint64_t u64;
  if (BN_get_u64(num, &u64)) {
    const char *neg = BN_is_negative(num) ? "-" : "";
    return BIO_printf(bp, "%s %s%" PRIu64 " (%s0x%" PRIx64 ")\n", name, neg,
                      u64, neg, u64) > 0;
  }

  if (BIO_printf(bp, "%s%s", name,
                  (BN_is_negative(num)) ? " (Negative)" : "") <= 0) {
    return 0;
  }

  // Print |num| in hex, adding a leading zero, as in ASN.1, if the high bit
  // is set.
  //
  // TODO(davidben): Do we need to do this? We already print "(Negative)" above
  // and negative values are never valid in keys anyway.
  size_t len = BN_num_bytes(num);
  uint8_t *buf = OPENSSL_malloc(len + 1);
  if (buf == NULL) {
    return 0;
  }

  buf[0] = 0;
  BN_bn2bin(num, buf + 1);
  int ret;
  if (len > 0 && (buf[1] & 0x80) != 0) {
    // Print the whole buffer.
    ret = print_hex(bp, buf, len + 1, off);
  } else {
    // Skip the leading zero.
    ret = print_hex(bp, buf + 1, len, off);
  }
  OPENSSL_free(buf);
  return ret;
}

// RSA keys.

static int do_rsa_print(BIO *out, const RSA *rsa, int off,
                        int include_private) {
  int mod_len = 0;
  if (rsa->n != NULL) {
    mod_len = BN_num_bits(rsa->n);
  }

  if (!BIO_indent(out, off, 128)) {
    return 0;
  }

  const char *s, *str;
  if (include_private && rsa->d) {
    if (BIO_printf(out, "Private-Key: (%d bit)\n", mod_len) <= 0) {
      return 0;
    }
    str = "modulus:";
    s = "publicExponent:";
  } else {
    if (BIO_printf(out, "Public-Key: (%d bit)\n", mod_len) <= 0) {
      return 0;
    }
    str = "Modulus:";
    s = "Exponent:";
  }
  if (!bn_print(out, str, rsa->n, off) ||
      !bn_print(out, s, rsa->e, off)) {
    return 0;
  }

  if (include_private) {
    if (!bn_print(out, "privateExponent:", rsa->d, off) ||
        !bn_print(out, "prime1:", rsa->p, off) ||
        !bn_print(out, "prime2:", rsa->q, off) ||
        !bn_print(out, "exponent1:", rsa->dmp1, off) ||
        !bn_print(out, "exponent2:", rsa->dmq1, off) ||
        !bn_print(out, "coefficient:", rsa->iqmp, off)) {
      return 0;
    }
  }

  return 1;
}

static int rsa_pub_print(BIO *bp, const EVP_PKEY *pkey, int indent) {
  return do_rsa_print(bp, EVP_PKEY_get0_RSA(pkey), indent, 0);
}

static int rsa_priv_print(BIO *bp, const EVP_PKEY *pkey, int indent) {
  return do_rsa_print(bp, EVP_PKEY_get0_RSA(pkey), indent, 1);
}


// DSA keys.

static int do_dsa_print(BIO *bp, const DSA *x, int off, int ptype) {
  const BIGNUM *priv_key = NULL;
  if (ptype == 2) {
    priv_key = DSA_get0_priv_key(x);
  }

  const BIGNUM *pub_key = NULL;
  if (ptype > 0) {
    pub_key = DSA_get0_pub_key(x);
  }

  const char *ktype = "DSA-Parameters";
  if (ptype == 2) {
    ktype = "Private-Key";
  } else if (ptype == 1) {
    ktype = "Public-Key";
  }

  if (!BIO_indent(bp, off, 128) ||
      BIO_printf(bp, "%s: (%u bit)\n", ktype, BN_num_bits(DSA_get0_p(x))) <=
          0 ||
      // |priv_key| and |pub_key| may be NULL, in which case |bn_print| will
      // silently skip them.
      !bn_print(bp, "priv:", priv_key, off) ||
      !bn_print(bp, "pub:", pub_key, off) ||
      !bn_print(bp, "P:", DSA_get0_p(x), off) ||
      !bn_print(bp, "Q:", DSA_get0_q(x), off) ||
      !bn_print(bp, "G:", DSA_get0_g(x), off)) {
    return 0;
  }

  return 1;
}

static int dsa_param_print(BIO *bp, const EVP_PKEY *pkey, int indent) {
  return do_dsa_print(bp, EVP_PKEY_get0_DSA(pkey), indent, 0);
}

static int dsa_pub_print(BIO *bp, const EVP_PKEY *pkey, int indent) {
  return do_dsa_print(bp, EVP_PKEY_get0_DSA(pkey), indent, 1);
}

static int dsa_priv_print(BIO *bp, const EVP_PKEY *pkey, int indent) {
  return do_dsa_print(bp, EVP_PKEY_get0_DSA(pkey), indent, 2);
}


// EC keys.

static int do_EC_KEY_print(BIO *bp, const EC_KEY *x, int off, int ktype) {
  const EC_GROUP *group;
  if (x == NULL || (group = EC_KEY_get0_group(x)) == NULL) {
    OPENSSL_PUT_ERROR(EVP, ERR_R_PASSED_NULL_PARAMETER);
    return 0;
  }

  const char *ecstr;
  if (ktype == 2) {
    ecstr = "Private-Key";
  } else if (ktype == 1) {
    ecstr = "Public-Key";
  } else {
    ecstr = "ECDSA-Parameters";
  }

  if (!BIO_indent(bp, off, 128)) {
    return 0;
  }
  int curve_name = EC_GROUP_get_curve_name(group);
  if (BIO_printf(bp, "%s: (%s)\n", ecstr,
                 curve_name == NID_undef
                     ? "unknown curve"
                     : EC_curve_nid2nist(curve_name)) <= 0) {
    return 0;
  }

  if (ktype == 2) {
    const BIGNUM *priv_key = EC_KEY_get0_private_key(x);
    if (priv_key != NULL &&  //
        !bn_print(bp, "priv:", priv_key, off)) {
      return 0;
    }
  }

  if (ktype > 0 && EC_KEY_get0_public_key(x) != NULL) {
    uint8_t *pub = NULL;
    size_t pub_len = EC_KEY_key2buf(x, EC_KEY_get_conv_form(x), &pub, NULL);
    if (pub_len == 0) {
      return 0;
    }
    int ret = BIO_indent(bp, off, 128) &&  //
              BIO_puts(bp, "pub:") > 0 &&  //
              print_hex(bp, pub, pub_len, off);
    OPENSSL_free(pub);
    if (!ret) {
      return 0;
    }
  }

  return 1;
}

static int eckey_param_print(BIO *bp, const EVP_PKEY *pkey, int indent) {
  return do_EC_KEY_print(bp, EVP_PKEY_get0_EC_KEY(pkey), indent, 0);
}

static int eckey_pub_print(BIO *bp, const EVP_PKEY *pkey, int indent) {
  return do_EC_KEY_print(bp, EVP_PKEY_get0_EC_KEY(pkey), indent, 1);
}


static int eckey_priv_print(BIO *bp, const EVP_PKEY *pkey, int indent) {
  return do_EC_KEY_print(bp, EVP_PKEY_get0_EC_KEY(pkey), indent, 2);
}


typedef struct {
  int type;
  int (*pub_print)(BIO *out, const EVP_PKEY *pkey, int indent);
  int (*priv_print)(BIO *out, const EVP_PKEY *pkey, int indent);
  int (*param_print)(BIO *out, const EVP_PKEY *pkey, int indent);
} EVP_PKEY_PRINT_METHOD;

static EVP_PKEY_PRINT_METHOD kPrintMethods[] = {
    {
        EVP_PKEY_RSA,
        rsa_pub_print,
        rsa_priv_print,
        NULL /* param_print */,
    },
    {
        EVP_PKEY_DSA,
        dsa_pub_print,
        dsa_priv_print,
        dsa_param_print,
    },
    {
        EVP_PKEY_EC,
        eckey_pub_print,
        eckey_priv_print,
        eckey_param_print,
    },
};

static size_t kPrintMethodsLen = OPENSSL_ARRAY_SIZE(kPrintMethods);

static EVP_PKEY_PRINT_METHOD *find_method(int type) {
  for (size_t i = 0; i < kPrintMethodsLen; i++) {
    if (kPrintMethods[i].type == type) {
      return &kPrintMethods[i];
    }
  }
  return NULL;
}

static int print_unsupported(BIO *out, const EVP_PKEY *pkey, int indent,
                             const char *kstr) {
  BIO_indent(out, indent, 128);
  BIO_printf(out, "%s algorithm unsupported\n", kstr);
  return 1;
}

int EVP_PKEY_print_public(BIO *out, const EVP_PKEY *pkey, int indent,
                          ASN1_PCTX *pctx) {
  EVP_PKEY_PRINT_METHOD *method = find_method(EVP_PKEY_id(pkey));
  if (method != NULL && method->pub_print != NULL) {
    return method->pub_print(out, pkey, indent);
  }
  return print_unsupported(out, pkey, indent, "Public Key");
}

int EVP_PKEY_print_private(BIO *out, const EVP_PKEY *pkey, int indent,
                           ASN1_PCTX *pctx) {
  EVP_PKEY_PRINT_METHOD *method = find_method(EVP_PKEY_id(pkey));
  if (method != NULL && method->priv_print != NULL) {
    return method->priv_print(out, pkey, indent);
  }
  return print_unsupported(out, pkey, indent, "Private Key");
}

int EVP_PKEY_print_params(BIO *out, const EVP_PKEY *pkey, int indent,
                          ASN1_PCTX *pctx) {
  EVP_PKEY_PRINT_METHOD *method = find_method(EVP_PKEY_id(pkey));
  if (method != NULL && method->param_print != NULL) {
    return method->param_print(out, pkey, indent);
  }
  return print_unsupported(out, pkey, indent, "Parameters");
}
