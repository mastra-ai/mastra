// Copyright 2015 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BSSL_PKI_VERIFY_NAME_MATCH_H_
#define BSSL_PKI_VERIFY_NAME_MATCH_H_

#include "fillins/openssl_util.h"
#include <string>
#include <vector>



namespace bssl {

class CertErrors;

namespace der {
class Input;
}  // namespace der

// Normalizes DER-encoded X.501 Name |name_rdn_sequence| (which should not
// include the Sequence tag).  If successful, returns true and stores the
// normalized DER-encoded Name into |normalized_rdn_sequence| (not including an
// outer Sequence tag). Returns false if there was an error parsing or
// normalizing the input, and adds error information to |errors|. |errors| must
// be non-null.
OPENSSL_EXPORT bool NormalizeName(const der::Input& name_rdn_sequence,
                              std::string* normalized_rdn_sequence,
                              CertErrors* errors);

// Compares DER-encoded X.501 Name values according to RFC 5280 rules.
// |a_rdn_sequence| and |b_rdn_sequence| should be the DER-encoded RDNSequence
// values (not including the Sequence tag).
// Returns true if |a_rdn_sequence| and |b_rdn_sequence| match.
OPENSSL_EXPORT bool VerifyNameMatch(const der::Input& a_rdn_sequence,
                                const der::Input& b_rdn_sequence);

// Compares |name_rdn_sequence| and |parent_rdn_sequence| and return true if
// |name_rdn_sequence| is within the subtree defined by |parent_rdn_sequence| as
// defined by RFC 5280 section 7.1. |name_rdn_sequence| and
// |parent_rdn_sequence| should be the DER-encoded sequence values (not
// including the Sequence tag).
OPENSSL_EXPORT bool VerifyNameInSubtree(const der::Input& name_rdn_sequence,
                                    const der::Input& parent_rdn_sequence);

// Helper functions:

// Find all emailAddress attribute values in |name_rdn_sequence|.
// Returns true if parsing was successful, in which case
// |*contained_email_address| will contain zero or more values.  The values
// returned in |*contained_email_addresses| will be UTF8 strings and have been
// checked that they were valid strings for the string type of the attribute
// tag, but otherwise have not been validated.
// Returns false if there was a parsing error.
[[nodiscard]] bool FindEmailAddressesInName(
    const der::Input& name_rdn_sequence,
    std::vector<std::string>* contained_email_addresses);

}  // namespace net

#endif  // BSSL_PKI_VERIFY_NAME_MATCH_H_
