// Copyright 2019 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>

#include "../pki/crl.h"
#include "../pki/input.h"

extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size) {
  bssl::der::Input idp_der(data, size);

  std::unique_ptr<bssl::GeneralNames> distribution_point_names;
  bssl::ContainedCertsType only_contains_cert_type;

  if (bssl::ParseIssuingDistributionPoint(idp_der, &distribution_point_names,
                                         &only_contains_cert_type)) {
    bool has_distribution_point_names =
        distribution_point_names &&
        distribution_point_names->present_name_types != bssl::GENERAL_NAME_NONE;
    if (!has_distribution_point_names &&
        only_contains_cert_type == bssl::ContainedCertsType::ANY_CERTS) {
      abort();
    }
  }
  return 0;
}
