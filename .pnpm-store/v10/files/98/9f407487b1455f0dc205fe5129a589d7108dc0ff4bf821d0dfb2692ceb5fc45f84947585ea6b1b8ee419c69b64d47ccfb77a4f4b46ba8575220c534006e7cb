// Copyright 2016 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BSSL_PKI_CERT_ISSUER_SOURCE_STATIC_H_
#define BSSL_PKI_CERT_ISSUER_SOURCE_STATIC_H_

#include "fillins/openssl_util.h"
#include <unordered_map>


#include "cert_issuer_source.h"

namespace bssl {

// Synchronously returns issuers from a pre-supplied set.
class OPENSSL_EXPORT CertIssuerSourceStatic : public CertIssuerSource {
 public:
  CertIssuerSourceStatic();

  CertIssuerSourceStatic(const CertIssuerSourceStatic&) = delete;
  CertIssuerSourceStatic& operator=(const CertIssuerSourceStatic&) = delete;

  ~CertIssuerSourceStatic() override;

  // Adds |cert| to the set of certificates that this CertIssuerSource will
  // provide.
  void AddCert(std::shared_ptr<const ParsedCertificate> cert);

  // Clears the set of certificates.
  void Clear();

  size_t size() const { return intermediates_.size(); }

  // CertIssuerSource implementation:
  void SyncGetIssuersOf(const ParsedCertificate* cert,
                        ParsedCertificateList* issuers) override;
  void AsyncGetIssuersOf(const ParsedCertificate* cert,
                         std::unique_ptr<Request>* out_req) override;

 private:
  // The certificates that the CertIssuerSourceStatic can return, keyed on the
  // normalized subject value.
  std::unordered_multimap<std::string_view,
                          std::shared_ptr<const ParsedCertificate>>
      intermediates_;
};

}  // namespace net

#endif  // BSSL_PKI_CERT_ISSUER_SOURCE_STATIC_H_
