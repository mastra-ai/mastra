/*
 * Written by Dr Stephen N Henson (steve@openssl.org) for the OpenSSL project
 * 2001.
 */
/* ====================================================================
 * Copyright (c) 2001 The OpenSSL Project.  All rights reserved.
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

#include <openssl/asn1.h>
#include <openssl/evp.h>
#include <openssl/obj.h>
#include <openssl/x509.h>

#include "../asn1/internal.h"
#include "../internal.h"
#include "internal.h"

int X509_CRL_set_version(X509_CRL *x, long version) {
  if (x == NULL) {
    return 0;
  }

  if (version < X509_CRL_VERSION_1 || version > X509_CRL_VERSION_2) {
    OPENSSL_PUT_ERROR(X509, X509_R_INVALID_VERSION);
    return 0;
  }

  // v1(0) is default and is represented by omitting the version.
  if (version == X509_CRL_VERSION_1) {
    ASN1_INTEGER_free(x->crl->version);
    x->crl->version = NULL;
    return 1;
  }

  if (x->crl->version == NULL) {
    x->crl->version = ASN1_INTEGER_new();
    if (x->crl->version == NULL) {
      return 0;
    }
  }
  return ASN1_INTEGER_set_int64(x->crl->version, version);
}

int X509_CRL_set_issuer_name(X509_CRL *x, X509_NAME *name) {
  if ((x == NULL) || (x->crl == NULL)) {
    return 0;
  }
  return (X509_NAME_set(&x->crl->issuer, name));
}

int X509_CRL_set1_lastUpdate(X509_CRL *x, const ASN1_TIME *tm) {
  ASN1_TIME *in;

  if (x == NULL) {
    return 0;
  }
  in = x->crl->lastUpdate;
  if (in != tm) {
    in = ASN1_STRING_dup(tm);
    if (in != NULL) {
      ASN1_TIME_free(x->crl->lastUpdate);
      x->crl->lastUpdate = in;
    }
  }
  return in != NULL;
}

int X509_CRL_set1_nextUpdate(X509_CRL *x, const ASN1_TIME *tm) {
  ASN1_TIME *in;

  if (x == NULL) {
    return 0;
  }
  in = x->crl->nextUpdate;
  if (in != tm) {
    in = ASN1_STRING_dup(tm);
    if (in != NULL) {
      ASN1_TIME_free(x->crl->nextUpdate);
      x->crl->nextUpdate = in;
    }
  }
  return in != NULL;
}

int X509_CRL_sort(X509_CRL *c) {
  // Sort the data so it will be written in serial number order.
  sk_X509_REVOKED_sort(c->crl->revoked);
  asn1_encoding_clear(&c->crl->enc);
  return 1;
}

int X509_CRL_up_ref(X509_CRL *crl) {
  CRYPTO_refcount_inc(&crl->references);
  return 1;
}

long X509_CRL_get_version(const X509_CRL *crl) {
  return ASN1_INTEGER_get(crl->crl->version);
}

const ASN1_TIME *X509_CRL_get0_lastUpdate(const X509_CRL *crl) {
  return crl->crl->lastUpdate;
}

const ASN1_TIME *X509_CRL_get0_nextUpdate(const X509_CRL *crl) {
  return crl->crl->nextUpdate;
}

ASN1_TIME *X509_CRL_get_lastUpdate(X509_CRL *crl) {
  return crl->crl->lastUpdate;
}

ASN1_TIME *X509_CRL_get_nextUpdate(X509_CRL *crl) {
  return crl->crl->nextUpdate;
}

X509_NAME *X509_CRL_get_issuer(const X509_CRL *crl) { return crl->crl->issuer; }

STACK_OF(X509_REVOKED) *X509_CRL_get_REVOKED(X509_CRL *crl) {
  return crl->crl->revoked;
}

const STACK_OF(X509_EXTENSION) *X509_CRL_get0_extensions(const X509_CRL *crl) {
  return crl->crl->extensions;
}

void X509_CRL_get0_signature(const X509_CRL *crl, const ASN1_BIT_STRING **psig,
                             const X509_ALGOR **palg) {
  if (psig != NULL) {
    *psig = crl->signature;
  }
  if (palg != NULL) {
    *palg = crl->sig_alg;
  }
}

int X509_CRL_get_signature_nid(const X509_CRL *crl) {
  return OBJ_obj2nid(crl->sig_alg->algorithm);
}

const ASN1_TIME *X509_REVOKED_get0_revocationDate(const X509_REVOKED *revoked) {
  return revoked->revocationDate;
}

int X509_REVOKED_set_revocationDate(X509_REVOKED *revoked,
                                    const ASN1_TIME *tm) {
  ASN1_TIME *in;

  if (revoked == NULL) {
    return 0;
  }
  in = revoked->revocationDate;
  if (in != tm) {
    in = ASN1_STRING_dup(tm);
    if (in != NULL) {
      ASN1_TIME_free(revoked->revocationDate);
      revoked->revocationDate = in;
    }
  }
  return in != NULL;
}

const ASN1_INTEGER *X509_REVOKED_get0_serialNumber(
    const X509_REVOKED *revoked) {
  return revoked->serialNumber;
}

int X509_REVOKED_set_serialNumber(X509_REVOKED *revoked,
                                  const ASN1_INTEGER *serial) {
  ASN1_INTEGER *in;

  if (serial->type != V_ASN1_INTEGER && serial->type != V_ASN1_NEG_INTEGER) {
    OPENSSL_PUT_ERROR(ASN1, ASN1_R_WRONG_TYPE);
    return 0;
  }

  if (revoked == NULL) {
    return 0;
  }
  in = revoked->serialNumber;
  if (in != serial) {
    in = ASN1_INTEGER_dup(serial);
    if (in != NULL) {
      ASN1_INTEGER_free(revoked->serialNumber);
      revoked->serialNumber = in;
    }
  }
  return in != NULL;
}

const STACK_OF(X509_EXTENSION) *X509_REVOKED_get0_extensions(
    const X509_REVOKED *r) {
  return r->extensions;
}

int i2d_re_X509_CRL_tbs(X509_CRL *crl, unsigned char **outp) {
  asn1_encoding_clear(&crl->crl->enc);
  return i2d_X509_CRL_INFO(crl->crl, outp);
}

int i2d_X509_CRL_tbs(X509_CRL *crl, unsigned char **outp) {
  return i2d_X509_CRL_INFO(crl->crl, outp);
}

int X509_CRL_set1_signature_algo(X509_CRL *crl, const X509_ALGOR *algo) {
  X509_ALGOR *copy1 = X509_ALGOR_dup(algo);
  X509_ALGOR *copy2 = X509_ALGOR_dup(algo);
  if (copy1 == NULL || copy2 == NULL) {
    X509_ALGOR_free(copy1);
    X509_ALGOR_free(copy2);
    return 0;
  }

  X509_ALGOR_free(crl->sig_alg);
  crl->sig_alg = copy1;
  X509_ALGOR_free(crl->crl->sig_alg);
  crl->crl->sig_alg = copy2;
  return 1;
}

int X509_CRL_set1_signature_value(X509_CRL *crl, const uint8_t *sig,
                                  size_t sig_len) {
  if (!ASN1_STRING_set(crl->signature, sig, sig_len)) {
    return 0;
  }
  crl->signature->flags &= ~(ASN1_STRING_FLAG_BITS_LEFT | 0x07);
  crl->signature->flags |= ASN1_STRING_FLAG_BITS_LEFT;
  return 1;
}
