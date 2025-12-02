// Copyright 2019 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include <stddef.h>
#include <stdint.h>

#include <tuple>

#include "../pki/crl.h"
#include "../pki/input.h"

extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size) {
  bssl::der::Input input_der(data, size);

  bssl::ParsedCrlTbsCertList tbs_cert_list;
  std::ignore = bssl::ParseCrlTbsCertList(input_der, &tbs_cert_list);

  return 0;
}
