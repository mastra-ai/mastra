// Copyright 2016 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BSSL_DER_ENCODE_VALUES_H_
#define BSSL_DER_ENCODE_VALUES_H_

#include "fillins/openssl_util.h"
#include <stddef.h>
#include <stdint.h>



namespace bssl::der {

struct GeneralizedTime;

// Encodes |posix_time|, a posix time in seconds, to DER |generalized_time|, for
// comparing against other GeneralizedTime objects, returning true on success or
// false if |posix_time| is outside of the range from year 0000 to 9999.
OPENSSL_EXPORT bool EncodePosixTimeAsGeneralizedTime(
    int64_t posix_time,
    GeneralizedTime* generalized_time);

// Converts a GeneralizedTime struct to a posix time in seconds in |result|,
// returning true on success or false if |generalized| was invalid or cannot be
// represented as a posix time in the range from the year 0000 to 9999.
OPENSSL_EXPORT bool GeneralizedTimeToPosixTime(
    const der::GeneralizedTime& generalized,
    int64_t* result);

static const size_t kGeneralizedTimeLength = 15;

// Encodes |time| to |out| as a DER GeneralizedTime value. Returns true on
// success and false on error.
OPENSSL_EXPORT bool EncodeGeneralizedTime(const GeneralizedTime& time,
                                      uint8_t out[kGeneralizedTimeLength]);

static const size_t kUTCTimeLength = 13;

// Encodes |time| to |out| as a DER UTCTime value. Returns true on success and
// false on error.
OPENSSL_EXPORT bool EncodeUTCTime(const GeneralizedTime& time,
                              uint8_t out[kUTCTimeLength]);

}  // namespace bssl::der

#endif  // BSSL_DER_ENCODE_VALUES_H_
