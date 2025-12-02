// Copyright 2017 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "general_names.h"

#include <openssl/base.h>

#include <climits>
#include <cstring>

#include "cert_error_params.h"
#include "cert_errors.h"
#include "string_util.h"
#include "input.h"
#include "parser.h"
#include "tag.h"

namespace bssl {

DEFINE_CERT_ERROR_ID(kFailedParsingGeneralName, "Failed parsing GeneralName");

namespace {

DEFINE_CERT_ERROR_ID(kRFC822NameNotAscii, "rfc822Name is not ASCII");
DEFINE_CERT_ERROR_ID(kDnsNameNotAscii, "dNSName is not ASCII");
DEFINE_CERT_ERROR_ID(kURINotAscii, "uniformResourceIdentifier is not ASCII");
DEFINE_CERT_ERROR_ID(kFailedParsingIp, "Failed parsing iPAddress");
DEFINE_CERT_ERROR_ID(kUnknownGeneralNameType, "Unknown GeneralName type");
DEFINE_CERT_ERROR_ID(kFailedReadingGeneralNames,
                     "Failed reading GeneralNames SEQUENCE");
DEFINE_CERT_ERROR_ID(kGeneralNamesTrailingData,
                     "GeneralNames contains trailing data after the sequence");
DEFINE_CERT_ERROR_ID(kGeneralNamesEmpty,
                     "GeneralNames is a sequence of 0 elements");
DEFINE_CERT_ERROR_ID(kFailedReadingGeneralName,
                     "Failed reading GeneralName TLV");

// Return true if the bitmask |mask| contains only zeros after the first
// |prefix_length| bits.
bool IsSuffixZero(const fillins::IPAddressBytes& mask, unsigned prefix_length) {
  size_t zero_bits = mask.size() * CHAR_BIT - prefix_length;
  size_t zero_bytes = zero_bits / CHAR_BIT;
  // We allocate the vector one byte bigger than needed to ensure there is a
  // valid pointer to pass to memcmp for a zero length comparison.
  std::vector<uint8_t> zeros(zero_bytes + 1, 0);
  if (memcmp(zeros.data(), mask.data() + mask.size() - zero_bytes,
             zero_bytes)) {
    return false;
  }
  size_t leftover_bits = zero_bits % CHAR_BIT;
  if (leftover_bits) {
    uint8_t b = mask[mask.size() - zero_bytes - 1];
    for (size_t i = 0; i < leftover_bits; ++i) {
      if (b & (1 << i))
        return false;
    }
  }
  return true;
}

}  // namespace

GeneralNames::GeneralNames() = default;

GeneralNames::~GeneralNames() = default;

// static
std::unique_ptr<GeneralNames> GeneralNames::Create(
    const der::Input& general_names_tlv,
    CertErrors* errors) {
  BSSL_CHECK(errors);

  // RFC 5280 section 4.2.1.6:
  // GeneralNames ::= SEQUENCE SIZE (1..MAX) OF GeneralName
  der::Parser parser(general_names_tlv);
  der::Input sequence_value;
  if (!parser.ReadTag(der::kSequence, &sequence_value)) {
    errors->AddError(kFailedReadingGeneralNames);
    return nullptr;
  }
  // Should not have trailing data after GeneralNames sequence.
  if (parser.HasMore()) {
    errors->AddError(kGeneralNamesTrailingData);
    return nullptr;
  }
  return CreateFromValue(sequence_value, errors);
}

// static
std::unique_ptr<GeneralNames> GeneralNames::CreateFromValue(
    const der::Input& general_names_value,
    CertErrors* errors) {
  BSSL_CHECK(errors);

  auto general_names = std::make_unique<GeneralNames>();

  der::Parser sequence_parser(general_names_value);
  // The GeneralNames sequence should have at least 1 element.
  if (!sequence_parser.HasMore()) {
    errors->AddError(kGeneralNamesEmpty);
    return nullptr;
  }

  while (sequence_parser.HasMore()) {
    der::Input raw_general_name;
    if (!sequence_parser.ReadRawTLV(&raw_general_name)) {
      errors->AddError(kFailedReadingGeneralName);
      return nullptr;
    }

    if (!ParseGeneralName(raw_general_name, IP_ADDRESS_ONLY,
                          general_names.get(), errors)) {
      errors->AddError(kFailedParsingGeneralName);
      return nullptr;
    }
  }

  return general_names;
}

[[nodiscard]] bool ParseGeneralName(
    const der::Input& input,
    GeneralNames::ParseGeneralNameIPAddressType ip_address_type,
    GeneralNames* subtrees,
    CertErrors* errors) {
  BSSL_CHECK(errors);
  der::Parser parser(input);
  der::Tag tag;
  der::Input value;
  if (!parser.ReadTagAndValue(&tag, &value))
    return false;
  GeneralNameTypes name_type = GENERAL_NAME_NONE;
  if (tag == der::ContextSpecificConstructed(0)) {
    // otherName                       [0]     OtherName,
    name_type = GENERAL_NAME_OTHER_NAME;
    subtrees->other_names.push_back(value);
  } else if (tag == der::ContextSpecificPrimitive(1)) {
    // rfc822Name                      [1]     IA5String,
    name_type = GENERAL_NAME_RFC822_NAME;
    const std::string_view s = value.AsStringView();
    if (!bssl::string_util::IsAscii(s)) {
      errors->AddError(kRFC822NameNotAscii);
      return false;
    }
    subtrees->rfc822_names.push_back(s);
  } else if (tag == der::ContextSpecificPrimitive(2)) {
    // dNSName                         [2]     IA5String,
    name_type = GENERAL_NAME_DNS_NAME;
    const std::string_view s = value.AsStringView();
    if (!bssl::string_util::IsAscii(s)) {
      errors->AddError(kDnsNameNotAscii);
      return false;
    }
    subtrees->dns_names.push_back(s);
  } else if (tag == der::ContextSpecificConstructed(3)) {
    // x400Address                     [3]     ORAddress,
    name_type = GENERAL_NAME_X400_ADDRESS;
    subtrees->x400_addresses.push_back(value);
  } else if (tag == der::ContextSpecificConstructed(4)) {
    // directoryName                   [4]     Name,
    name_type = GENERAL_NAME_DIRECTORY_NAME;
    // Name is a CHOICE { rdnSequence  RDNSequence }, therefore the SEQUENCE
    // tag is explicit. Remove it, since the name matching functions expect
    // only the value portion.
    der::Parser name_parser(value);
    der::Input name_value;
    if (!name_parser.ReadTag(der::kSequence, &name_value) || parser.HasMore())
      return false;
    subtrees->directory_names.push_back(name_value);
  } else if (tag == der::ContextSpecificConstructed(5)) {
    // ediPartyName                    [5]     EDIPartyName,
    name_type = GENERAL_NAME_EDI_PARTY_NAME;
    subtrees->edi_party_names.push_back(value);
  } else if (tag == der::ContextSpecificPrimitive(6)) {
    // uniformResourceIdentifier       [6]     IA5String,
    name_type = GENERAL_NAME_UNIFORM_RESOURCE_IDENTIFIER;
    const std::string_view s = value.AsStringView();
    if (!bssl::string_util::IsAscii(s)) {
      errors->AddError(kURINotAscii);
      return false;
    }
    subtrees->uniform_resource_identifiers.push_back(s);
  } else if (tag == der::ContextSpecificPrimitive(7)) {
    // iPAddress                       [7]     OCTET STRING,
    name_type = GENERAL_NAME_IP_ADDRESS;
    if (ip_address_type == GeneralNames::IP_ADDRESS_ONLY) {
      // RFC 5280 section 4.2.1.6:
      // When the subjectAltName extension contains an iPAddress, the address
      // MUST be stored in the octet string in "network byte order", as
      // specified in [RFC791].  The least significant bit (LSB) of each octet
      // is the LSB of the corresponding byte in the network address.  For IP
      // version 4, as specified in [RFC791], the octet string MUST contain
      // exactly four octets.  For IP version 6, as specified in [RFC2460],
      // the octet string MUST contain exactly sixteen octets.
      if ((value.Length() != fillins::IPAddress::kIPv4AddressSize &&
           value.Length() != fillins::IPAddress::kIPv6AddressSize)) {
        errors->AddError(kFailedParsingIp);
        return false;
      }
      subtrees->ip_addresses.emplace_back(value.UnsafeData(), value.Length());
    } else {
      BSSL_CHECK(ip_address_type == GeneralNames::IP_ADDRESS_AND_NETMASK);
      // RFC 5280 section 4.2.1.10:
      // The syntax of iPAddress MUST be as described in Section 4.2.1.6 with
      // the following additions specifically for name constraints. For IPv4
      // addresses, the iPAddress field of GeneralName MUST contain eight (8)
      // octets, encoded in the style of RFC 4632 (CIDR) to represent an
      // address range [RFC4632]. For IPv6 addresses, the iPAddress field
      // MUST contain 32 octets similarly encoded. For example, a name
      // constraint for "class C" subnet 192.0.2.0 is represented as the
      // octets C0 00 02 00 FF FF FF 00, representing the CIDR notation
      // 192.0.2.0/24 (mask 255.255.255.0).
      if (value.Length() != fillins::IPAddress::kIPv4AddressSize * 2 &&
          value.Length() != fillins::IPAddress::kIPv6AddressSize * 2) {
        errors->AddError(kFailedParsingIp);
        return false;
      }
      const fillins::IPAddress mask(value.UnsafeData() + value.Length() / 2,
                           value.Length() / 2);
      const unsigned mask_prefix_length = MaskPrefixLength(mask);
      if (!IsSuffixZero(mask.bytes(), mask_prefix_length)) {
        errors->AddError(kFailedParsingIp);
        return false;
      }
      subtrees->ip_address_ranges.emplace_back(
          fillins::IPAddress(value.UnsafeData(), value.Length() / 2),
          mask_prefix_length);
    }
  } else if (tag == der::ContextSpecificPrimitive(8)) {
    // registeredID                    [8]     OBJECT IDENTIFIER }
    name_type = GENERAL_NAME_REGISTERED_ID;
    subtrees->registered_ids.push_back(value);
  } else {
    errors->AddError(kUnknownGeneralNameType,
                     CreateCertErrorParams1SizeT("tag", tag));
    return false;
  }
  BSSL_CHECK(GENERAL_NAME_NONE != name_type);
  subtrees->present_name_types |= name_type;
  return true;
}

}  // namespace net
