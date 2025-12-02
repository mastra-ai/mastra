// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "utf_string_conversions.h"

namespace bssl {

namespace fillins {

static const size_t kMaxUTF8Bytes = 4;

static size_t EncodeUTF8(uint32_t codepoint, char *out_buf) {
  if (codepoint < 0x7f) {
    out_buf[0] = codepoint;
    return 1;
  }

  if (codepoint <= 0x7ff) {
    out_buf[0] = 0xc0 | (codepoint >> 6);
    out_buf[1] = 0x80 | (codepoint & 0x3f);
    return 2;
  }

  if (codepoint <= 0xffff) {
    out_buf[0] = 0xe0 | (codepoint >> 12);
    out_buf[1] = 0x80 | ((codepoint >> 6) & 0x3f);
    out_buf[2] = 0x80 | (codepoint & 0x3f);
    return 3;
  }

  out_buf[0] = 0xf0 | (codepoint >> 18);
  out_buf[1] = 0x80 | ((codepoint >> 12) & 0x3f);
  out_buf[2] = 0x80 | ((codepoint >> 6) & 0x3f);
  out_buf[3] = 0x80 | (codepoint & 0x3f);
  return 4;
}

void WriteUnicodeCharacter(uint32_t codepoint, std::string *append_to) {
  char buf[kMaxUTF8Bytes];
  const size_t num_bytes = EncodeUTF8(codepoint, buf);
  append_to->append(buf, num_bytes);
}

}  // namespace fillins

}  // namespace bssl
