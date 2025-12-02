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

#pragma once

#include <couchbase/error.hxx>

#include <cstddef>
#include <utility>
#include <vector>

namespace couchbase::crypto::internal
{
auto
generate_initialization_vector() -> std::pair<error, std::vector<std::byte>>;

namespace aead_aes_256_cbc_hmac_sha512
{
auto
encrypt(std::vector<std::byte> key,
        std::vector<std::byte> iv,
        std::vector<std::byte> plaintext,
        std::vector<std::byte> associated_data) -> std::pair<error, std::vector<std::byte>>;

auto
decrypt(std::vector<std::byte> key,
        std::vector<std::byte> ciphertext,
        std::vector<std::byte> associated_data) -> std::pair<error, std::vector<std::byte>>;
} // namespace aead_aes_256_cbc_hmac_sha512
} // namespace couchbase::crypto::internal
