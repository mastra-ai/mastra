// Copyright 2015 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "input.h"

#include <algorithm>

#include <openssl/base.h>

namespace bssl::der {

std::string Input::AsString() const {
  return std::string(reinterpret_cast<const char*>(data_.data()), data_.size());
}

std::string_view Input::AsStringView() const {
  return std::string_view(reinterpret_cast<const char*>(data_.data()),
                          data_.size());
}

bssl::Span<const uint8_t> Input::AsSpan() const {
  return data_;
}

bool operator==(const Input& lhs, const Input& rhs) {
  return lhs.Length() == rhs.Length() &&
         std::equal(lhs.UnsafeData(), lhs.UnsafeData() + lhs.Length(),
                    rhs.UnsafeData());
}

bool operator!=(const Input& lhs, const Input& rhs) {
  return !(lhs == rhs);
}

ByteReader::ByteReader(const Input& in)
    : data_(in.UnsafeData()), len_(in.Length()) {
}

bool ByteReader::ReadByte(uint8_t* byte_p) {
  if (!HasMore())
    return false;
  *byte_p = *data_;
  Advance(1);
  return true;
}

bool ByteReader::ReadBytes(size_t len, Input* out) {
  if (len > len_)
    return false;
  *out = Input(data_, len);
  Advance(len);
  return true;
}

// Returns whether there is any more data to be read.
bool ByteReader::HasMore() {
  return len_ > 0;
}

void ByteReader::Advance(size_t len) {
  BSSL_CHECK(len <= len_);
  data_ += len;
  len_ -= len;
}

}  // namespace bssl::der
