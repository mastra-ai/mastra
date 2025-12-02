// Copyright 2022 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BSSL_PKI_SIGNATURE_VERIFY_CACHE_H_
#define BSSL_PKI_SIGNATURE_VERIFY_CACHE_H_

#include "fillins/openssl_util.h"
#include <string>

namespace bssl {

class OPENSSL_EXPORT SignatureVerifyCache {
 public:
  enum class Value {
    kValid,    // Cached as a valid signature result.
    kInvalid,  // Cached as an invalid signature result.
    kUnknown,  // Cache has no information.
  };

  virtual ~SignatureVerifyCache() = default;

  // This interface uses a const std::string reference instead of
  // std::string_view because any implementation that may reasonably want to use
  // std::unordered_map or similar can run into problems with std::hash before
  // C++20. (https://en.cppreference.com/w/cpp/container/unordered_map/find)

  // |Store| is called to store the result of a verification for |key| as kValid
  // or kInvalid after a signature check.
  virtual void Store(const std::string& key, Value value) = 0;

  // |Check| is called to fetch a cached value for a verification for |key|. If
  // the result is kValid, or kInvalid, signature checking is skipped and the
  // corresponding cached result is used.  If the result is kUnknown signature
  // checking is performed and the corresponding result saved using |Store|.
  virtual Value Check(const std::string& key) = 0;
};

}  // namespace net

#endif  // BSSL_PKI_SIGNATURE_VERIFY_CACHE_H_
