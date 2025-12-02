// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BSSL_FILLINS_UTF_STRING_CONVERSIONS
#define BSSL_FILLINS_UTF_STRING_CONVERSIONS

#include <openssl/base.h>

#include <string>

#define CBU_IS_SURROGATE(c) (((c)&0xfffff800) == 0xd800)

#define CBU_IS_UNICODE_NONCHAR(c)                                          \
  ((c) >= 0xfdd0 && ((uint32_t)(c) <= 0xfdef || ((c)&0xfffe) == 0xfffe) && \
   (uint32_t)(c) <= 0x10ffff)

#define CBU_IS_UNICODE_CHAR(c)                             \
  ((uint32_t)(c) < 0xd800 ||                               \
   ((uint32_t)(c) > 0xdfff && (uint32_t)(c) <= 0x10ffff && \
    !CBU_IS_UNICODE_NONCHAR(c)))

namespace bssl {

namespace fillins {

OPENSSL_EXPORT void WriteUnicodeCharacter(uint32_t codepoint,
                                          std::string *append_to);

}  // namespace fillins

}  // namespace bssl

#endif  // BSSL_FILLINS_UTF_STRING_CONVERSIONS
