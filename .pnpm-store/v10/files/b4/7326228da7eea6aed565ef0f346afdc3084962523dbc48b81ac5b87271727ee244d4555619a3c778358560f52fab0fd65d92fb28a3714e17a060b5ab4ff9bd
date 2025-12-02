/*
 * Written by Dr Stephen N Henson (steve@openssl.org) for the OpenSSL project
 * 1999.
 */
/* ====================================================================
 * Copyright (c) 1999 The OpenSSL Project.  All rights reserved.
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
 * Hudson (tjh@cryptsoft.com).
 *
 */
/* X509 v3 extension utilities */

#include <assert.h>
#include <stdio.h>

#include <openssl/conf.h>
#include <openssl/err.h>
#include <openssl/mem.h>
#include <openssl/obj.h>
#include <openssl/x509v3.h>

#include "../x509/internal.h"

#include "ext_dat.h"
static STACK_OF(X509V3_EXT_METHOD) *ext_list = NULL;

static int ext_stack_cmp(const X509V3_EXT_METHOD *const *a,
                         const X509V3_EXT_METHOD *const *b) {
  return ((*a)->ext_nid - (*b)->ext_nid);
}

int X509V3_EXT_add(X509V3_EXT_METHOD *ext) {
  // We only support |ASN1_ITEM|-based extensions.
  assert(ext->it != NULL);

  // TODO(davidben): This should be locked. Also check for duplicates.
  if (!ext_list && !(ext_list = sk_X509V3_EXT_METHOD_new(ext_stack_cmp))) {
    return 0;
  }
  if (!sk_X509V3_EXT_METHOD_push(ext_list, ext)) {
    return 0;
  }
  sk_X509V3_EXT_METHOD_sort(ext_list);
  return 1;
}

static int ext_cmp(const void *void_a, const void *void_b) {
  const X509V3_EXT_METHOD **a = (const X509V3_EXT_METHOD **)void_a;
  const X509V3_EXT_METHOD **b = (const X509V3_EXT_METHOD **)void_b;
  return ext_stack_cmp(a, b);
}

const X509V3_EXT_METHOD *X509V3_EXT_get_nid(int nid) {
  X509V3_EXT_METHOD tmp;
  const X509V3_EXT_METHOD *t = &tmp, *const * ret;
  size_t idx;

  if (nid < 0) {
    return NULL;
  }
  tmp.ext_nid = nid;
  ret = bsearch(&t, standard_exts, STANDARD_EXTENSION_COUNT,
                sizeof(X509V3_EXT_METHOD *), ext_cmp);
  if (ret) {
    return *ret;
  }
  if (!ext_list) {
    return NULL;
  }

  if (!sk_X509V3_EXT_METHOD_find(ext_list, &idx, &tmp)) {
    return NULL;
  }
  return sk_X509V3_EXT_METHOD_value(ext_list, idx);
}

const X509V3_EXT_METHOD *X509V3_EXT_get(const X509_EXTENSION *ext) {
  int nid;
  if ((nid = OBJ_obj2nid(ext->object)) == NID_undef) {
    return NULL;
  }
  return X509V3_EXT_get_nid(nid);
}

int X509V3_EXT_free(int nid, void *ext_data) {
  const X509V3_EXT_METHOD *ext_method = X509V3_EXT_get_nid(nid);
  if (ext_method == NULL) {
    OPENSSL_PUT_ERROR(X509V3, X509V3_R_CANNOT_FIND_FREE_FUNCTION);
    return 0;
  }

  ASN1_item_free(ext_data, ASN1_ITEM_ptr(ext_method->it));
  return 1;
}

int X509V3_EXT_add_alias(int nid_to, int nid_from) {
OPENSSL_BEGIN_ALLOW_DEPRECATED
  const X509V3_EXT_METHOD *ext;
  X509V3_EXT_METHOD *tmpext;

  if (!(ext = X509V3_EXT_get_nid(nid_from))) {
    OPENSSL_PUT_ERROR(X509V3, X509V3_R_EXTENSION_NOT_FOUND);
    return 0;
  }
  if (!(tmpext =
            (X509V3_EXT_METHOD *)OPENSSL_malloc(sizeof(X509V3_EXT_METHOD)))) {
    return 0;
  }
  *tmpext = *ext;
  tmpext->ext_nid = nid_to;
  if (!X509V3_EXT_add(tmpext)) {
    OPENSSL_free(tmpext);
    return 0;
  }
  return 1;
OPENSSL_END_ALLOW_DEPRECATED
}

// Legacy function: we don't need to add standard extensions any more because
// they are now kept in ext_dat.h.

int X509V3_add_standard_extensions(void) { return 1; }

// Return an extension internal structure

void *X509V3_EXT_d2i(const X509_EXTENSION *ext) {
  const X509V3_EXT_METHOD *method;
  const unsigned char *p;

  if (!(method = X509V3_EXT_get(ext))) {
    return NULL;
  }
  p = ext->value->data;
  void *ret =
      ASN1_item_d2i(NULL, &p, ext->value->length, ASN1_ITEM_ptr(method->it));
  if (ret == NULL) {
    return NULL;
  }
  // Check for trailing data.
  if (p != ext->value->data + ext->value->length) {
    ASN1_item_free(ret, ASN1_ITEM_ptr(method->it));
    OPENSSL_PUT_ERROR(X509V3, X509V3_R_TRAILING_DATA_IN_EXTENSION);
    return NULL;
  }
  return ret;
}

void *X509V3_get_d2i(const STACK_OF(X509_EXTENSION) *extensions, int nid,
                     int *out_critical, int *out_idx) {
  int lastpos;
  X509_EXTENSION *ex, *found_ex = NULL;
  if (!extensions) {
    if (out_idx) {
      *out_idx = -1;
    }
    if (out_critical) {
      *out_critical = -1;
    }
    return NULL;
  }
  if (out_idx) {
    lastpos = *out_idx + 1;
  } else {
    lastpos = 0;
  }
  if (lastpos < 0) {
    lastpos = 0;
  }
  for (size_t i = lastpos; i < sk_X509_EXTENSION_num(extensions); i++) {
    ex = sk_X509_EXTENSION_value(extensions, i);
    if (OBJ_obj2nid(ex->object) == nid) {
      if (out_idx) {
        // TODO(https://crbug.com/boringssl/379): Consistently reject
        // duplicate extensions.
        *out_idx = (int)i;
        found_ex = ex;
        break;
      } else if (found_ex) {
        // Found more than one
        if (out_critical) {
          *out_critical = -2;
        }
        return NULL;
      }
      found_ex = ex;
    }
  }
  if (found_ex) {
    // Found it
    if (out_critical) {
      *out_critical = X509_EXTENSION_get_critical(found_ex);
    }
    return X509V3_EXT_d2i(found_ex);
  }

  // Extension not found
  if (out_idx) {
    *out_idx = -1;
  }
  if (out_critical) {
    *out_critical = -1;
  }
  return NULL;
}

// This function is a general extension append, replace and delete utility.
// The precise operation is governed by the 'flags' value. The 'crit' and
// 'value' arguments (if relevant) are the extensions internal structure.

int X509V3_add1_i2d(STACK_OF(X509_EXTENSION) **x, int nid, void *value,
                    int crit, unsigned long flags) {
  int errcode, extidx = -1;
  X509_EXTENSION *ext = NULL, *extmp;
  STACK_OF(X509_EXTENSION) *ret = NULL;
  unsigned long ext_op = flags & X509V3_ADD_OP_MASK;

  // If appending we don't care if it exists, otherwise look for existing
  // extension.
  if (ext_op != X509V3_ADD_APPEND) {
    extidx = X509v3_get_ext_by_NID(*x, nid, -1);
  }

  // See if extension exists
  if (extidx >= 0) {
    // If keep existing, nothing to do
    if (ext_op == X509V3_ADD_KEEP_EXISTING) {
      return 1;
    }
    // If default then its an error
    if (ext_op == X509V3_ADD_DEFAULT) {
      errcode = X509V3_R_EXTENSION_EXISTS;
      goto err;
    }
    // If delete, just delete it
    if (ext_op == X509V3_ADD_DELETE) {
      X509_EXTENSION *prev_ext = sk_X509_EXTENSION_delete(*x, extidx);
      if (prev_ext == NULL) {
        return -1;
      }
      X509_EXTENSION_free(prev_ext);
      return 1;
    }
  } else {
    // If replace existing or delete, error since extension must exist
    if ((ext_op == X509V3_ADD_REPLACE_EXISTING) ||
        (ext_op == X509V3_ADD_DELETE)) {
      errcode = X509V3_R_EXTENSION_NOT_FOUND;
      goto err;
    }
  }

  // If we get this far then we have to create an extension: could have
  // some flags for alternative encoding schemes...

  ext = X509V3_EXT_i2d(nid, crit, value);

  if (!ext) {
    OPENSSL_PUT_ERROR(X509V3, X509V3_R_ERROR_CREATING_EXTENSION);
    return 0;
  }

  // If extension exists replace it..
  if (extidx >= 0) {
    extmp = sk_X509_EXTENSION_value(*x, extidx);
    X509_EXTENSION_free(extmp);
    if (!sk_X509_EXTENSION_set(*x, extidx, ext)) {
      return -1;
    }
    return 1;
  }

  if ((ret = *x) == NULL && (ret = sk_X509_EXTENSION_new_null()) == NULL) {
    goto m_fail;
  }
  if (!sk_X509_EXTENSION_push(ret, ext)) {
    goto m_fail;
  }

  *x = ret;
  return 1;

m_fail:
  if (ret != *x) {
    sk_X509_EXTENSION_free(ret);
  }
  X509_EXTENSION_free(ext);
  return -1;

err:
  if (!(flags & X509V3_ADD_SILENT)) {
    OPENSSL_PUT_ERROR(X509V3, errcode);
  }
  return 0;
}
