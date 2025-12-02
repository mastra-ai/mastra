// Copyright 2016 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BSSL_PKI_TRUST_STORE_COLLECTION_H_
#define BSSL_PKI_TRUST_STORE_COLLECTION_H_

#include "fillins/openssl_util.h"

#include "trust_store.h"

namespace bssl {

// TrustStoreCollection is an implementation of TrustStore which combines the
// results from multiple TrustStores.
//
// The order of the matches will correspond to a concatenation of matches in
// the order the stores were added.
class OPENSSL_EXPORT TrustStoreCollection : public TrustStore {
 public:
  TrustStoreCollection();

  TrustStoreCollection(const TrustStoreCollection&) = delete;
  TrustStoreCollection& operator=(const TrustStoreCollection&) = delete;

  ~TrustStoreCollection() override;

  // Includes results from |store| in the combined output. |store| must
  // outlive the TrustStoreCollection.
  void AddTrustStore(TrustStore* store);

  // TrustStore implementation:
  void SyncGetIssuersOf(const ParsedCertificate* cert,
                        ParsedCertificateList* issuers) override;
  CertificateTrust GetTrust(const ParsedCertificate* cert,
                            void* debug_data) override;

 private:
  std::vector<TrustStore*> stores_;
};

}  // namespace net

#endif  // BSSL_PKI_TRUST_STORE_COLLECTION_H_
