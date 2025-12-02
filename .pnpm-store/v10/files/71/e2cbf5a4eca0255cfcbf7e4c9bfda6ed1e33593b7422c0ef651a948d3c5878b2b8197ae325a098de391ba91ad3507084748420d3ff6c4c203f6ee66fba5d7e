/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2021 Couchbase, Inc.
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

#include "logging_meter_options.hxx"

#include <couchbase/metrics/meter.hxx>

#include <asio/steady_timer.hpp>

#include <mutex>

namespace couchbase::core::metrics
{
class logging_value_recorder;

class logging_meter
  : public couchbase::metrics::meter
  , public std::enable_shared_from_this<logging_meter>
{
private:
  asio::steady_timer emit_report_;
  logging_meter_options options_;
  std::mutex recorders_mutex_{};
  // service name -> operation name -> recorder
  std::map<std::string, std::map<std::string, std::shared_ptr<logging_value_recorder>>>
    recorders_{};

  void log_report() const;

  void rearm_reporter();

public:
  logging_meter(asio::io_context& ctx, logging_meter_options options);

  ~logging_meter() override;

  void start() override;

  void stop() override;

  auto get_value_recorder(const std::string& name, const std::map<std::string, std::string>& tags)
    -> std::shared_ptr<couchbase::metrics::value_recorder> override;
};

} // namespace couchbase::core::metrics
