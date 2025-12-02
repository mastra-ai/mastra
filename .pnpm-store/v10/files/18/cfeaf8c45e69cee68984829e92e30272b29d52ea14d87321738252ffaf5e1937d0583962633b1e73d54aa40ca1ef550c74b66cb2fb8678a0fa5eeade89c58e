// Copyright 2019 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include <stddef.h>
#include <stdint.h>

#include "../pki/ocsp.h"
#include "../pki/input.h"

extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size) {
  bssl::der::Input single_response_der(data, size);
  bssl::OCSPSingleResponse single_response;
  bssl::ParseOCSPSingleResponse(single_response_der, &single_response);

  return 0;
}
