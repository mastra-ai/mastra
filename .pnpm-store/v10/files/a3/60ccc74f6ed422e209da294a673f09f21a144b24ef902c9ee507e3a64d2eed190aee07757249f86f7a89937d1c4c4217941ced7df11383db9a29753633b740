/*
 *     Copyright 2021-Present Couchbase, Inc.
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

#include <spdlog/fmt/bundled/core.h>

#include <string>
#include <vector>

namespace couchbase::core::transactions
{
/**
 *  Represents details about client records
 */
struct client_record_details {
  std::string client_uuid;
  std::uint32_t num_active_clients;
  std::uint32_t index_of_this_client;
  std::uint32_t num_existing_clients;
  std::uint32_t num_expired_clients;
  bool client_is_new;
  std::vector<std::string> expired_client_ids;
  bool override_enabled;
  bool override_active;
  std::uint64_t override_expires;
  std::uint64_t cas_now_nanos;

  template<typename OStream>
  friend auto operator<<(OStream& os, const client_record_details& details) -> OStream&
  {
    os << "client_record_details{";
    os << "client_uuid: " << details.client_uuid;
    os << ", num_active_clients: " << details.num_active_clients;
    os << ", index_of_this_client: " << details.index_of_this_client;
    os << ", num_existing_clients: " << details.num_existing_clients;
    os << ", num_expired_clients: " << details.num_expired_clients;
    os << ", override_enabled: " << details.override_enabled;
    os << ", override_expires: " << details.override_expires;
    os << ", cas_now_nanos: " << details.cas_now_nanos;
    os << ", expired_client_ids: [";
    for (const auto& id : details.expired_client_ids) {
      os << id << ",";
    }
    os << "]}";
    return os;
  }
};
} // namespace couchbase::core::transactions
template<>
struct fmt::formatter<couchbase::core::transactions::client_record_details> {
public:
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(const couchbase::core::transactions::client_record_details& r,
              FormatContext& ctx) const
  {
    return format_to(
      ctx.out(),
      "client_record:{{ client_uuid:: {}, active_clients: {}, index_of_this_client: {}, "
      "existing_clients: {}, "
      "expired_clients: {}, override_enabled: {}, override_expires: {}, cas_now_nanos: {} }}",
      r.client_uuid,
      r.num_active_clients,
      r.index_of_this_client,
      r.num_existing_clients,
      r.num_expired_clients,
      r.override_enabled,
      r.override_expires,
      r.cas_now_nanos);
  }
};
