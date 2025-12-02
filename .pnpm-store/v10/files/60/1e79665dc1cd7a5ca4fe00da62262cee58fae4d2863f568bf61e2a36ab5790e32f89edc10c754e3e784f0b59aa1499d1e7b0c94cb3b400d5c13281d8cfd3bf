// Copyright 2019 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include <stddef.h>
#include <stdint.h>

#include "../pki/ocsp.h"
#include "../pki/input.h"

extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size) {
  bssl::der::Input response_data_der(data, size);
  bssl::OCSPResponseData response_data;
  bssl::ParseOCSPResponseData(response_data_der, &response_data);

  return 0;
}
