// Copyright 2016 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "../pki/verify_name_match.h"

#include "../pki/cert_errors.h"
#include "../pki/input.h"

// Entry point for LibFuzzer.
extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size) {
  bssl::der::Input in(data, size);
  std::string normalized_der;
  bssl::CertErrors errors;
  bool success = bssl::NormalizeName(in, &normalized_der, &errors);
  if (success) {
    // If the input was successfully normalized, re-normalizing it should
    // produce the same output again.
    std::string renormalized_der;
    bool renormalize_success = bssl::NormalizeName(
        bssl::der::Input(normalized_der), &renormalized_der, &errors);
    if (!renormalize_success) {
      abort();
    }
    if (normalized_der != renormalized_der) {
      abort();
    }
  }
  return 0;
}
