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
#include <openssl/time.h>

#include <string.h>
#include <time.h>

#include <openssl/asn1t.h>
#include <openssl/bytestring.h>
#include <openssl/err.h>
#include <openssl/mem.h>

#include "internal.h"

// This is an implementation of the ASN1 Time structure which is: Time ::=
// CHOICE { utcTime UTCTime, generalTime GeneralizedTime } written by Steve
// Henson.

IMPLEMENT_ASN1_MSTRING(ASN1_TIME, B_ASN1_TIME)

IMPLEMENT_ASN1_FUNCTIONS_const(ASN1_TIME)

ASN1_TIME *ASN1_TIME_set_posix(ASN1_TIME *s, int64_t posix_time) {
  return ASN1_TIME_adj(s, posix_time, 0, 0);
}

ASN1_TIME *ASN1_TIME_set(ASN1_TIME *s, time_t time) {
  return ASN1_TIME_adj(s, time, 0, 0);
}

static int fits_in_utc_time(const struct tm *tm) {
  return 50 <= tm->tm_year && tm->tm_year < 150;
}

ASN1_TIME *ASN1_TIME_adj(ASN1_TIME *s, int64_t posix_time, int offset_day,
                         long offset_sec) {
  struct tm tm;

  if (!OPENSSL_posix_to_tm(posix_time, &tm)) {
    OPENSSL_PUT_ERROR(ASN1, ASN1_R_ERROR_GETTING_TIME);
    return NULL;
  }
  if (offset_day || offset_sec) {
    if (!OPENSSL_gmtime_adj(&tm, offset_day, offset_sec)) {
      return NULL;
    }
  }
  if (fits_in_utc_time(&tm)) {
    return ASN1_UTCTIME_adj(s, posix_time, offset_day, offset_sec);
  }
  return ASN1_GENERALIZEDTIME_adj(s, posix_time, offset_day, offset_sec);
}

int ASN1_TIME_check(const ASN1_TIME *t) {
  if (t->type == V_ASN1_GENERALIZEDTIME) {
    return ASN1_GENERALIZEDTIME_check(t);
  } else if (t->type == V_ASN1_UTCTIME) {
    return ASN1_UTCTIME_check(t);
  }
  return 0;
}

// Convert an ASN1_TIME structure to GeneralizedTime
ASN1_GENERALIZEDTIME *ASN1_TIME_to_generalizedtime(const ASN1_TIME *t,
                                                   ASN1_GENERALIZEDTIME **out) {
  ASN1_GENERALIZEDTIME *ret = NULL;
  char *str;
  int newlen;

  if (!ASN1_TIME_check(t)) {
    return NULL;
  }

  if (!out || !*out) {
    if (!(ret = ASN1_GENERALIZEDTIME_new())) {
      goto err;
    }
  } else {
    ret = *out;
  }

  // If already GeneralizedTime just copy across
  if (t->type == V_ASN1_GENERALIZEDTIME) {
    if (!ASN1_STRING_set(ret, t->data, t->length)) {
      goto err;
    }
    goto done;
  }

  // grow the string
  if (!ASN1_STRING_set(ret, NULL, t->length + 2)) {
    goto err;
  }
  // ASN1_STRING_set() allocated 'len + 1' bytes.
  newlen = t->length + 2 + 1;
  str = (char *)ret->data;
  // Work out the century and prepend
  if (t->data[0] >= '5') {
    OPENSSL_strlcpy(str, "19", newlen);
  } else {
    OPENSSL_strlcpy(str, "20", newlen);
  }

  OPENSSL_strlcat(str, (char *)t->data, newlen);

done:
  if (out != NULL && *out == NULL) {
    *out = ret;
  }
  return ret;

err:
  if (out == NULL || *out != ret) {
    ASN1_GENERALIZEDTIME_free(ret);
  }
  return NULL;
}

int ASN1_TIME_set_string(ASN1_TIME *s, const char *str) {
  return ASN1_UTCTIME_set_string(s, str) ||
         ASN1_GENERALIZEDTIME_set_string(s, str);
}

int ASN1_TIME_set_string_X509(ASN1_TIME *s, const char *str) {
  CBS cbs;
  CBS_init(&cbs, (const uint8_t*)str, strlen(str));
  int type;
  struct tm tm;
  if (CBS_parse_utc_time(&cbs, /*out_tm=*/NULL,
                         /*allow_timezone_offset=*/0)) {
    type = V_ASN1_UTCTIME;
  } else if (CBS_parse_generalized_time(&cbs, &tm,
                                        /*allow_timezone_offset=*/0)) {
    type = V_ASN1_GENERALIZEDTIME;
    if (fits_in_utc_time(&tm)) {
      type = V_ASN1_UTCTIME;
      CBS_skip(&cbs, 2);
    }
  } else {
    return 0;
  }

  if (s != NULL) {
    if (!ASN1_STRING_set(s, CBS_data(&cbs), CBS_len(&cbs))) {
      return 0;
    }
    s->type = type;
  }
  return 1;
}

static int asn1_time_to_tm(struct tm *tm, const ASN1_TIME *t,
                           int allow_timezone_offset) {
  if (t == NULL) {
    if (OPENSSL_posix_to_tm(time(NULL), tm)) {
      return 1;
    }
    return 0;
  }

  if (t->type == V_ASN1_UTCTIME) {
    return asn1_utctime_to_tm(tm, t, allow_timezone_offset);
  } else if (t->type == V_ASN1_GENERALIZEDTIME) {
    return asn1_generalizedtime_to_tm(tm, t);
  }

  return 0;
}

int ASN1_TIME_diff(int *out_days, int *out_seconds, const ASN1_TIME *from,
                   const ASN1_TIME *to) {
  struct tm tm_from, tm_to;
  if (!asn1_time_to_tm(&tm_from, from, /*allow_timezone_offset=*/1)) {
    return 0;
  }
  if (!asn1_time_to_tm(&tm_to, to, /*allow_timezone_offset=*/1)) {
    return 0;
  }
  return OPENSSL_gmtime_diff(out_days, out_seconds, &tm_from, &tm_to);
}

// The functions below do *not* permissively allow the use of four digit
// timezone offsets in UTC times, as is done elsewhere in the code. They are
// both new API, and used internally to X509_cmp_time. This is to discourage the
// use of nonstandard times in new code, and to ensure that this code behaves
// correctly in X509_cmp_time which historically did its own time validations
// slightly different than the many other copies of X.509 time validation
// sprinkled through the codebase. The custom checks in X509_cmp_time meant that
// it did not allow four digit timezone offsets in UTC times.
int ASN1_TIME_to_time_t(const ASN1_TIME *t, time_t *out_time) {
  struct tm tm;
  if (!asn1_time_to_tm(&tm, t, /*allow_timezone_offset=*/0)) {
    return 0;
  }
  return OPENSSL_timegm(&tm, out_time);
}

int ASN1_TIME_to_posix(const ASN1_TIME *t, int64_t *out_time) {
  struct tm tm;
  if (!asn1_time_to_tm(&tm, t, /*allow_timezone_offset=*/0)) {
    return 0;
  }
  return OPENSSL_tm_to_posix(&tm, out_time);
}
