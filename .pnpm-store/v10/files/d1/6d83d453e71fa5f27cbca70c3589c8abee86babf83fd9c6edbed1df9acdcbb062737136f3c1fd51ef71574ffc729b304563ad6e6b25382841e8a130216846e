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

#include "internal.h"

#if defined(OPENSSL_ARM) && defined(OPENSSL_FREEBSD) && \
    !defined(OPENSSL_STATIC_ARMCAP)
#include <sys/auxv.h>
#include <sys/types.h>

#include <openssl/arm_arch.h>
#include <openssl/mem.h>


void OPENSSL_cpuid_setup(void) {
  unsigned long hwcap = 0, hwcap2 = 0;

  // |elf_aux_info| may fail, in which case |hwcap| and |hwcap2| will be
  // left at zero. The rest of this function will then gracefully report
  // the features are absent.
  elf_aux_info(AT_HWCAP, &hwcap, sizeof(hwcap));
  elf_aux_info(AT_HWCAP2, &hwcap2, sizeof(hwcap2));

  // Matching OpenSSL, only report other features if NEON is present.
  if (hwcap & HWCAP_NEON) {
    OPENSSL_armcap_P |= ARMV7_NEON;

    if (hwcap2 & HWCAP2_AES) {
      OPENSSL_armcap_P |= ARMV8_AES;
    }
    if (hwcap2 & HWCAP2_PMULL) {
      OPENSSL_armcap_P |= ARMV8_PMULL;
    }
    if (hwcap2 & HWCAP2_SHA1) {
      OPENSSL_armcap_P |= ARMV8_SHA1;
    }
    if (hwcap2 & HWCAP2_SHA2) {
      OPENSSL_armcap_P |= ARMV8_SHA256;
    }
  }
}

#endif  // OPENSSL_ARM && OPENSSL_OPENBSD && !OPENSSL_STATIC_ARMCAP
