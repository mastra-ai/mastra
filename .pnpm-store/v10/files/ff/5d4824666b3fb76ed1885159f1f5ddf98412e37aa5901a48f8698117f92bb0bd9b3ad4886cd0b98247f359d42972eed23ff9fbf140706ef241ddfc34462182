/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-Present Couchbase, Inc.
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

#include <couchbase/error_codes.hxx>

#include <string>
#include <system_error>

namespace couchbase::core::impl
{

struct field_level_encryption_error_category : std::error_category {
  [[nodiscard]] auto name() const noexcept -> const char* override
  {
    return "couchbase.field_level_encryption";
  }

  [[nodiscard]] auto message(int ev) const noexcept -> std::string override
  {
    switch (static_cast<errc::field_level_encryption>(ev)) {
      case errc::field_level_encryption::generic_cryptography_failure:
        return "generic_cryptography_failure (700)";
      case errc::field_level_encryption::encryption_failure:
        return "encryption_failure (701)";
      case errc::field_level_encryption::decryption_failure:
        return "decryption_failure (702)";
      case errc::field_level_encryption::crypto_key_not_found:
        return "crypto_key_not_found (703)";
      case errc::field_level_encryption::invalid_crypto_key:
        return "invalid_crypto_key (704)";
      case errc::field_level_encryption::decrypter_not_found:
        return "decrypter_not_found (705)";
      case errc::field_level_encryption::encrypter_not_found:
        return "encrypter_not_found (706)";
      case errc::field_level_encryption::invalid_ciphertext:
        return "invalid_ciphertext (707)";
    }
    return "FIXME: unknown error code (recompile with newer library): "
           "couchbase.field_level_encryption." +
           std::to_string(ev);
  }
};

const inline static field_level_encryption_error_category category_instance;

auto
field_level_encryption_category() noexcept -> const std::error_category&
{
  return category_instance;
}

} // namespace couchbase::core::impl
