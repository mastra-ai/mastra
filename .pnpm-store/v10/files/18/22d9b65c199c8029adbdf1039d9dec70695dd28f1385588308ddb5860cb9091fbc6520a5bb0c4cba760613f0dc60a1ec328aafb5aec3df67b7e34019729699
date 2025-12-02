// Copyright 2016 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "../pki/verify_name_match.h"

#include <stddef.h>
#include <stdint.h>

#include <fuzzer/FuzzedDataProvider.h>

#include <vector>

#include "../pki/input.h"

// Entry point for LibFuzzer.
extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size) {
  FuzzedDataProvider fuzzed_data(data, size);

  // Intentionally using uint16_t here to avoid empty |second_part|.
  size_t first_part_size = fuzzed_data.ConsumeIntegral<uint16_t>();
  std::vector<uint8_t> first_part =
      fuzzed_data.ConsumeBytes<uint8_t>(first_part_size);
  std::vector<uint8_t> second_part =
      fuzzed_data.ConsumeRemainingBytes<uint8_t>();

  bssl::der::Input in1(first_part);
  bssl::der::Input in2(second_part);
  bool match = bssl::VerifyNameInSubtree(in1, in2);
  bool reverse_order_match = bssl::VerifyNameInSubtree(in2, in1);
  // If both InSubtree matches are true, then in1 == in2 (modulo normalization).
  if (match && reverse_order_match) {
    if (!bssl::VerifyNameMatch(in1, in2)) {
      abort();
    }
  }
  return 0;
}
