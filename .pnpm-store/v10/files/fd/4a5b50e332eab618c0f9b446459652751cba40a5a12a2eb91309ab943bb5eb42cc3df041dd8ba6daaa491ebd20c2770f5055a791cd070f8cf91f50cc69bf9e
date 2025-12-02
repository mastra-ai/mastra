/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * Copyright 2024-Present Couchbase, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

#include "app_telemetry_meter.hxx"

#include "logger/logger.hxx"
#include "meta/version.hxx"
#include "topology/configuration.hxx"
#include "utils/json.hxx"

#include <spdlog/fmt/bin_to_hex.h>
#include <spdlog/fmt/bundled/core.h>
#include <tao/json/to_string.hpp>
#include <tao/json/value.hpp>

#include <array>
#include <atomic>
#include <chrono>
#include <map>
#include <mutex>
#include <utility>

namespace couchbase::core
{
struct node_labels {
  std::string node;
  std::optional<std::string> alt_node;
};

class app_telemetry_meter_impl
{
public:
  app_telemetry_meter_impl() = default;
  app_telemetry_meter_impl(app_telemetry_meter_impl&&) = delete;
  app_telemetry_meter_impl(const app_telemetry_meter_impl&) = delete;
  auto operator=(app_telemetry_meter_impl&&) -> app_telemetry_meter_impl& = delete;
  auto operator=(const app_telemetry_meter_impl&) -> app_telemetry_meter_impl& = delete;
  virtual ~app_telemetry_meter_impl() = default;

  virtual auto enabled() -> bool = 0;
  [[nodiscard]] virtual auto current_node_labels() const -> std::map<std::string, node_labels> = 0;
  virtual void set_node_labels_cache(std::map<std::string, node_labels>) = 0;
  virtual auto nothing_to_report() -> bool = 0;
  virtual void update_config(const topology::configuration& config) = 0;
  virtual auto value_recorder(const std::string& node_uuid, const std::string& bucket_name)
    -> std::shared_ptr<app_telemetry_value_recorder> = 0;
  virtual void generate_to(std::vector<std::byte>& output_buffer, const std::string& agent) = 0;
};

namespace detail
{
class byte_appender
{
public:
  using iterator_category = std::output_iterator_tag;
  using value_type = void;

  explicit byte_appender(std::vector<std::byte>& output)
    : buffer_{ output }
  {
  }

  auto operator=(char ch) -> byte_appender&
  {
    buffer_.push_back(static_cast<std::byte>(ch));
    return *this;
  }

  auto operator*() -> byte_appender&
  {
    return *this;
  }

  auto operator++() const -> byte_appender
  {
    return *this;
  }

  auto operator++(int) const -> byte_appender
  {
    return *this;
  }

private:
  std::vector<std::byte>& buffer_;
};
} // namespace detail
} // namespace couchbase::core

template<>
struct fmt::detail::is_output_iterator<couchbase::core::detail::byte_appender, char>
  : std::true_type {
};

namespace couchbase::core
{
namespace
{
struct kv_non_durable_histogram {
  const char* name;
  std::atomic_uint64_t le_1ms{};
  std::atomic_uint64_t le_10ms{};
  std::atomic_uint64_t le_100ms{};
  std::atomic_uint64_t le_500ms{};
  std::atomic_uint64_t le_1s{};
  std::atomic_uint64_t le_2_5s{};
  std::atomic_uint64_t inf{};
  std::atomic_uint64_t sum{};
  std::atomic_uint64_t count{};

  void generate_to(detail::byte_appender& output,
                   const std::string& node_uuid,
                   const node_labels& labels,
                   const std::string& bucket,
                   const std::string& agent)
  {
    if (count > 0) {
      std::string lbuf{};
      fmt::format_to(back_inserter(lbuf), "node_uuid=\"{}\"", node_uuid);
      if (!labels.node.empty()) {
        fmt::format_to(back_inserter(lbuf), ",node=\"{}\"", labels.node);
      }
      if (const auto& alt = labels.alt_node; alt && !alt->empty()) {
        fmt::format_to(back_inserter(lbuf), ",alt_node=\"{}\"", alt.value());
      }
      if (!bucket.empty()) {
        fmt::format_to(back_inserter(lbuf), ",bucket=\"{}\"", bucket);
      }
      fmt::format_to(back_inserter(lbuf), ",agent={}", agent);
      fmt::format_to(output, "{}_bucket{{le=\"1\",{}}} {}\n", name, lbuf, le_1ms.load());
      fmt::format_to(output, "{}_bucket{{le=\"10\",{}}} {}\n", name, lbuf, le_10ms.load());
      fmt::format_to(output, "{}_bucket{{le=\"100\",{}}} {}\n", name, lbuf, le_100ms.load());
      fmt::format_to(output, "{}_bucket{{le=\"500\",{}}} {}\n", name, lbuf, le_500ms.load());
      fmt::format_to(output, "{}_bucket{{le=\"1000\",{}}} {}\n", name, lbuf, le_1s.load());
      fmt::format_to(output, "{}_bucket{{le=\"2500\",{}}} {}\n", name, lbuf, le_2_5s.load());
      fmt::format_to(output, "{}_bucket{{le=\"+Inf\",{}}} {}\n", name, lbuf, inf.load());
      fmt::format_to(output, "{}_sum{{{}}} {}\n", name, lbuf, sum.load());
      fmt::format_to(output, "{}_count{{{}}} {}\n", name, lbuf, count.load());
    }
  }
};

struct kv_durable_histogram {
  const char* name;
  std::atomic_uint64_t le_10ms{};
  std::atomic_uint64_t le_100ms{};
  std::atomic_uint64_t le_500ms{};
  std::atomic_uint64_t le_1s{};
  std::atomic_uint64_t le_2s{};
  std::atomic_uint64_t le_10s{};
  std::atomic_uint64_t inf{};
  std::atomic_uint64_t sum{};
  std::atomic_uint64_t count{};

  void generate_to(detail::byte_appender& output,
                   const std::string& node_uuid,
                   const node_labels& labels,
                   const std::string& bucket,
                   const std::string& agent)
  {
    if (count > 0) {
      std::string lbuf{};
      fmt::format_to(back_inserter(lbuf), "node_uuid=\"{}\"", node_uuid);
      if (!labels.node.empty()) {
        fmt::format_to(back_inserter(lbuf), ",node=\"{}\"", labels.node);
      }
      if (const auto& alt = labels.alt_node; alt && !alt->empty()) {
        fmt::format_to(back_inserter(lbuf), ",alt_node=\"{}\"", alt.value());
      }
      if (!bucket.empty()) {
        fmt::format_to(back_inserter(lbuf), ",bucket=\"{}\"", bucket);
      }
      fmt::format_to(back_inserter(lbuf), ",agent={}", agent);
      fmt::format_to(output, "{}_bucket{{le=\"10\",{}}} {}\n", name, lbuf, le_10ms.load());
      fmt::format_to(output, "{}_bucket{{le=\"100\",{}}} {}\n", name, lbuf, le_100ms.load());
      fmt::format_to(output, "{}_bucket{{le=\"500\",{}}} {}\n", name, lbuf, le_500ms.load());
      fmt::format_to(output, "{}_bucket{{le=\"1000\",{}}} {}\n", name, lbuf, le_1s.load());
      fmt::format_to(output, "{}_bucket{{le=\"2000\",{}}} {}\n", name, lbuf, le_2s.load());
      fmt::format_to(output, "{}_bucket{{le=\"10000\",{}}} {}\n", name, lbuf, le_10s.load());
      fmt::format_to(output, "{}_bucket{{le=\"+Inf\",{}}} {}\n", name, lbuf, inf.load());
      fmt::format_to(output, "{}_sum{{{}}} {}\n", name, lbuf, sum.load());
      fmt::format_to(output, "{}_count{{{}}} {}\n", name, lbuf, count.load());
    }
  }
};

struct http_histogram {
  const char* name;
  std::atomic_uint64_t le_100ms{};
  std::atomic_uint64_t le_1s{};
  std::atomic_uint64_t le_10s{};
  std::atomic_uint64_t le_30s{};
  std::atomic_uint64_t le_75s{};
  std::atomic_uint64_t inf{};
  std::atomic_uint64_t sum{};
  std::atomic_uint64_t count{};

  void generate_to(detail::byte_appender& output,
                   const std::string& node_uuid,
                   const node_labels& labels,
                   const std::string& bucket,
                   const std::string& agent)
  {
    if (count > 0) {
      std::string lbuf{};
      fmt::format_to(back_inserter(lbuf), "node_uuid=\"{}\"", node_uuid);
      if (!labels.node.empty()) {
        fmt::format_to(back_inserter(lbuf), ",node=\"{}\"", labels.node);
      }
      if (const auto& alt = labels.alt_node; alt && !alt->empty()) {
        fmt::format_to(back_inserter(lbuf), ",alt_node=\"{}\"", alt.value());
      }
      if (!bucket.empty()) {
        fmt::format_to(back_inserter(lbuf), ",bucket=\"{}\"", bucket);
      }
      fmt::format_to(back_inserter(lbuf), ",agent={}", agent);
      fmt::format_to(output, "{}_bucket{{le=\"100\",{}}} {}\n", name, lbuf, le_100ms.load());
      fmt::format_to(output, "{}_bucket{{le=\"1000\",{}}} {}\n", name, lbuf, le_1s.load());
      fmt::format_to(output, "{}_bucket{{le=\"10000\",{}}} {}\n", name, lbuf, le_10s.load());
      fmt::format_to(output, "{}_bucket{{le=\"30000\",{}}} {}\n", name, lbuf, le_30s.load());
      fmt::format_to(output, "{}_bucket{{le=\"75000\",{}}} {}\n", name, lbuf, le_75s.load());
      fmt::format_to(output, "{}_bucket{{le=\"+Inf\",{}}} {}\n", name, lbuf, inf.load());
      fmt::format_to(output, "{}_sum{{{}}} {}\n", name, lbuf, sum.load() / 1000);
      fmt::format_to(output, "{}_count{{{}}} {}\n", name, lbuf, count.load());
    }
  }
};

constexpr auto max_number_of_counters{ static_cast<std::size_t>(
  app_telemetry_counter::number_of_elements) };

constexpr auto
is_valid_app_telemetry_counter(std::size_t name) -> bool
{
  return name > static_cast<std::size_t>(app_telemetry_counter::unknown) &&
         name < static_cast<std::size_t>(app_telemetry_counter::number_of_elements);
}

constexpr auto
app_telemetry_counter_name(std::size_t name) -> const char*
{
  switch (static_cast<app_telemetry_counter>(name)) {

    case app_telemetry_counter::kv_r_timedout:
      return "sdk_kv_r_timedout";
    case app_telemetry_counter::kv_r_canceled:
      return "sdk_kv_r_canceled";
    case app_telemetry_counter::kv_r_total:
      return "sdk_kv_r_total";

    case app_telemetry_counter::query_r_timedout:
      return "sdk_query_r_timedout";
    case app_telemetry_counter::query_r_canceled:
      return "sdk_query_r_canceled";
    case app_telemetry_counter::query_r_total:
      return "sdk_query_r_total";

    case app_telemetry_counter::search_r_timedout:
      return "sdk_search_r_timedout";
    case app_telemetry_counter::search_r_canceled:
      return "sdk_search_r_canceled";
    case app_telemetry_counter::search_r_total:
      return "sdk_search_r_total";

    case app_telemetry_counter::analytics_r_timedout:
      return "sdk_analytics_r_timedout";
    case app_telemetry_counter::analytics_r_canceled:
      return "sdk_analytics_r_canceled";
    case app_telemetry_counter::analytics_r_total:
      return "sdk_analytics_r_total";

    case app_telemetry_counter::management_r_timedout:
      return "sdk_management_r_timedout";
    case app_telemetry_counter::management_r_canceled:
      return "sdk_management_r_canceled";
    case app_telemetry_counter::management_r_total:
      return "sdk_management_r_total";

    case app_telemetry_counter::eventing_r_timedout:
      return "sdk_eventing_r_timedout";
    case app_telemetry_counter::eventing_r_canceled:
      return "sdk_eventing_r_canceled";
    case app_telemetry_counter::eventing_r_total:
      return "sdk_eventing_r_total";

    case app_telemetry_counter::unknown:
    case app_telemetry_counter::number_of_elements:
      break;
  }
  return "";
}

class null_app_telemetry_value_recorder : public app_telemetry_value_recorder
{
public:
  void record_latency(app_telemetry_latency /* name */,
                      std::chrono::milliseconds /* interval */) override
  {
    /* do nothing */
  }

  void update_counter(app_telemetry_counter /* name */) override
  {
    /* do nothing */
  }
};

class null_app_telemetry_meter_impl : public app_telemetry_meter_impl
{
private:
  std::shared_ptr<null_app_telemetry_value_recorder> instance_{
    std::make_shared<null_app_telemetry_value_recorder>()
  };

public:
  void update_config(const topology::configuration& /* config */) override
  {
    /* do nothing */
  }

  auto value_recorder(const std::string& /* node_uuid */, const std::string& /* bucket_name */)
    -> std::shared_ptr<app_telemetry_value_recorder> override
  {
    return instance_;
  }

  auto enabled() -> bool override
  {
    return false;
  }

  auto nothing_to_report() -> bool override
  {
    return true;
  }

  void generate_to(std::vector<std::byte>& /* output_buffer */,
                   const std::string& /* agent */) override
  {
    /* do nothing */
  }

  [[nodiscard]] auto current_node_labels() const -> std::map<std::string, node_labels> override
  {
    return {};
  }

  void set_node_labels_cache(std::map<std::string, node_labels> /* labels */) override
  {
    /* do nothing */
  }
};

class default_app_telemetry_value_recorder : public app_telemetry_value_recorder
{
public:
  default_app_telemetry_value_recorder(std::string node_uuid, std::string bucket_name)
    : node_uuid_{ std::move(node_uuid) }
    , bucket_name_{ std::move(bucket_name) }
  {
  }

  void record_latency(app_telemetry_latency name, std::chrono::milliseconds interval) override
  {
    // NOLINTBEGIN(cppcoreguidelines-pro-bounds-constant-array-index)
    switch (name) {
      case app_telemetry_latency::unknown:
      case app_telemetry_latency::number_of_elements:
        return;
      case app_telemetry_latency::kv_retrieval:
        ++kv_retrieval_.count;
        kv_retrieval_.sum += static_cast<std::uint64_t>(interval.count());
        if (interval <= std::chrono::milliseconds{ 1 }) {
          ++kv_retrieval_.le_1ms;
        }
        if (interval <= std::chrono::milliseconds{ 10 }) {
          ++kv_retrieval_.le_10ms;
        }
        if (interval <= std::chrono::milliseconds{ 100 }) {
          ++kv_retrieval_.le_100ms;
        }
        if (interval <= std::chrono::milliseconds{ 500 }) {
          ++kv_retrieval_.le_500ms;
        }
        if (interval <= std::chrono::milliseconds{ 1000 }) {
          ++kv_retrieval_.le_1s;
        }
        if (interval <= std::chrono::milliseconds{ 2500 }) {
          ++kv_retrieval_.le_2_5s;
        }
        ++kv_retrieval_.inf;
        break;

      case app_telemetry_latency::kv_mutation_nondurable:
        ++kv_mutation_nondurable_.count;
        kv_mutation_nondurable_.sum += static_cast<std::uint64_t>(interval.count());
        if (interval <= std::chrono::milliseconds{ 1 }) {
          ++kv_mutation_nondurable_.le_1ms;
        }
        if (interval <= std::chrono::milliseconds{ 10 }) {
          ++kv_mutation_nondurable_.le_10ms;
        }
        if (interval <= std::chrono::milliseconds{ 100 }) {
          ++kv_mutation_nondurable_.le_100ms;
        }
        if (interval <= std::chrono::milliseconds{ 500 }) {
          ++kv_mutation_nondurable_.le_500ms;
        }
        if (interval <= std::chrono::milliseconds{ 1000 }) {
          ++kv_mutation_nondurable_.le_1s;
        }
        if (interval <= std::chrono::milliseconds{ 2500 }) {
          ++kv_mutation_nondurable_.le_2_5s;
        }
        ++kv_mutation_nondurable_.inf;
        break;

      case app_telemetry_latency::kv_mutation_durable:
        ++kv_mutation_durable_.count;
        kv_mutation_durable_.sum += static_cast<std::uint64_t>(interval.count());
        if (interval <= std::chrono::milliseconds{ 10 }) {
          ++kv_mutation_durable_.le_10ms;
        }
        if (interval <= std::chrono::milliseconds{ 100 }) {
          ++kv_mutation_durable_.le_100ms;
        }
        if (interval <= std::chrono::milliseconds{ 500 }) {
          ++kv_mutation_durable_.le_500ms;
        }
        if (interval <= std::chrono::milliseconds{ 1000 }) {
          ++kv_mutation_durable_.le_1s;
        }
        if (interval <= std::chrono::milliseconds{ 2000 }) {
          ++kv_mutation_durable_.le_2s;
        }
        if (interval <= std::chrono::milliseconds{ 10000 }) {
          ++kv_mutation_durable_.le_10s;
        }
        ++kv_mutation_durable_.inf;
        break;

      case app_telemetry_latency::query:
        ++query_.count;
        query_.sum += static_cast<std::uint64_t>(interval.count());
        if (interval <= std::chrono::milliseconds{ 100 }) {
          ++query_.le_100ms;
        }
        if (interval <= std::chrono::milliseconds{ 1000 }) {
          ++query_.le_1s;
        }
        if (interval <= std::chrono::milliseconds{ 10000 }) {
          ++query_.le_10s;
        }
        if (interval <= std::chrono::milliseconds{ 30000 }) {
          ++query_.le_30s;
        }
        if (interval <= std::chrono::milliseconds{ 75000 }) {
          ++query_.le_75s;
        }
        ++query_.inf;
        break;

      case app_telemetry_latency::search:
        ++search_.count;
        search_.sum += static_cast<std::uint64_t>(interval.count());
        if (interval <= std::chrono::milliseconds{ 100 }) {
          ++search_.le_100ms;
        }
        if (interval <= std::chrono::milliseconds{ 1000 }) {
          ++search_.le_1s;
        }
        if (interval <= std::chrono::milliseconds{ 10000 }) {
          ++search_.le_10s;
        }
        if (interval <= std::chrono::milliseconds{ 30000 }) {
          ++search_.le_30s;
        }
        if (interval <= std::chrono::milliseconds{ 75000 }) {
          ++search_.le_75s;
        }
        ++search_.inf;
        break;

      case app_telemetry_latency::analytics:
        ++analytics_.count;
        analytics_.sum += static_cast<std::uint64_t>(interval.count());
        if (interval <= std::chrono::milliseconds{ 100 }) {
          ++analytics_.le_100ms;
        }
        if (interval <= std::chrono::milliseconds{ 1000 }) {
          ++analytics_.le_1s;
        }
        if (interval <= std::chrono::milliseconds{ 10000 }) {
          ++analytics_.le_10s;
        }
        if (interval <= std::chrono::milliseconds{ 30000 }) {
          ++analytics_.le_30s;
        }
        if (interval <= std::chrono::milliseconds{ 75000 }) {
          ++analytics_.le_75s;
        }
        ++analytics_.inf;
        break;

      case app_telemetry_latency::management:
        ++management_.count;
        management_.sum += static_cast<std::uint64_t>(interval.count());
        if (interval <= std::chrono::milliseconds{ 100 }) {
          ++management_.le_100ms;
        }
        if (interval <= std::chrono::milliseconds{ 1000 }) {
          ++management_.le_1s;
        }
        if (interval <= std::chrono::milliseconds{ 10000 }) {
          ++management_.le_10s;
        }
        if (interval <= std::chrono::milliseconds{ 30000 }) {
          ++management_.le_30s;
        }
        if (interval <= std::chrono::milliseconds{ 75000 }) {
          ++management_.le_75s;
        }
        ++management_.inf;
        break;

      case app_telemetry_latency::eventing:
        ++eventing_.count;
        eventing_.sum += static_cast<std::uint64_t>(interval.count());
        if (interval <= std::chrono::milliseconds{ 100 }) {
          ++eventing_.le_100ms;
        }
        if (interval <= std::chrono::milliseconds{ 1000 }) {
          ++eventing_.le_1s;
        }
        if (interval <= std::chrono::milliseconds{ 10000 }) {
          ++eventing_.le_10s;
        }
        if (interval <= std::chrono::milliseconds{ 30000 }) {
          ++eventing_.le_30s;
        }
        if (interval <= std::chrono::milliseconds{ 75000 }) {
          ++eventing_.le_75s;
        }
        ++eventing_.inf;

        break;
    }
    // NOLINTEND(cppcoreguidelines-pro-bounds-constant-array-index)
  }

  void update_counter(app_telemetry_counter name) override
  {
    switch (name) {
      case app_telemetry_counter::unknown:
      case app_telemetry_counter::number_of_elements:
        return;
      default:
        // NOLINTNEXTLINE(cppcoreguidelines-pro-bounds-constant-array-index)
        ++counters_[static_cast<std::size_t>(name)];
        break;
    }
  }

private:
  friend class default_app_telemetry_meter_impl;

  std::string node_uuid_;
  std::string bucket_name_;
  std::array<std::atomic_uint64_t, max_number_of_counters> counters_{};

  kv_non_durable_histogram kv_retrieval_{ "sdk_kv_retrieval_duration_milliseconds" };
  kv_non_durable_histogram kv_mutation_nondurable_{
    "sdk_kv_mutation_nondurable_duration_milliseconds"
  };
  kv_durable_histogram kv_mutation_durable_{ "sdk_kv_mutation_durable_duration_milliseconds" };
  http_histogram query_{ "sdk_query_duration_milliseconds" };
  http_histogram search_{ "sdk_search_duration_milliseconds" };
  http_histogram analytics_{ "sdk_analytics_duration_milliseconds" };
  http_histogram management_{ "sdk_management_duration_milliseconds" };
  http_histogram eventing_{ "sdk_eventing_duration_milliseconds" };
};

class default_app_telemetry_meter_impl : public app_telemetry_meter_impl
{
public:
  auto value_recorder(const std::string& node_uuid, const std::string& bucket_name)
    -> std::shared_ptr<app_telemetry_value_recorder> override
  {
    const std::lock_guard<std::mutex> lock(mutex_);

    if (auto node = recorders_.find(node_uuid); node != recorders_.end()) {
      if (auto bucket = node->second.find(bucket_name); bucket != node->second.end()) {
        return bucket->second;
      }
    }
    auto recorder = std::make_shared<default_app_telemetry_value_recorder>(node_uuid, bucket_name);
    recorders_[node_uuid][bucket_name] = recorder;
    return recorder;
  }

  void update_config(const topology::configuration& config) override
  {
    node_uuids_in_last_config_.clear();
    for (const auto& node : config.nodes) {
      std::optional<std::string> alt_node{};
      if (auto it = node.alt.find("external"); it != node.alt.end()) {
        if (!it->second.hostname.empty()) {
          alt_node = it->second.hostname;
        }
      }
      labels_cache_[node.node_uuid] = node_labels{
        node.hostname,
        alt_node,
      };
      node_uuids_in_last_config_.push_back(node.node_uuid);
    }
  }

  auto enabled() -> bool override
  {
    return true;
  }

  auto nothing_to_report() -> bool override
  {
    const std::lock_guard<std::mutex> lock(mutex_);
    return recorders_.empty();
  }

  [[nodiscard]] auto current_node_labels() const -> std::map<std::string, node_labels> override
  {
    std::map<std::string, node_labels> labels{};
    for (const auto& node_uuid : node_uuids_in_last_config_) {
      labels[node_uuid] = labels_cache_.at(node_uuid);
    }
    return labels;
  }

  void set_node_labels_cache(std::map<std::string, node_labels> labels) override
  {
    for (const auto& [node_uuid, _] : labels) {
      node_uuids_in_last_config_.push_back(node_uuid);
    }
    labels_cache_ = std::move(labels);
  }

  void generate_to(std::vector<std::byte>& buffer, const std::string& agent) override
  {
    auto now = std::chrono::duration_cast<std::chrono::milliseconds>(
                 std::chrono::system_clock::now().time_since_epoch())
                 .count();
    detail::byte_appender output{ buffer };
    for (const auto& [node_uuid, buckets] : recorders_) {
      auto labels = labels_cache_[node_uuid];
      for (const auto& [bucket, recorder] : buckets) {

        for (std::size_t i = 0; i < recorder->counters_.size(); ++i) {
          if (is_valid_app_telemetry_counter(i)) {
            // NOLINTNEXTLINE(cppcoreguidelines-pro-bounds-constant-array-index)
            std::uint64_t value = recorder->counters_[i];
            if (value == 0) {
              continue;
            }

            fmt::format_to(
              output, "{}{{node_uuid=\"{}\"", app_telemetry_counter_name(i), node_uuid);
            if (!labels.node.empty()) {
              fmt::format_to(output, ",node=\"{}\"", labels.node);
            }
            if (const auto& alt = labels.alt_node; alt && !alt->empty()) {
              fmt::format_to(output, ",alt_node=\"{}\"", alt.value());
            }
            if (!bucket.empty()) {
              fmt::format_to(output, ",bucket=\"{}\"", bucket);
            }
            fmt::format_to(output, ",agent={}}} {} {}\n", agent, value, now);
          }
        }

        recorder->kv_retrieval_.generate_to(output, node_uuid, labels, bucket, agent);
        recorder->kv_mutation_nondurable_.generate_to(output, node_uuid, labels, bucket, agent);
        recorder->kv_mutation_durable_.generate_to(output, node_uuid, labels, bucket, agent);
        recorder->query_.generate_to(output, node_uuid, labels, bucket, agent);
        recorder->search_.generate_to(output, node_uuid, labels, bucket, agent);
        recorder->analytics_.generate_to(output, node_uuid, labels, bucket, agent);
        recorder->management_.generate_to(output, node_uuid, labels, bucket, agent);
        recorder->eventing_.generate_to(output, node_uuid, labels, bucket, agent);
      }
    }
  }

private:
  std::mutex mutex_{};
  // node_uuid -> bucket_name -> recorders
  std::map<std::string,
           std::map<std::string, std::shared_ptr<default_app_telemetry_value_recorder>>>
    recorders_{};
  std::map<std::string, node_labels> labels_cache_{};
  std::vector<std::string> node_uuids_in_last_config_{};
};

auto
generate_agent_string(const std::string& extra = {}) -> std::string
{
  constexpr auto uuid{ "00000000-0000-0000-0000-000000000000" };
  auto hello = meta::user_agent_for_mcbp(uuid, uuid, extra);
  auto json = utils::json::parse(hello.data(), hello.size());
  return utils::json::generate(json["a"]);
}

} // namespace

app_telemetry_meter::app_telemetry_meter()
  : impl_{ std::make_unique<default_app_telemetry_meter_impl>() }
{
  agent_ = generate_agent_string();
}

void
app_telemetry_meter::disable()
{
  const std::scoped_lock lock{ impl_mutex_ };
  if (!impl_->enabled()) {
    return;
  }
  CB_LOG_DEBUG("Disable app telemetry meter.  {}",
               tao::json::to_string(tao::json::value{
                 { "nothing_to_report", impl_->nothing_to_report() },
               }));
  impl_ = std::make_unique<null_app_telemetry_meter_impl>();
}

void
app_telemetry_meter::enable()
{
  const std::scoped_lock lock{ impl_mutex_ };
  if (impl_->enabled()) {
    return;
  }
  CB_LOG_DEBUG("Enable app telemetry meter.");
  impl_ = std::make_unique<default_app_telemetry_meter_impl>();
}

void
app_telemetry_meter::update_agent(const std::string& extra)
{
  agent_ = generate_agent_string(extra);
}

app_telemetry_meter::~app_telemetry_meter() = default;

void
app_telemetry_meter::update_config(const topology::configuration& config)
{
  const std::shared_lock lock{ impl_mutex_ };
  return impl_->update_config(config);
}

auto
app_telemetry_meter::value_recorder(const std::string& node_uuid, const std::string& bucket_name)
  -> std::shared_ptr<app_telemetry_value_recorder>
{
  const std::shared_lock lock{ impl_mutex_ };
  return impl_->value_recorder(node_uuid, bucket_name);
}

void
app_telemetry_meter::generate_report(std::vector<std::byte>& output_buffer)
{
  const std::scoped_lock lock{ impl_mutex_ };
  if (impl_->nothing_to_report()) {
    return;
  }
  const auto old_impl = std::move(impl_);
  impl_ = std::make_unique<default_app_telemetry_meter_impl>();
  impl_->set_node_labels_cache(old_impl->current_node_labels());
  old_impl->generate_to(output_buffer, agent_);
}
} // namespace couchbase::core
