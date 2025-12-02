/* -*- MODE: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2018-Present Couchbase, Inc.
 *
 *   Use of this software is governed by the Business Source License included
 *   in the file licenses/BSL-Couchbase.txt.  As of the Change Date specified
 *   in that file, in accordance with the Business Source License, use of this
 *   software will be governed by the Apache License, Version 2.0, included in
 *   the file licenses/APL2.txt.
 */

#include "logger.hxx"

#include "configuration.hxx"
#include "core/logger/level.hxx"
#include "custom_rotating_file_sink.hxx"

#include <spdlog/async.h>
#include <spdlog/async_logger.h>
#include <spdlog/common.h>
#include <spdlog/details/os.h>
#include <spdlog/logger.h>
#include <spdlog/sinks/dist_sink.h>
#include <spdlog/sinks/null_sink.h>
#include <spdlog/sinks/stdout_color_sinks.h>
#include <spdlog/spdlog.h>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <string_view>
#include <utility>

namespace
{
const std::string file_logger_name{ "couchbase_cxx_client_file_logger" };
const std::string protocol_logger_name{ "couchbase_cxx_client_protocol_logger" };

/**
 * Custom log pattern which the loggers will use.
 * This pattern is duplicated for some test cases. If you need to update it,
 * please also update in all relevant places.
 */
const std::string log_pattern{ "[%Y-%m-%d %T.%e] %4oms [%^%4!l%$] [%P,%t] %v" };

/**
 * Instances of spdlog (async) file logger.
 * The files logger requires a rotating file sink which is manually configured
 * from the parsed settings.
 * The loggers act as a handle to the sinks. They do the processing of log
 * messages and send them to the sinks, which do the actual writing (to file,
 * to stream etc.) or further processing.
 */
std::shared_ptr<spdlog::logger> file_logger{};
std::mutex file_logger_mutex;
std::atomic_int file_logger_version{ 0 };

std::shared_ptr<couchbase::core::logger::log_callback> log_callback{};
std::mutex log_callback_mutex;
std::atomic_int log_callback_version{ 0 };

auto
get_file_logger() -> std::shared_ptr<spdlog::logger>
{
  thread_local std::shared_ptr<spdlog::logger> logger{ nullptr };
  thread_local int version{ -1 };
  if (version != file_logger_version) {
    const std::scoped_lock lock(file_logger_mutex);
    logger = file_logger;
    version = file_logger_version;
  }
  return logger;
}

auto
get_custom_callback() -> std::shared_ptr<couchbase::core::logger::log_callback>
{
  thread_local std::shared_ptr<couchbase::core::logger::log_callback> callback{ nullptr };
  thread_local int version{ -1 };
  if (version != log_callback_version) {
    const std::scoped_lock lock(log_callback_mutex);
    callback = log_callback;
    version = log_callback_version;
  }
  return callback;
}

void
update_callback_logger(const std::shared_ptr<couchbase::core::logger::log_callback>& new_callback)
{
  const std::scoped_lock lock(log_callback_mutex);
  log_callback = new_callback;
  ++log_callback_version;
}

void
update_file_logger(const std::shared_ptr<spdlog::logger>& new_logger)
{
  const std::scoped_lock lock(file_logger_mutex);
  // delete if already exists
  spdlog::drop(file_logger_name);
  if (new_logger) {
    file_logger = new_logger;
    spdlog::register_logger(new_logger);
  }
  ++file_logger_version;
}

/**
 * Instance of the protocol logger.
 */
std::shared_ptr<spdlog::logger> protocol_logger{};
} // namespace

namespace couchbase::core::logger
{
auto
translate_level(level level) -> spdlog::level::level_enum
{
  switch (level) {
    case level::trace:
      return spdlog::level::level_enum::trace;
    case level::debug:
      return spdlog::level::level_enum::debug;
    case level::info:
      return spdlog::level::level_enum::info;
    case level::warn:
      return spdlog::level::level_enum::warn;
    case level::err:
      return spdlog::level::level_enum::err;
    case level::critical:
      return spdlog::level::level_enum::critical;
    case level::off:
      return spdlog::level::level_enum::off;
  }
  return spdlog::level::level_enum::trace;
}

auto
translate_level(spdlog::level::level_enum spdlog_level) -> level
{
  switch (spdlog_level) {
    case spdlog::level::level_enum::trace:
      return level::trace;
    case spdlog::level::debug:
      return level::debug;
    case spdlog::level::info:
      return level::info;
    case spdlog::level::warn:
      return level::warn;
    case spdlog::level::err:
      return level::err;
    case spdlog::level::critical:
      return level::critical;
    default:
      break;
  }
  return level::off;
}

auto
level_from_str(const std::string& str) -> level
{
  switch (spdlog::level::from_str(str)) {
    case spdlog::level::level_enum::trace:
      return level::trace;
    case spdlog::level::level_enum::debug:
      return level::debug;
    case spdlog::level::level_enum::info:
      return level::info;
    case spdlog::level::level_enum::warn:
      return level::warn;
    case spdlog::level::level_enum::err:
      return level::err;
    case spdlog::level::level_enum::critical:
      return level::critical;
    case spdlog::level::level_enum::off:
      return level::off;
    default:
      break;
  }
  // return highest level if we don't understand
  return level::trace;
}

auto
should_log(level lvl) -> bool
{
  if (is_initialized()) {
    return get_file_logger()->should_log(translate_level(lvl));
  }
  return false;
}

namespace detail
{
void
log(const char* file, int line, const char* function, level lvl, std::string_view msg)
{
  if (is_initialized()) {
    return get_file_logger()->log(
      spdlog::source_loc{ file, line, function }, translate_level(lvl), msg);
  }
}

void
log_custom_logger(const char* file, int line, const char* function, level lvl, std::string_view msg)
{
  if (auto callback = get_custom_callback()) {
    (*callback)(msg, lvl, { file, function, line });
  }
}
} // namespace detail

void
flush()
{
  if (is_initialized()) {
    get_file_logger()->flush();
  }
}

void
shutdown()
{
  // Force a flush (posts a message to the async logger if we are not in unit
  // test mode)
  flush();

  /**
   * This will drop all spdlog instances from the registry, and destruct the
   * thread pool which will post terminate message(s) (one per thread) to the
   * thread pool message queue. The calling thread will then block until all
   * thread pool workers have joined. This ensures that any messages queued
   * before shutdown is called will be flushed to disk. Any messages that are
   * queued after the final terminate message will not be logged.
   *
   * If the logger is running in unit test mode (synchronous) then this is a
   * no-op.
   */
  get_file_logger().reset();
  spdlog::details::registry::instance().shutdown();
}

auto
is_initialized() -> bool
{
  return get_file_logger() != nullptr;
}

auto
create_file_logger_impl(const std::string& logger_name, const configuration& logger_settings)
  -> std::pair<std::optional<std::string>, std::shared_ptr<spdlog::logger>>
{
  std::shared_ptr<spdlog::logger> logger{};

  try {
    // Initialise the loggers.
    //
    // The structure is as follows:
    //
    // file_logger = sends log messages to sink
    //   |__dist_sink_mt = Distribute log messages to multiple sinks
    //       |     |__custom_rotating_file_sink_mt = adds opening & closing
    //       |                                       hooks to the file
    //       |__ (color)__stderr_sink_mt = Send log messages to console
    //
    // When a new log message is being submitted to the file_logger it
    // is subject to the log level specified on the file_logger. If it
    // is to be included it is passed down to the dist_sink which will
    // evaluate if the message should be passed on based on its log level.
    // It'll then try to pass the message to the file sink and the
    // console sink and they will evaluate if the message should be
    // logged or not. This means that we should set the file sink
    // loglevel to TRACE so that all messages which goes all the way
    // will end up in the file. Due to the fact that ns_server can't
    // keep up with the rate we might produce log we want the console
    // sink to drop everything below WARNING (unless we're running
    // unit tests (through testapp).
    //
    // When the user change the verbosity level we'll modify the
    // level for the file_logger object causing it to allow more
    // messages to go down to the various sinks.

    auto sink = std::make_shared<spdlog::sinks::dist_sink_mt>();
    sink->set_level(spdlog::level::trace);

    if (const auto& fname = logger_settings.filename; !fname.empty()) {
      auto cyclesz = logger_settings.cycle_size;

      if (!spdlog::details::os::getenv("COUCHBASE_CXX_CLIENT_MAXIMIZE_LOGGER_CYCLE_SIZE").empty()) {
        cyclesz = 1024LLU * 1024 * 1024; // use up to 1 GB log file size
      }

      auto fsink = std::make_shared<custom_rotating_file_sink_mt>(fname, cyclesz, log_pattern);
      fsink->set_level(spdlog::level::trace);
      sink->add_sink(fsink);
    }

    if (logger_settings.console) {
      auto stderrsink = std::make_shared<spdlog::sinks::stderr_color_sink_mt>();

      // Set the formatting pattern of this sink
      stderrsink->set_pattern(log_pattern);
      stderrsink->set_level(translate_level(logger_settings.console_sink_log_level));
      sink->add_sink(stderrsink);
    }
    if (nullptr != logger_settings.sink) {
      logger_settings.sink->set_pattern(log_pattern);
      sink->add_sink(logger_settings.sink);
    }

    spdlog::drop(logger_name);

    if (logger_settings.unit_test) {
      logger = std::make_shared<spdlog::logger>(logger_name, sink);
    } else {
      auto buffersz = logger_settings.buffer_size;
      // Create the default thread pool for async logging
      spdlog::init_thread_pool(buffersz, 1);

      // Get the thread pool so that we can actually construct the
      // object with already created sinks...
      auto tp = spdlog::thread_pool();
      logger = std::make_shared<spdlog::async_logger>(
        logger_name, sink, tp, spdlog::async_overflow_policy::block);
    }

    logger->set_pattern(log_pattern);
    logger->set_level(translate_level(logger_settings.log_level));

    // Set the flushing interval policy
    spdlog::flush_every(std::chrono::seconds(1));

    spdlog::register_logger(logger);
  } catch (const spdlog::spdlog_ex& ex) {
    std::string msg = std::string{ "Log initialization failed: " } + ex.what();
    return { msg, {} };
  }
  return { {}, logger };
}

/**
 * Initialises the loggers. Called if the logger configuration is
 * specified in a separate settings object.
 */
auto
create_file_logger(const configuration& logger_settings) -> std::optional<std::string>
{
  auto [error, logger] = create_file_logger_impl(file_logger_name, logger_settings);
  if (error) {
    return error;
  }
  update_file_logger(logger);
  return {};
}

auto
create_protocol_logger(const configuration& logger_settings) -> std::optional<std::string>
{
  if (logger_settings.filename.empty()) {
    return "File name is missing";
  }
  auto config = logger_settings;
  config.log_level = couchbase::core::logger::level::trace;
  auto [error, logger] = create_file_logger_impl(protocol_logger_name, config);
  if (error) {
    return error;
  }
  protocol_logger = std::move(logger);
  return {};
}

auto
should_log_protocol() -> bool
{
  return protocol_logger != nullptr;
}

namespace detail
{
void
log_protocol(const char* file, int line, const char* function, std::string_view msg)
{
  if (should_log_protocol()) {
    return protocol_logger->log(
      spdlog::source_loc{ file, line, function }, spdlog::level::level_enum::trace, msg);
  }
}
} // namespace detail

auto
get() -> spdlog::logger*
{
  return get_file_logger().get();
}

void
reset()
{
  update_file_logger(nullptr);

  spdlog::drop(protocol_logger_name);
  protocol_logger.reset();
}

void
create_blackhole_logger()
{
  auto new_logger = std::make_shared<spdlog::logger>(
    file_logger_name, std::make_shared<spdlog::sinks::null_sink_mt>());
  new_logger->set_level(spdlog::level::off);
  new_logger->set_pattern(log_pattern);

  update_file_logger(new_logger);
}

void
create_console_logger()
{
  auto stderrsink = std::make_shared<spdlog::sinks::stderr_color_sink_mt>();
  auto new_logger = std::make_shared<spdlog::logger>(file_logger_name, stderrsink);
  new_logger->set_level(spdlog::level::info);
  new_logger->set_pattern(log_pattern);
  update_file_logger(new_logger);
}

void
register_log_callback(log_callback callback)
{
  auto new_callback = std::make_shared<log_callback>(std::move(callback));
  update_callback_logger(new_callback);
}

void
unregister_log_callback()
{
  update_callback_logger(nullptr);
}

void
register_spdlog_logger(const std::shared_ptr<spdlog::logger>& l)
{
  try {
    get_file_logger()->debug("Registering logger {}", l->name());
    spdlog::register_logger(l);
  } catch (const spdlog::spdlog_ex& e) {
    get_file_logger()->warn(
      "Exception caught when attempting to register the logger {} in the spdlog "
      "registry. The verbosity of this logger "
      "cannot be changed at runtime. e.what()={}",
      l->name(),
      e.what());
  }
}

void
unregister_spdlog_logger(const std::string& n)
{
  spdlog::drop(n);
}

auto
check_log_levels(level lvl) -> bool
{
  auto level = translate_level(lvl);
  bool correct = true;
  spdlog::apply_all([level, &correct](const std::shared_ptr<spdlog::logger>& l) {
    if (l->level() != level) {
      correct = false;
    }
  });
  return correct;
}

auto
get_lowest_log_level() -> level
{
  auto lowest = spdlog::level::off;
  // Apply the function to each registered spdlog::logger except protocol logger
  spdlog::apply_all([&lowest](const std::shared_ptr<spdlog::logger>& l) {
    lowest = std::min(l->level(), lowest);
  });
  return translate_level(lowest);
}

void
set_log_levels(level lvl)
{
  auto level = translate_level(lvl);
  // Apply the function to each registered spdlog::logger except protocol logger
  spdlog::apply_all([level](const std::shared_ptr<spdlog::logger>& l) {
    if (l->name() == protocol_logger_name) {
      l->set_level(spdlog::level::trace);
      return;
    }

    try {
      l->set_level(level);
    } catch (const spdlog::spdlog_ex& e) {
      l->warn("Exception caught when attempting to change the verbosity "
              "of logger {} to spdlog level {}. e.what()={}",
              l->name(),
              to_short_c_str(level),
              e.what());
    }
  });

  flush();
}
} // namespace couchbase::core::logger
