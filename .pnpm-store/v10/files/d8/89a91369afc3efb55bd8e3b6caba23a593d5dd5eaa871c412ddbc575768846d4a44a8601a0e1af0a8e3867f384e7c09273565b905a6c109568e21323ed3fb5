// Copyright 2022 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BSSL_PKI_MOCK_SIGNATURE_VERIFY_CACHE_H_
#define BSSL_PKI_MOCK_SIGNATURE_VERIFY_CACHE_H_

#include <stddef.h>

#include <string>
#include <string_view>
#include <unordered_map>


#include "signature_verify_cache.h"

namespace bssl {

// MockSignatureVerifyCache is an implementation of SignatureVerifyCache.  It is
// intended only for testing of cache functionality.

class MockSignatureVerifyCache : public SignatureVerifyCache {
 public:
  MockSignatureVerifyCache();

  ~MockSignatureVerifyCache() override;

  void Store(const std::string& key,
             SignatureVerifyCache::Value value) override;

  SignatureVerifyCache::Value Check(const std::string& key) override;

  size_t CacheHits() { return hits_; }

  size_t CacheMisses() { return misses_; }

  size_t CacheStores() { return stores_; }

 private:
  std::unordered_map<std::string, SignatureVerifyCache::Value> cache_;
  size_t hits_ = 0;
  size_t misses_ = 0;
  size_t stores_ = 0;
};

}  // namespace net

#endif  // BSSL_PKI_MOCK_PATH_BUILDER_DELEGATE_H_
