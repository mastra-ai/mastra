// Copyright 2016 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "trust_store_collection.h"

#include <openssl/base.h>

namespace bssl {

TrustStoreCollection::TrustStoreCollection() = default;
TrustStoreCollection::~TrustStoreCollection() = default;

void TrustStoreCollection::AddTrustStore(TrustStore* store) {
  BSSL_CHECK(store);
  stores_.push_back(store);
}

void TrustStoreCollection::SyncGetIssuersOf(const ParsedCertificate* cert,
                                            ParsedCertificateList* issuers) {
  for (auto* store : stores_) {
    store->SyncGetIssuersOf(cert, issuers);
  }
}

CertificateTrust TrustStoreCollection::GetTrust(
    const ParsedCertificate* cert,
    void* debug_data) {
  // The current aggregate result.
  CertificateTrust result = CertificateTrust::ForUnspecified();

  for (auto* store : stores_) {
    CertificateTrust cur_trust = store->GetTrust(cert, debug_data);

    // * If any stores distrust the certificate, consider it untrusted.
    // * If multiple stores consider it trusted, use the trust result from the
    //   last one
    if (!cur_trust.HasUnspecifiedTrust()) {
      result = cur_trust;
      if (result.IsDistrusted())
        break;
    }
  }

  return result;
}

}  // namespace net
