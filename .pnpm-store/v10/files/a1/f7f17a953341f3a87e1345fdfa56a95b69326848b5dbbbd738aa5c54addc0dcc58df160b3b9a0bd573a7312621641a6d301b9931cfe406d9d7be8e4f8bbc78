// Copyright 2016 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "cert_issuer_source_static.h"

namespace bssl {

CertIssuerSourceStatic::CertIssuerSourceStatic() = default;
CertIssuerSourceStatic::~CertIssuerSourceStatic() = default;

void CertIssuerSourceStatic::AddCert(
    std::shared_ptr<const ParsedCertificate> cert) {
  intermediates_.insert(std::make_pair(
      cert->normalized_subject().AsStringView(), std::move(cert)));
}

void CertIssuerSourceStatic::Clear() {
  intermediates_.clear();
}

void CertIssuerSourceStatic::SyncGetIssuersOf(const ParsedCertificate* cert,
                                              ParsedCertificateList* issuers) {
  auto range =
      intermediates_.equal_range(cert->normalized_issuer().AsStringView());
  for (auto it = range.first; it != range.second; ++it)
    issuers->push_back(it->second);
}

void CertIssuerSourceStatic::AsyncGetIssuersOf(
    const ParsedCertificate* cert,
    std::unique_ptr<Request>* out_req) {
  // CertIssuerSourceStatic never returns asynchronous results.
  out_req->reset();
}

}  // namespace net
