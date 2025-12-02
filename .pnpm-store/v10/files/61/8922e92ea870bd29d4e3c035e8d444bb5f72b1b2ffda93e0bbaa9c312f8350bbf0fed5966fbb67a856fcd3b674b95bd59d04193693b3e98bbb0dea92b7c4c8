/* ====================================================================
 * Copyright (c) 1998-2011 The OpenSSL Project.  All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in
 *    the documentation and/or other materials provided with the
 *    distribution.
 *
 * 3. All advertising materials mentioning features or use of this
 *    software must display the following acknowledgment:
 *    "This product includes software developed by the OpenSSL Project
 *    for use in the OpenSSL Toolkit. (http://www.openssl.org/)"
 *
 * 4. The names "OpenSSL Toolkit" and "OpenSSL Project" must not be used to
 *    endorse or promote products derived from this software without
 *    prior written permission. For written permission, please contact
 *    openssl-core@openssl.org.
 *
 * 5. Products derived from this software may not be called "OpenSSL"
 *    nor may "OpenSSL" appear in their names without prior written
 *    permission of the OpenSSL Project.
 *
 * 6. Redistributions of any form whatsoever must retain the following
 *    acknowledgment:
 *    "This product includes software developed by the OpenSSL Project
 *    for use in the OpenSSL Toolkit (http://www.openssl.org/)"
 *
 * THIS SOFTWARE IS PROVIDED BY THE OpenSSL PROJECT ``AS IS'' AND ANY
 * EXPRESSED OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE OpenSSL PROJECT OR
 * ITS CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 * NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
 * STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
 * OF THE POSSIBILITY OF SUCH DAMAGE.
 * ====================================================================
 *
 * This product includes cryptographic software written by Eric Young
 * (eay@cryptsoft.com).  This product includes software written by Tim
 * Hudson (tjh@cryptsoft.com). */

#ifndef OPENSSL_HEADER_ARM_ARCH_H
#define OPENSSL_HEADER_ARM_ARCH_H

#include <openssl/target.h>

// arm_arch.h contains symbols used by ARM assembly, and the C code that calls
// it. It is included as a public header to simplify the build, but is not
// intended for external use.

#if defined(OPENSSL_ARM) || defined(OPENSSL_AARCH64)

// ARMV7_NEON is true when a NEON unit is present in the current CPU.
#define ARMV7_NEON (1 << 0)

// ARMV8_AES indicates support for hardware AES instructions.
#define ARMV8_AES (1 << 2)

// ARMV8_SHA1 indicates support for hardware SHA-1 instructions.
#define ARMV8_SHA1 (1 << 3)

// ARMV8_SHA256 indicates support for hardware SHA-256 instructions.
#define ARMV8_SHA256 (1 << 4)

// ARMV8_PMULL indicates support for carryless multiplication.
#define ARMV8_PMULL (1 << 5)

// ARMV8_SHA512 indicates support for hardware SHA-512 instructions.
#define ARMV8_SHA512 (1 << 6)

#if defined(__ASSEMBLER__)

// We require the ARM assembler provide |__ARM_ARCH| from Arm C Language
// Extensions (ACLE). This is supported in GCC 4.8+ and Clang 3.2+. MSVC does
// not implement ACLE, but we require Clang's assembler on Windows.
#if !defined(__ARM_ARCH)
#error "ARM assembler must define __ARM_ARCH"
#endif

// __ARM_ARCH__ is used by OpenSSL assembly to determine the minimum target ARM
// version.
//
// TODO(davidben): Switch the assembly to use |__ARM_ARCH| directly.
#define __ARM_ARCH__ __ARM_ARCH

// Even when building for 32-bit ARM, support for aarch64 crypto instructions
// will be included.
#define __ARM_MAX_ARCH__ 8

#endif  // __ASSEMBLER__

#endif  // ARM || AARCH64

#endif  // OPENSSL_HEADER_ARM_ARCH_H
