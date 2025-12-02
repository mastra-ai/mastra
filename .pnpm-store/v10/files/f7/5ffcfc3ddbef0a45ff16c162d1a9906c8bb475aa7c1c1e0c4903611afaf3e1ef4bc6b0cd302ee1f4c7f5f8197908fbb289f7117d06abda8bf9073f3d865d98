/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2025 Couchbase, Inc.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

#include <couchbase/build_config.hxx>
#include <couchbase/crypto/internal.hxx>
#include <couchbase/error_codes.hxx>

#include "core/crypto/cbcrypto.h"
#include "core/mcbp/big_endian.hxx"
#include "core/utils/binary.hxx"

#include "include_ssl/rand.h"
#include <spdlog/fmt/bundled/format.h>

namespace couchbase::crypto::internal
{
auto
generate_initialization_vector() -> std::pair<error, std::vector<std::byte>>
{

  std::vector<std::byte> iv{ 16 };
#ifdef COUCHBASE_CXX_CLIENT_STATIC_BORINGSSL
  auto iv_size = iv.size();
#else
  auto iv_size = static_cast<int>(iv.size());
#endif
  if (RAND_bytes(reinterpret_cast<unsigned char*>(iv.data()), iv_size) != 1) {
    return { error{ errc::field_level_encryption::encryption_failure,
                    "Failed to generate random initialization vector" },
             {} };
  }
  return { {}, iv };
}

auto
aead_aes_256_cbc_hmac_sha512::encrypt(std::vector<std::byte> key,
                                      std::vector<std::byte> iv,
                                      std::vector<std::byte> plaintext,
                                      std::vector<std::byte> associated_data)
  -> std::pair<error, std::vector<std::byte>>
{
  if (key.size() != 64) {
    return {
      error{ errc::field_level_encryption::invalid_crypto_key, "Key must be 64 bytes long." }, {}
    };
  }

  std::vector<std::byte> ciphertext;
  try {
    auto aes_key = std::vector<std::byte>{ key.begin() + 32, key.end() };
    ciphertext = core::utils::to_binary(
      core::crypto::encrypt(core::crypto::Cipher::AES_256_cbc,
                            { reinterpret_cast<char*>(aes_key.data()), aes_key.size() },
                            { reinterpret_cast<char*>(iv.data()), iv.size() },
                            { reinterpret_cast<char*>(plaintext.data()), plaintext.size() }));
  } catch (const std::exception& e) {
    return { error{ errc::field_level_encryption::encryption_failure,
                    fmt::format("Encryption failed: {}", e.what()) },
             {} };
  }

  ciphertext.insert(ciphertext.begin(), iv.begin(), iv.end());

  std::vector<std::byte> associated_data_length{ sizeof(std::uint64_t) };
  core::mcbp::big_endian::put_uint64(associated_data_length, associated_data.size() * 8); // In bits

  std::vector<std::byte> digest_data;
  digest_data.reserve(associated_data.size() + ciphertext.size() + sizeof(std::uint64_t));
  digest_data.insert(digest_data.end(), associated_data.begin(), associated_data.end());
  digest_data.insert(digest_data.end(), ciphertext.begin(), ciphertext.end());
  digest_data.insert(
    digest_data.end(), associated_data_length.begin(), associated_data_length.end());

  std::vector<std::byte> auth_tag;
  try {
    auto hmac_key = std::vector<std::byte>{ key.begin(), key.begin() + 32 };
    auth_tag = core::utils::to_binary(
      core::crypto::CBC_HMAC(core::crypto::Algorithm::ALG_SHA512,
                             { reinterpret_cast<char*>(hmac_key.data()), hmac_key.size() },
                             { reinterpret_cast<char*>(digest_data.data()), digest_data.size() }));
  } catch (const std::exception& e) {
    return { error{ errc::field_level_encryption::encryption_failure,
                    fmt::format("Generating the HMAC SHA-512 auth tag failed: {}", e.what()) },
             {} };
  }

  if (auth_tag.size() != 64) {
    return { { errc::field_level_encryption::encryption_failure,
               fmt::format("Unexpected HMAC-SHA512 auth tag size: expected 64 bytes, got {}.",
                           auth_tag.size()) },
             {} };
  }

  // We append the first 32 bytes of the auth tag to the ciphertext to get the authenticated
  // ciphertext
  ciphertext.insert(ciphertext.end(), auth_tag.begin(), auth_tag.begin() + 32);

  return { {}, ciphertext };
}

auto
aead_aes_256_cbc_hmac_sha512::decrypt(std::vector<std::byte> key,
                                      std::vector<std::byte> ciphertext,
                                      std::vector<std::byte> associated_data)
  -> std::pair<error, std::vector<std::byte>>
{
  if (ciphertext.size() < 48) {
    return { error{ errc::field_level_encryption::invalid_ciphertext,
                    "ciphertext is not long enough to include auth tag and IV." },
             {} };
  }
  if (key.size() != 64) {
    return {
      error{ errc::field_level_encryption::invalid_crypto_key, "key must be 64 bytes long." }, {}
    };
  }

  std::vector<std::byte> associated_data_length{ sizeof(std::uint64_t) };
  core::mcbp::big_endian::put_uint64(associated_data_length, associated_data.size() * 8); // In bits

  const auto expected_auth_tag = std::vector<std::byte>{ ciphertext.end() - 32, ciphertext.end() };
  ciphertext.erase(ciphertext.end() - 32, ciphertext.end());

  std::vector<std::byte> digest_data;
  digest_data.reserve(associated_data.size() + ciphertext.size() + sizeof(std::uint64_t));
  digest_data.insert(digest_data.end(), associated_data.begin(), associated_data.end());
  digest_data.insert(digest_data.end(), ciphertext.begin(), ciphertext.end());
  digest_data.insert(
    digest_data.end(), associated_data_length.begin(), associated_data_length.end());

  std::vector<std::byte> auth_tag;
  try {
    auto hmac_key = std::vector<std::byte>{ key.begin(), key.begin() + 32 };
    auth_tag = core::utils::to_binary(
      core::crypto::CBC_HMAC(core::crypto::Algorithm::ALG_SHA512,
                             { reinterpret_cast<char*>(hmac_key.data()), hmac_key.size() },
                             { reinterpret_cast<char*>(digest_data.data()), digest_data.size() }));
  } catch (const std::exception& e) {
    return { error{ errc::field_level_encryption::decryption_failure,
                    fmt::format("Generating the HMAC SHA-512 auth tag failed: {}.", e.what()) },
             {} };
  }

  if (auth_tag.size() != 64) {
    return { { errc::field_level_encryption::decryption_failure,
               fmt::format("Unexpected HMAC-SHA512 auth tag size: expected 64 bytes, got {}.",
                           auth_tag.size()) },
             {} };
  }

  // Time-constant comparison of auth_tag and expected_auth_tag
  bool auth_tag_matches = true;
  for (std::size_t i = 0; i < expected_auth_tag.size(); ++i) {
    auth_tag_matches &= auth_tag.at(i) == expected_auth_tag.at(i);
  }
  if (!auth_tag_matches) {
    return { error{ errc::field_level_encryption::invalid_ciphertext,
                    "Invalid HMAC SHA-512 auth tag." },
             {} };
  }

  std::vector<std::byte> plaintext;
  try {
    auto iv = std::vector<std::byte>{ ciphertext.begin(), ciphertext.begin() + 16 };
    ciphertext.erase(ciphertext.begin(), ciphertext.begin() + 16);

    auto aes_key = std::vector<std::byte>{ key.begin() + 32, key.end() };
    plaintext = core::utils::to_binary(
      core::crypto::decrypt(core::crypto::Cipher::AES_256_cbc,
                            { reinterpret_cast<char*>(aes_key.data()), aes_key.size() },
                            { reinterpret_cast<char*>(iv.data()), iv.size() },
                            { reinterpret_cast<char*>(ciphertext.data()), ciphertext.size() }));
  } catch (const std::exception& e) {
    return { error{ errc::field_level_encryption::decryption_failure,
                    fmt::format("Decryption failed: {}", e.what()) },
             {} };
  }
  return { {}, plaintext };
}
} // namespace couchbase::crypto::internal
