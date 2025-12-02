// Copyright 2015 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BSSL_PKI_NAME_CONSTRAINTS_H_
#define BSSL_PKI_NAME_CONSTRAINTS_H_

#include "fillins/openssl_util.h"
#include <stdint.h>

#include <memory>

#include "fillins/ip_address.h"

#include "general_names.h"

namespace bssl {

class CertErrors;

namespace der {
class Input;
}  // namespace der

// Parses a NameConstraints extension value and allows testing whether names are
// allowed under those constraints as defined by RFC 5280 section 4.2.1.10.
class OPENSSL_EXPORT NameConstraints {
 public:
  ~NameConstraints();

  // Parses a DER-encoded NameConstraints extension and initializes this object.
  // |extension_value| should be the extnValue from the extension (not including
  // the OCTET STRING tag). |is_critical| should be true if the extension was
  // marked critical. Returns nullptr if parsing the the extension failed.
  // The object may reference data from |extension_value|, so is only valid as
  // long as |extension_value| is.
  static std::unique_ptr<NameConstraints> Create(
      const der::Input& extension_value,
      bool is_critical,
      CertErrors* errors);

  // Tests if a certificate is allowed by the name constraints.
  // |subject_rdn_sequence| should be the DER-encoded value of the subject's
  // RDNSequence (not including Sequence tag), and may be an empty ASN.1
  // sequence. |subject_alt_names| should be the parsed representation of the
  // subjectAltName extension or nullptr if the extension was not present.
  // If the certificate is not allowed, an error will be added to |errors|.
  // Note that this method does not check hostname or IP address in commonName,
  // which is deprecated (crbug.com/308330).
  void IsPermittedCert(const der::Input& subject_rdn_sequence,
                       const GeneralNames* subject_alt_names,
                       CertErrors* errors) const;

  // Returns true if the ASCII email address |name| is permitted. |name| should
  // be a "mailbox" as specified by RFC 2821, with the additional restriction
  // that quoted names and whitespace are not allowed by this implementation.
  bool IsPermittedRfc822Name(std::string_view name,
                             bool case_insensitive_exclude_localpart) const;

  // Returns true if the ASCII hostname |name| is permitted.
  // |name| may be a wildcard hostname (starts with "*."). Eg, "*.bar.com"
  // would not be permitted if "bar.com" is permitted and "foo.bar.com" is
  // excluded, while "*.baz.com" would only be permitted if "baz.com" is
  // permitted.
  bool IsPermittedDNSName(std::string_view name) const;

  // Returns true if the directoryName |name_rdn_sequence| is permitted.
  // |name_rdn_sequence| should be the DER-encoded RDNSequence value (not
  // including the Sequence tag.)
  bool IsPermittedDirectoryName(const der::Input& name_rdn_sequence) const;

  // Returns true if the iPAddress |ip| is permitted.
  bool IsPermittedIP(const fillins::IPAddress& ip) const;

  // Returns a bitfield of GeneralNameTypes of all the types constrained by this
  // NameConstraints. Name types that aren't supported will only be present if
  // the name constraint they appeared in was marked critical.
  //
  // RFC 5280 section 4.2.1.10 says:
  // Applications conforming to this profile MUST be able to process name
  // constraints that are imposed on the directoryName name form and SHOULD be
  // able to process name constraints that are imposed on the rfc822Name,
  // uniformResourceIdentifier, dNSName, and iPAddress name forms.
  // If a name constraints extension that is marked as critical
  // imposes constraints on a particular name form, and an instance of
  // that name form appears in the subject field or subjectAltName
  // extension of a subsequent certificate, then the application MUST
  // either process the constraint or reject the certificate.
  int constrained_name_types() const { return constrained_name_types_; }

  const GeneralNames& permitted_subtrees() const { return permitted_subtrees_; }
  const GeneralNames& excluded_subtrees() const { return excluded_subtrees_; }

 private:
  [[nodiscard]] bool Parse(const der::Input& extension_value,
                           bool is_critical,
                           CertErrors* errors);

  GeneralNames permitted_subtrees_;
  GeneralNames excluded_subtrees_;
  int constrained_name_types_ = GENERAL_NAME_NONE;
};

}  // namespace net

#endif  // BSSL_PKI_NAME_CONSTRAINTS_H_
