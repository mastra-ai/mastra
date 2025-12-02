// Copyright 2012 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BSSL_PKI_CERT_STATUS_FLAGS_H_
#define BSSL_PKI_CERT_STATUS_FLAGS_H_

#include "fillins/openssl_util.h"
#include <stdint.h>



namespace bssl {

// Bitmask of status flags of a certificate, representing any errors, as well as
// other non-error status information such as whether the certificate is EV.
typedef uint32_t CertStatus;

// NOTE: Because these names have appeared in bug reports, we preserve them as
// MACRO_STYLE for continuity, instead of renaming them to kConstantStyle as
// befits most static consts.
#define CERT_STATUS_FLAG(label, value) \
    CertStatus static const CERT_STATUS_##label = value;
#include "cert_status_flags_list.h"
#undef CERT_STATUS_FLAG

static const CertStatus CERT_STATUS_ALL_ERRORS = 0xFF00FFFF;

// Returns true if the specified cert status has an error set.
inline bool IsCertStatusError(CertStatus status) {
  return (CERT_STATUS_ALL_ERRORS & status) != 0;
}

// Maps a network error code to the equivalent certificate status flag. If
// the error code is not a certificate error, it is mapped to 0.
// Note: It is not safe to go bssl::CertStatus -> bssl::Error -> bssl::CertStatus,
// as the CertStatus contains more information. Conversely, going from
// bssl::Error -> bssl::CertStatus -> bssl::Error is not a lossy function, for the
// same reason.
// To avoid incorrect use, this is only exported for unittest helpers.
OPENSSL_EXPORT CertStatus MapNetErrorToCertStatus(int error);

// Maps the most serious certificate error in the certificate status flags
// to the equivalent network error code.
OPENSSL_EXPORT int MapCertStatusToNetError(CertStatus cert_status);

}  // namespace net

#endif  // BSSL_PKI_CERT_STATUS_FLAGS_H_
