/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2018-Present Couchbase, Inc.
 *
 *   Use of this software is governed by the Business Source License included
 *   in the file licenses/BSL-Couchbase.txt.  As of the Change Date specified
 *   in that file, in accordance with the Business Source License, use of this
 *   software will be governed by the Apache License, Version 2.0, included in
 *   the file licenses/APL2.txt.
 */
#pragma once

#include "level.hxx"

#include <spdlog/common.h>

#include <string>

namespace couchbase::core::logger
{

struct configuration {
  /**
   *  The base name of the log files (we'll append: .000000.txt where
   *  the numbers is a sequence counter. The higher the newer ;)
   */
  std::string filename;

  /**
   * 8192 item size for the logging queue. This is equivalent to 2 MB
   */
  std::size_t buffer_size{ 8192 };

  /**
   * 100 MB per cycled file
   */
  std::size_t cycle_size{ 100LLU * 1024 * 1024 };

  /**
   * if running in a unit test or not
   */
  bool unit_test{ false };

  /**
   * Should messages be passed on to the console via stderr
   */
  bool console{ true };

  /**
   * The default log level to initialize the logger to
   */
  level log_level{ level::info };

  /**
   * The default log level for console sink
   */
  level console_sink_log_level{ level::trace };

  /**
   * Custom sink to use, if desired
   */
  std::shared_ptr<spdlog::sinks::sink> sink{ nullptr };
};

} // namespace couchbase::core::logger
