// Copyright 2019 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BSSL_PKI_REVOCATION_UTIL_H_
#define BSSL_PKI_REVOCATION_UTIL_H_

#include "fillins/openssl_util.h"

#include <optional>

#include <cstdint>

namespace bssl {

namespace der {
struct GeneralizedTime;
}

// Returns true if a revocation status with |this_update| field and potentially
// a |next_update| field, is valid at POSIX time |verify_time_epoch_seconds| and
// not older than |max_age_seconds| seconds, if specified. Expressed
// differently, returns true if |this_update <= verify_time < next_update|, and
// |this_update >= verify_time - max_age|.
[[nodiscard]] OPENSSL_EXPORT bool CheckRevocationDateValid(
    const der::GeneralizedTime& this_update,
    const der::GeneralizedTime* next_update,
    int64_t verify_time_epoch_seconds,
    std::optional<int64_t> max_age_seconds);

}  // namespace net

#endif  // BSSL_PKI_REVOCATION_UTIL_H_
