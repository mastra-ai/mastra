/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-2021 Couchbase, Inc.
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

#include "json_streaming_lexer.hxx"
#include "core/logger/logger.hxx"

#include "third_party/jsonsl/jsonsl.h"

#include <stdexcept>

namespace couchbase::core::utils::json
{
namespace detail
{

namespace
{
void
noop_on_complete(std::error_code /* ec */,
                 std::size_t /* number_of_rows */,
                 std::string&& /* meta */)
{ /* do nothing */
}

auto
noop_on_row(std::string&& /* row */) -> stream_control
{
  return stream_control::next_row;
}

void
noop_on_meta_header_complete(std::error_code /* ec */, std::string&& /* meta_header */)
{ /* do nothing */
}
} // namespace

#define STATE_MARKER_ROOT (reinterpret_cast<void*>(1))
#define STATE_MARKER_ROWSET (reinterpret_cast<void*>(2))

struct streaming_lexer_impl {
  streaming_lexer_impl(jsonsl_t lexer, jsonsl_jpr_t pointer)
    : lexer_(lexer)
    , pointer_(pointer)
  {
  }

  streaming_lexer_impl(streaming_lexer_impl& other) = delete;
  auto operator=(const streaming_lexer_impl& other) -> const streaming_lexer_impl& = delete;
  streaming_lexer_impl(streaming_lexer_impl&& other) noexcept = delete;
  auto operator=(streaming_lexer_impl&& other) -> const streaming_lexer_impl& = delete;

  ~streaming_lexer_impl()
  {
    jsonsl_jpr_destroy(pointer_);
    jsonsl_jpr_match_state_cleanup(lexer_);
    jsonsl_destroy(lexer_);
  }

  void validate_root(struct jsonsl_state_st* state, jsonsl_jpr_match_t match)
  {
    if (root_has_been_validated_) {
      return;
    }
    root_has_been_validated_ = true;

    if (state->type != JSONSL_T_OBJECT) {
      error_ = errc::streaming_json_lexer::root_is_not_an_object;
      return;
    }

    if (match != JSONSL_MATCH_POSSIBLE) {
      error_ = errc::streaming_json_lexer::root_does_not_match_json_pointer;
      return;
    }
    /* tag the state */
    state->data = STATE_MARKER_ROOT;
  }

  [[nodiscard]] auto get_buffer_region(std::size_t pos,
                                       std::size_t desired = 0) const -> std::string_view
  {
    if (min_pos_ > pos) {
      /* swallowed */
      return { nullptr, 0 };
    }

    const char* ret = buffer_.c_str() + pos - min_pos_;
    const char* end = buffer_.c_str() + buffer_.size();
    if (ret >= end) {
      return { nullptr, 0 };
    }
    auto len = static_cast<std::size_t>(end - ret);
    if (desired > 0 && len > desired) {
      len = desired;
    }
    return { ret, len };
  }

  jsonsl_t lexer_{};
  jsonsl_jpr_t pointer_{};
  std::string meta_buffer_{};

  std::size_t number_of_rows_{};
  /**
   * whether to emit next row
   */
  bool emit_next_row_{ true };

  bool meta_complete_{ false };

  /**
   * size of the metadata header chunk (i.e. everything until the opening
   * bracket of "rows" [
   */
  std::size_t meta_header_length_{};

  /**
   * Position of last row returned. If there are no subsequent rows, this
   * signals the beginning of the metadata trailer
   */
  std::size_t last_row_end_position_{};

  /** absolute position offset corresponding to the first byte in current_buf */
  std::size_t min_pos_{};

  /** minimum (absolute) position to keep */
  std::size_t keep_position_{};

  std::string buffer_{};
  std::string last_key_{};
  std::error_code error_{};
  utils::movable_function<void(std::error_code, std::string&&)> on_meta_header_complete_{
    noop_on_meta_header_complete
  };
  std::function<void(std::error_code, std::size_t, std::string&&)> on_complete_{ noop_on_complete };
  std::function<stream_control(std::string&&)> on_row_{ noop_on_row };
  bool root_has_been_validated_{ false };
};
} // namespace detail

namespace
{
auto
convert_status(jsonsl_error_t error) -> std::error_code
{
  switch (error) {
    case JSONSL_ERROR_SUCCESS:
      return {};

    case JSONSL_ERROR_GARBAGE_TRAILING:
      return errc::streaming_json_lexer::garbage_trailing;

    case JSONSL_ERROR_SPECIAL_EXPECTED:
      return errc::streaming_json_lexer::special_expected;

    case JSONSL_ERROR_SPECIAL_INCOMPLETE:
      return errc::streaming_json_lexer::special_incomplete;

    case JSONSL_ERROR_STRAY_TOKEN:
      return errc::streaming_json_lexer::stray_token;

    case JSONSL_ERROR_MISSING_TOKEN:
      return errc::streaming_json_lexer::missing_token;

    case JSONSL_ERROR_CANT_INSERT:
      return errc::streaming_json_lexer::cannot_insert;

    case JSONSL_ERROR_ESCAPE_OUTSIDE_STRING:
      return errc::streaming_json_lexer::escape_outside_string;

    case JSONSL_ERROR_KEY_OUTSIDE_OBJECT:
      return errc::streaming_json_lexer::key_outside_object;

    case JSONSL_ERROR_STRING_OUTSIDE_CONTAINER:
      return errc::streaming_json_lexer::string_outside_container;

    case JSONSL_ERROR_FOUND_NULL_BYTE:
      return errc::streaming_json_lexer::found_null_byte;

    case JSONSL_ERROR_LEVELS_EXCEEDED:
      return errc::streaming_json_lexer::levels_exceeded;

    case JSONSL_ERROR_BRACKET_MISMATCH:
      return errc::streaming_json_lexer::bracket_mismatch;

    case JSONSL_ERROR_HKEY_EXPECTED:
      return errc::streaming_json_lexer::object_key_expected;

    case JSONSL_ERROR_WEIRD_WHITESPACE:
      return errc::streaming_json_lexer::weird_whitespace;

    case JSONSL_ERROR_UESCAPE_TOOSHORT:
      return errc::streaming_json_lexer::unicode_escape_is_too_short;

    case JSONSL_ERROR_ESCAPE_INVALID:
      return errc::streaming_json_lexer::escape_invalid;

    case JSONSL_ERROR_TRAILING_COMMA:
      return errc::streaming_json_lexer::trailing_comma;

    case JSONSL_ERROR_INVALID_NUMBER:
      return errc::streaming_json_lexer::invalid_number;

    case JSONSL_ERROR_VALUE_EXPECTED:
      return errc::streaming_json_lexer::value_expected;

    case JSONSL_ERROR_PERCENT_BADHEX:
      return errc::streaming_json_lexer::percent_bad_hex;

    case JSONSL_ERROR_JPR_BADPATH:
      return errc::streaming_json_lexer::json_pointer_bad_path;

    case JSONSL_ERROR_JPR_DUPSLASH:
      return errc::streaming_json_lexer::json_pointer_duplicated_slash;

    case JSONSL_ERROR_JPR_NOROOT:
      return errc::streaming_json_lexer::json_pointer_missing_root;

    case JSONSL_ERROR_ENOMEM:
      return errc::streaming_json_lexer::not_enough_memory;

    case JSONSL_ERROR_INVALID_CODEPOINT:
      return errc::streaming_json_lexer::invalid_codepoint;

    case JSONSL_ERROR_GENERIC:
      return errc::streaming_json_lexer::generic;

    default:
      break;
  }
  return errc::streaming_json_lexer::generic;
}

auto
error_callback(jsonsl_t lexer,
               jsonsl_error_t error,
               struct jsonsl_state_st* /* state */,
               jsonsl_char_t* /* at */) -> int
{
  auto* impl = static_cast<detail::streaming_lexer_impl*>(lexer->data);

  impl->error_ = convert_status(error);

  impl->on_meta_header_complete_(impl->error_, {});
  impl->on_meta_header_complete_ = detail::noop_on_meta_header_complete;

  impl->on_complete_(impl->error_, impl->number_of_rows_, {});
  impl->on_complete_ = detail::noop_on_complete;

  return 0;
}

void
meta_header_complete_callback(jsonsl_t lexer,
                              jsonsl_action_t /* action */,
                              struct jsonsl_state_st* state,
                              const jsonsl_char_t* /* at */)
{
  auto* impl = static_cast<detail::streaming_lexer_impl*>(lexer->data);

  impl->meta_buffer_.append(impl->buffer_.c_str(), state->pos_begin);
  impl->meta_header_length_ = state->pos_begin;
  lexer->action_callback_PUSH = nullptr;

  auto meta_header = impl->meta_buffer_;
  impl->on_meta_header_complete_({}, std::move(meta_header));
  impl->on_meta_header_complete_ = detail::noop_on_meta_header_complete;
}

void
trailer_pop_callback(jsonsl_t lexer,
                     jsonsl_action_t /* action */,
                     struct jsonsl_state_st* state,
                     const jsonsl_char_t* /* at */)
{
  if (state->data != STATE_MARKER_ROOT) {
    return;
  }

  auto* impl = static_cast<detail::streaming_lexer_impl*>(lexer->data);

  if (impl->meta_complete_) {
    return;
  }

  impl->meta_buffer_.resize(impl->meta_header_length_);
  impl->meta_buffer_.append(impl->get_buffer_region(impl->last_row_end_position_));
  impl->meta_complete_ = true;

  // This will have no effect if on_meta_header_complete has already been called.
  auto meta_header = impl->meta_buffer_;
  impl->on_meta_header_complete_({}, std::move(meta_header));
  impl->on_meta_header_complete_ = detail::noop_on_meta_header_complete;

  impl->on_complete_({}, impl->number_of_rows_, std::move(impl->meta_buffer_));
}

void
row_pop_callback(jsonsl_t lexer,
                 jsonsl_action_t /* action */,
                 struct jsonsl_state_st* state,
                 const jsonsl_char_t* /* at */)
{
  auto* impl = static_cast<detail::streaming_lexer_impl*>(lexer->data);

  if (impl->error_) {
    return;
  }

  impl->keep_position_ = lexer->pos;
  impl->last_row_end_position_ = lexer->pos;

  if (state->data == STATE_MARKER_ROWSET) {
    lexer->action_callback_POP = trailer_pop_callback;
    lexer->action_callback_PUSH = nullptr;
    if (impl->number_of_rows_ == 0) {
      /* While the entire meta is available to us, the _closing_ part
       * of the meta is handled in a different callback. */
      impl->meta_buffer_.append(impl->buffer_.c_str(), lexer->pos);
      impl->meta_header_length_ = lexer->pos;
    }
    return;
  }

  impl->number_of_rows_++;
  if (impl->meta_complete_) {
    return;
  }

  if (impl->emit_next_row_) {
    auto row = impl->get_buffer_region(
      state->pos_begin, lexer->pos - state->pos_begin + (state->type == JSONSL_T_SPECIAL ? 0 : 1));
    auto rc = impl->on_row_(std::string(row));
    impl->emit_next_row_ = rc == stream_control::next_row;
    if (!impl->emit_next_row_) {
      impl->on_row_ = detail::noop_on_row;
    }
  }
}

void
initial_action_pop_callback(jsonsl_t lexer,
                            jsonsl_action_t action,
                            struct jsonsl_state_st* state,
                            const jsonsl_char_t* at)
{
  auto* impl = static_cast<detail::streaming_lexer_impl*>(lexer->data);

  if (impl->error_) {
    return;
  }

  if (state->type == JSONSL_T_HKEY) {
    impl->last_key_ =
      impl->buffer_.substr(state->pos_begin + 1, state->pos_cur - state->pos_begin - 1);
  }

  if (state->data == STATE_MARKER_ROOT) {
    trailer_pop_callback(lexer, action, state, at);
  }
}

void
initial_action_push_callback(jsonsl_t lexer,
                             jsonsl_action_t /* action */,
                             struct jsonsl_state_st* state,
                             const jsonsl_char_t* /* at */)
{
  auto* impl = static_cast<detail::streaming_lexer_impl*>(lexer->data);

  if (impl->error_) {
    return;
  }

  jsonsl_jpr_match_t match = JSONSL_MATCH_UNKNOWN;
  if (state->type != JSONSL_T_HKEY) {
    auto key = std::move(impl->last_key_);
    jsonsl_jpr_match_state(lexer, state, key.data(), key.size(), &match);
  }
  impl->validate_root(state, match);
  if (state->type == JSONSL_T_LIST && match == JSONSL_MATCH_POSSIBLE) {
    /* we have a match, e.g. "rows:[]" */
    lexer->action_callback_POP = row_pop_callback;
    lexer->action_callback_PUSH = meta_header_complete_callback;
    state->data = STATE_MARKER_ROWSET;
  }
}
} // namespace

json::streaming_lexer::streaming_lexer(const std::string& pointer_expression, std::uint32_t depth)
{
  jsonsl_error_t error = JSONSL_ERROR_SUCCESS;
  jsonsl_jpr_t ptr = jsonsl_jpr_new(pointer_expression.c_str(), &error);
  if (ptr == nullptr) {
    throw std::invalid_argument("unable to allocate JSON pointer");
  }
  if (error != JSONSL_ERROR_SUCCESS) {
    throw std::invalid_argument(std::string("unable to create JSON pointer: ") +
                                jsonsl_strerror(error));
  }

  impl_ = std::make_shared<detail::streaming_lexer_impl>(jsonsl_new(512), ptr);
  impl_->lexer_->data = impl_.get();
  impl_->lexer_->action_callback_PUSH = initial_action_push_callback;
  impl_->lexer_->action_callback_POP = initial_action_pop_callback;
  impl_->lexer_->error_callback = error_callback;
  jsonsl_jpr_match_state_init(impl_->lexer_, &impl_->pointer_, 1);
  jsonsl_enable_all_callbacks(impl_->lexer_);
  impl_->lexer_->max_callback_level = depth;
}

void
streaming_lexer::feed(std::string_view data)
{
  impl_->buffer_.append(data);
  jsonsl_feed(impl_->lexer_, data.data(), data.size());

  /* Do we need to cut off some bytes? */
  if (impl_->keep_position_ > impl_->min_pos_) {
    impl_->buffer_.erase(0, impl_->keep_position_ - impl_->min_pos_);
  }
  impl_->min_pos_ = impl_->keep_position_;
}

void
streaming_lexer::on_metadata_header_complete(
  utils::movable_function<void(std::error_code, std::string&&)> handler)
{
  impl_->on_meta_header_complete_ = std::move(handler);
}

void
streaming_lexer::on_complete(
  std::function<void(std::error_code, std::size_t, std::string&&)> handler)
{
  impl_->on_complete_ = std::move(handler);
}

void
streaming_lexer::on_row(std::function<stream_control(std::string&&)> handler)
{
  impl_->on_row_ = std::move(handler);
}
} // namespace couchbase::core::utils::json
