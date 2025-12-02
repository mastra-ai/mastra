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

#pragma once

#include <couchbase/tls_verify_mode.hxx>

#include <optional>
#include <string>

namespace couchbase
{
class security_options
{
public:
  auto enabled(bool enabled) -> security_options&
  {
    enabled_ = enabled;
    return *this;
  }

  auto tls_verify(tls_verify_mode mode) -> security_options&
  {
    tls_verify_ = mode;
    return *this;
  }

  auto trust_certificate(std::string certificate_path) -> security_options&
  {
    trust_certificate_ = certificate_path;
    return *this;
  }

  auto trust_certificate_value(std::string certificate_value) -> security_options&
  {
    trust_certificate_value_ = certificate_value;
    return *this;
  }

  struct built {
    bool enabled;
    tls_verify_mode tls_verify;
    std::optional<std::string> trust_certificate;
    std::optional<std::string> trust_certificate_value;
    bool disable_mozilla_ca_certificates;
    bool disable_deprecated_protocols;
    bool disable_tls_v1_2;
  };

  [[nodiscard]] auto build() const -> built
  {
    return {
      enabled_,
      tls_verify_,
      trust_certificate_,
      trust_certificate_value_,
      disable_mozilla_ca_certificates_,
      disable_deprecated_protocols,
      disable_tls_v1_2,
    };
  }

private:
  bool enabled_{ true };
  tls_verify_mode tls_verify_{ tls_verify_mode::peer };
  std::optional<std::string> trust_certificate_{};
  std::optional<std::string> trust_certificate_value_{};
  bool disable_mozilla_ca_certificates_{ false };
  bool disable_deprecated_protocols{ true };
  bool disable_tls_v1_2{ false };
};
} // namespace couchbase
