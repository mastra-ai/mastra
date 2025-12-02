// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include <openssl/base64.h>

#include "base64.h"

#include <vector>

namespace bssl {

namespace fillins {

bool Base64Encode(const std::string_view &input, std::string *output) {
  size_t len;
  if (!EVP_EncodedLength(&len, input.size())) {
    return false;
  }
  std::vector<char> encoded(len);
  len = EVP_EncodeBlock(reinterpret_cast<uint8_t *>(encoded.data()),
                        reinterpret_cast<const uint8_t *>(input.data()),
                        input.size());
  if (!len) {
    return false;
  }
  output->assign(encoded.data(), len);
  return true;
}

bool Base64Decode(const std::string_view &input, std::string *output) {
  size_t len;
  if (!EVP_DecodedLength(&len, input.size())) {
    return false;
  }
  std::vector<char> decoded(len);
  if (!EVP_DecodeBase64(reinterpret_cast<uint8_t *>(decoded.data()), &len, len,
                        reinterpret_cast<const uint8_t *>(input.data()),
                        input.size())) {
    return false;
  }
  output->assign(decoded.data(), len);
  return true;
}

}  // namespace fillins

}  // namespace bssl
