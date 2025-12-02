// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "../string_util.h"
#include <string>
#include <string_view>
#include "string_util.h"


namespace bssl {

namespace fillins {


// TODO(bbe): get rid of this
std::string HexEncode(const void *bytes, size_t size) {
  return bssl::string_util::HexEncode((const uint8_t *)bytes, size);
}

static bool IsUnicodeWhitespace(char c) {
  return c == 9 || c == 10 || c == 11 || c == 12 || c == 13 || c == ' ';
}

std::string CollapseWhitespaceASCII(std::string_view text,
                                    bool trim_sequences_with_line_breaks) {
  std::string result;
  result.resize(text.size());

  // Set flags to pretend we're already in a trimmed whitespace sequence, so we
  // will trim any leading whitespace.
  bool in_whitespace = true;
  bool already_trimmed = true;

  int chars_written = 0;
  for (auto i = text.begin(); i != text.end(); ++i) {
    if (IsUnicodeWhitespace(*i)) {
      if (!in_whitespace) {
        // Reduce all whitespace sequences to a single space.
        in_whitespace = true;
        result[chars_written++] = L' ';
      }
      if (trim_sequences_with_line_breaks && !already_trimmed &&
          ((*i == '\n') || (*i == '\r'))) {
        // Whitespace sequences containing CR or LF are eliminated entirely.
        already_trimmed = true;
        --chars_written;
      }
    } else {
      // Non-whitespace chracters are copied straight across.
      in_whitespace = false;
      already_trimmed = false;
      result[chars_written++] = *i;
    }
  }

  if (in_whitespace && !already_trimmed) {
    // Any trailing whitespace is eliminated.
    --chars_written;
  }

  result.resize(chars_written);
  return result;
}

// TODO(bbe): get rid of this (used to be strcasecmp in google3, which
// causes windows pain because msvc and strings.h)
bool EqualsCaseInsensitiveASCII(std::string_view a, std::string_view b) {
  return bssl::string_util::IsEqualNoCase(a, b);
}

bool IsAsciiAlpha(char c) {
  return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');
}

bool IsAsciiDigit(char c) { return c >= '0' && c <= '9'; }

void ReplaceSubstringsAfterOffset(std::string *s, size_t offset,
                                  std::string_view find,
                                  std::string_view replace) {
  std::string_view prefix(s->data(), offset);
  std::string suffix =
      bssl::string_util::FindAndReplace(s->substr(offset), find, replace);
  *s = std::string(prefix) + suffix;
};

}  // namespace fillins

}  // namespace bssl
