// Copyright 2015 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "parser.h"

#include "parse_values.h"
#include <openssl/base.h>

namespace bssl::der {

Parser::Parser() {
  CBS_init(&cbs_, nullptr, 0);
}

Parser::Parser(const Input& input) {
  CBS_init(&cbs_, input.UnsafeData(), input.Length());
}

bool Parser::PeekTagAndValue(Tag* tag, Input* out) {
  CBS peeker = cbs_;
  CBS tmp_out;
  size_t header_len;
  unsigned tag_value;
  if (!CBS_get_any_asn1_element(&peeker, &tmp_out, &tag_value, &header_len) ||
      !CBS_skip(&tmp_out, header_len)) {
    return false;
  }
  advance_len_ = CBS_len(&tmp_out) + header_len;
  *tag = tag_value;
  *out = Input(CBS_data(&tmp_out), CBS_len(&tmp_out));
  return true;
}

bool Parser::Advance() {
  if (advance_len_ == 0)
    return false;
  bool ret = !!CBS_skip(&cbs_, advance_len_);
  advance_len_ = 0;
  return ret;
}

bool Parser::HasMore() {
  return CBS_len(&cbs_) > 0;
}

bool Parser::ReadRawTLV(Input* out) {
  CBS tmp_out;
  if (!CBS_get_any_asn1_element(&cbs_, &tmp_out, nullptr, nullptr))
    return false;
  *out = Input(CBS_data(&tmp_out), CBS_len(&tmp_out));
  return true;
}

bool Parser::ReadTagAndValue(Tag* tag, Input* out) {
  if (!PeekTagAndValue(tag, out))
    return false;
  BSSL_CHECK(Advance());
  return true;
}

bool Parser::ReadOptionalTag(Tag tag, std::optional<Input>* out) {
  if (!HasMore()) {
    *out = std::nullopt;
    return true;
  }
  Tag actual_tag;
  Input value;
  if (!PeekTagAndValue(&actual_tag, &value)) {
    return false;
  }
  if (actual_tag == tag) {
    BSSL_CHECK(Advance());
    *out = value;
  } else {
    advance_len_ = 0;
    *out = std::nullopt;
  }
  return true;
}

bool Parser::ReadOptionalTag(Tag tag, Input* out, bool* present) {
  std::optional<Input> tmp_out;
  if (!ReadOptionalTag(tag, &tmp_out))
    return false;
  *present = tmp_out.has_value();
  *out = tmp_out.value_or(der::Input());
  return true;
}

bool Parser::SkipOptionalTag(Tag tag, bool* present) {
  Input out;
  return ReadOptionalTag(tag, &out, present);
}

bool Parser::ReadTag(Tag tag, Input* out) {
  Tag actual_tag;
  Input value;
  if (!PeekTagAndValue(&actual_tag, &value) || actual_tag != tag) {
    return false;
  }
  BSSL_CHECK(Advance());
  *out = value;
  return true;
}

bool Parser::SkipTag(Tag tag) {
  Input out;
  return ReadTag(tag, &out);
}

// Type-specific variants of ReadTag

bool Parser::ReadConstructed(Tag tag, Parser* out) {
  if (!IsConstructed(tag))
    return false;
  Input data;
  if (!ReadTag(tag, &data))
    return false;
  *out = Parser(data);
  return true;
}

bool Parser::ReadSequence(Parser* out) {
  return ReadConstructed(kSequence, out);
}

bool Parser::ReadUint8(uint8_t* out) {
  Input encoded_int;
  if (!ReadTag(kInteger, &encoded_int))
    return false;
  return ParseUint8(encoded_int, out);
}

bool Parser::ReadUint64(uint64_t* out) {
  Input encoded_int;
  if (!ReadTag(kInteger, &encoded_int))
    return false;
  return ParseUint64(encoded_int, out);
}

std::optional<BitString> Parser::ReadBitString() {
  Input value;
  if (!ReadTag(kBitString, &value))
    return std::nullopt;
  return ParseBitString(value);
}

bool Parser::ReadGeneralizedTime(GeneralizedTime* out) {
  Input value;
  if (!ReadTag(kGeneralizedTime, &value))
    return false;
  return ParseGeneralizedTime(value, out);
}

}  // namespace bssl::der
