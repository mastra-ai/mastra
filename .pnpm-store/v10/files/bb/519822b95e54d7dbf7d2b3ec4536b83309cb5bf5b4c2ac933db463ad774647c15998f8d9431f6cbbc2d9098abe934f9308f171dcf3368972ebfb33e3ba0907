/* Copyright (c) 2022, Google Inc.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 * SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 * OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 * CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE. */

#ifndef OPENSSL_HEADER_RUST_WRAPPER_H
#define OPENSSL_HEADER_RUST_WRAPPER_H

#include <openssl/err.h>

#if defined(__cplusplus)
extern "C" {
#endif


// The following functions are wrappers over inline functions and macros in
// BoringSSL, which bindgen cannot currently correctly bind. These wrappers
// ensure changes to the functions remain in lockstep with the Rust versions.
int ERR_GET_LIB_RUST(uint32_t packed_error);
int ERR_GET_REASON_RUST(uint32_t packed_error);
int ERR_GET_FUNC_RUST(uint32_t packed_error);


#if defined(__cplusplus)
}  // extern C
#endif

#endif  // OPENSSL_HEADER_RUST_WRAPPER_H
