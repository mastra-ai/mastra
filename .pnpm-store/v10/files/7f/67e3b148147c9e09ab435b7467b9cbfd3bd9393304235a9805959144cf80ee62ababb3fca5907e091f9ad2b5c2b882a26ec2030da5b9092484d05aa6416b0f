// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BSSL_FILLINS_STRING_UTIL_H
#define BSSL_FILLINS_STRING_UTIL_H

#include <openssl/base.h>

#include <string.h>
#include <cassert>
#include <string>
#include <string_view>

namespace bssl {

namespace fillins {

OPENSSL_EXPORT std::string HexEncode(const void *bytes, size_t size);

OPENSSL_EXPORT std::string CollapseWhitespaceASCII(
    std::string_view text, bool trim_sequences_with_line_breaks);

OPENSSL_EXPORT bool EqualsCaseInsensitiveASCII(std::string_view a,
                                               std::string_view b);

OPENSSL_EXPORT bool IsAsciiAlpha(char c);

OPENSSL_EXPORT bool IsAsciiDigit(char c);

OPENSSL_EXPORT void ReplaceSubstringsAfterOffset(std::string *s, size_t offset,
                                                 std::string_view find,
                                                 std::string_view replace);

OPENSSL_EXPORT std::string HexDecode(std::string_view hex);

}  // namespace fillins

}  // namespace bssl

#endif  // BSSL_FILLINS_STRING_UTIL_H
