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

#include <stdio.h>
#include <string.h>

#include <openssl/asn1.h>
#include <openssl/asn1t.h>
#include <openssl/conf.h>
#include <openssl/err.h>
#include <openssl/mem.h>
#include <openssl/obj.h>
#include <openssl/x509v3.h>

static STACK_OF(CONF_VALUE) *i2v_AUTHORITY_INFO_ACCESS(
    const X509V3_EXT_METHOD *method, void *ext, STACK_OF(CONF_VALUE) *ret);
static void *v2i_AUTHORITY_INFO_ACCESS(const X509V3_EXT_METHOD *method,
                                       const X509V3_CTX *ctx,
                                       const STACK_OF(CONF_VALUE) *nval);

const X509V3_EXT_METHOD v3_info = {
    NID_info_access,
    X509V3_EXT_MULTILINE,
    ASN1_ITEM_ref(AUTHORITY_INFO_ACCESS),
    0,
    0,
    0,
    0,
    0,
    0,
    i2v_AUTHORITY_INFO_ACCESS,
    v2i_AUTHORITY_INFO_ACCESS,
    0,
    0,
    NULL,
};

const X509V3_EXT_METHOD v3_sinfo = {
    NID_sinfo_access,
    X509V3_EXT_MULTILINE,
    ASN1_ITEM_ref(AUTHORITY_INFO_ACCESS),
    0,
    0,
    0,
    0,
    0,
    0,
    i2v_AUTHORITY_INFO_ACCESS,
    v2i_AUTHORITY_INFO_ACCESS,
    0,
    0,
    NULL,
};

ASN1_SEQUENCE(ACCESS_DESCRIPTION) = {
    ASN1_SIMPLE(ACCESS_DESCRIPTION, method, ASN1_OBJECT),
    ASN1_SIMPLE(ACCESS_DESCRIPTION, location, GENERAL_NAME),
} ASN1_SEQUENCE_END(ACCESS_DESCRIPTION)

IMPLEMENT_ASN1_FUNCTIONS(ACCESS_DESCRIPTION)

ASN1_ITEM_TEMPLATE(AUTHORITY_INFO_ACCESS) = ASN1_EX_TEMPLATE_TYPE(
    ASN1_TFLG_SEQUENCE_OF, 0, GeneralNames, ACCESS_DESCRIPTION)
ASN1_ITEM_TEMPLATE_END(AUTHORITY_INFO_ACCESS)

IMPLEMENT_ASN1_FUNCTIONS(AUTHORITY_INFO_ACCESS)

static STACK_OF(CONF_VALUE) *i2v_AUTHORITY_INFO_ACCESS(
    const X509V3_EXT_METHOD *method, void *ext, STACK_OF(CONF_VALUE) *ret) {
  const AUTHORITY_INFO_ACCESS *ainfo = ext;
  ACCESS_DESCRIPTION *desc;
  int nlen;
  char objtmp[80], *ntmp;
  CONF_VALUE *vtmp;
  STACK_OF(CONF_VALUE) *tret = ret;

  for (size_t i = 0; i < sk_ACCESS_DESCRIPTION_num(ainfo); i++) {
    STACK_OF(CONF_VALUE) *tmp;

    desc = sk_ACCESS_DESCRIPTION_value(ainfo, i);
    tmp = i2v_GENERAL_NAME(method, desc->location, tret);
    if (tmp == NULL) {
      goto err;
    }
    tret = tmp;
    vtmp = sk_CONF_VALUE_value(tret, i);
    i2t_ASN1_OBJECT(objtmp, sizeof objtmp, desc->method);
    nlen = strlen(objtmp) + strlen(vtmp->name) + 5;
    ntmp = OPENSSL_malloc(nlen);
    if (ntmp == NULL) {
      goto err;
    }
    OPENSSL_strlcpy(ntmp, objtmp, nlen);
    OPENSSL_strlcat(ntmp, " - ", nlen);
    OPENSSL_strlcat(ntmp, vtmp->name, nlen);
    OPENSSL_free(vtmp->name);
    vtmp->name = ntmp;
  }
  if (ret == NULL && tret == NULL) {
    return sk_CONF_VALUE_new_null();
  }

  return tret;
err:
  if (ret == NULL && tret != NULL) {
    sk_CONF_VALUE_pop_free(tret, X509V3_conf_free);
  }
  return NULL;
}

static void *v2i_AUTHORITY_INFO_ACCESS(const X509V3_EXT_METHOD *method,
                                       const X509V3_CTX *ctx,
                                       const STACK_OF(CONF_VALUE) *nval) {
  AUTHORITY_INFO_ACCESS *ainfo = NULL;
  ACCESS_DESCRIPTION *acc;
  if (!(ainfo = sk_ACCESS_DESCRIPTION_new_null())) {
    return NULL;
  }
  for (size_t i = 0; i < sk_CONF_VALUE_num(nval); i++) {
    const CONF_VALUE *cnf = sk_CONF_VALUE_value(nval, i);
    if (!(acc = ACCESS_DESCRIPTION_new()) ||
        !sk_ACCESS_DESCRIPTION_push(ainfo, acc)) {
      goto err;
    }
    char *ptmp = strchr(cnf->name, ';');
    if (!ptmp) {
      OPENSSL_PUT_ERROR(X509V3, X509V3_R_INVALID_SYNTAX);
      goto err;
    }
    CONF_VALUE ctmp;
    ctmp.name = ptmp + 1;
    ctmp.value = cnf->value;
    if (!v2i_GENERAL_NAME_ex(acc->location, method, ctx, &ctmp, 0)) {
      goto err;
    }
    char *objtmp = OPENSSL_strndup(cnf->name, ptmp - cnf->name);
    if (objtmp == NULL) {
      goto err;
    }
    acc->method = OBJ_txt2obj(objtmp, 0);
    if (!acc->method) {
      OPENSSL_PUT_ERROR(X509V3, X509V3_R_BAD_OBJECT);
      ERR_add_error_data(2, "value=", objtmp);
      OPENSSL_free(objtmp);
      goto err;
    }
    OPENSSL_free(objtmp);
  }
  return ainfo;
err:
  sk_ACCESS_DESCRIPTION_pop_free(ainfo, ACCESS_DESCRIPTION_free);
  return NULL;
}

int i2a_ACCESS_DESCRIPTION(BIO *bp, const ACCESS_DESCRIPTION *a) {
  i2a_ASN1_OBJECT(bp, a->method);
  return 2;
}
