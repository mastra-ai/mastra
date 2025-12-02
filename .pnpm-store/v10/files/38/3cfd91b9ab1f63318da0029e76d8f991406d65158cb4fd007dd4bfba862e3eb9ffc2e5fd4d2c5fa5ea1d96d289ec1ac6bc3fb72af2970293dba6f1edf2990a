// Copyright 2022 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "mock_signature_verify_cache.h"

#include <algorithm>

namespace bssl {

MockSignatureVerifyCache::MockSignatureVerifyCache() = default;

MockSignatureVerifyCache::~MockSignatureVerifyCache() = default;

void MockSignatureVerifyCache::Store(const std::string& key,
                                     SignatureVerifyCache::Value value) {
  cache_.insert_or_assign(key, value);
  stores_++;
}

SignatureVerifyCache::Value MockSignatureVerifyCache::Check(
    const std::string& key) {
  auto iter = cache_.find(key);
  if (iter == cache_.end()) {
    misses_++;
    return SignatureVerifyCache::Value::kUnknown;
  }
  hits_++;
  return iter->second;
}

}  // namespace net
