/* Copyright (c) 2017, Google Inc.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 * SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 * OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 * CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE. */

#include <openssl/bytestring.h>

#include <errno.h>
#include <stdio.h>
#include <string.h>

#include <algorithm>
#include <vector>

#include "internal.h"


bool ReadAll(std::vector<uint8_t> *out, FILE *file) {
  out->clear();

  constexpr size_t kMaxSize = 1024 * 1024;
  size_t len = 0;
  out->resize(128);

  for (;;) {
    len += fread(out->data() + len, 1, out->size() - len, file);

    if (feof(file)) {
      out->resize(len);
      return true;
    }
    if (ferror(file)) {
      return false;
    }

    if (len == out->size()) {
      if (out->size() == kMaxSize) {
        fprintf(stderr, "Input too large.\n");
        return false;
      }
      size_t cap = std::min(out->size() * 2, kMaxSize);
      out->resize(cap);
    }
  }
}

bool WriteToFile(const std::string &path, bssl::Span<const uint8_t> in) {
  ScopedFILE file(fopen(path.c_str(), "wb"));
  if (!file) {
    fprintf(stderr, "Failed to open '%s': %s\n", path.c_str(), strerror(errno));
    return false;
  }
  if (fwrite(in.data(), in.size(), 1, file.get()) != 1) {
    fprintf(stderr, "Failed to write to '%s': %s\n", path.c_str(),
            strerror(errno));
    return false;
  }
  return true;
}
