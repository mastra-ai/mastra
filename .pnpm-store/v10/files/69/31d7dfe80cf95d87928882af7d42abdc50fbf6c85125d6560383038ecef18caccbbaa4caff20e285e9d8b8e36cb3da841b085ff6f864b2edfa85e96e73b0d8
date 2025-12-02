// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "ip_address.h"

#include <stdlib.h>
#include <string.h>
#include <climits>

#include <openssl/base.h>

namespace bssl {

namespace fillins {

IPAddress::IPAddress() {}

IPAddress::IPAddress(const uint8_t *address, size_t address_len)
    : addr_(reinterpret_cast<const char *>(address), address_len) {}

IPAddress::IPAddress(uint8_t b0, uint8_t b1, uint8_t b2, uint8_t b3) {
  addr_.reserve(4);
  addr_.push_back(b0);
  addr_.push_back(b1);
  addr_.push_back(b2);
  addr_.push_back(b3);
}

IPAddress::IPAddress(uint8_t b0, uint8_t b1, uint8_t b2, uint8_t b3, uint8_t b4,
                     uint8_t b5, uint8_t b6, uint8_t b7, uint8_t b8, uint8_t b9,
                     uint8_t b10, uint8_t b11, uint8_t b12, uint8_t b13,
                     uint8_t b14, uint8_t b15) {
  addr_.reserve(16);
  addr_.push_back(b0);
  addr_.push_back(b1);
  addr_.push_back(b2);
  addr_.push_back(b3);
  addr_.push_back(b4);
  addr_.push_back(b5);
  addr_.push_back(b6);
  addr_.push_back(b7);
  addr_.push_back(b8);
  addr_.push_back(b9);
  addr_.push_back(b10);
  addr_.push_back(b11);
  addr_.push_back(b12);
  addr_.push_back(b13);
  addr_.push_back(b14);
  addr_.push_back(b15);
}

// static
IPAddress IPAddress::AllZeros(size_t num_zero_bytes) {
  BSSL_CHECK(num_zero_bytes <= 16u);
  IPAddress result;
  result.addr_.reserve(num_zero_bytes);
  for (size_t i = 0; i < num_zero_bytes; ++i) {
    result.addr_.push_back(0u);
  }
  return result;
}

// static
IPAddress IPAddress::IPv4AllZeros() { return AllZeros(kIPv4AddressSize); }

bool IPAddress::IsIPv4() const { return addr_.size() == kIPv4AddressSize; }

bool IPAddress::IsIPv6() const { return addr_.size() == kIPv6AddressSize; }

bool IPAddress::IsValid() const { return IsIPv4() || IsIPv6(); }

const uint8_t *IPAddress::data() const {
  return reinterpret_cast<const uint8_t *>(addr_.data());
}

size_t IPAddress::size() const { return addr_.size(); }

const IPAddressBytes &IPAddress::bytes() const { return addr_; }

static IPAddress ConvertIPv4ToIPv4MappedIPv6(const IPAddress &address) {
  BSSL_CHECK(address.IsIPv4());
  // IPv4-mapped addresses are formed by:
  // <80 bits of zeros>  + <16 bits of ones> + <32-bit IPv4 address>.
  uint8_t bytes[16];
  memset(bytes, 0, 10);
  memset(bytes + 10, 0xff, 2);
  memcpy(bytes + 12, address.data(), address.size());
  return IPAddress(bytes, sizeof(bytes));
}

// Note that this function assumes:
// * |ip_address| is at least |prefix_length_in_bits| (bits) long;
// * |ip_prefix| is at least |prefix_length_in_bits| (bits) long.
static bool IPAddressPrefixCheck(const uint8_t *ip_address,
                                 const uint8_t *ip_prefix,
                                 size_t prefix_length_in_bits) {
  // Compare all the bytes that fall entirely within the prefix.
  size_t num_entire_bytes_in_prefix = prefix_length_in_bits / 8;
  for (size_t i = 0; i < num_entire_bytes_in_prefix; ++i) {
    if (ip_address[i] != ip_prefix[i]) {
      return false;
    }
  }

  // In case the prefix was not a multiple of 8, there will be 1 byte
  // which is only partially masked.
  size_t remaining_bits = prefix_length_in_bits % 8;
  if (remaining_bits != 0) {
    uint8_t mask = 0xFF << (8 - remaining_bits);
    size_t i = num_entire_bytes_in_prefix;
    if ((ip_address[i] & mask) != (ip_prefix[i] & mask)) {
      return false;
    }
  }

  return true;
}

bool IPAddressMatchesPrefix(const IPAddress &ip_address,
                            const IPAddress &ip_prefix,
                            size_t prefix_length_in_bits) {
  // Both the input IP address and the prefix IP address should be either IPv4
  // or IPv6.
  BSSL_CHECK(ip_address.IsValid());
  BSSL_CHECK(ip_prefix.IsValid());

  BSSL_CHECK(prefix_length_in_bits <= ip_prefix.size() * 8);

  // In case we have an IPv6 / IPv4 mismatch, convert the IPv4 addresses to
  // IPv6 addresses in order to do the comparison.
  if (ip_address.size() != ip_prefix.size()) {
    if (ip_address.IsIPv4()) {
      return IPAddressMatchesPrefix(ConvertIPv4ToIPv4MappedIPv6(ip_address),
                                    ip_prefix, prefix_length_in_bits);
    }
    return IPAddressMatchesPrefix(ip_address,
                                  ConvertIPv4ToIPv4MappedIPv6(ip_prefix),
                                  96 + prefix_length_in_bits);
  }

  return IPAddressPrefixCheck(ip_address.data(), ip_prefix.data(),
                              prefix_length_in_bits);
}

static unsigned CommonPrefixLength(const IPAddress &a1, const IPAddress &a2) {
  BSSL_CHECK(a1.size() == a2.size());
  for (size_t i = 0; i < a1.size(); ++i) {
    uint8_t diff = a1.bytes()[i] ^ a2.bytes()[i];
    if (!diff)
      continue;
    for (unsigned j = 0; j < CHAR_BIT; ++j) {
      if (diff & (1 << (CHAR_BIT - 1)))
        return i * CHAR_BIT + j;
      diff <<= 1;
    }
    abort();
  }
  return a1.size() * CHAR_BIT;
}

unsigned MaskPrefixLength(const IPAddress &mask) {
  uint8_t all_ones[16];
  const size_t mask_len = std::min(mask.size(), sizeof(all_ones));
  memset(all_ones, 0xff, mask_len);
  return CommonPrefixLength(mask, IPAddress(all_ones, mask_len));
}

}  // namespace fillins

}  // namespace bssl
