// Copyright 2016 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "cert_issuer_source_static.h"

#include "cert_issuer_source_sync_unittest.h"
#include "parsed_certificate.h"
#include <gtest/gtest.h>

namespace bssl {

namespace {

class CertIssuerSourceStaticTestDelegate {
 public:
  void AddCert(std::shared_ptr<const ParsedCertificate> cert) {
    source_.AddCert(std::move(cert));
  }

  CertIssuerSource& source() { return source_; }

 protected:
  CertIssuerSourceStatic source_;
};

INSTANTIATE_TYPED_TEST_SUITE_P(CertIssuerSourceStaticTest,
                               CertIssuerSourceSyncTest,
                               CertIssuerSourceStaticTestDelegate);

INSTANTIATE_TYPED_TEST_SUITE_P(CertIssuerSourceStaticNormalizationTest,
                               CertIssuerSourceSyncNormalizationTest,
                               CertIssuerSourceStaticTestDelegate);

GTEST_ALLOW_UNINSTANTIATED_PARAMETERIZED_TEST(
    CertIssuerSourceSyncNotNormalizedTest);

}  // namespace

}  // namespace net
