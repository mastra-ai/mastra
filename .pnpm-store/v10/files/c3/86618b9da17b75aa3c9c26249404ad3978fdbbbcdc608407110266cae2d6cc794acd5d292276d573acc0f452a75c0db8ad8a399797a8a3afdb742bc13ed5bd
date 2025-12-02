// Copyright 2016 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BSSL_PKI_OCSP_VERIFY_RESULT_H_
#define BSSL_PKI_OCSP_VERIFY_RESULT_H_

#include "fillins/openssl_util.h"

#include "ocsp_revocation_status.h"

namespace bssl {

// The result of OCSP verification. This always contains a ResponseStatus, which
// describes whether or not an OCSP response was provided, and response level
// errors. It optionally contains an OCSPRevocationStatus when |response_status
// = PROVIDED|. For example, a stapled OCSP response matching the certificate,
// and indicating a non-revoked status, will have |response_status = PROVIDED|
// and |revocation_status = GOOD|. This is populated as part of the certificate
// verification process, and should not be modified at other layers.
struct OPENSSL_EXPORT OCSPVerifyResult {
  OCSPVerifyResult();
  OCSPVerifyResult(const OCSPVerifyResult&);
  ~OCSPVerifyResult();

  bool operator==(const OCSPVerifyResult& other) const;

  // This value is histogrammed, so do not re-order or change values, and add
  // new values at the end.
  enum ResponseStatus {
    // OCSP verification was not checked on this connection.
    NOT_CHECKED = 0,

    // No OCSPResponse was stapled.
    MISSING = 1,

    // An up-to-date OCSP response was stapled and matched the certificate.
    PROVIDED = 2,

    // The stapled OCSP response did not have a SUCCESSFUL status.
    ERROR_RESPONSE = 3,

    // The OCSPResponseData field producedAt was outside the certificate
    // validity period.
    BAD_PRODUCED_AT = 4,

    // At least one OCSPSingleResponse was stapled, but none matched the
    // certificate.
    NO_MATCHING_RESPONSE = 5,

    // A matching OCSPSingleResponse was stapled, but was either expired or not
    // yet valid.
    INVALID_DATE = 6,

    // The OCSPResponse structure could not be parsed.
    PARSE_RESPONSE_ERROR = 7,

    // The OCSPResponseData structure could not be parsed.
    PARSE_RESPONSE_DATA_ERROR = 8,

    // Unhandled critical extension in either OCSPResponseData or
    // OCSPSingleResponse
    UNHANDLED_CRITICAL_EXTENSION = 9,
    RESPONSE_STATUS_MAX = UNHANDLED_CRITICAL_EXTENSION
  };

  ResponseStatus response_status = NOT_CHECKED;

  // The strictest CertStatus matching the certificate (REVOKED > UNKNOWN >
  // GOOD). Only valid if |response_status| = PROVIDED.
  OCSPRevocationStatus revocation_status = OCSPRevocationStatus::UNKNOWN;
};

}  // namespace net

#endif  // BSSL_PKI_OCSP_VERIFY_RESULT_H_
