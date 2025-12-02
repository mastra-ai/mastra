//
// impl/config.ipp
// ~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IMPL_CONFIG_IPP
#define ASIO_IMPL_CONFIG_IPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/config.hpp"
#include "asio/detail/concurrency_hint.hpp"
#include <cctype>
#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <vector>
#include <utility>

#include "asio/detail/push_options.hpp"

namespace asio {

config_service::config_service(execution_context& ctx)
  : detail::execution_context_service_base<config_service>(ctx)
{
}

void config_service::shutdown()
{
}

const char* config_service::get_value(const char* /*section*/,
    const char* /*key*/, char* /*value*/, std::size_t /*value_len*/) const
{
  return nullptr;
}

namespace detail {

class config_from_concurrency_hint_service : public config_service
{
public:
  explicit config_from_concurrency_hint_service(
      execution_context& ctx, int concurrency_hint)
    : config_service(ctx),
      concurrency_hint_(concurrency_hint)
  {
  }

  const char* get_value(const char* section, const char* key,
      char* value, std::size_t value_len) const override
  {
    if (std::strcmp(section, "scheduler") == 0)
    {
      if (std::strcmp(key, "concurrency_hint") == 0)
      {
        std::snprintf(value, value_len, "%d",
            ASIO_CONCURRENCY_HINT_IS_SPECIAL(concurrency_hint_)
              ? 1 : concurrency_hint_);
        return value;
      }
      else if (std::strcmp(key, "locking") == 0)
      {
        return ASIO_CONCURRENCY_HINT_IS_LOCKING(
            SCHEDULER, concurrency_hint_) ? "1" : "0";
      }
    }
    else if (std::strcmp(section, "reactor") == 0)
    {
      if (std::strcmp(key, "io_locking") == 0)
      {
        return ASIO_CONCURRENCY_HINT_IS_LOCKING(
            REACTOR_IO, concurrency_hint_) ? "1" : "0";
      }
      else if (std::strcmp(key, "registration_locking") == 0)
      {
        return ASIO_CONCURRENCY_HINT_IS_LOCKING(
            REACTOR_REGISTRATION, concurrency_hint_) ? "1" : "0";
      }
    }
    return nullptr;
  }

private:
  int concurrency_hint_;
};

} // namespace detail

config_from_concurrency_hint::config_from_concurrency_hint()
  : concurrency_hint_(ASIO_CONCURRENCY_HINT_DEFAULT)
{
}

void config_from_concurrency_hint::make(execution_context& ctx) const
{
  (void)make_service<detail::config_from_concurrency_hint_service>(ctx,
      concurrency_hint_ == 1
        ? ASIO_CONCURRENCY_HINT_1 : concurrency_hint_);
}

namespace detail {

class config_from_string_service : public config_service
{
public:
  config_from_string_service(execution_context& ctx,
      std::string s, std::string prefix)
    : config_service(ctx),
      string_(static_cast<std::string&&>(s)),
      prefix_(static_cast<std::string&&>(prefix))
  {
    enum
    {
      expecting_key,
      key,
      expecting_equals,
      expecting_value,
      value,
      expecting_eol
    } state = expecting_key;
    std::pair<const char*, const char*> entry{};

    for (char& c : string_)
    {
      switch (state)
      {
      case expecting_key:
        switch (c)
        {
        case ' ': case '\t': case '\n':
          break;
        case '#':
          state = expecting_eol;
          break;
        default:
          entry.first = &c;
          state = key;
          break;
        }
        break;
      case key:
        switch (c)
        {
        case ' ': case '\t':
          c = 0;
          state = expecting_equals;
          break;
        case '=':
          c = 0;
          state = expecting_value;
          break;
        case '\n':
          entry.first = nullptr;
          state = expecting_key;
          break;
        case '#':
          entry.first = nullptr;
          state = expecting_eol;
          break;
        default:
          break;
        }
        break;
      case expecting_equals:
        switch (c)
        {
        case ' ': case '\t':
          break;
        case '=':
          state = expecting_value;
          break;
        case '\n':
          entry.first = nullptr;
          state = expecting_key;
          break;
        default:
          entry.first = nullptr;
          state = expecting_eol;
          break;
        }
        break;
      case expecting_value:
        switch (c)
        {
        case ' ': case '\t':
          break;
        case '\n':
          entry.first = nullptr;
          state = expecting_key;
          break;
        case '#':
          entry.first = nullptr;
          state = expecting_eol;
          break;
        default:
          entry.second = &c;
          state = value;
          break;
        }
        break;
      case value:
        switch (c)
        {
        case '\n':
          c = 0;
          entries_.push_back(entry);
          entry.first = entry.second = nullptr;
          state = expecting_key;
          break;
        case '#':
          c = 0;
          entries_.push_back(entry);
          entry.first = entry.second = nullptr;
          state = expecting_eol;
          break;
        default:
          break;
        }
        break;
      case expecting_eol:
        switch (c)
        {
        case '\n':
          state = expecting_key;
          break;
        default:
          break;
        }
        break;
      }
    }
    if (entry.first && entry.second)
      entries_.push_back(entry);
  }

  const char* get_value(const char* section, const char* key,
      char* /*value*/, std::size_t /*value_len*/) const override
  {
    std::string entry_key;
    entry_key.reserve(prefix_.length() + 1
        + std::strlen(section) + 1
        + std::strlen(key) + 1);
    entry_key.append(prefix_);
    if (!entry_key.empty())
      entry_key.append(".");
    entry_key.append(section);
    entry_key.append(".");
    entry_key.append(key);
    for (const std::pair<const char*, const char*>& entry : entries_)
      if (entry_key == entry.first)
        return entry.second;
    return nullptr;
  }

private:
  std::string string_;
  std::string prefix_;
  std::vector<std::pair<const char*, const char*>> entries_;
};

} // namespace detail

void config_from_string::make(execution_context& ctx) const
{
  (void)make_service<detail::config_from_string_service>(ctx, string_, prefix_);
}

namespace detail {

#if defined(ASIO_MSVC)
# pragma warning (push)
# pragma warning (disable:4996) // suppress unsafe warning for std::getenv
#endif // defined(ASIO_MSVC)

class config_from_env_service : public config_service
{
public:
  explicit config_from_env_service(
      execution_context& ctx, std::string prefix)
    : config_service(ctx),
      prefix_(static_cast<std::string&&>(prefix))
  {
  }

  const char* get_value(const char* section, const char* key,
      char* /*value*/, std::size_t /*value_len*/) const override
  {
    std::string env_var;
    env_var.reserve(prefix_.length() + 1
        + std::strlen(section) + 1
        + std::strlen(key) + 1);
    env_var.append(prefix_);
    if (!env_var.empty())
      env_var.append("_");
    env_var.append(section);
    env_var.append("_");
    env_var.append(key);
    for (char& c : env_var)
      c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
    return std::getenv(env_var.c_str());
  }

private:
  std::string prefix_;
};

#if defined(ASIO_MSVC)
# pragma warning (pop)
#endif // defined(ASIO_MSVC)

} // namespace detail

config_from_env::config_from_env()
  : prefix_("asio")
{
}

void config_from_env::make(execution_context& ctx) const
{
  (void)make_service<detail::config_from_env_service>(ctx, prefix_);
}

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IMPL_CONFIG_IPP
