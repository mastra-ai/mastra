/* Copyright (c) 2022, Robert Nagy <robert.nagy@gmail.com>
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

#include <openssl/cpu.h>

#if defined(OPENSSL_AARCH64) && defined(OPENSSL_OPENBSD) && \
    !defined(OPENSSL_STATIC_ARMCAP)

#include <sys/sysctl.h>
#include <machine/cpu.h>
#include <machine/armreg.h>

#include <openssl/arm_arch.h>

#include "internal.h"


void OPENSSL_cpuid_setup(void) {
  int isar0_mib[] = { CTL_MACHDEP, CPU_ID_AA64ISAR0 };
  uint64_t cpu_id = 0;
  size_t len = sizeof(cpu_id);

  if (sysctl(isar0_mib, 2, &cpu_id, &len, NULL, 0) < 0) {
    return;
  }

  OPENSSL_armcap_P |= ARMV7_NEON;

  if (ID_AA64ISAR0_AES(cpu_id) >= ID_AA64ISAR0_AES_BASE) {
    OPENSSL_armcap_P |= ARMV8_AES;
  }

  if (ID_AA64ISAR0_AES(cpu_id) >= ID_AA64ISAR0_AES_PMULL) {
    OPENSSL_armcap_P |= ARMV8_PMULL;
  }

  if (ID_AA64ISAR0_SHA1(cpu_id) >= ID_AA64ISAR0_SHA1_BASE) {
    OPENSSL_armcap_P |= ARMV8_SHA1;
  }

  if (ID_AA64ISAR0_SHA2(cpu_id) >= ID_AA64ISAR0_SHA2_BASE) {
    OPENSSL_armcap_P |= ARMV8_SHA256;
  }

  if (ID_AA64ISAR0_SHA2(cpu_id) >= ID_AA64ISAR0_SHA2_512) {
    OPENSSL_armcap_P |= ARMV8_SHA512;
  }
}

#endif  // OPENSSL_AARCH64 && OPENSSL_OPENBSD && !OPENSSL_STATIC_ARMCAP
