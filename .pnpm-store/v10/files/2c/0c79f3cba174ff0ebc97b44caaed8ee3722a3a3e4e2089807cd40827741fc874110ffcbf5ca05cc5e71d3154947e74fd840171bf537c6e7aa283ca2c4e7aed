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

#include "forward_compat.hxx"

#include "internal/exceptions_internal.hxx"
#include "internal/logging.hxx"

#include "core/utils/split_string.hxx"

#include <chrono>
#include <thread>
#include <utility>
#include <vector>

namespace couchbase::core::transactions
{
struct forward_compat_behavior_full {
  forward_compat_behavior behavior;
  std::optional<std::chrono::milliseconds> retry_delay;

  forward_compat_behavior_full(forward_compat_behavior b,
                               std::optional<std::chrono::milliseconds> r)
    : behavior(b)
    , retry_delay(r)
  {
  }

  explicit forward_compat_behavior_full(const tao::json::value& j)
  {
    const std::string b = j.at("b").get_string();
    behavior = create_forward_compat_behavior(b);
    if (const auto* ra = j.find("ra"); ra != nullptr) {
      retry_delay = std::chrono::milliseconds(ra->get_unsigned());
    }
  }

  template<typename OStream>
  friend auto operator<<(OStream& os, const forward_compat_behavior_full& b) -> OStream&
  {
    os << "forward_compat_behavior_full:{";
    os << "behavior: " << forward_compat_behavior_name(b.behavior);
    if (b.retry_delay) {
      os << ", retry_delay: " << b.retry_delay->count() << " ms";
    }
    os << "}";
    return os;
  }
};

struct forward_compat_requirement {
  forward_compat_behavior_full behavior;

  explicit forward_compat_requirement(forward_compat_behavior_full b)
    : behavior(b)
  {
  }

  forward_compat_requirement(const forward_compat_requirement&) = default;
  forward_compat_requirement(forward_compat_requirement&&) = default;
  auto operator=(const forward_compat_requirement&) -> forward_compat_requirement& = default;
  auto operator=(forward_compat_requirement&&) -> forward_compat_requirement& = default;

  [[nodiscard]] virtual auto check(const forward_compat_supported& supported) const
    -> forward_compat_behavior_full = 0;
  virtual ~forward_compat_requirement() = default;
};

struct forward_compat_protocol_requirement : public forward_compat_requirement {
  std::uint64_t min_protocol_major;
  std::uint64_t min_protocol_minor;

  forward_compat_protocol_requirement(forward_compat_behavior_full b,
                                      unsigned long min_major,
                                      unsigned long min_minor)
    : forward_compat_requirement(b)
    , min_protocol_major(min_major)
    , min_protocol_minor(min_minor)
  {
  }

  [[nodiscard]] auto check(const forward_compat_supported& supported) const
    -> forward_compat_behavior_full override
  {
    if ((min_protocol_major > supported.protocol_major) ||
        (min_protocol_minor > supported.protocol_minor)) {
      return behavior;
    }
    return { forward_compat_behavior::CONTINUE, std::nullopt };
  }
};

struct forward_compat_extension_requirement : public forward_compat_requirement {
  std::string extension_id;

  forward_compat_extension_requirement(forward_compat_behavior_full b, std::string ext)
    : forward_compat_requirement(b)
    , extension_id(std::move(ext))
  {
  }

  [[nodiscard]] auto check(const forward_compat_supported& supported) const
    -> forward_compat_behavior_full override
  {
    auto it = std::find(supported.extensions.begin(), supported.extensions.end(), extension_id);
    if (it == supported.extensions.end()) {
      return behavior;
    }
    return { forward_compat_behavior::CONTINUE, std::nullopt };
  }
};

auto
create_forward_compat_stage(const std::string& str) -> forward_compat_stage
{
  if (str == "WW_R") {
    return forward_compat_stage::WRITE_WRITE_CONFLICT_READING_ATR;
  }
  if (str == "WW_RP") {
    return forward_compat_stage::WRITE_WRITE_CONFLICT_REPLACING;
  }
  if (str == "WW_RM") {
    return forward_compat_stage::WRITE_WRITE_CONFLICT_REMOVING;
  }
  if (str == "WW_I") {
    return forward_compat_stage::WRITE_WRITE_CONFLICT_INSERTING;
  }
  if (str == "WW_IG") {
    return forward_compat_stage::WRITE_WRITE_CONFLICT_INSERTING_GET;
  }
  if (str == "G") {
    return forward_compat_stage::GETS;
  }
  if (str == "G_A") {
    return forward_compat_stage::GETS_READING_ATR;
  }
  if (str == "CL_E") {
    return forward_compat_stage::CLEANUP_ENTRY;
  }
  if (str == "CM_C") {
    return forward_compat_stage::CAS_MISMATCH_DURING_COMMIT;
  }
  if (str == "CM_R") {
    return forward_compat_stage::CAS_MISMATCH_DURING_ROLLBACK;
  }
  if (str == "CM_S") {
    return forward_compat_stage::CAS_MISMATCH_DURING_STAGING;
  }
  if (str == "GM_G") {
    return forward_compat_stage::GET_MULTI_GET;
  }
  throw std::runtime_error(fmt::format("Unknown forward compatibility stage: {}", str));
}

class forward_compat
{
public:
  explicit forward_compat(tao::json::value& json)
    : json_(json)
  {
    CB_TXN_LOG_TRACE("creating forward_compat from {}", core::utils::json::generate(json_));
    // parse it into the map
    for (const auto& [key, value] : json_.get_object()) {
      auto stage = create_forward_compat_stage(key);
      // the value is an array of forward_compat_behavior_full objects
      for (const auto& item : value.get_array()) {
        const forward_compat_behavior_full behavior(item);
        if (const auto* b = item.find("b"); b != nullptr) {
          if (const auto* e = item.find("e")) {
            const std::string ext = e->get_string();
            compat_map_[stage].push_back(
              std::make_unique<forward_compat_extension_requirement>(behavior, ext));
          } else if (const auto* p = item.find("p")) {
            const std::string proto_string = p->get_string();
            auto proto = core::utils::split_string(proto_string, '.');
            compat_map_[stage].push_back(std::make_unique<forward_compat_protocol_requirement>(
              behavior, std::stoul(proto[0]), std::stoul(proto[1])));
          }
        }
      }
    }
  }

  auto check_internal(forward_compat_stage stage, const forward_compat_supported& supported)
    -> std::optional<transaction_operation_failed>
  {
    if (auto it = compat_map_.find(stage); it != compat_map_.end()) {
      transaction_operation_failed ex(FAIL_OTHER, "Forward Compatibililty failure");
      ex.cause(FORWARD_COMPATIBILITY_FAILURE);
      for (const auto& b : it->second) {
        auto behavior = b->check(supported);
        switch (behavior.behavior) {
          case forward_compat_behavior::FAIL_FAST_TXN:
            CB_TXN_LOG_TRACE("forward compatiblity FAIL_FAST_TXN");
            return ex;
          case forward_compat_behavior::RETRY_TXN:
            CB_TXN_LOG_TRACE("forward compatibility RETRY_TXN");
            if (behavior.retry_delay) {
              CB_TXN_LOG_TRACE("delay {}ms before retrying", behavior.retry_delay->count());
              std::this_thread::sleep_for(*behavior.retry_delay);
            }
            return ex.retry();
          case forward_compat_behavior::CONTINUE:
          default:
            break;
        }
      }
    }
    return std::nullopt;
  }

private:
  std::map<forward_compat_stage, std::list<std::unique_ptr<forward_compat_requirement>>>
    compat_map_;
  tao::json::value json_;
};

auto
check_forward_compat(forward_compat_stage stage, std::optional<tao::json::value> json)
  -> std::optional<transaction_operation_failed>
{
  if (json) {
    const forward_compat_supported supported;
    forward_compat fc(json.value());
    return fc.check_internal(stage, supported);
  }
  return std::nullopt;
}

auto
to_string(forward_compat_stage value) -> std::string
{
  switch (value) {
    case forward_compat_stage::WRITE_WRITE_CONFLICT_READING_ATR:
      return "WW_R";
    case forward_compat_stage::WRITE_WRITE_CONFLICT_REPLACING:
      return "WW_RP";
    case forward_compat_stage::WRITE_WRITE_CONFLICT_REMOVING:
      return "WW_RM";
    case forward_compat_stage::WRITE_WRITE_CONFLICT_INSERTING:
      return "WW_I";
    case forward_compat_stage::WRITE_WRITE_CONFLICT_INSERTING_GET:
      return "WW_IG";
    case forward_compat_stage::GETS:
      return "G";
    case forward_compat_stage::GETS_READING_ATR:
      return "G_A";
    case forward_compat_stage::CLEANUP_ENTRY:
      return "CL_E";
    case forward_compat_stage::CAS_MISMATCH_DURING_COMMIT:
      return "CM_C";
    case forward_compat_stage::CAS_MISMATCH_DURING_ROLLBACK:
      return "CM_R";
    case forward_compat_stage::CAS_MISMATCH_DURING_STAGING:
      return "CM_S";
    case forward_compat_stage::GET_MULTI_GET:
      return "GM_G";
  };
  throw std::runtime_error(
    fmt::format("Unknown forward compatibility stage: {}", static_cast<std::uint8_t>(value)));
}
auto
create_forward_compat_behavior(const std::string& str) -> forward_compat_behavior
{
  if (str == "r") {
    return forward_compat_behavior::RETRY_TXN;
  }
  return forward_compat_behavior::FAIL_FAST_TXN;
}
auto
forward_compat_behavior_name(forward_compat_behavior b) -> const char*
{
  switch (b) {
    case forward_compat_behavior::CONTINUE:
      return "CONTINUE";
    case forward_compat_behavior::RETRY_TXN:
      return "RETRY_TXN";
    case forward_compat_behavior::FAIL_FAST_TXN:
      return "FAIL_FAST_TRANSACTION";
  }
  return "unknown behavior";
}
} // namespace couchbase::core::transactions
