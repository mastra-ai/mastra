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

#include <openssl/asn1.h>
#include <openssl/cipher.h>
#include <openssl/evp.h>
#include <openssl/obj.h>
#include <openssl/x509.h>

#include "internal.h"


long X509_get_version(const X509 *x509) {
  // The default version is v1(0).
  if (x509->cert_info->version == NULL) {
    return X509_VERSION_1;
  }
  return ASN1_INTEGER_get(x509->cert_info->version);
}

int X509_set_version(X509 *x, long version) {
  if (x == NULL) {
    return 0;
  }

  if (version < X509_VERSION_1 || version > X509_VERSION_3) {
    OPENSSL_PUT_ERROR(X509, X509_R_INVALID_VERSION);
    return 0;
  }

  // v1(0) is default and is represented by omitting the version.
  if (version == X509_VERSION_1) {
    ASN1_INTEGER_free(x->cert_info->version);
    x->cert_info->version = NULL;
    return 1;
  }

  if (x->cert_info->version == NULL) {
    x->cert_info->version = ASN1_INTEGER_new();
    if (x->cert_info->version == NULL) {
      return 0;
    }
  }
  return ASN1_INTEGER_set_int64(x->cert_info->version, version);
}

int X509_set_serialNumber(X509 *x, const ASN1_INTEGER *serial) {
  if (serial->type != V_ASN1_INTEGER && serial->type != V_ASN1_NEG_INTEGER) {
    OPENSSL_PUT_ERROR(ASN1, ASN1_R_WRONG_TYPE);
    return 0;
  }

  ASN1_INTEGER *in;
  if (x == NULL) {
    return 0;
  }
  in = x->cert_info->serialNumber;
  if (in != serial) {
    in = ASN1_INTEGER_dup(serial);
    if (in != NULL) {
      ASN1_INTEGER_free(x->cert_info->serialNumber);
      x->cert_info->serialNumber = in;
    }
  }
  return in != NULL;
}

int X509_set_issuer_name(X509 *x, X509_NAME *name) {
  if ((x == NULL) || (x->cert_info == NULL)) {
    return 0;
  }
  return (X509_NAME_set(&x->cert_info->issuer, name));
}

int X509_set_subject_name(X509 *x, X509_NAME *name) {
  if ((x == NULL) || (x->cert_info == NULL)) {
    return 0;
  }
  return (X509_NAME_set(&x->cert_info->subject, name));
}

int X509_set1_notBefore(X509 *x, const ASN1_TIME *tm) {
  ASN1_TIME *in;

  if ((x == NULL) || (x->cert_info->validity == NULL)) {
    return 0;
  }
  in = x->cert_info->validity->notBefore;
  if (in != tm) {
    in = ASN1_STRING_dup(tm);
    if (in != NULL) {
      ASN1_TIME_free(x->cert_info->validity->notBefore);
      x->cert_info->validity->notBefore = in;
    }
  }
  return in != NULL;
}

int X509_set_notBefore(X509 *x, const ASN1_TIME *tm) {
  return X509_set1_notBefore(x, tm);
}

const ASN1_TIME *X509_get0_notBefore(const X509 *x) {
  return x->cert_info->validity->notBefore;
}

ASN1_TIME *X509_getm_notBefore(X509 *x) {
  // Note this function takes a const |X509| pointer in OpenSSL. We require
  // non-const as this allows mutating |x|. If it comes up for compatibility,
  // we can relax this.
  return x->cert_info->validity->notBefore;
}

ASN1_TIME *X509_get_notBefore(const X509 *x509) {
  // In OpenSSL, this function is an alias for |X509_getm_notBefore|, but our
  // |X509_getm_notBefore| is const-correct. |X509_get_notBefore| was
  // originally a macro, so it needs to capture both get0 and getm use cases.
  return x509->cert_info->validity->notBefore;
}

int X509_set1_notAfter(X509 *x, const ASN1_TIME *tm) {
  ASN1_TIME *in;

  if ((x == NULL) || (x->cert_info->validity == NULL)) {
    return 0;
  }
  in = x->cert_info->validity->notAfter;
  if (in != tm) {
    in = ASN1_STRING_dup(tm);
    if (in != NULL) {
      ASN1_TIME_free(x->cert_info->validity->notAfter);
      x->cert_info->validity->notAfter = in;
    }
  }
  return in != NULL;
}

int X509_set_notAfter(X509 *x, const ASN1_TIME *tm) {
  return X509_set1_notAfter(x, tm);
}

const ASN1_TIME *X509_get0_notAfter(const X509 *x) {
  return x->cert_info->validity->notAfter;
}

ASN1_TIME *X509_getm_notAfter(X509 *x) {
  // Note this function takes a const |X509| pointer in OpenSSL. We require
  // non-const as this allows mutating |x|. If it comes up for compatibility,
  // we can relax this.
  return x->cert_info->validity->notAfter;
}

ASN1_TIME *X509_get_notAfter(const X509 *x509) {
  // In OpenSSL, this function is an alias for |X509_getm_notAfter|, but our
  // |X509_getm_notAfter| is const-correct. |X509_get_notAfter| was
  // originally a macro, so it needs to capture both get0 and getm use cases.
  return x509->cert_info->validity->notAfter;
}

void X509_get0_uids(const X509 *x509, const ASN1_BIT_STRING **out_issuer_uid,
                    const ASN1_BIT_STRING **out_subject_uid) {
  if (out_issuer_uid != NULL) {
    *out_issuer_uid = x509->cert_info->issuerUID;
  }
  if (out_subject_uid != NULL) {
    *out_subject_uid = x509->cert_info->subjectUID;
  }
}

int X509_set_pubkey(X509 *x, EVP_PKEY *pkey) {
  if ((x == NULL) || (x->cert_info == NULL)) {
    return 0;
  }
  return (X509_PUBKEY_set(&(x->cert_info->key), pkey));
}

const STACK_OF(X509_EXTENSION) *X509_get0_extensions(const X509 *x) {
  return x->cert_info->extensions;
}

const X509_ALGOR *X509_get0_tbs_sigalg(const X509 *x) {
  return x->cert_info->signature;
}

X509_PUBKEY *X509_get_X509_PUBKEY(const X509 *x509) {
  return x509->cert_info->key;
}
