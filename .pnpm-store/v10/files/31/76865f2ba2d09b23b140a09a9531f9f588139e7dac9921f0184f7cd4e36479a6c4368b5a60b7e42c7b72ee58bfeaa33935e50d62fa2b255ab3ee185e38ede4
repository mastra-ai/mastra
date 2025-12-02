/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2016 Couchbase, Inc.
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
#pragma once

#include <cstdint>
#include <string>

namespace couchbase::core::crypto
{
enum class Algorithm {
  ALG_SHA1,
  ALG_SHA256,
  ALG_SHA512
};

auto
isSupported(Algorithm algorithm) -> bool;

const int SHA1_DIGEST_SIZE = 20;
const int SHA256_DIGEST_SIZE = 32;
const int SHA512_DIGEST_SIZE = 64;

/**
 * Generate a HMAC digest of the key and data by using the given
 * algorithm
 *
 * @throws std::invalid_argument - unsupported algorithm
 *         std::runtime_error - Failures generating the HMAC
 */
auto
CBC_HMAC(Algorithm algorithm, std::string_view key, std::string_view data) -> std::string;

/**
 * Generate a PBKDF2_HMAC digest of the key and data by using the given
 * algorithm
 *
 * @throws std::invalid_argument - unsupported algorithm
 *         std::runtime_error - Failures generating the HMAC
 */
auto
PBKDF2_HMAC(Algorithm algorithm,
            const std::string& pass,
            std::string_view salt,
            unsigned int iterationCount) -> std::string;

/**
 * Generate a digest by using the requested algorithm
 */
auto
digest(Algorithm algorithm, std::string_view data) -> std::string;

enum class Cipher {
  AES_256_cbc
};

auto
to_cipher(const std::string& str) -> Cipher;

/**
 * Encrypt the specified data by using a given cipher
 *
 * @param cipher The cipher to use
 * @param key The key used for encryption
 * @param ivec The IV to use for encryption
 * @param data The Pointer to the data to encrypt
 * @return The encrypted data
 */
auto
encrypt(Cipher cipher, std::string_view key, std::string_view iv, std::string_view data)
  -> std::string;

/**
 * Decrypt the specified data by using a given cipher
 *
 * @param cipher The cipher to use
 * @param key The key used for encryption
 * @param ivec The IV to use for encryption
 * @param data The data to decrypt
 * @return The decrypted data
 */
auto
decrypt(Cipher cipher, std::string_view key, std::string_view iv, std::string_view data)
  -> std::string;

} // namespace couchbase::core::crypto
