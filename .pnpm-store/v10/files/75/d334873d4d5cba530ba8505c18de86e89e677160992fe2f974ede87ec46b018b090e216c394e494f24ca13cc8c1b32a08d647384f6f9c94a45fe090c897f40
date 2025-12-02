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

/*
 *   A note on the thread safety of the logger API:
 *
 *   The API is thread safe unless the underlying logger object is changed
 * during runtime. This means some methods can only be safely called if the
 * caller guarantees no other threads exist and/or are calling the logging
 * functions.
 *
 *   The caveat being we should not change the underlying logger object during
 * run-time, the exception to this is during the initial memcached startup,
 * where we are running in a single thread at the point we switch from console
 * logging to file logging.
 */

#pragma once

#include <functional>

#include "level.hxx"

#include <spdlog/fmt/bundled/core.h>
#include <spdlog/fwd.h>

#include <memory>
#include <optional>
#include <string>

namespace couchbase::core::logger
{

struct configuration;

struct log_location {
  std::string file;
  std::string function;
  int line;
};

using log_callback = std::function<void(std::string_view, level, log_location)>;

auto
level_from_str(const std::string& str) -> level;

/**
 * Initialize the logger.
 *
 * The default level for the created logger is set to INFO
 *
 * See note about thread safety at the top of the file
 *
 * @param logger_settings the configuration for the logger
 * @return optional error message if something goes wrong
 */
auto
create_file_logger(const configuration& logger_settings) -> std::optional<std::string>;

/**
 * Protocol logger writes only communication logs with the nodes.
 *
 * It accepts the same settings as a file logger, and writes only to the filesystem.
 *
 * @param logger_settings
 * @return
 */
auto
create_protocol_logger(const configuration& logger_settings) -> std::optional<std::string>;

/**
 * Initialize the logger with the blackhole logger object
 *
 * This method is intended to be used by unit tests which don't need any output (but may call
 * methods who tries to fetch the logger)
 *
 * See note about thread safety at the top of the file
 *
 * @throws std::bad_alloc
 * @throws spdlog::spdlog_ex if an error occurs creating the logger
 *                           (if it already exists for instance)
 */
void
create_blackhole_logger();

/**
 * Initialize the logger with the logger which logs to the console
 *
 * See note about thread safety at the top of the file
 *
 * @throws std::bad_alloc
 * @throws spdlog::spdlog_ex if an error occurs creating the logger
 */
void
create_console_logger();

/**
 * Get the underlying logger object
 *
 * See note about thread safety at the top of the file.
 *
 * This will return null if a logger has not been initialized through one of the following:
 *
 * - create_file_logger()
 * - create_blackhole_logger()
 * - create_console_logger()
 */
auto
get() -> spdlog::logger*;

/**
 * Reset the underlying logger object
 *
 * See note about thread safety at the top of the file
 */
void
reset();

void
register_log_callback(log_callback callback);

void
unregister_log_callback();

/**
 * Engines that create their own instances of an spdlog::logger should register the logger here to
 * ensure that the verbosity of the logger is updated when memcached receives a request to update
 * verbosity
 *
 * @param l spdlog::logger instance
 */
void
register_spdlog_logger(const std::shared_ptr<spdlog::logger>& l);

/**
 * Engines that create their own instances of an spdlog::logger should unregister
 * the logger here to ensure that resources can be freed when their loggers
 * go out of scope, or unsubscribe from runtime verbosity changes
 *
 * @param n The name of the spdlog::logger
 */
void
unregister_spdlog_logger(const std::string& n);

/**
 * Check the log level of all spdLoggers is equal to the given level
 * @param log severity level
 * @return true if all registered loggers have the specified severity level
 */
auto
check_log_levels(level lvl) -> bool;

/**
 * Set the log level of all registered spdLoggers
 * @param log severity level
 */
void
set_log_levels(level lvl);

/**
 * Get the lowest (most verbose) level among the registered loggers
 * @return log severity level
 */
auto
get_lowest_log_level() -> level;

/**
 * Checks whether a specific level should be logged based on the current
 * configuration.
 * @param level severity level to check
 * @return true if we should log at this level
 */
auto
should_log(level lvl) -> bool;

auto
should_log_protocol() -> bool;

namespace detail
{
/**
 * Logs a message at a specific severity level.
 * @param lvl severity level to log at
 * @param msg message to log
 */
void
log(const char* file, int line, const char* function, level lvl, std::string_view msg);

void
log_protocol(const char* file, int line, const char* function, std::string_view msg);

void
log_custom_logger(const char* file,
                  int line,
                  const char* function,
                  level lvl,
                  std::string_view msg);
} // namespace detail

/**
 * Logs a formatted message at a specific severity level.
 * @param lvl severity level to log at
 * @param msg message to log
 * @param args the formatting arguments
 */
template<typename... Args>
inline void
log(const char* file,
    int line,
    const char* function,
    level lvl,
    fmt::format_string<Args...> msg,
    Args&&... args)
{
  detail::log(file, line, function, lvl, fmt::format(msg, std::forward<Args>(args)...));
}

template<typename... Args>
inline void
log_custom_logger(const char* file,
                  int line,
                  const char* function,
                  level lvl,
                  fmt::format_string<Args...> msg,
                  Args&&... args)
{
  detail::log_custom_logger(
    file, line, function, lvl, fmt::format(msg, std::forward<Args>(args)...));
}

template<typename... Args>
inline void
log_protocol(const char* file,
             int line,
             const char* function,
             fmt::format_string<Args...> msg,
             Args&&... args)
{
  detail::log_protocol(file, line, function, fmt::format(msg, std::forward<Args>(args)...));
}

/**
 * Tell the logger to flush its buffers
 */
void
flush();

/**
 * Tell the logger to shut down (flush buffers) and release _ALL_
 * loggers (you'd need to create new loggers after this method)
 */
void
shutdown();

/**
 * @return whether or not the logger has been initialized
 */
auto
is_initialized() -> bool;
} // namespace couchbase::core::logger

#if defined(__GNUC__) || defined(__clang__)
#define COUCHBASE_LOGGER_FUNCTION __PRETTY_FUNCTION__
#else
#define COUCHBASE_LOGGER_FUNCTION __FUNCTION__
#endif
/**
 * We implement this macro to avoid having argument evaluation performed
 * on log messages which likely will not actually be logged due to their
 * severity value not matching the logger.
 */
#define COUCHBASE_LOG(file, line, function, severity, ...)                                         \
  do {                                                                                             \
    couchbase::core::logger::log_custom_logger(file, line, function, severity, __VA_ARGS__);       \
                                                                                                   \
    if (couchbase::core::logger::should_log(severity)) {                                           \
      couchbase::core::logger::log(file, line, function, severity, __VA_ARGS__);                   \
    }                                                                                              \
  } while (false)

#define CB_LOG_TRACE(...)                                                                          \
  COUCHBASE_LOG(__FILE__,                                                                          \
                __LINE__,                                                                          \
                COUCHBASE_LOGGER_FUNCTION,                                                         \
                couchbase::core::logger::level::trace,                                             \
                __VA_ARGS__)
#define CB_LOG_DEBUG(...)                                                                          \
  COUCHBASE_LOG(__FILE__,                                                                          \
                __LINE__,                                                                          \
                COUCHBASE_LOGGER_FUNCTION,                                                         \
                couchbase::core::logger::level::debug,                                             \
                __VA_ARGS__)
#define CB_LOG_INFO(...)                                                                           \
  COUCHBASE_LOG(__FILE__,                                                                          \
                __LINE__,                                                                          \
                COUCHBASE_LOGGER_FUNCTION,                                                         \
                couchbase::core::logger::level::info,                                              \
                __VA_ARGS__)
#define CB_LOG_WARNING(...)                                                                        \
  COUCHBASE_LOG(__FILE__,                                                                          \
                __LINE__,                                                                          \
                COUCHBASE_LOGGER_FUNCTION,                                                         \
                couchbase::core::logger::level::warn,                                              \
                __VA_ARGS__)
#define CB_LOG_ERROR(...)                                                                          \
  COUCHBASE_LOG(__FILE__,                                                                          \
                __LINE__,                                                                          \
                COUCHBASE_LOGGER_FUNCTION,                                                         \
                couchbase::core::logger::level::err,                                               \
                __VA_ARGS__)
#define CB_LOG_CRITICAL(...)                                                                       \
  COUCHBASE_LOG(__FILE__,                                                                          \
                __LINE__,                                                                          \
                COUCHBASE_LOGGER_FUNCTION,                                                         \
                couchbase::core::logger::level::critical,                                          \
                __VA_ARGS__)

#define CB_LOG_PROTOCOL(...)                                                                       \
  do {                                                                                             \
    if (couchbase::core::logger::should_log_protocol()) {                                          \
      couchbase::core::logger::log_protocol(                                                       \
        __FILE__, __LINE__, COUCHBASE_LOGGER_FUNCTION, __VA_ARGS__);                               \
    }                                                                                              \
  } while (false)

/**
 * Convenience macros which log with the given level, and message, if the given
 * level is currently enabled.
 * @param msg Fixed string (implicitly convertible to `std::string_view`)
 *
 * For example:
 *
 *   LOG_INFO_RAW("Starting flusher");
 *   LOG_INFO_RAW(std:string{...});
 */
#define COUCHBASE_LOG_RAW(file, line, function, severity, msg)                                     \
  do {                                                                                             \
    couchbase::core::logger::log_custom_logger(file, line, function, severity, msg);               \
                                                                                                   \
    if (couchbase::core::logger::should_log(severity)) {                                           \
      couchbase::core::logger::detail::log(file, line, function, severity, msg);                   \
    }                                                                                              \
  } while (false)

#define CB_LOG_TRACE_RAW(msg)                                                                      \
  COUCHBASE_LOG_RAW(                                                                               \
    __FILE__, __LINE__, COUCHBASE_LOGGER_FUNCTION, couchbase::core::logger::level::trace, msg)
#define CB_LOG_DEBUG_RAW(msg)                                                                      \
  COUCHBASE_LOG_RAW(                                                                               \
    __FILE__, __LINE__, COUCHBASE_LOGGER_FUNCTION, couchbase::core::logger::level::debug, msg)
#define CB_LOG_INFO_RAW(msg)                                                                       \
  COUCHBASE_LOG_RAW(                                                                               \
    __FILE__, __LINE__, COUCHBASE_LOGGER_FUNCTION, couchbase::core::logger::level::info, msg)
#define CB_LOG_WARNING_RAW(msg)                                                                    \
  COUCHBASE_LOG_RAW(                                                                               \
    __FILE__, __LINE__, COUCHBASE_LOGGER_FUNCTION, couchbase::core::logger::level::warn, msg)
#define CB_LOG_ERROR_RAW(msg)                                                                      \
  COUCHBASE_LOG_RAW(                                                                               \
    __FILE__, __LINE__, COUCHBASE_LOGGER_FUNCTION, couchbase::core::logger::level::err, msg)
#define CB_LOG_CRITICAL_RAW(msg)                                                                   \
  COUCHBASE_LOG_RAW(                                                                               \
    __FILE__, __LINE__, COUCHBASE_LOGGER_FUNCTION, couchbase::core::logger::level::critical, msg)
