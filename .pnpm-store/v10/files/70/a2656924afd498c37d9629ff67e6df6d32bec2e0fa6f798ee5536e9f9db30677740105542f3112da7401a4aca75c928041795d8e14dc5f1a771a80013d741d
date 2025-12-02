// Copyright 2016 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "parse_name.h"

#include <cassert>

#include "string_util.h"
#include "parse_values.h"
#include <openssl/bytestring.h>
#include <openssl/mem.h>

namespace bssl {

namespace {

// Returns a string containing the dotted numeric form of |oid|, or an empty
// string on error.
std::string OidToString(der::Input oid) {
  CBS cbs;
  CBS_init(&cbs, oid.UnsafeData(), oid.Length());
  bssl::UniquePtr<char> text(CBS_asn1_oid_to_text(&cbs));
  if (!text)
    return std::string();
  return text.get();
}

}  // namespace

bool X509NameAttribute::ValueAsString(std::string* out) const {
  switch (value_tag) {
    case der::kTeletexString:
      return der::ParseTeletexStringAsLatin1(value, out);
    case der::kIA5String:
      return der::ParseIA5String(value, out);
    case der::kPrintableString:
      return der::ParsePrintableString(value, out);
    case der::kUtf8String:
      *out = value.AsString();
      return true;
    case der::kUniversalString:
      return der::ParseUniversalString(value, out);
    case der::kBmpString:
      return der::ParseBmpString(value, out);
    default:
      return false;
  }
}

bool X509NameAttribute::ValueAsStringWithUnsafeOptions(
    PrintableStringHandling printable_string_handling,
    std::string* out) const {
  if (printable_string_handling == PrintableStringHandling::kAsUTF8Hack &&
      value_tag == der::kPrintableString) {
    *out = value.AsString();
    return true;
  }
  return ValueAsString(out);
}

bool X509NameAttribute::ValueAsStringUnsafe(std::string* out) const {
  switch (value_tag) {
    case der::kIA5String:
    case der::kPrintableString:
    case der::kTeletexString:
    case der::kUtf8String:
      *out = value.AsString();
      return true;
    case der::kUniversalString:
      return der::ParseUniversalString(value, out);
    case der::kBmpString:
      return der::ParseBmpString(value, out);
    default:
      assert(0);  // NOTREACHED
      return false;
  }
}

bool X509NameAttribute::AsRFC2253String(std::string* out) const {
  std::string type_string;
  std::string value_string;
  // TODO(mattm): Add streetAddress and domainComponent here?
  if (type == der::Input(kTypeCommonNameOid)) {
    type_string = "CN";
  } else if (type == der::Input(kTypeSurnameOid)) {
    type_string = "SN";
  } else if (type == der::Input(kTypeCountryNameOid)) {
    type_string = "C";
  } else if (type == der::Input(kTypeLocalityNameOid)) {
    type_string = "L";
  } else if (type == der::Input(kTypeStateOrProvinceNameOid)) {
    type_string = "ST";
  } else if (type == der::Input(kTypeOrganizationNameOid)) {
    type_string = "O";
  } else if (type == der::Input(kTypeOrganizationUnitNameOid)) {
    type_string = "OU";
  } else if (type == der::Input(kTypeGivenNameOid)) {
    type_string = "givenName";
  } else if (type == der::Input(kTypeEmailAddressOid)) {
    type_string = "emailAddress";
  } else {
    type_string = OidToString(type);
    if (type_string.empty())
      return false;
    value_string =
        "#" + bssl::string_util::HexEncode(value.UnsafeData(), value.Length());
  }

  if (value_string.empty()) {
    std::string unescaped;
    if (!ValueAsStringUnsafe(&unescaped))
      return false;

    bool nonprintable = false;
    for (unsigned int i = 0; i < unescaped.length(); ++i) {
      unsigned char c = static_cast<unsigned char>(unescaped[i]);
      if (i == 0 && c == '#') {
        value_string += "\\#";
      } else if (i == 0 && c == ' ') {
        value_string += "\\ ";
      } else if (i == unescaped.length() - 1 && c == ' ') {
        value_string += "\\ ";
      } else if (c == ',' || c == '+' || c == '"' || c == '\\' || c == '<' ||
                 c == '>' || c == ';') {
        value_string += "\\";
        value_string += c;
      } else if (c < 32 || c > 126) {
        nonprintable = true;
        std::string h;
        h += c;
        value_string +=
            "\\" + bssl::string_util::HexEncode(
                       reinterpret_cast<const uint8_t*>(h.data()), h.length());
      } else {
        value_string += c;
      }
    }

    // If we have non-printable characters in a TeletexString, we hex encode
    // since we don't handle Teletex control codes.
    if (nonprintable && value_tag == der::kTeletexString)
      value_string =
          "#" + bssl::string_util::HexEncode(value.UnsafeData(), value.Length());
  }

  *out = type_string + "=" + value_string;
  return true;
}

bool ReadRdn(der::Parser* parser, RelativeDistinguishedName* out) {
  while (parser->HasMore()) {
    der::Parser attr_type_and_value;
    if (!parser->ReadSequence(&attr_type_and_value))
      return false;
    // Read the attribute type, which must be an OBJECT IDENTIFIER.
    der::Input type;
    if (!attr_type_and_value.ReadTag(der::kOid, &type))
      return false;

    // Read the attribute value.
    der::Tag tag;
    der::Input value;
    if (!attr_type_and_value.ReadTagAndValue(&tag, &value))
      return false;

    // There should be no more elements in the sequence after reading the
    // attribute type and value.
    if (attr_type_and_value.HasMore())
      return false;

    out->push_back(X509NameAttribute(type, tag, value));
  }

  // RFC 5280 section 4.1.2.4
  // RelativeDistinguishedName ::= SET SIZE (1..MAX) OF AttributeTypeAndValue
  return out->size() != 0;
}

bool ParseName(const der::Input& name_tlv, RDNSequence* out) {
  der::Parser name_parser(name_tlv);
  der::Input name_value;
  if (!name_parser.ReadTag(der::kSequence, &name_value))
    return false;
  return ParseNameValue(name_value, out);
}

bool ParseNameValue(const der::Input& name_value, RDNSequence* out) {
  der::Parser rdn_sequence_parser(name_value);
  while (rdn_sequence_parser.HasMore()) {
    der::Parser rdn_parser;
    if (!rdn_sequence_parser.ReadConstructed(der::kSet, &rdn_parser))
      return false;
    RelativeDistinguishedName type_and_values;
    if (!ReadRdn(&rdn_parser, &type_and_values))
      return false;
    out->push_back(type_and_values);
  }

  return true;
}

bool ConvertToRFC2253(const RDNSequence& rdn_sequence, std::string* out) {
  std::string rdns_string;
  size_t size = rdn_sequence.size();
  for (size_t i = 0; i < size; ++i) {
    RelativeDistinguishedName rdn = rdn_sequence[size - i - 1];
    std::string rdn_string;
    for (const auto& atv : rdn) {
      if (!rdn_string.empty())
        rdn_string += "+";
      std::string atv_string;
      if (!atv.AsRFC2253String(&atv_string))
        return false;
      rdn_string += atv_string;
    }
    if (!rdns_string.empty())
      rdns_string += ",";
    rdns_string += rdn_string;
  }

  *out = rdns_string;
  return true;
}

}  // namespace net
