/**
 * hdr_encoding.c
 * Written by Michael Barker and released to the public domain,
 * as explained at http://creativecommons.org/publicdomain/zero/1.0/
 */

#include <errno.h>
#include <stddef.h>
#include <math.h>

#include "hdr_encoding.h"
#include "hdr_tests.h"

int zig_zag_encode_i64(uint8_t* buffer, int64_t signed_value)
{
    int bytesWritten;
    int64_t value = signed_value;

    value = (value << 1) ^ (value >> 63);
    if (value >> 7 == 0)
    {
        buffer[0] = (uint8_t) value;
        bytesWritten = 1;
    }
    else
    {
        buffer[0] = (uint8_t) ((value & 0x7F) | 0x80);
        if (value >> 14 == 0)
        {
            buffer[1] = (uint8_t) (value >> 7);
            bytesWritten = 2;
        }
        else
        {
            buffer[1] = (uint8_t) ((value >> 7 | 0x80));
            if (value >> 21 == 0)
            {
                buffer[2] = (uint8_t) (value >> 14);
                bytesWritten = 3;
            }
            else
            {
                buffer[2] = (uint8_t) (value >> 14 | 0x80);
                if (value >> 28 == 0)
                {
                    buffer[3] = (uint8_t) (value >> 21);
                    bytesWritten = 4;
                }
                else
                {
                    buffer[3] = (uint8_t) (value >> 21 | 0x80);
                    if (value >> 35 == 0)
                    {
                        buffer[4] = (uint8_t) (value >> 28);
                        bytesWritten = 5;
                    }
                    else
                    {
                        buffer[4] = (uint8_t) (value >> 28 | 0x80);
                        if (value >> 42 == 0)
                        {
                            buffer[5] = (uint8_t) (value >> 35);
                            bytesWritten = 6;
                        }
                        else
                        {
                            buffer[5] = (uint8_t) (value >> 35 | 0x80);
                            if (value >> 49 == 0)
                            {
                                buffer[6] = (uint8_t) (value >> 42);
                                bytesWritten = 7;
                            }
                            else
                            {
                                buffer[6] = (uint8_t) (value >> 42 | 0x80);
                                if (value >> 56 == 0)
                                {
                                    buffer[7] = (uint8_t) (value >> 49);
                                    bytesWritten = 8;
                                }
                                else
                                {
                                    buffer[7] = (uint8_t) (value >> 49 | 0x80);
                                    buffer[8] = (uint8_t) (value >> 56);
                                    bytesWritten = 9;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    return bytesWritten;
}

int zig_zag_decode_i64(const uint8_t* buffer, int64_t* signed_value)
{
    uint64_t v = buffer[0];
    uint64_t value = v & 0x7F;
    int bytesRead = 1;
    if ((v & 0x80) != 0)
    {
        bytesRead = 2;
        v = buffer[1];
        value |= (v & 0x7F) << 7;
        if ((v & 0x80) != 0)
        {
            bytesRead = 3;
            v = buffer[2];
            value |= (v & 0x7F) << 14;
            if ((v & 0x80) != 0)
            {
                bytesRead = 4;
                v = buffer[3];
                value |= (v & 0x7F) << 21;
                if ((v & 0x80) != 0)
                {
                    bytesRead = 5;
                    v = buffer[4];
                    value |= (v & 0x7F) << 28;
                    if ((v & 0x80) != 0)
                    {
                        bytesRead = 6;
                        v = buffer[5];
                        value |= (v & 0x7F) << 35;
                        if ((v & 0x80) != 0)
                        {
                            bytesRead = 7;
                            v = buffer[6];
                            value |= (v & 0x7F) << 42;
                            if ((v & 0x80) != 0)
                            {
                                bytesRead = 8;
                                v = buffer[7];
                                value |= (v & 0x7F) << 49;
                                if ((v & 0x80) != 0)
                                {
                                    bytesRead = 9;
                                    v = buffer[8];
                                    value |= v << 56;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

#if defined(_MSC_VER)
#pragma warning(push)
#pragma warning(disable: 4146) /* C4146: unary minus operator applied to unsigned type, result still unsigned */
#endif
    value = (value >> 1) ^ (-(value & 1));
#if defined(_MSC_VER)
#pragma warning(pop)
#endif
    *signed_value = (int64_t) value;

    return bytesRead;
}

static const char base64_table[] =
    {
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
        'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
        'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '/', '\0'
    };

static char get_base_64(uint32_t _24_bit_value, int shift)
{
    uint32_t _6_bit_value = 0x3F & (_24_bit_value >> shift);
    return base64_table[_6_bit_value];
}

static int from_base_64(int c)
{
    if ('A' <= c && c <= 'Z')
    {
        return c - 'A';
    }
    else if ('a' <= c && c <= 'z')
    {
        return (c - 'a') + 26;
    }
    else if ('0' <= c && c <= '9')
    {
        return (c - '0') + 52;
    }
    else if ('+' == c)
    {
        return 62;
    }
    else if ('/' == c)
    {
        return 63;
    }
    else if ('=' == c)
    {
        return 0;
    }

    return EINVAL;
}

size_t hdr_base64_encoded_len(size_t decoded_size)
{
    return (size_t) (ceil(decoded_size / 3.0) * 4.0);
}

size_t hdr_base64_decoded_len(size_t encoded_size)
{
    return (encoded_size / 4) * 3;
}

static void hdr_base64_encode_block_pad(const uint8_t* input, char* output, size_t pad)
{
    uint32_t _24_bit_value = 0;

    switch (pad)
    {
        case 2:
            _24_bit_value = (input[0] << 16) + (input[1] << 8);

            output[0] = get_base_64(_24_bit_value, 18);
            output[1] = get_base_64(_24_bit_value, 12);
            output[2] = get_base_64(_24_bit_value,  6);
            output[3] = '=';

            break;

        case 1:
            _24_bit_value = (input[0] << 16);

            output[0] = get_base_64(_24_bit_value, 18);
            output[1] = get_base_64(_24_bit_value, 12);
            output[2] = '=';
            output[3] = '=';

            break;

        default:
            /* No-op */
            break;
    }
}

/**
 * Assumes that there is 3 input bytes and 4 output chars.
 */
void hdr_base64_encode_block(const uint8_t* input, char* output)
{
    uint32_t _24_bit_value = (input[0] << 16) + (input[1] << 8) + (input[2]);

    output[0] = get_base_64(_24_bit_value, 18);
    output[1] = get_base_64(_24_bit_value, 12);
    output[2] = get_base_64(_24_bit_value,  6);
    output[3] = get_base_64(_24_bit_value,  0);
}

int hdr_base64_encode(
    const uint8_t* input, size_t input_len, char* output, size_t output_len)
{
    size_t i, j, remaining;

    if (hdr_base64_encoded_len(input_len) != output_len)
    {
        return EINVAL;
    }

    for (i = 0, j = 0; input_len - i >= 3 && j < output_len; i += 3, j += 4)
    {
        hdr_base64_encode_block(&input[i], &output[j]);
    }

    remaining = input_len - i;

    hdr_base64_encode_block_pad(&input[i], &output[j], remaining);

    return 0;
}

/**
 * Assumes that there is 4 input chars available and 3 output chars.
 */
void hdr_base64_decode_block(const char* input, uint8_t* output)
{
    uint32_t _24_bit_value = 0;

    _24_bit_value |= from_base_64(input[0]) << 18;
    _24_bit_value |= from_base_64(input[1]) << 12;
    _24_bit_value |= from_base_64(input[2]) << 6;
    _24_bit_value |= from_base_64(input[3]);

    output[0] = (uint8_t) ((_24_bit_value >> 16) & 0xFF);
    output[1] = (uint8_t) ((_24_bit_value >> 8) & 0xFF);
    output[2] = (uint8_t) ((_24_bit_value) & 0xFF);
}

int hdr_base64_decode(
    const char* input, size_t input_len, uint8_t* output, size_t output_len)
{
    size_t i, j;

    if (input_len < 4 ||
        (input_len & 3u) != 0 ||
        (input_len / 4) * 3 != output_len)
    {
        return -EINVAL;
    }

    for (i = 0, j = 0; i < input_len; i += 4, j += 3)
    {
        hdr_base64_decode_block(&input[i], &output[j]);
    }

    return 0;
}
