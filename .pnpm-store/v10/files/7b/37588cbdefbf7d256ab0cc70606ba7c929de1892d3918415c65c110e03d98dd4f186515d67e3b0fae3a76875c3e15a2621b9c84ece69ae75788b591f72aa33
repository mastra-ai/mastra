/* Copyright (c) 2020, Google Inc.
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

#include <openssl/ctrdrbg.h>

#include "../fipsmodule/rand/internal.h"
#include "../internal.h"

#if defined(BORINGSSL_FIPS)

#define ENTROPY_READ_LEN \
  (/* last_block size */ 16 + CTR_DRBG_ENTROPY_LEN * BORINGSSL_FIPS_OVERREAD)

#if defined(OPENSSL_ANDROID)

#include <errno.h>
#include <stdatomic.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <sys/un.h>
#include <unistd.h>

// socket_history_t enumerates whether the entropy daemon should be contacted
// for a given entropy request. Values other than socket_not_yet_attempted are
// sticky so if the first attempt to read from the daemon fails it's assumed
// that the daemon is not present and no more attempts will be made. If the
// first attempt is successful then attempts will be made forever more.
enum socket_history_t {
  // initial value, no connections to the entropy daemon have been made yet.
  socket_not_yet_attempted = 0,
  // reading from the entropy daemon was successful
  socket_success,
  // reading from the entropy daemon failed.
  socket_failed,
};

static _Atomic enum socket_history_t g_socket_history =
    socket_not_yet_attempted;

// DAEMON_RESPONSE_LEN is the number of bytes that the entropy daemon replies
// with.
#define DAEMON_RESPONSE_LEN 496

static_assert(ENTROPY_READ_LEN == DAEMON_RESPONSE_LEN,
              "entropy daemon response length mismatch");

static int get_seed_from_daemon(uint8_t *out_entropy, size_t out_entropy_len) {
  // |RAND_need_entropy| should never call this function for more than
  // |DAEMON_RESPONSE_LEN| bytes.
  if (out_entropy_len > DAEMON_RESPONSE_LEN) {
    abort();
  }

  const enum socket_history_t socket_history = atomic_load(&g_socket_history);
  if (socket_history == socket_failed) {
    return 0;
  }

  int ret = 0;
  const int sock = socket(AF_UNIX, SOCK_STREAM, 0);
  if (sock < 0) {
    goto out;
  }

  struct sockaddr_un sun;
  memset(&sun, 0, sizeof(sun));
  sun.sun_family = AF_UNIX;
  static const char kSocketPath[] = "/dev/socket/prng_seeder";
  static_assert(sizeof(kSocketPath) <= UNIX_PATH_MAX,
                      "kSocketPath too long");
  OPENSSL_memcpy(sun.sun_path, kSocketPath, sizeof(kSocketPath));

  if (connect(sock, (struct sockaddr *)&sun, sizeof(sun))) {
    goto out;
  }

  uint8_t buffer[DAEMON_RESPONSE_LEN];
  size_t done = 0;
  while (done < sizeof(buffer)) {
    ssize_t n;
    do {
      n = read(sock, buffer + done, sizeof(buffer) - done);
    } while (n == -1 && errno == EINTR);

    if (n < 1) {
      goto out;
    }
    done += n;
  }

  if (done != DAEMON_RESPONSE_LEN) {
    // The daemon should always write |DAEMON_RESPONSE_LEN| bytes on every
    // connection.
    goto out;
  }

  assert(out_entropy_len <= DAEMON_RESPONSE_LEN);
  OPENSSL_memcpy(out_entropy, buffer, out_entropy_len);
  ret = 1;

out:
  if (socket_history == socket_not_yet_attempted) {
    enum socket_history_t expected = socket_history;
    // If another thread has already updated |g_socket_history| then we defer
    // to their value.
    atomic_compare_exchange_strong(&g_socket_history, &expected,
                                   (ret == 0) ? socket_failed : socket_success);
  }

  close(sock);
  return ret;
}

#else

static int get_seed_from_daemon(uint8_t *out_entropy, size_t out_entropy_len) {
  return 0;
}

#endif  // OPENSSL_ANDROID

// RAND_need_entropy is called by the FIPS module when it has blocked because of
// a lack of entropy. This signal is used as an indication to feed it more.
void RAND_need_entropy(size_t bytes_needed) {
  uint8_t buf[ENTROPY_READ_LEN];
  size_t todo = sizeof(buf);
  if (todo > bytes_needed) {
    todo = bytes_needed;
  }

  int want_additional_input;
  if (get_seed_from_daemon(buf, todo)) {
    want_additional_input = 1;
  } else {
    CRYPTO_get_seed_entropy(buf, todo, &want_additional_input);
  }

  if (boringssl_fips_break_test("CRNG")) {
    // This breaks the "continuous random number generator test" defined in FIPS
    // 140-2, section 4.9.2, and implemented in |rand_get_seed|.
    OPENSSL_memset(buf, 0, todo);
  }

  RAND_load_entropy(buf, todo, want_additional_input);
}

#endif  // FIPS
