// Copyright 2022 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "string_util.h"

#include <algorithm>
#include <iomanip>
#include <sstream>
#include <string>

#include <openssl/mem.h>

namespace bssl::string_util {

bool IsAscii(std::string_view str) {
  for (unsigned char c : str) {
    if (c > 127) {
      return false;
    }
  }
  return true;
}

bool IsEqualNoCase(std::string_view str1, std::string_view str2) {
  return std::equal(str1.begin(), str1.end(), str2.begin(), str2.end(),
                    [](const unsigned char a, const unsigned char b) {
                      return OPENSSL_tolower(a) == OPENSSL_tolower(b);
                    });
}

bool EndsWithNoCase(std::string_view str, std::string_view suffix) {
  return suffix.size() <= str.size() &&
         IsEqualNoCase(suffix, str.substr(str.size() - suffix.size()));
}

bool StartsWithNoCase(std::string_view str, std::string_view prefix) {
  return prefix.size() <= str.size() &&
         IsEqualNoCase(prefix, str.substr(0, prefix.size()));
}

std::string FindAndReplace(std::string_view str,
                           std::string_view find,
                           std::string_view replace) {
  std::string ret;

  if (find.empty()) {
    return std::string(str);
  }
  while (!str.empty()) {
    size_t index = str.find(find);
    if (index == std::string_view::npos) {
      ret.append(str);
      break;
    }
    ret.append(str.substr(0, index));
    ret.append(replace);
    str = str.substr(index + find.size());
  }
  return ret;
}

// TODO(bbe) get rid of this once we can c++20.
bool EndsWith(std::string_view str, std::string_view suffix) {
  return suffix.size() <= str.size() &&
         suffix == str.substr(str.size() - suffix.size());
}

// TODO(bbe) get rid of this once we can c++20.
bool StartsWith(std::string_view str, std::string_view prefix) {
  return prefix.size() <= str.size() && prefix == str.substr(0, prefix.size());
}

std::string HexEncode(const uint8_t* data, size_t length) {
  std::ostringstream out;
  for (size_t i = 0; i < length; i++) {
    out << std::hex << std::setfill('0') << std::setw(2) << std::uppercase
        << int{data[i]};
  }
  return out.str();
}

// TODO(bbe) get rid of this once extracted to boringssl. Everything else
// in third_party uses std::to_string
std::string NumberToDecimalString(int i) {
  std::ostringstream out;
  out << std::dec << i;
  return out.str();
}

std::vector<std::string_view> SplitString(std::string_view str,
                                          char split_char) {
  std::vector<std::string_view> out;

  if (str.empty()) {
    return out;
  }

  while (true) {
    // Find end of current token
    size_t i = str.find(split_char);

    // Add current token
    out.push_back(str.substr(0, i));

    if (i == str.npos) {
      // That was the last token
      break;
    }
    // Continue to next
    str = str.substr(i + 1);
  }

  return out;
}

}  // namespace bssl::string_util
