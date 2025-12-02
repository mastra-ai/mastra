// Copyright 2012 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BSSL_PKI_ASN1_UTIL_H_
#define BSSL_PKI_ASN1_UTIL_H_

#include "fillins/openssl_util.h"
#include <string_view>



namespace bssl::asn1 {

// ExtractSubjectFromDERCert parses the DER encoded certificate in |cert| and
// extracts the bytes of the X.501 Subject. On successful return, |subject_out|
// is set to contain the Subject, pointing into |cert|.
OPENSSL_EXPORT bool ExtractSubjectFromDERCert(
    std::string_view cert,
    std::string_view* subject_out);

// ExtractSPKIFromDERCert parses the DER encoded certificate in |cert| and
// extracts the bytes of the SubjectPublicKeyInfo. On successful return,
// |spki_out| is set to contain the SPKI, pointing into |cert|.
OPENSSL_EXPORT bool ExtractSPKIFromDERCert(std::string_view cert,
                                               std::string_view* spki_out);

// ExtractSubjectPublicKeyFromSPKI parses the DER encoded SubjectPublicKeyInfo
// in |spki| and extracts the bytes of the SubjectPublicKey. On successful
// return, |spk_out| is set to contain the public key, pointing into |spki|.
OPENSSL_EXPORT bool ExtractSubjectPublicKeyFromSPKI(
    std::string_view spki,
    std::string_view* spk_out);

// HasCanSignHttpExchangesDraftExtension parses the DER encoded certificate
// in |cert| and extracts the canSignHttpExchangesDraft extension
// (https://wicg.github.io/webpackage/draft-yasskin-http-origin-signed-responses.html)
// if present. Returns true if the extension was present, and false if
// the extension was not present or if there was a parsing failure.
OPENSSL_EXPORT bool HasCanSignHttpExchangesDraftExtension(std::string_view cert);

// Extracts the two (SEQUENCE) tag-length-values for the signature
// AlgorithmIdentifiers in a DER encoded certificate. Does not use strict
// parsing or validate the resulting AlgorithmIdentifiers.
//
// On success returns true, and assigns |cert_signature_algorithm_sequence| and
// |tbs_signature_algorithm_sequence| to point into |cert|:
//
// * |cert_signature_algorithm_sequence| points at the TLV for
//   Certificate.signatureAlgorithm.
//
// * |tbs_signature_algorithm_sequence| points at the TLV for
//   TBSCertificate.algorithm.
OPENSSL_EXPORT bool ExtractSignatureAlgorithmsFromDERCert(
    std::string_view cert,
    std::string_view* cert_signature_algorithm_sequence,
    std::string_view* tbs_signature_algorithm_sequence);

// Extracts the contents of the extension (if any) with OID |extension_oid| from
// the DER-encoded, X.509 certificate in |cert|.
//
// Returns false on parse error or true if the parse was successful. Sets
// |*out_extension_present| to whether or not the extension was found. If found,
// sets |*out_extension_critical| to match the extension's "critical" flag, and
// sets |*out_contents| to the contents of the extension (after unwrapping the
// OCTET STRING).
OPENSSL_EXPORT bool ExtractExtensionFromDERCert(std::string_view cert,
                                            std::string_view extension_oid,
                                            bool* out_extension_present,
                                            bool* out_extension_critical,
                                            std::string_view* out_contents);

}  // namespace bssl::asn1

#endif // BSSL_PKI_ASN1_UTIL_H_
