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
#include <openssl/bytestring.h>
#include <openssl/err.h>
#include <openssl/mem.h>
#include <openssl/time.h>

#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "internal.h"

int asn1_generalizedtime_to_tm(struct tm *tm, const ASN1_GENERALIZEDTIME *d) {
  if (d->type != V_ASN1_GENERALIZEDTIME) {
    return 0;
  }
  CBS cbs;
  CBS_init(&cbs, d->data, (size_t)d->length);
  if (!CBS_parse_generalized_time(&cbs, tm, /*allow_timezone_offset=*/0)) {
    return 0;
  }
  return 1;
}

int ASN1_GENERALIZEDTIME_check(const ASN1_GENERALIZEDTIME *d) {
  return asn1_generalizedtime_to_tm(NULL, d);
}

int ASN1_GENERALIZEDTIME_set_string(ASN1_GENERALIZEDTIME *s, const char *str) {
  size_t len = strlen(str);
  CBS cbs;
  CBS_init(&cbs, (const uint8_t *)str, len);
  if (!CBS_parse_generalized_time(&cbs, /*out_tm=*/NULL,
                                  /*allow_timezone_offset=*/0)) {
    return 0;
  }
  if (s != NULL) {
    if (!ASN1_STRING_set(s, str, len)) {
      return 0;
    }
    s->type = V_ASN1_GENERALIZEDTIME;
  }
  return 1;
}

ASN1_GENERALIZEDTIME *ASN1_GENERALIZEDTIME_set(ASN1_GENERALIZEDTIME *s,
                                               int64_t posix_time) {
  return ASN1_GENERALIZEDTIME_adj(s, posix_time, 0, 0);
}

ASN1_GENERALIZEDTIME *ASN1_GENERALIZEDTIME_adj(ASN1_GENERALIZEDTIME *s,
                                               int64_t posix_time, int offset_day,
                                               long offset_sec) {
  struct tm data;
  if (!OPENSSL_posix_to_tm(posix_time, &data)) {
    return NULL;
  }

  if (offset_day || offset_sec) {
    if (!OPENSSL_gmtime_adj(&data, offset_day, offset_sec)) {
      return NULL;
    }
  }

  if (data.tm_year < 0 - 1900 || data.tm_year > 9999 - 1900) {
    OPENSSL_PUT_ERROR(ASN1, ASN1_R_ILLEGAL_TIME_VALUE);
    return NULL;
  }

  char buf[16];
  int ret = snprintf(buf, sizeof(buf), "%04d%02d%02d%02d%02d%02dZ",
                     data.tm_year + 1900, data.tm_mon + 1, data.tm_mday,
                     data.tm_hour, data.tm_min, data.tm_sec);
  if (ret != (int)(sizeof(buf) - 1)) {
    abort();  // |snprintf| should neither truncate nor write fewer bytes.
  }

  int free_s = 0;
  if (s == NULL) {
    free_s = 1;
    s = ASN1_UTCTIME_new();
    if (s == NULL) {
      return NULL;
    }
  }

  if (!ASN1_STRING_set(s, buf, strlen(buf))) {
    if (free_s) {
      ASN1_UTCTIME_free(s);
    }
    return NULL;
  }
  s->type = V_ASN1_GENERALIZEDTIME;
  return s;
}
