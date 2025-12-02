// Copyright 2016 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "trust_store_in_memory.h"

namespace bssl {

TrustStoreInMemory::TrustStoreInMemory() = default;
TrustStoreInMemory::~TrustStoreInMemory() = default;

bool TrustStoreInMemory::IsEmpty() const {
  return entries_.empty();
}

void TrustStoreInMemory::Clear() {
  entries_.clear();
}

void TrustStoreInMemory::AddTrustAnchor(
    std::shared_ptr<const ParsedCertificate> cert) {
  AddCertificate(std::move(cert), CertificateTrust::ForTrustAnchor());
}

void TrustStoreInMemory::AddTrustAnchorWithExpiration(
    std::shared_ptr<const ParsedCertificate> cert) {
  AddCertificate(std::move(cert),
                 CertificateTrust::ForTrustAnchor().WithEnforceAnchorExpiry());
}

void TrustStoreInMemory::AddTrustAnchorWithConstraints(
    std::shared_ptr<const ParsedCertificate> cert) {
  AddCertificate(
      std::move(cert),
      CertificateTrust::ForTrustAnchor().WithEnforceAnchorConstraints());
}

void TrustStoreInMemory::AddDistrustedCertificateForTest(
    std::shared_ptr<const ParsedCertificate> cert) {
  AddCertificate(std::move(cert), CertificateTrust::ForDistrusted());
}

void TrustStoreInMemory::AddCertificateWithUnspecifiedTrust(
    std::shared_ptr<const ParsedCertificate> cert) {
  AddCertificate(std::move(cert), CertificateTrust::ForUnspecified());
}

void TrustStoreInMemory::SyncGetIssuersOf(const ParsedCertificate* cert,
                                          ParsedCertificateList* issuers) {
  auto range = entries_.equal_range(cert->normalized_issuer().AsStringView());
  for (auto it = range.first; it != range.second; ++it)
    issuers->push_back(it->second.cert);
}

CertificateTrust TrustStoreInMemory::GetTrust(
    const ParsedCertificate* cert,
    void* debug_data) {
  const Entry* entry = GetEntry(cert);
  return entry ? entry->trust : CertificateTrust::ForUnspecified();
}

bool TrustStoreInMemory::Contains(const ParsedCertificate* cert) const {
  return GetEntry(cert) != nullptr;
}

TrustStoreInMemory::Entry::Entry() = default;
TrustStoreInMemory::Entry::Entry(const Entry& other) = default;
TrustStoreInMemory::Entry::~Entry() = default;

void TrustStoreInMemory::AddCertificate(
    std::shared_ptr<const ParsedCertificate> cert,
    const CertificateTrust& trust) {
  Entry entry;
  entry.cert = std::move(cert);
  entry.trust = trust;

  // TODO(mattm): should this check for duplicate certificates?
  entries_.insert(
      std::make_pair(entry.cert->normalized_subject().AsStringView(), entry));
}

const TrustStoreInMemory::Entry* TrustStoreInMemory::GetEntry(
    const ParsedCertificate* cert) const {
  auto range = entries_.equal_range(cert->normalized_subject().AsStringView());
  for (auto it = range.first; it != range.second; ++it) {
    if (cert == it->second.cert.get() ||
        cert->der_cert() == it->second.cert->der_cert()) {
      // NOTE: ambiguity when there are duplicate entries.
      return &it->second;
    }
  }
  return nullptr;
}

}  // namespace net
