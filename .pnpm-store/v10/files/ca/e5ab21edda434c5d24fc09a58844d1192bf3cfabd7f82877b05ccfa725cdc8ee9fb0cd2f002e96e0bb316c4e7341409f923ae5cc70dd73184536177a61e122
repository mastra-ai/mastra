// Copyright 2015 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "extended_key_usage.h"

#include "input.h"
#include "parser.h"
#include "tag.h"

namespace bssl {

bool ParseEKUExtension(const der::Input& extension_value,
                       std::vector<der::Input>* eku_oids) {
  der::Parser extension_parser(extension_value);
  der::Parser sequence_parser;
  if (!extension_parser.ReadSequence(&sequence_parser))
    return false;

  // Section 4.2.1.12 of RFC 5280 defines ExtKeyUsageSyntax as:
  // ExtKeyUsageSyntax ::= SEQUENCE SIZE (1..MAX) OF KeyPurposeId
  //
  // Therefore, the sequence must contain at least one KeyPurposeId.
  if (!sequence_parser.HasMore())
    return false;
  while (sequence_parser.HasMore()) {
    der::Input eku_oid;
    if (!sequence_parser.ReadTag(der::kOid, &eku_oid))
      // The SEQUENCE OF must contain only KeyPurposeIds (OIDs).
      return false;
    eku_oids->push_back(eku_oid);
  }
  if (extension_parser.HasMore())
    // The extension value must follow ExtKeyUsageSyntax - there is no way that
    // it could be extended to allow for something after the SEQUENCE OF.
    return false;
  return true;
}

}  // namespace net
