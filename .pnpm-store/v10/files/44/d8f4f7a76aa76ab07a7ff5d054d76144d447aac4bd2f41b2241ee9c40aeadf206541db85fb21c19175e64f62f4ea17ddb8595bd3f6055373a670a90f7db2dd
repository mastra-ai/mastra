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

#include <limits.h>
#include <string.h>

#include <openssl/bytestring.h>
#include <openssl/err.h>
#include <openssl/mem.h>
#include <openssl/obj.h>

#include "../bytestring/internal.h"
#include "../internal.h"
#include "internal.h"


int i2d_ASN1_OBJECT(const ASN1_OBJECT *in, unsigned char **outp) {
  if (in == NULL) {
    OPENSSL_PUT_ERROR(ASN1, ERR_R_PASSED_NULL_PARAMETER);
    return -1;
  }

  if (in->length <= 0) {
    OPENSSL_PUT_ERROR(ASN1, ASN1_R_ILLEGAL_OBJECT);
    return -1;
  }

  CBB cbb, child;
  if (!CBB_init(&cbb, (size_t)in->length + 2) ||
      !CBB_add_asn1(&cbb, &child, CBS_ASN1_OBJECT) ||
      !CBB_add_bytes(&child, in->data, in->length)) {
    CBB_cleanup(&cbb);
    return -1;
  }

  return CBB_finish_i2d(&cbb, outp);
}

int i2t_ASN1_OBJECT(char *buf, int buf_len, const ASN1_OBJECT *a) {
  return OBJ_obj2txt(buf, buf_len, a, 0);
}

static int write_str(BIO *bp, const char *str) {
  size_t len = strlen(str);
  if (len > INT_MAX) {
    OPENSSL_PUT_ERROR(ASN1, ERR_R_OVERFLOW);
    return -1;
  }
  return BIO_write(bp, str, (int)len) == (int)len ? (int)len : -1;
}

int i2a_ASN1_OBJECT(BIO *bp, const ASN1_OBJECT *a) {
  if (a == NULL || a->data == NULL) {
    return write_str(bp, "NULL");
  }

  char buf[80], *allocated = NULL;
  const char *str = buf;
  int len = i2t_ASN1_OBJECT(buf, sizeof(buf), a);
  if (len > (int)sizeof(buf) - 1) {
    // The input was truncated. Allocate a buffer that fits.
    allocated = OPENSSL_malloc(len + 1);
    if (allocated == NULL) {
      return -1;
    }
    len = i2t_ASN1_OBJECT(allocated, len + 1, a);
    str = allocated;
  }
  if (len <= 0) {
    str = "<INVALID>";
  }

  int ret = write_str(bp, str);
  OPENSSL_free(allocated);
  return ret;
}

ASN1_OBJECT *d2i_ASN1_OBJECT(ASN1_OBJECT **out, const unsigned char **inp,
                             long len) {
  if (len < 0) {
    return NULL;
  }

  CBS cbs, child;
  CBS_init(&cbs, *inp, (size_t)len);
  if (!CBS_get_asn1(&cbs, &child, CBS_ASN1_OBJECT)) {
    OPENSSL_PUT_ERROR(ASN1, ASN1_R_DECODE_ERROR);
    return NULL;
  }

  const uint8_t *contents = CBS_data(&child);
  ASN1_OBJECT *ret = c2i_ASN1_OBJECT(out, &contents, CBS_len(&child));
  if (ret != NULL) {
    // |c2i_ASN1_OBJECT| should have consumed the entire input.
    assert(CBS_data(&cbs) == contents);
    *inp = CBS_data(&cbs);
  }
  return ret;
}

ASN1_OBJECT *c2i_ASN1_OBJECT(ASN1_OBJECT **out, const unsigned char **inp,
                             long len) {
  if (len < 0) {
    OPENSSL_PUT_ERROR(ASN1, ASN1_R_INVALID_OBJECT_ENCODING);
    return NULL;
  }

  CBS cbs;
  CBS_init(&cbs, *inp, (size_t)len);
  if (!CBS_is_valid_asn1_oid(&cbs)) {
    OPENSSL_PUT_ERROR(ASN1, ASN1_R_INVALID_OBJECT_ENCODING);
    return NULL;
  }

  ASN1_OBJECT *ret = ASN1_OBJECT_create(NID_undef, *inp, (size_t)len,
                                        /*sn=*/NULL, /*ln=*/NULL);
  if (ret == NULL) {
    return NULL;
  }

  if (out != NULL) {
    ASN1_OBJECT_free(*out);
    *out = ret;
  }
  *inp += len;  // All bytes were consumed.
  return ret;
}

ASN1_OBJECT *ASN1_OBJECT_new(void) {
  ASN1_OBJECT *ret;

  ret = (ASN1_OBJECT *)OPENSSL_malloc(sizeof(ASN1_OBJECT));
  if (ret == NULL) {
    return NULL;
  }
  ret->length = 0;
  ret->data = NULL;
  ret->nid = 0;
  ret->sn = NULL;
  ret->ln = NULL;
  ret->flags = ASN1_OBJECT_FLAG_DYNAMIC;
  return ret;
}

void ASN1_OBJECT_free(ASN1_OBJECT *a) {
  if (a == NULL) {
    return;
  }
  if (a->flags & ASN1_OBJECT_FLAG_DYNAMIC_STRINGS) {
    OPENSSL_free((void *)a->sn);
    OPENSSL_free((void *)a->ln);
    a->sn = a->ln = NULL;
  }
  if (a->flags & ASN1_OBJECT_FLAG_DYNAMIC_DATA) {
    OPENSSL_free((void *)a->data);
    a->data = NULL;
    a->length = 0;
  }
  if (a->flags & ASN1_OBJECT_FLAG_DYNAMIC) {
    OPENSSL_free(a);
  }
}

ASN1_OBJECT *ASN1_OBJECT_create(int nid, const unsigned char *data, size_t len,
                                const char *sn, const char *ln) {
  if (len > INT_MAX) {
    OPENSSL_PUT_ERROR(ASN1, ASN1_R_STRING_TOO_LONG);
    return NULL;
  }

  ASN1_OBJECT o;
  o.sn = sn;
  o.ln = ln;
  o.data = data;
  o.nid = nid;
  o.length = (int)len;
  o.flags = ASN1_OBJECT_FLAG_DYNAMIC | ASN1_OBJECT_FLAG_DYNAMIC_STRINGS |
            ASN1_OBJECT_FLAG_DYNAMIC_DATA;
  return OBJ_dup(&o);
}
