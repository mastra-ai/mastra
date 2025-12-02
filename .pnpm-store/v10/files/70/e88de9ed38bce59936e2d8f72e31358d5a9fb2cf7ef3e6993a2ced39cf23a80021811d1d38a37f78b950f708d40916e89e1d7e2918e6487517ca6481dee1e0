// Copyright 2022 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BSSL_PKI_STRING_UTIL_H_
#define BSSL_PKI_STRING_UTIL_H_

#include "fillins/openssl_util.h"


#include <stdint.h>

#include <cstdint>
#include <string_view>
#include <vector>

namespace bssl::string_util {

// Returns true if the characters in |str| are all ASCII, false otherwise.
OPENSSL_EXPORT bool IsAscii(std::string_view str);

// Compares |str1| and |str2| ASCII case insensitively (independent of locale).
// Returns true if |str1| and |str2| match.
OPENSSL_EXPORT bool IsEqualNoCase(std::string_view str1,
                                      std::string_view str2);

// Compares |str1| and |prefix| ASCII case insensitively (independent of
// locale). Returns true if |str1| starts with |prefix|.
OPENSSL_EXPORT bool StartsWithNoCase(std::string_view str,
                                         std::string_view prefix);

// Compares |str1| and |suffix| ASCII case insensitively (independent of
// locale). Returns true if |str1| starts with |suffix|.
OPENSSL_EXPORT bool EndsWithNoCase(std::string_view str,
                                       std::string_view suffix);

// Finds and replaces all occurrences of |find| of non zero length with
// |replace| in |str|, returning the result.
OPENSSL_EXPORT std::string FindAndReplace(std::string_view str,
                                              std::string_view find,
                                              std::string_view replace);

// TODO(bbe) transition below to c++20
// Compares |str1| and |prefix|. Returns true if |str1| starts with |prefix|.
OPENSSL_EXPORT bool StartsWith(std::string_view str,
                                   std::string_view prefix);

// TODO(bbe) transition below to c++20
// Compares |str1| and |suffix|. Returns true if |str1| ends with |suffix|.
OPENSSL_EXPORT bool EndsWith(std::string_view str, std::string_view suffix);

// Returns a hexadecimal string encoding |data| of length |length|.
OPENSSL_EXPORT std::string HexEncode(const uint8_t* data, size_t length);

// Returns a decimal string representation of |i|.
OPENSSL_EXPORT std::string NumberToDecimalString(int i);

// Splits |str| on |split_char| returning the list of resulting strings.
OPENSSL_EXPORT std::vector<std::string_view> SplitString(
    std::string_view str,
    char split_char);

}  // namespace bssl::string_util

#endif  // BSSL_PKI_STRING_UTIL_H_
