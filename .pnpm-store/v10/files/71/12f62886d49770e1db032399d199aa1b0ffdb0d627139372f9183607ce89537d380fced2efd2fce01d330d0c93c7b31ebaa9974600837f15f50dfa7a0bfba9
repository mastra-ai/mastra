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

#include "custom_rotating_file_sink.hxx"

#include "core/platform/dirutils.h"

#include <algorithm>
#include <gsl/assert>
#include <memory>
#include <spdlog/details/file_helper.h>

namespace
{
auto
find_first_logfile_id(const std::string& basename) -> unsigned long
{
  unsigned long id = 0;

  auto files = couchbase::core::platform::find_files_with_prefix(basename);
  for (auto& file : files) {
    // the format of the name should be:
    // fnm.number.txt
    auto index = file.rfind(".txt");
    if (index == std::string::npos) {
      continue;
    }

    file.resize(index);
    index = file.rfind('.');
    if (index != std::string::npos) {
      try {
        const unsigned long value = std::stoul(file.substr(index + 1));
        id = std::max(value, id);
      } catch (const std::invalid_argument&) {
        continue; /* ignore */
      } catch (const std::out_of_range&) {
        continue; /* ignore */
      }
    }
  }

  return id;
}
} // namespace

template<class Mutex>
custom_rotating_file_sink<Mutex>::custom_rotating_file_sink(const spdlog::filename_t& base_filename,
                                                            std::size_t max_size,
                                                            const std::string& log_pattern)
  : base_filename_{ base_filename }
  , max_size_{ max_size }
  , file_helper_{ open_file() }
  , current_size_{ file_helper_->size() } // expensive. called only once
  , formatter{ std::make_unique<spdlog::pattern_formatter>(log_pattern,
                                                           spdlog::pattern_time_type::local) }
  , next_file_id_{ find_first_logfile_id(base_filename) }
{
  add_hook(opening_log_file_);
}

/* In addition to the functionality of spdlog's rotating_file_sink,
 * this class adds hooks marking the start and end of a logfile.
 */
template<class Mutex>
void
custom_rotating_file_sink<Mutex>::sink_it_(const spdlog::details::log_msg& msg)
{
  current_size_ += msg.payload.size();
  spdlog::memory_buf_t formatted;
  formatter->format(msg, formatted);
  file_helper_->write(formatted);

  // Is it time to wrap to the next file?
  if (current_size_ > max_size_) {
    try {
      auto next = open_file();
      add_hook(closing_log_file_);
      std::swap(file_helper_, next);
      current_size_ = file_helper_->size();
      add_hook(opening_log_file_);
    } catch (const spdlog::spdlog_ex&) {
      // Keep on logging to this file, but try swap at the next
      // insert of data (didn't use the next file we need to
      // roll back the next_file_id to avoid getting a hole ;-)
      next_file_id_--;
    }
  }
}

template<class Mutex>
void
custom_rotating_file_sink<Mutex>::flush_()
{
  file_helper_->flush();
}

/* Takes a message, formats it and writes it to file */
template<class Mutex>
void
custom_rotating_file_sink<Mutex>::add_hook(const std::string& hook)
{
  spdlog::details::log_msg msg;
  msg.time = spdlog::details::os::now();
  msg.level = spdlog::level::info;

  std::string hookToAdd = hook;
  if (hook == opening_log_file_) {
    hookToAdd.append(file_helper_->filename());
  }

  // Payload shouldn't contain anything yet, overwrite it
  Expects(msg.payload.size() == 0);
  msg.payload = hookToAdd;

  spdlog::memory_buf_t formatted;
  formatter->format(msg, formatted);
  current_size_ += formatted.size();

  file_helper_->write(formatted);
}

template<class Mutex>
auto
custom_rotating_file_sink<Mutex>::open_file() -> std::unique_ptr<spdlog::details::file_helper>
{
  auto ret = std::make_unique<spdlog::details::file_helper>();
  do {
    ret->open(fmt::format("{}.{:06}.txt", base_filename_, next_file_id_++));
  } while (ret->size() > max_size_);
  return ret;
}

template<class Mutex>
custom_rotating_file_sink<Mutex>::~custom_rotating_file_sink()
{
  add_hook(closing_log_file_);
}

template class custom_rotating_file_sink<std::mutex>;
template class custom_rotating_file_sink<spdlog::details::null_mutex>;
