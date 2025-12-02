/**
 * hdr_interval_recorder.h
 * Written by Michael Barker and released to the public domain,
 * as explained at http://creativecommons.org/publicdomain/zero/1.0/
 */

#include <hdr/hdr_interval_recorder.h>
#include "hdr_atomic.h"

#ifndef HDR_MALLOC_INCLUDE
#define HDR_MALLOC_INCLUDE "hdr_malloc.h"
#endif

#include HDR_MALLOC_INCLUDE

int hdr_interval_recorder_init(struct hdr_interval_recorder* r)
{
    r->active = r->inactive = NULL;
    return hdr_writer_reader_phaser_init(&r->phaser);
}

int hdr_interval_recorder_init_all(
    struct hdr_interval_recorder* r,
    int64_t lowest_discernible_value,
    int64_t highest_trackable_value,
    int significant_figures)
{
    int result;

    r->active = r->inactive = NULL;
    result = hdr_writer_reader_phaser_init(&r->phaser);
    result = result == 0
        ? hdr_init(lowest_discernible_value, highest_trackable_value, significant_figures, &r->active)
        : result;

    return result;
}

void hdr_interval_recorder_destroy(struct hdr_interval_recorder* r)
{
    hdr_writer_reader_phaser_destroy(&r->phaser);
    if (r->active) {
        hdr_close(r->active);
    }
    if (r->inactive) {
        hdr_close(r->inactive);
    }
}

struct hdr_histogram* hdr_interval_recorder_sample_and_recycle(
    struct hdr_interval_recorder* r,
    struct hdr_histogram* histogram_to_recycle)
{
    struct hdr_histogram* old_active;

    if (NULL == histogram_to_recycle)
    {
        int64_t lo = r->active->lowest_discernible_value;
        int64_t hi = r->active->highest_trackable_value;
        int significant_figures = r->active->significant_figures;
        hdr_init(lo, hi, significant_figures, &histogram_to_recycle);
    }
    else
    {
        hdr_reset(histogram_to_recycle);
    }

    hdr_phaser_reader_lock(&r->phaser);

    /* volatile read */
    old_active = hdr_atomic_load_pointer(&r->active);

    /* volatile write */
    hdr_atomic_store_pointer(&r->active, histogram_to_recycle);

    hdr_phaser_flip_phase(&r->phaser, 0);

    hdr_phaser_reader_unlock(&r->phaser);

    return old_active;
}

struct hdr_histogram* hdr_interval_recorder_sample(struct hdr_interval_recorder* r)
{
    r->inactive = hdr_interval_recorder_sample_and_recycle(r, r->inactive);
    return r->inactive;
}

static void hdr_interval_recorder_update(
    struct hdr_interval_recorder* r,
    void(*update_action)(struct hdr_histogram*, void*),
    void* arg)
{
    int64_t val = hdr_phaser_writer_enter(&r->phaser);

    void* active = hdr_atomic_load_pointer(&r->active);

    update_action(active, arg);

    hdr_phaser_writer_exit(&r->phaser, val);
}

static void update_values(struct hdr_histogram* data, void* arg)
{
    struct hdr_histogram* h = data;
    int64_t* params = arg;
    params[2] = hdr_record_values(h, params[0], params[1]);
}

static void update_values_atomic(struct hdr_histogram* data, void* arg)
{
    struct hdr_histogram* h = data;
    int64_t* params = arg;
    params[2] = hdr_record_values_atomic(h, params[0], params[1]);
}

int64_t hdr_interval_recorder_record_values(
    struct hdr_interval_recorder* r,
    int64_t value,
    int64_t count
)
{
    int64_t params[3];
    params[0] = value;
    params[1] = count;
    params[2] = 0;

    hdr_interval_recorder_update(r, update_values, &params[0]);
    return params[2];
}

int64_t hdr_interval_recorder_record_value(
    struct hdr_interval_recorder* r,
    int64_t value
)
{
    return hdr_interval_recorder_record_values(r, value, 1);
}

static void update_corrected_values(struct hdr_histogram* data, void* arg)
{
    struct hdr_histogram* h = data;
    int64_t* params = arg;
    params[3] = hdr_record_corrected_values(h, params[0], params[1], params[2]);
}

static void update_corrected_values_atomic(struct hdr_histogram* data, void* arg)
{
    struct hdr_histogram* h = data;
    int64_t* params = arg;
    params[3] = hdr_record_corrected_values_atomic(h, params[0], params[1], params[2]);
}

int64_t hdr_interval_recorder_record_corrected_values(
    struct hdr_interval_recorder* r,
    int64_t value,
    int64_t count,
    int64_t expected_interval
)
{
    int64_t params[4];
    params[0] = value;
    params[1] = count;
    params[2] = expected_interval;
    params[3] = 0;

    hdr_interval_recorder_update(r, update_corrected_values, &params[0]);
    return params[3];
}

int64_t hdr_interval_recorder_record_corrected_value(
    struct hdr_interval_recorder* r,
    int64_t value,
    int64_t expected_interval
)
{
    return hdr_interval_recorder_record_corrected_values(r, value, 1, expected_interval);
}

int64_t hdr_interval_recorder_record_value_atomic(
    struct hdr_interval_recorder* r,
    int64_t value
)
{
    return hdr_interval_recorder_record_values_atomic(r, value, 1);
}

int64_t hdr_interval_recorder_record_values_atomic(
    struct hdr_interval_recorder* r,
    int64_t value,
    int64_t count
)
{
    int64_t params[3];
    params[0] = value;
    params[1] = count;
    params[2] = 0;

    hdr_interval_recorder_update(r, update_values_atomic, &params[0]);
    return params[2];
}

int64_t hdr_interval_recorder_record_corrected_value_atomic(
    struct hdr_interval_recorder* r,
    int64_t value,
    int64_t expected_interval
)
{
    return hdr_interval_recorder_record_corrected_values_atomic(r, value, 1, expected_interval);
}

int64_t hdr_interval_recorder_record_corrected_values_atomic(
    struct hdr_interval_recorder* r,
    int64_t value,
    int64_t count,
    int64_t expected_interval
)
{
    int64_t params[4];
    params[0] = value;
    params[1] = count;
    params[2] = expected_interval;
    params[3] = 0;

    hdr_interval_recorder_update(r, update_corrected_values_atomic, &params[0]);
    return params[3];
}
