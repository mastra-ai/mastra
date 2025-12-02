// Copyright 2016 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include <stddef.h>
#include <stdint.h>

#include "../pki/cert_errors.h"
#include "../pki/parsed_certificate.h"
#include <openssl/base.h>
#include <openssl/pool.h>

extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size) {
  bssl::CertErrors errors;
  std::shared_ptr<const bssl::ParsedCertificate> cert =
      bssl::ParsedCertificate::Create(
          bssl::UniquePtr<CRYPTO_BUFFER>(
              CRYPTO_BUFFER_new(data, size, nullptr)),
          {}, &errors);

  // Severe errors must be provided iff the parsing failed.
  BSSL_CHECK(errors.ContainsAnyErrorWithSeverity(
                 bssl::CertError::SEVERITY_HIGH) == (cert == nullptr));

  return 0;
}
