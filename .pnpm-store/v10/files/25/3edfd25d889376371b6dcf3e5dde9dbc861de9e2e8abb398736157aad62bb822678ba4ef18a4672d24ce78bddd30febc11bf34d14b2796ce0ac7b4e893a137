// Copyright 2015 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BSSL_DER_TAG_H_
#define BSSL_DER_TAG_H_

#include "fillins/openssl_util.h"
#include <stdint.h>


#include <openssl/bytestring.h>

namespace bssl::der {

// This Tag type represents the identifier for an ASN.1 tag as encoded with
// DER. It matches the BoringSSL CBS and CBB in-memory representation for a
// tag.
//
// Callers must not assume it matches the DER representation for small tag
// numbers. Instead, constants are provided for universal class types, and
// functions are provided for building context specific tags. Tags can also be
// built from the provided constants and bitmasks.
using Tag = unsigned;

// Universal class primitive types
const Tag kBool = CBS_ASN1_BOOLEAN;
const Tag kInteger = CBS_ASN1_INTEGER;
const Tag kBitString = CBS_ASN1_BITSTRING;
const Tag kOctetString = CBS_ASN1_OCTETSTRING;
const Tag kNull = CBS_ASN1_NULL;
const Tag kOid = CBS_ASN1_OBJECT;
const Tag kEnumerated = CBS_ASN1_ENUMERATED;
const Tag kUtf8String = CBS_ASN1_UTF8STRING;
const Tag kPrintableString = CBS_ASN1_PRINTABLESTRING;
const Tag kTeletexString = CBS_ASN1_T61STRING;
const Tag kIA5String = CBS_ASN1_IA5STRING;
const Tag kUtcTime = CBS_ASN1_UTCTIME;
const Tag kGeneralizedTime = CBS_ASN1_GENERALIZEDTIME;
const Tag kVisibleString = CBS_ASN1_VISIBLESTRING;
const Tag kUniversalString = CBS_ASN1_UNIVERSALSTRING;
const Tag kBmpString = CBS_ASN1_BMPSTRING;

// Universal class constructed types
const Tag kSequence = CBS_ASN1_SEQUENCE;
const Tag kSet = CBS_ASN1_SET;

// Primitive/constructed bits
const unsigned kTagPrimitive = 0x00;
const unsigned kTagConstructed = CBS_ASN1_CONSTRUCTED;

// Tag classes
const unsigned kTagUniversal = 0x00;
const unsigned kTagApplication = CBS_ASN1_APPLICATION;
const unsigned kTagContextSpecific = CBS_ASN1_CONTEXT_SPECIFIC;
const unsigned kTagPrivate = CBS_ASN1_PRIVATE;

// Masks for the 3 components of a tag (class, primitive/constructed, number)
const unsigned kTagNumberMask = CBS_ASN1_TAG_NUMBER_MASK;
const unsigned kTagConstructionMask = CBS_ASN1_CONSTRUCTED;
const unsigned kTagClassMask = CBS_ASN1_CLASS_MASK;

// Creates the value for the outer tag of an explicitly tagged type.
//
// The ASN.1 keyword for this is:
//     [tag_number] EXPLICIT
//
// (Note, the EXPLICIT may be omitted if the entire schema is in
// EXPLICIT mode, the default)
OPENSSL_EXPORT Tag ContextSpecificConstructed(uint8_t tag_number);

OPENSSL_EXPORT Tag ContextSpecificPrimitive(uint8_t base);

OPENSSL_EXPORT bool IsConstructed(Tag tag);

}  // namespace bssl::der

#endif  // BSSL_DER_TAG_H_
