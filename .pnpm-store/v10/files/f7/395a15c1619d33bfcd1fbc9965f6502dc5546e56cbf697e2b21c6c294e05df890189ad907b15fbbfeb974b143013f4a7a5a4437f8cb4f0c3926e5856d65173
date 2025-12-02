import { usualFormBoundarySize } from '../core/constants.js';
// eslint-disable-next-line @typescript-eslint/ban-types
export const getBodySize = (body) => {
    if (!body) {
        return 0;
    }
    if (body instanceof FormData) {
        // This is an approximation, as FormData size calculation is not straightforward
        let size = 0;
        for (const [key, value] of body) {
            size += usualFormBoundarySize;
            size += new TextEncoder().encode(`Content-Disposition: form-data; name="${key}"`).length;
            size += typeof value === 'string'
                ? new TextEncoder().encode(value).length
                : value.size;
        }
        return size;
    }
    if (body instanceof Blob) {
        return body.size;
    }
    if (body instanceof ArrayBuffer) {
        return body.byteLength;
    }
    if (typeof body === 'string') {
        return new TextEncoder().encode(body).length;
    }
    if (body instanceof URLSearchParams) {
        return new TextEncoder().encode(body.toString()).length;
    }
    if ('byteLength' in body) {
        return (body).byteLength;
    }
    if (typeof body === 'object' && body !== null) {
        try {
            const jsonString = JSON.stringify(body);
            return new TextEncoder().encode(jsonString).length;
        }
        catch {
            return 0;
        }
    }
    return 0; // Default case, unable to determine size
};
const withProgress = (stream, totalBytes, onProgress) => {
    let previousChunk;
    let transferredBytes = 0;
    return stream.pipeThrough(new TransformStream({
        transform(currentChunk, controller) {
            controller.enqueue(currentChunk);
            if (previousChunk) {
                transferredBytes += previousChunk.byteLength;
                let percent = totalBytes === 0 ? 0 : transferredBytes / totalBytes;
                // Avoid reporting 100% progress before the stream is actually finished (in case totalBytes is inaccurate)
                if (percent >= 1) {
                    // Epsilon is used here to get as close as possible to 100% without reaching it.
                    // If we were to use 0.99 here, percent could potentially go backwards.
                    percent = 1 - Number.EPSILON;
                }
                onProgress?.({ percent, totalBytes: Math.max(totalBytes, transferredBytes), transferredBytes }, previousChunk);
            }
            previousChunk = currentChunk;
        },
        flush() {
            if (previousChunk) {
                transferredBytes += previousChunk.byteLength;
                onProgress?.({ percent: 1, totalBytes: Math.max(totalBytes, transferredBytes), transferredBytes }, previousChunk);
            }
        },
    }));
};
export const streamResponse = (response, onDownloadProgress) => {
    if (!response.body) {
        return response;
    }
    if (response.status === 204) {
        return new Response(null, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });
    }
    const totalBytes = Number(response.headers.get('content-length')) || 0;
    return new Response(withProgress(response.body, totalBytes, onDownloadProgress), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
    });
};
// eslint-disable-next-line @typescript-eslint/ban-types
export const streamRequest = (request, onUploadProgress, originalBody) => {
    if (!request.body) {
        return request;
    }
    // Use original body for size calculation since request.body is already a stream
    const totalBytes = getBodySize(originalBody ?? request.body);
    return new Request(request, {
        // @ts-expect-error - Types are outdated.
        duplex: 'half',
        body: withProgress(request.body, totalBytes, onUploadProgress),
    });
};
//# sourceMappingURL=body.js.map