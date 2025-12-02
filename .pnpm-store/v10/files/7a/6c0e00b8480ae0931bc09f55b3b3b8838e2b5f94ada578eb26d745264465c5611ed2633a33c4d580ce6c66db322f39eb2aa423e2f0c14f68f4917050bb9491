/* Copyright (c) 2023, Google Inc.
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

#include "internal.h"

// While Arm system registers are normally not available to userspace, FreeBSD
// expects userspace to simply read them. It traps the reads and fills in CPU
// capabilities.
#if defined(OPENSSL_AARCH64) && !defined(OPENSSL_STATIC_ARMCAP) && \
    (defined(ANDROID_BAREMETAL) || defined(OPENSSL_FREEBSD))

#include <openssl/arm_arch.h>

#define ID_AA64PFR0_EL1_ADVSIMD 5

#define ID_AA64ISAR0_EL1_AES 1
#define ID_AA64ISAR0_EL1_SHA1 2
#define ID_AA64ISAR0_EL1_SHA2 3

#define NBITS_ID_FIELD 4

#define READ_SYSREG(name)                \
  ({                                     \
    uint64_t _r;                         \
    __asm__("mrs %0, " name : "=r"(_r)); \
    _r;                                  \
  })

static unsigned get_id_field(uint64_t reg, unsigned field) {
  return (reg >> (field * NBITS_ID_FIELD)) & ((1 << NBITS_ID_FIELD) - 1);
}

static int get_signed_id_field(uint64_t reg, unsigned field) {
  unsigned value = get_id_field(reg, field);
  if (value & (1 << (NBITS_ID_FIELD - 1))) {
    return (int)(value | (UINT64_MAX << NBITS_ID_FIELD));
  } else {
    return (int)value;
  }
}

static uint32_t read_armcap(void) {
  uint32_t armcap = ARMV7_NEON;

  uint64_t id_aa64pfr0_el1 = READ_SYSREG("id_aa64pfr0_el1");

  if (get_signed_id_field(id_aa64pfr0_el1, ID_AA64PFR0_EL1_ADVSIMD) < 0) {
    // If AdvSIMD ("NEON") is missing, don't report other features either.
    // This matches OpenSSL.
    return 0;
  }

  uint64_t id_aa64isar0_el1 = READ_SYSREG("id_aa64isar0_el1");

  unsigned aes = get_id_field(id_aa64isar0_el1, ID_AA64ISAR0_EL1_AES);
  if (aes > 0) {
    armcap |= ARMV8_AES;
  }
  if (aes > 1) {
    armcap |= ARMV8_PMULL;
  }

  unsigned sha1 = get_id_field(id_aa64isar0_el1, ID_AA64ISAR0_EL1_SHA1);
  if (sha1 > 0) {
    armcap |= ARMV8_SHA1;
  }

  unsigned sha2 = get_id_field(id_aa64isar0_el1, ID_AA64ISAR0_EL1_SHA2);
  if (sha2 > 0) {
    armcap |= ARMV8_SHA256;
  }
  if (sha2 > 1) {
    armcap |= ARMV8_SHA512;
  }

  return armcap;
}

void OPENSSL_cpuid_setup(void) { OPENSSL_armcap_P |= read_armcap(); }

#endif  // OPENSSL_AARCH64 && !OPENSSL_STATIC_ARMCAP &&
        // (ANDROID_BAREMETAL || OPENSSL_FREEBSD)
