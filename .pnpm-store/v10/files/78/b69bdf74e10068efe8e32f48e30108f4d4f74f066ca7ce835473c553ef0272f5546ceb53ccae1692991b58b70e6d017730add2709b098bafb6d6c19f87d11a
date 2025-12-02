/**
 * hdr_writer_reader_phaser.h
 * Written by Michael Barker and released to the public domain,
 * as explained at http://creativecommons.org/publicdomain/zero/1.0/
 */

#include <stdint.h>
#include <stdbool.h>
#include <errno.h>

#include <hdr/hdr_thread.h>
#include <hdr/hdr_writer_reader_phaser.h>
#include "hdr_atomic.h"

#ifndef HDR_MALLOC_INCLUDE
#define HDR_MALLOC_INCLUDE "hdr_malloc.h"
#endif

#include HDR_MALLOC_INCLUDE

static int64_t _hdr_phaser_get_epoch(int64_t* field)
{
    return hdr_atomic_load_64(field);
}

static void _hdr_phaser_set_epoch(int64_t* field, int64_t val)
{
    hdr_atomic_store_64(field, val);
}

static int64_t _hdr_phaser_reset_epoch(int64_t* field, int64_t initial_value)
{
    return hdr_atomic_exchange_64(field, initial_value);
}

int hdr_writer_reader_phaser_init(struct hdr_writer_reader_phaser* p)
{
    int rc;
    if (NULL == p)
    {
        return EINVAL;
    }

    p->start_epoch = 0;
    p->even_end_epoch = 0;
    p->odd_end_epoch = INT64_MIN;
    p->reader_mutex = hdr_mutex_alloc();

    if (!p->reader_mutex)
    {
        return ENOMEM;
    }

    rc = hdr_mutex_init(p->reader_mutex);
    if (0 != rc)
    {
        return rc;
    }

    /* TODO: Should I fence here. */

    return 0;
}

void hdr_writer_reader_phaser_destroy(struct hdr_writer_reader_phaser* p)
{
    hdr_mutex_destroy(p->reader_mutex);
    hdr_mutex_free(p->reader_mutex);
}

int64_t hdr_phaser_writer_enter(struct hdr_writer_reader_phaser* p)
{
    return hdr_atomic_add_fetch_64(&p->start_epoch, 1);
}

void hdr_phaser_writer_exit(
    struct hdr_writer_reader_phaser* p, int64_t critical_value_at_enter)
{
    int64_t* end_epoch =
        (critical_value_at_enter < 0) ? &p->odd_end_epoch : &p->even_end_epoch;
    hdr_atomic_add_fetch_64(end_epoch, 1);
}

void hdr_phaser_reader_lock(struct hdr_writer_reader_phaser* p)
{
    hdr_mutex_lock(p->reader_mutex);
}

void hdr_phaser_reader_unlock(struct hdr_writer_reader_phaser* p)
{
    hdr_mutex_unlock(p->reader_mutex);
}

void hdr_phaser_flip_phase(
    struct hdr_writer_reader_phaser* p, int64_t sleep_time_ns)
{
    bool caught_up;
    int64_t start_value_at_flip;
    /* TODO: is_held_by_current_thread */
    unsigned int sleep_time_us = sleep_time_ns < 1000000000 ? (unsigned int) (sleep_time_ns / 1000) : 1000000;

    int64_t start_epoch = _hdr_phaser_get_epoch(&p->start_epoch);

    bool next_phase_is_even = (start_epoch < 0);

    /* Clear currently used phase end epoch.*/
    int64_t initial_start_value;
    if (next_phase_is_even)
    {
        initial_start_value = 0;
        _hdr_phaser_set_epoch(&p->even_end_epoch, initial_start_value);
    }
    else
    {
        initial_start_value = INT64_MIN;
        _hdr_phaser_set_epoch(&p->odd_end_epoch, initial_start_value);
    }

    /* Reset start value, indicating new phase.*/
    start_value_at_flip = _hdr_phaser_reset_epoch(&p->start_epoch, initial_start_value);

    do
    {
        int64_t* end_epoch =
            next_phase_is_even ? &p->odd_end_epoch : &p->even_end_epoch;

        caught_up = _hdr_phaser_get_epoch(end_epoch) == start_value_at_flip;

        if (!caught_up)
        {
            if (sleep_time_us <= 0)
            {
                hdr_yield();
            }
            else
            {
                hdr_usleep(sleep_time_us);
            }
        }
    }
    while (!caught_up);
}
