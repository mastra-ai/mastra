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

#include <functional>
#include <string>
#include <string_view>

namespace couchbase::logger
{
enum class log_level {
  trace,
  debug,
  info,
  warn,
  error,
  critical,
  off,
};

struct log_location {
  std::string file;
  std::string function;
  int line;
};

using log_callback = std::function<void(std::string_view, log_level, log_location)>;

void
register_log_callback(const log_callback& callback);

void
unregister_log_callback();

void
set_level(log_level level);

void
initialize_console_logger();

void
initialize_file_logger(std::string_view filename);

void
initialize_protocol_logger(std::string_view filename);

void
flush_all_loggers();

void
shutdown_all_loggers();
} // namespace couchbase::logger
