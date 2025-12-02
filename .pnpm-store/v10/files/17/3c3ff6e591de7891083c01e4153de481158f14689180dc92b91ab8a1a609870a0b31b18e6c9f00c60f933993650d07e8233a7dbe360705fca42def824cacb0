/**
* hdr_thread.c
* Written by Philip Orwig and released to the public domain,
* as explained at http://creativecommons.org/publicdomain/zero/1.0/
*/

#include <stdlib.h>
#include <hdr/hdr_thread.h>

#ifndef HDR_MALLOC_INCLUDE
#define HDR_MALLOC_INCLUDE "hdr_malloc.h"
#endif

#include HDR_MALLOC_INCLUDE

struct hdr_mutex* hdr_mutex_alloc(void)
{
    return hdr_malloc(sizeof(hdr_mutex));
}

void hdr_mutex_free(struct hdr_mutex* mutex)
{
    hdr_free(mutex);
}

#if defined(_WIN32) || defined(_WIN64) || defined(__CYGWIN__)

#if !defined(WIN32_LEAN_AND_MEAN)
#define WIN32_LEAN_AND_MEAN
#endif

#include <windows.h>
#include <WinSock2.h>

int hdr_mutex_init(struct hdr_mutex* mutex)
{
    InitializeCriticalSection((CRITICAL_SECTION*)(mutex->_critical_section));
    return 0;
}

void hdr_mutex_destroy(struct hdr_mutex* mutex)
{
    DeleteCriticalSection((CRITICAL_SECTION*)(mutex->_critical_section));
}

void hdr_mutex_lock(struct hdr_mutex* mutex)
{
    EnterCriticalSection((CRITICAL_SECTION*)(mutex->_critical_section));
}

void hdr_mutex_unlock(struct hdr_mutex* mutex)
{
    LeaveCriticalSection((CRITICAL_SECTION*)(mutex->_critical_section));
}

void hdr_yield()
{
    Sleep(0);
}

int hdr_usleep(unsigned int useconds)
{
    struct timeval tv;

    tv.tv_sec = (long)useconds / 1000000;
    tv.tv_usec = useconds % 1000000;
    select(0, NULL, NULL, NULL, &tv);

    return 0;
}


#else
#include <pthread.h>
#include <unistd.h>

int hdr_mutex_init(struct hdr_mutex* mutex)
{
    return pthread_mutex_init(&mutex->_mutex, NULL);
}

void hdr_mutex_destroy(struct hdr_mutex* mutex)
{
    pthread_mutex_destroy(&mutex->_mutex);
}

void hdr_mutex_lock(struct hdr_mutex* mutex)
{
    pthread_mutex_lock(&mutex->_mutex);
}

void hdr_mutex_unlock(struct hdr_mutex* mutex)
{
    pthread_mutex_unlock(&mutex->_mutex);
}

void hdr_yield(void)
{
    sched_yield();
}

int hdr_usleep(unsigned int useconds)
{
    return usleep(useconds);
}


#endif
