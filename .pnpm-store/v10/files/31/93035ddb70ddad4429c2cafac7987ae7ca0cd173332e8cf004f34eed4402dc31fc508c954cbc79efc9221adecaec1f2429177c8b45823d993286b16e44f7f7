//
// Copyright(c) 2015 Gabi Melman.
// Distributed under the MIT License (http://opensource.org/licenses/MIT)
//

/* -*- MODE: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2017 Couchbase, Inc
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

#include <mutex>
#include <spdlog/pattern_formatter.h>
#include <spdlog/sinks/base_sink.h>

namespace spdlog::details
{
class file_helper;
} // namespace spdlog::details

/**
 * Customised version of spdlog's rotating_file_sink with the following
 * modifications:
 *
 * 1 Adds open and closing tags in the file so that a concatenated version
 *   of all of the log files may be split back into its fragments again
 *
 * 2 Instead of renaming all of the files every time we're rotating to
 *   the next file we start a new log file with a higher number
 *
 * TODO: If updating spdlog from v1.1.0, check if this class also needs
 *       updating.
 */
template<class Mutex>
class custom_rotating_file_sink : public spdlog::sinks::base_sink<Mutex>
{
public:
  custom_rotating_file_sink(const spdlog::filename_t& base_filename,
                            std::size_t max_size,
                            const std::string& log_pattern);

  ~custom_rotating_file_sink() override;

protected:
  // Explicitly instantiated in custom_rotating_file_sink.cxx
  // NOLINTBEGIN(portability-template-virtual-member-function)
  void sink_it_(const spdlog::details::log_msg& msg) override;
  void flush_() override;
  // NOLINTEND(portability-template-virtual-member-function)

private:
  void add_hook(const std::string& hook);
  // Calculate the full filename to use the next time
  auto open_file() -> std::unique_ptr<spdlog::details::file_helper>;

  const spdlog::filename_t base_filename_;
  const std::size_t max_size_;
  std::unique_ptr<spdlog::details::file_helper> file_helper_;
  std::size_t current_size_{ 0 };
  std::unique_ptr<spdlog::pattern_formatter> formatter;
  unsigned long next_file_id_;

  const std::string opening_log_file_{ "---------- Opening logfile: " };
  const std::string closing_log_file_{ "---------- Closing logfile" };
};

using custom_rotating_file_sink_mt = custom_rotating_file_sink<std::mutex>;
using custom_rotating_file_sink_st = custom_rotating_file_sink<spdlog::details::null_mutex>;
