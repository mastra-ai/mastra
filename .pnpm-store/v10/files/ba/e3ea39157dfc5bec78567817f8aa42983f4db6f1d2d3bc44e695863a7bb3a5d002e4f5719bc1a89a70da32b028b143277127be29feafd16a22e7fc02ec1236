// Copyright 2015 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "verify_certificate_chain.h"

#include "cert_errors.h"
#include "common_cert_errors.h"
#include "mock_signature_verify_cache.h"
#include "simple_path_builder_delegate.h"
#include "test_helpers.h"
#include "trust_store.h"
#include "verify_certificate_chain_typed_unittest.h"

namespace bssl {

namespace {

class VerifyCertificateChainTestDelegate {
 public:
  static void Verify(const VerifyCertChainTest& test,
                     const std::string& test_file_path) {
    SimplePathBuilderDelegate delegate(1024, test.digest_policy);

    CertPathErrors errors;
    std::set<der::Input> user_constrained_policy_set;
    VerifyCertificateChain(
        test.chain, test.last_cert_trust, &delegate, test.time,
        test.key_purpose, test.initial_explicit_policy,
        test.user_initial_policy_set, test.initial_policy_mapping_inhibit,
        test.initial_any_policy_inhibit, &user_constrained_policy_set, &errors);
    VerifyCertPathErrors(test.expected_errors, errors, test.chain,
                         test_file_path);
    VerifyUserConstrainedPolicySet(test.expected_user_constrained_policy_set,
                                   user_constrained_policy_set, test_file_path);
  }
};

}  // namespace

INSTANTIATE_TYPED_TEST_SUITE_P(VerifyCertificateChain,
                               VerifyCertificateChainSingleRootTest,
                               VerifyCertificateChainTestDelegate);

TEST(VerifyCertificateIsSelfSigned, TargetOnly) {
  auto cert = ReadCertFromFile(
      "testdata/verify_certificate_chain_unittest/target-only/chain.pem");
  ASSERT_TRUE(cert);

  // Test with null cache and errors.
  EXPECT_FALSE(VerifyCertificateIsSelfSigned(*cert, /*cache=*/nullptr,
                                             /*errors=*/nullptr));

  // Test with cache and errors.
  CertErrors errors;
  MockSignatureVerifyCache cache;
  EXPECT_FALSE(VerifyCertificateIsSelfSigned(*cert, &cache, &errors));

  EXPECT_TRUE(
      errors.ContainsAnyErrorWithSeverity(CertError::Severity::SEVERITY_HIGH));
  EXPECT_TRUE(errors.ContainsError(cert_errors::kSubjectDoesNotMatchIssuer));

  // Should not try to verify signature if names don't match.
  EXPECT_EQ(cache.CacheHits(), 0U);
  EXPECT_EQ(cache.CacheMisses(), 0U);
  EXPECT_EQ(cache.CacheStores(), 0U);
}

TEST(VerifyCertificateIsSelfSigned, SelfIssued) {
  auto cert = ReadCertFromFile(
      "testdata/verify_certificate_chain_unittest/target-selfissued/chain.pem");
  ASSERT_TRUE(cert);

  // Test with null cache and errors.
  EXPECT_FALSE(VerifyCertificateIsSelfSigned(*cert, /*cache=*/nullptr,
                                             /*errors=*/nullptr));

  // Test with cache and errors.
  CertErrors errors;
  MockSignatureVerifyCache cache;
  EXPECT_FALSE(VerifyCertificateIsSelfSigned(*cert, &cache, &errors));

  EXPECT_TRUE(
      errors.ContainsAnyErrorWithSeverity(CertError::Severity::SEVERITY_HIGH));
  EXPECT_TRUE(errors.ContainsError(cert_errors::kVerifySignedDataFailed));

  EXPECT_EQ(cache.CacheHits(), 0U);
  EXPECT_EQ(cache.CacheMisses(), 1U);
  EXPECT_EQ(cache.CacheStores(), 1U);

  // Trying again should use cached signature verification result.
  EXPECT_FALSE(VerifyCertificateIsSelfSigned(*cert, &cache, &errors));
  EXPECT_EQ(cache.CacheHits(), 1U);
  EXPECT_EQ(cache.CacheMisses(), 1U);
  EXPECT_EQ(cache.CacheStores(), 1U);
}

TEST(VerifyCertificateIsSelfSigned, SelfSigned) {
  auto cert = ReadCertFromFile(
      "testdata/verify_certificate_chain_unittest/target-selfsigned/chain.pem");
  ASSERT_TRUE(cert);

  // Test with null cache and errors.
  EXPECT_TRUE(VerifyCertificateIsSelfSigned(*cert, /*cache=*/nullptr,
                                            /*errors=*/nullptr));

  // Test with cache and errors.
  CertErrors errors;
  MockSignatureVerifyCache cache;
  EXPECT_TRUE(VerifyCertificateIsSelfSigned(*cert, &cache, &errors));

  EXPECT_FALSE(errors.ContainsAnyErrorWithSeverity(
      CertError::Severity::SEVERITY_WARNING));
  EXPECT_FALSE(
      errors.ContainsAnyErrorWithSeverity(CertError::Severity::SEVERITY_HIGH));

  EXPECT_EQ(cache.CacheHits(), 0U);
  EXPECT_EQ(cache.CacheMisses(), 1U);
  EXPECT_EQ(cache.CacheStores(), 1U);

  // Trying again should use cached signature verification result.
  EXPECT_TRUE(VerifyCertificateIsSelfSigned(*cert, &cache, &errors));
  EXPECT_EQ(cache.CacheHits(), 1U);
  EXPECT_EQ(cache.CacheMisses(), 1U);
  EXPECT_EQ(cache.CacheStores(), 1U);
}

}  // namespace net
