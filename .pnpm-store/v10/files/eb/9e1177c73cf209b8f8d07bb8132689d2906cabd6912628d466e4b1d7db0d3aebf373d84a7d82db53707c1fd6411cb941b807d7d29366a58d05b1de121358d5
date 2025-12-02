//
// config.hpp
// ~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_CONFIG_HPP
#define ASIO_CONFIG_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/throw_exception.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/execution_context.hpp"
#include <cstddef>
#include <string>

#include "asio/detail/push_options.hpp"

namespace asio {

/// Base class for configuration implementations.
class config_service :
#if defined(GENERATING_DOCUMENTATION)
  public execution_context::service
#else // defined(GENERATING_DOCUMENTATION)
  public detail::execution_context_service_base<config_service>
#endif // defined(GENERATING_DOCUMENTATION)
{
public:
#if defined(GENERATING_DOCUMENTATION)
  typedef config_service key_type;
#endif // defined(GENERATING_DOCUMENTATION)

  /// Constructor.
  ASIO_DECL explicit config_service(execution_context& ctx);

  /// Shutdown the service.
  ASIO_DECL void shutdown() override;

  /// Retrieve a configuration value.
  ASIO_DECL virtual const char* get_value(const char* section,
      const char* key, char* value, std::size_t value_len) const;
};

/// Provides access to the configuration values associated with an execution
/// context.
class config
{
public:
  /// Constructor.
  /**
   * This constructor initialises a @c config object to retrieve configuration
   * values associated with the specified execution context.
   */
  explicit config(execution_context& context)
    : service_(use_service<config_service>(context))
  {
  }

  /// Copy constructor.
  config(const config& other) noexcept
    : service_(other.service_)
  {
  }

  /// Retrieve an integral configuration value.
  template <typename T>
  constraint_t<is_integral<T>::value, T>
  get(const char* section, const char* key, T default_value) const;

private:
  config_service& service_;
};

/// Configures an execution context based on a concurrency hint.
/**
 * This configuration service is provided for backwards compatibility with
 * the existing concurrency hint mechanism.
 *
 * @par Example
 * @code asio::io_context my_io_context{
 *     asio::config_from_concurrency_hint{1}}; @endcode
 */
class config_from_concurrency_hint : public execution_context::service_maker
{
public:
  /// Construct with a default concurrency hint.
  ASIO_DECL config_from_concurrency_hint();

  /// Construct with a specified concurrency hint.
  explicit config_from_concurrency_hint(int concurrency_hint)
    : concurrency_hint_(concurrency_hint)
  {
  }

  /// Add a concrete service to the specified execution context.
  ASIO_DECL void make(execution_context& ctx) const override;

private:
  int concurrency_hint_;
};

/// Configures an execution context by reading variables from a string.
/**
 * Each variable must be on a line of its own, and of the form:
 *
 * <tt>section.key=value</tt>
 *
 * or, if an optional prefix is specified:
 *
 * <tt>prefix.section.key=value</tt>
 *
 * Blank lines and lines starting with <tt>#</tt> are ignored. It is also
 * permitted to include a comment starting with <tt>#</tt> after the value.
 *
 * @par Example
 * @code asio::io_context my_io_context{
 *     asio::config_from_string{
 *       "scheduler.concurrency_hint=10\n"
 *       "scheduler.locking=1"}}; @endcode
 */
class config_from_string : public execution_context::service_maker
{
public:
  /// Construct with the default prefix "asio".
  explicit config_from_string(std::string s)
    : string_(static_cast<std::string&&>(s)),
      prefix_()
  {
  }

  /// Construct with a specified prefix.
  config_from_string(std::string s, std::string prefix)
    : string_(static_cast<std::string&&>(s)),
      prefix_(static_cast<std::string&&>(prefix))
  {
  }

  /// Add a concrete service to the specified execution context.
  ASIO_DECL void make(execution_context& ctx) const override;

private:
  std::string string_;
  std::string prefix_;
};

/// Configures an execution context by reading environment variables.
/**
 * The environment variable names are formed by concatenating the prefix,
 * section, and key, with underscore as delimiter, and then converting the
 * resulting string to upper case.
 *
 * @par Example
 * @code asio::io_context my_io_context{
 *     asio::config_from_env{"my_app"}}; @endcode
 */
class config_from_env : public execution_context::service_maker
{
public:
  /// Construct with the default prefix "asio".
  ASIO_DECL config_from_env();

  /// Construct with a specified prefix.
  explicit config_from_env(std::string prefix)
    : prefix_(static_cast<std::string&&>(prefix))
  {
  }

  /// Add a concrete service to the specified execution context.
  ASIO_DECL void make(execution_context& ctx) const override;

private:
  std::string prefix_;
};

} // namespace asio

#include "asio/detail/pop_options.hpp"

#include "asio/impl/config.hpp"
#if defined(ASIO_HEADER_ONLY)
# include "asio/impl/config.ipp"
#endif // defined(ASIO_HEADER_ONLY)

#endif // ASIO_CONFIG_HPP
