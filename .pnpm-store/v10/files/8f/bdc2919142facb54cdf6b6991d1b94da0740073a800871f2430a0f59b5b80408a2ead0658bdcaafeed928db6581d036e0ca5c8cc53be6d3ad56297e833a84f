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

#include <openssl/x509.h>

#include <assert.h>
#include <inttypes.h>
#include <string.h>

#include <openssl/asn1.h>
#include <openssl/bio.h>
#include <openssl/obj.h>


static int maybe_write(BIO *out, const void *buf, int len) {
  // If |out| is NULL, ignore the output but report the length.
  return out == NULL || BIO_write(out, buf, len) == len;
}

// do_indent prints |indent| spaces to |out|.
static int do_indent(BIO *out, int indent) {
  for (int i = 0; i < indent; i++) {
    if (!maybe_write(out, " ", 1)) {
      return 0;
    }
  }
  return 1;
}

#define FN_WIDTH_LN 25
#define FN_WIDTH_SN 10

static int do_name_ex(BIO *out, const X509_NAME *n, int indent,
                      unsigned long flags) {
  int prev = -1, orflags;
  char objtmp[80];
  const char *objbuf;
  int outlen, len;
  const char *sep_dn, *sep_mv, *sep_eq;
  int sep_dn_len, sep_mv_len, sep_eq_len;
  if (indent < 0) {
    indent = 0;
  }
  outlen = indent;
  if (!do_indent(out, indent)) {
    return -1;
  }
  switch (flags & XN_FLAG_SEP_MASK) {
    case XN_FLAG_SEP_MULTILINE:
      sep_dn = "\n";
      sep_dn_len = 1;
      sep_mv = " + ";
      sep_mv_len = 3;
      break;

    case XN_FLAG_SEP_COMMA_PLUS:
      sep_dn = ",";
      sep_dn_len = 1;
      sep_mv = "+";
      sep_mv_len = 1;
      indent = 0;
      break;

    case XN_FLAG_SEP_CPLUS_SPC:
      sep_dn = ", ";
      sep_dn_len = 2;
      sep_mv = " + ";
      sep_mv_len = 3;
      indent = 0;
      break;

    case XN_FLAG_SEP_SPLUS_SPC:
      sep_dn = "; ";
      sep_dn_len = 2;
      sep_mv = " + ";
      sep_mv_len = 3;
      indent = 0;
      break;

    default:
      return -1;
  }

  if (flags & XN_FLAG_SPC_EQ) {
    sep_eq = " = ";
    sep_eq_len = 3;
  } else {
    sep_eq = "=";
    sep_eq_len = 1;
  }

  int cnt = X509_NAME_entry_count(n);
  for (int i = 0; i < cnt; i++) {
    const X509_NAME_ENTRY *ent;
    if (flags & XN_FLAG_DN_REV) {
      ent = X509_NAME_get_entry(n, cnt - i - 1);
    } else {
      ent = X509_NAME_get_entry(n, i);
    }
    if (prev != -1) {
      if (prev == X509_NAME_ENTRY_set(ent)) {
        if (!maybe_write(out, sep_mv, sep_mv_len)) {
          return -1;
        }
        outlen += sep_mv_len;
      } else {
        if (!maybe_write(out, sep_dn, sep_dn_len)) {
          return -1;
        }
        outlen += sep_dn_len;
        if (!do_indent(out, indent)) {
          return -1;
        }
        outlen += indent;
      }
    }
    prev = X509_NAME_ENTRY_set(ent);
    const ASN1_OBJECT *fn = X509_NAME_ENTRY_get_object(ent);
    const ASN1_STRING *val = X509_NAME_ENTRY_get_data(ent);
    assert((flags & XN_FLAG_FN_MASK) == XN_FLAG_FN_SN);
    int fn_nid = OBJ_obj2nid(fn);
    if (fn_nid == NID_undef) {
      OBJ_obj2txt(objtmp, sizeof(objtmp), fn, 1);
      objbuf = objtmp;
    } else {
      objbuf = OBJ_nid2sn(fn_nid);
    }
    int objlen = strlen(objbuf);
    if (!maybe_write(out, objbuf, objlen) ||
        !maybe_write(out, sep_eq, sep_eq_len)) {
      return -1;
    }
    outlen += objlen + sep_eq_len;
    // If the field name is unknown then fix up the DER dump flag. We
    // might want to limit this further so it will DER dump on anything
    // other than a few 'standard' fields.
    if ((fn_nid == NID_undef) && (flags & XN_FLAG_DUMP_UNKNOWN_FIELDS)) {
      orflags = ASN1_STRFLGS_DUMP_ALL;
    } else {
      orflags = 0;
    }

    len = ASN1_STRING_print_ex(out, val, flags | orflags);
    if (len < 0) {
      return -1;
    }
    outlen += len;
  }
  return outlen;
}

int X509_NAME_print_ex(BIO *out, const X509_NAME *nm, int indent,
                       unsigned long flags) {
  if (flags == XN_FLAG_COMPAT) {
    return X509_NAME_print(out, nm, indent);
  }
  return do_name_ex(out, nm, indent, flags);
}

int X509_NAME_print_ex_fp(FILE *fp, const X509_NAME *nm, int indent,
                          unsigned long flags) {
  BIO *bio = NULL;
  if (fp != NULL) {
    // If |fp| is NULL, this function returns the number of bytes without
    // writing.
    bio = BIO_new_fp(fp, BIO_NOCLOSE);
    if (bio == NULL) {
      return -1;
    }
  }
  int ret = X509_NAME_print_ex(bio, nm, indent, flags);
  BIO_free(bio);
  return ret;
}
