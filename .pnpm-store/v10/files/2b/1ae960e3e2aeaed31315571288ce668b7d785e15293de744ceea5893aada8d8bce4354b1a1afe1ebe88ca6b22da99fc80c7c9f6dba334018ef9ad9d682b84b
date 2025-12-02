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

#include <assert.h>

#include <openssl/asn1.h>
#include <openssl/err.h>
#include <openssl/mem.h>
#include <openssl/obj.h>
#include <openssl/x509.h>
#include <openssl/x509v3.h>

int X509_CRL_print_fp(FILE *fp, X509_CRL *x) {
  BIO *b = BIO_new_fp(fp, BIO_NOCLOSE);
  if (b == NULL) {
    OPENSSL_PUT_ERROR(X509, ERR_R_BUF_LIB);
    return 0;
  }
  int ret = X509_CRL_print(b, x);
  BIO_free(b);
  return ret;
}

int X509_CRL_print(BIO *out, X509_CRL *x) {
  long version = X509_CRL_get_version(x);
  assert(X509_CRL_VERSION_1 <= version && version <= X509_CRL_VERSION_2);
  const X509_ALGOR *sig_alg;
  const ASN1_BIT_STRING *signature;
  X509_CRL_get0_signature(x, &signature, &sig_alg);
  if (BIO_printf(out, "Certificate Revocation List (CRL):\n") <= 0 ||
      BIO_printf(out, "%8sVersion %ld (0x%lx)\n", "", version + 1,
                 (unsigned long)version) <= 0 ||
      // Note this and the other |X509_signature_print| call both print the
      // outer signature algorithm, rather than printing the inner and outer
      // ones separately. This matches OpenSSL, though it was probably a bug.
      !X509_signature_print(out, sig_alg, NULL)) {
    return 0;
  }

  char *issuer = X509_NAME_oneline(X509_CRL_get_issuer(x), NULL, 0);
  int ok = issuer != NULL && BIO_printf(out, "%8sIssuer: %s\n", "", issuer) > 0;
  OPENSSL_free(issuer);
  if (!ok) {
    return 0;
  }

  if (BIO_printf(out, "%8sLast Update: ", "") <= 0 ||
      !ASN1_TIME_print(out, X509_CRL_get0_lastUpdate(x)) ||
      BIO_printf(out, "\n%8sNext Update: ", "") <= 0) {
    return 0;
  }
  if (X509_CRL_get0_nextUpdate(x)) {
    if (!ASN1_TIME_print(out, X509_CRL_get0_nextUpdate(x))) {
      return 0;
    }
  } else {
    if (BIO_printf(out, "NONE") <= 0) {
      return 0;
    }
  }

  if (BIO_printf(out, "\n") <= 0 ||
      !X509V3_extensions_print(out, "CRL extensions",
                               X509_CRL_get0_extensions(x), 0, 8)) {
    return 0;
  }

  const STACK_OF(X509_REVOKED) *rev = X509_CRL_get_REVOKED(x);
  if (sk_X509_REVOKED_num(rev) > 0) {
    if (BIO_printf(out, "Revoked Certificates:\n") <= 0) {
      return 0;
    }
  } else {
    if (BIO_printf(out, "No Revoked Certificates.\n") <= 0) {
      return 0;
    }
  }

  for (size_t i = 0; i < sk_X509_REVOKED_num(rev); i++) {
    const X509_REVOKED *r = sk_X509_REVOKED_value(rev, i);
    if (BIO_printf(out, "    Serial Number: ") <= 0 ||
        i2a_ASN1_INTEGER(out, X509_REVOKED_get0_serialNumber(r)) <= 0 ||
        BIO_printf(out, "\n        Revocation Date: ") <= 0 ||
        !ASN1_TIME_print(out, X509_REVOKED_get0_revocationDate(r)) ||
        BIO_printf(out, "\n") <= 0 ||
        !X509V3_extensions_print(out, "CRL entry extensions",
                                 X509_REVOKED_get0_extensions(r), 0, 8)) {
    }
  }

  return X509_signature_print(out, sig_alg, signature);
}
