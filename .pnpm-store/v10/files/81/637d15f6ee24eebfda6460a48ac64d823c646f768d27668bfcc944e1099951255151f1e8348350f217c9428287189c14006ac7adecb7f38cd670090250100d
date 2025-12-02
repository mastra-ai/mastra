/**
 * hdr_thread.h
 * Written by Philip Orwig and released to the public domain,
 * as explained at http://creativecommons.org/publicdomain/zero/1.0/
 */

#ifndef HDR_THREAD_H__
#define HDR_THREAD_H__

#include <stdint.h>

#if defined(_WIN32) || defined(_WIN64) || defined(__CYGWIN__)


#define HDR_ALIGN_PREFIX(alignment) __declspec( align(alignment) )
#define HDR_ALIGN_SUFFIX(alignment) 

typedef struct hdr_mutex
{
    uint8_t _critical_section[40];
} hdr_mutex;

#else

#include <pthread.h>

#define HDR_ALIGN_PREFIX(alignment) 
#define HDR_ALIGN_SUFFIX(alignment) __attribute__((aligned(alignment)))

typedef struct hdr_mutex
{
    pthread_mutex_t _mutex;
} hdr_mutex;
#endif

#ifdef __cplusplus
extern "C" {
#endif

struct hdr_mutex* hdr_mutex_alloc(void);
void hdr_mutex_free(struct hdr_mutex*);

int hdr_mutex_init(struct hdr_mutex* mutex);
void hdr_mutex_destroy(struct hdr_mutex* mutex);

void hdr_mutex_lock(struct hdr_mutex* mutex);
void hdr_mutex_unlock(struct hdr_mutex* mutex);

void hdr_yield(void);
int hdr_usleep(unsigned int useconds);

#ifdef __cplusplus
}
#endif
#endif
