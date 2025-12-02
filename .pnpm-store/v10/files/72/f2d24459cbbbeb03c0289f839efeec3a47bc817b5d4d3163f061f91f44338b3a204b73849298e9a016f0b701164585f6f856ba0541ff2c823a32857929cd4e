/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2015 Couchbase, Inc
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

#include <stdio.h>

#ifdef __cplusplus
extern "C" {
#else
#include <stdbool.h>
#endif

typedef void (*write_cb_t)(void* ctx, const char* frame);

/**
 * Prints a backtrace from the current thread. For each frame, the
 * `write_cb` function is called with `context` and a string describing
 * the frame.
 */
void
print_backtrace(write_cb_t write_cb, void* context);

/**
 * Convenience function - prints a backtrace to the specified FILE.
 */
void
print_backtrace_to_file(FILE* stream);

/**
 * print a backtrace to a buffer
 *
 * @param indent the indent used for each entry in the callstack
 * @param buffer the buffer to populate with the backtrace
 * @param size the size of the input buffer
 */
bool
print_backtrace_to_buffer(const char* indent, char* buffer, size_t size);

#ifdef __cplusplus
} // extern "C"
#endif
