// Copyright 2015 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BSSL_DER_INPUT_H_
#define BSSL_DER_INPUT_H_

#include "fillins/openssl_util.h"
#include <stddef.h>
#include <stdint.h>

#include <string>
#include <string_view>


#include <openssl/span.h>

namespace bssl::der {

// An opaque class that represents a fixed buffer of data of a fixed length,
// to be used as an input to other operations. An Input object does not own
// the data it references, so callers are responsible for making sure that
// the data outlives the Input object and any other associated objects.
//
// All data access for an Input should be done through the ByteReader class.
// This class and associated classes are designed with safety in mind to make it
// difficult to read memory outside of an Input. ByteReader provides a simple
// API for reading through the Input sequentially. For more complicated uses,
// multiple instances of a ByteReader for a particular Input can be created.
class OPENSSL_EXPORT Input {
 public:
  // Creates an empty Input, one from which no data can be read.
  constexpr Input() = default;

  // Creates an Input from a span. The constructed Input is only valid as long
  // as |data| points to live memory. If constructed from, say, a
  // |std::vector<uint8_t>|, mutating the vector will invalidate the Input.
  constexpr explicit Input(bssl::Span<const uint8_t> data) : data_(data) {}

  // Creates an Input from the given |data| and |len|.
  constexpr explicit Input(const uint8_t* data, size_t len)
      : data_(bssl::MakeConstSpan(data, len)) {}

  // Creates an Input from a std::string_view. The constructed Input is only
  // valid as long as |data| points to live memory. If constructed from, say, a
  // |std::string|, mutating the vector will invalidate the Input.
  explicit Input(std::string_view str)
      : data_(bssl::MakeConstSpan(reinterpret_cast<const uint8_t*>(str.data()),
                                  str.size())) {}

  // Returns the length in bytes of an Input's data.
  constexpr size_t Length() const { return data_.size(); }

  // Returns a pointer to the Input's data. This method is marked as "unsafe"
  // because access to the Input's data should be done through ByteReader
  // instead. This method should only be used where using a ByteReader truly
  // is not an option.
  constexpr const uint8_t* UnsafeData() const { return data_.data(); }

  constexpr uint8_t operator[](size_t idx) const { return data_[idx]; }

  // Returns a copy of the data represented by this object as a std::string.
  std::string AsString() const;

  // Returns a std::string_view pointing to the same data as the Input. The
  // resulting string_view must not outlive the data that was used to construct
  // this Input.
  std::string_view AsStringView() const;

  // Returns a span pointing to the same data as the Input. The resulting span
  // must not outlive the data that was used to construct this Input.
  bssl::Span<const uint8_t> AsSpan() const;

 private:
  // TODO(crbug.com/770501): Replace this type with span altogether.
  bssl::Span<const uint8_t> data_;
};

// Return true if |lhs|'s data and |rhs|'s data are byte-wise equal.
OPENSSL_EXPORT bool operator==(const Input& lhs, const Input& rhs);

// Return true if |lhs|'s data and |rhs|'s data are not byte-wise equal.
OPENSSL_EXPORT bool operator!=(const Input& lhs, const Input& rhs);

// Returns true if |lhs|'s data is lexicographically less than |rhs|'s data.
OPENSSL_EXPORT constexpr bool operator<(const Input& lhs,
                                            const Input& rhs) {
  // This is `std::lexicographical_compare`, but that's not `constexpr` until
  // C++-20.
  auto* it1 = lhs.UnsafeData();
  auto* it2 = rhs.UnsafeData();
  const auto* end1 = lhs.UnsafeData() + lhs.Length();
  const auto* end2 = rhs.UnsafeData() + rhs.Length();
  for (; it1 != end1 && it2 != end2; ++it1, ++it2) {
    if (*it1 < *it2) {
      return true;
    } else if (*it2 < *it1) {
      return false;
    }
  }

  return it2 != end2;
}

// This class provides ways to read data from an Input in a bounds-checked way.
// The ByteReader is designed to read through the input sequentially. Once a
// byte has been read with a ByteReader, the caller can't go back and re-read
// that byte with the same reader. Of course, the caller can create multiple
// ByteReaders for the same input (or copy an existing ByteReader).
//
// For something simple like a single byte lookahead, the easiest way to do
// that is to copy the ByteReader and call ReadByte() on the copy - the original
// ByteReader will be unaffected and the peeked byte will be read through
// ReadByte(). For other read patterns, it can be useful to mark where one is
// in a ByteReader to be able to return to that spot.
//
// Some operations using Mark can also be done by creating a copy of the
// ByteReader. By using a Mark instead, you use less memory, but more
// importantly, you end up with an immutable object that matches the semantics
// of what is intended.
class OPENSSL_EXPORT ByteReader {
 public:
  // Creates a ByteReader to read the data represented by an Input.
  explicit ByteReader(const Input& in);

  // Reads a single byte from the input source, putting the byte read in
  // |*byte_p|. If a byte cannot be read from the input (because there is
  // no input left), then this method returns false.
  [[nodiscard]] bool ReadByte(uint8_t* out);

  // Reads |len| bytes from the input source, and initializes an Input to
  // point to that data. If there aren't enough bytes left in the input source,
  // then this method returns false.
  [[nodiscard]] bool ReadBytes(size_t len, Input* out);

  // Returns how many bytes are left to read.
  size_t BytesLeft() const { return len_; }

  // Returns whether there is any more data to be read.
  bool HasMore();

 private:
  void Advance(size_t len);

  const uint8_t* data_;
  size_t len_;
};

}  // namespace bssl::der

#endif  // BSSL_DER_INPUT_H_
