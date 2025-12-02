// Copyright 2019 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include <stddef.h>
#include <stdint.h>

#include <tuple>

#include "../pki/crl.h"
#include "../pki/input.h"

extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size) {
  bssl::der::Input crl_der(data, size);

  bssl::der::Input tbs_cert_list_tlv;
  bssl::der::Input signature_algorithm_tlv;
  bssl::der::BitString signature_value;

  std::ignore = bssl::ParseCrlCertificateList(
      crl_der, &tbs_cert_list_tlv, &signature_algorithm_tlv, &signature_value);

  return 0;
}
