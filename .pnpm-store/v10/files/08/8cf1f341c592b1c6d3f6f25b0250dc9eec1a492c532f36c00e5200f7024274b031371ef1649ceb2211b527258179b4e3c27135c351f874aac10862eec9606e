// Copyright 2016 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "ocsp_verify_result.h"

namespace bssl {

OCSPVerifyResult::OCSPVerifyResult() = default;
OCSPVerifyResult::OCSPVerifyResult(const OCSPVerifyResult&) = default;
OCSPVerifyResult::~OCSPVerifyResult() = default;

bool OCSPVerifyResult::operator==(const OCSPVerifyResult& other) const {
  if (response_status != other.response_status)
    return false;

  if (response_status == PROVIDED) {
    // |revocation_status| is only defined when |response_status| is PROVIDED.
    return revocation_status == other.revocation_status;
  }
  return true;
}

}  // namespace net
