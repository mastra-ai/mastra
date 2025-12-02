// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BSSL_FILLINS_IP_ADDRESS
#define BSSL_FILLINS_IP_ADDRESS

#include <openssl/base.h>

#include <stddef.h>
#include <stdint.h>

#include <string>

namespace bssl {

namespace fillins {

typedef std::string IPAddressBytes;

class OPENSSL_EXPORT IPAddress {
 public:
  enum : size_t { kIPv4AddressSize = 4, kIPv6AddressSize = 16 };

  OPENSSL_EXPORT IPAddress();
  OPENSSL_EXPORT IPAddress(const uint8_t *address, size_t address_len);
  OPENSSL_EXPORT IPAddress(uint8_t b0, uint8_t b1, uint8_t b2, uint8_t b3);
  OPENSSL_EXPORT IPAddress(uint8_t b0, uint8_t b1, uint8_t b2, uint8_t b3,
                           uint8_t b4, uint8_t b5, uint8_t b6, uint8_t b7,
                           uint8_t b8, uint8_t b9, uint8_t b10, uint8_t b11,
                           uint8_t b12, uint8_t b13, uint8_t b14, uint8_t b15);

  static IPAddress IPv4AllZeros();

  OPENSSL_EXPORT bool IsIPv4() const;
  OPENSSL_EXPORT bool IsIPv6() const;
  OPENSSL_EXPORT bool IsValid() const;

  OPENSSL_EXPORT const uint8_t *data() const;
  OPENSSL_EXPORT size_t size() const;
  OPENSSL_EXPORT const IPAddressBytes &bytes() const;

  OPENSSL_EXPORT bool operator==(const IPAddress &other) const {
    return addr_ == other.addr_;
  }

 private:
  static IPAddress AllZeros(size_t num_zero_bytes);
  std::string addr_;
};

OPENSSL_EXPORT bool IPAddressMatchesPrefix(const IPAddress &ip_address,
                                           const IPAddress &ip_prefix,
                                           size_t prefix_length_in_bits);

OPENSSL_EXPORT unsigned MaskPrefixLength(const IPAddress &mask);

}  // namespace fillins

}  // namespace bssl

#endif  // BSSL_FILLINS_IP_ADDRESS
