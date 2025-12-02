// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BSSL_FILLINS_BASE64_H
#define BSSL_FILLINS_BASE64_H

#include <openssl/base.h>

#include <string>
#include <string_view>

namespace bssl {

namespace fillins {

OPENSSL_EXPORT bool Base64Encode(const std::string_view &input,
                                 std::string *output);

OPENSSL_EXPORT bool Base64Decode(const std::string_view &input,
                                 std::string *output);

}  // namespace fillins

}  // namespace bssl

#endif  // BSSL_FILLINS_BASE64_H
