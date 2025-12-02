// Copyright 2016 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "path_builder.h"

#include "cert_issuer_source_static.h"
#include "simple_path_builder_delegate.h"
#include "trust_store_in_memory.h"
#include "verify_certificate_chain_typed_unittest.h"

namespace bssl {

namespace {

class PathBuilderTestDelegate {
 public:
  static void Verify(const VerifyCertChainTest& test,
                     const std::string& test_file_path) {
    SimplePathBuilderDelegate path_builder_delegate(1024, test.digest_policy);
    ASSERT_FALSE(test.chain.empty());

    TrustStoreInMemory trust_store;
    trust_store.AddCertificate(test.chain.back(), test.last_cert_trust);

    CertIssuerSourceStatic intermediate_cert_issuer_source;
    for (size_t i = 1; i < test.chain.size(); ++i)
      intermediate_cert_issuer_source.AddCert(test.chain[i]);

    // First cert in the |chain| is the target.
    CertPathBuilder path_builder(
        test.chain.front(), &trust_store, &path_builder_delegate, test.time,
        test.key_purpose, test.initial_explicit_policy,
        test.user_initial_policy_set, test.initial_policy_mapping_inhibit,
        test.initial_any_policy_inhibit);
    path_builder.AddCertIssuerSource(&intermediate_cert_issuer_source);

    CertPathBuilder::Result result = path_builder.Run();
    EXPECT_EQ(!test.HasHighSeverityErrors(), result.HasValidPath());
    if (result.HasValidPath()) {
      VerifyUserConstrainedPolicySet(
          test.expected_user_constrained_policy_set,
          result.GetBestValidPath()->user_constrained_policy_set,
          test_file_path);
    }
  }
};

}  // namespace

INSTANTIATE_TYPED_TEST_SUITE_P(PathBuilder,
                               VerifyCertificateChainSingleRootTest,
                               PathBuilderTestDelegate);

}  // namespace net
