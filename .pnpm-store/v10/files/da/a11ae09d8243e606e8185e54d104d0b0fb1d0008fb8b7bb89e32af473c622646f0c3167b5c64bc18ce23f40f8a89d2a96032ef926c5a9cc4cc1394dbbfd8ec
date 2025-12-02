import { StorageVectorsApiError, StorageVectorsUnknownError } from './errors'
import { isPlainObject, resolveResponse } from './helpers'
import { VectorFetchParameters } from './types'

export type Fetch = typeof fetch

/**
 * Options for fetch requests
 * @property headers - Custom HTTP headers
 * @property noResolveJson - If true, return raw Response instead of parsing JSON
 */
export interface FetchOptions {
  headers?: {
    [key: string]: string
  }
  noResolveJson?: boolean
}

/**
 * HTTP methods supported by the API
 */
export type RequestMethodType = 'GET' | 'POST' | 'PUT' | 'DELETE'

/**
 * Extracts error message from various error response formats
 * @param err - Error object from API
 * @returns Human-readable error message
 */
const _getErrorMessage = (err: any): string =>
  err.msg || err.message || err.error_description || err.error || JSON.stringify(err)

/**
 * Handles fetch errors and converts them to StorageVectors error types
 * @param error - The error caught from fetch
 * @param reject - Promise rejection function
 * @param options - Fetch options that may affect error handling
 */
const handleError = async (
  error: unknown,
  reject: (reason?: any) => void,
  options?: FetchOptions
) => {
  // Check if error is a Response-like object (has status and ok properties)
  // This is more reliable than instanceof which can fail across realms
  const isResponseLike =
    error &&
    typeof error === 'object' &&
    'status' in error &&
    'ok' in error &&
    typeof (error as any).status === 'number'

  if (isResponseLike && !options?.noResolveJson) {
    const status = (error as any).status || 500
    const responseError = error as any

    // Try to parse JSON body if available
    if (typeof responseError.json === 'function') {
      responseError
        .json()
        .then((err: any) => {
          const statusCode = err?.statusCode || err?.code || status + ''
          reject(new StorageVectorsApiError(_getErrorMessage(err), status, statusCode))
        })
        .catch(() => {
          // If JSON parsing fails, create an ApiError with the HTTP status code
          const statusCode = status + ''
          const message = responseError.statusText || `HTTP ${status} error`
          reject(new StorageVectorsApiError(message, status, statusCode))
        })
    } else {
      // No json() method available, create error from status
      const statusCode = status + ''
      const message = responseError.statusText || `HTTP ${status} error`
      reject(new StorageVectorsApiError(message, status, statusCode))
    }
  } else {
    reject(new StorageVectorsUnknownError(_getErrorMessage(error), error))
  }
}

/**
 * Builds request parameters for fetch calls
 * @param method - HTTP method
 * @param options - Custom fetch options
 * @param parameters - Additional fetch parameters like AbortSignal
 * @param body - Request body (will be JSON stringified if plain object)
 * @returns Complete fetch request parameters
 */
const _getRequestParams = (
  method: RequestMethodType,
  options?: FetchOptions,
  parameters?: VectorFetchParameters,
  body?: object
) => {
  const params: { [k: string]: any } = { method, headers: options?.headers || {} }

  if (method === 'GET' || !body) {
    return params
  }

  if (isPlainObject(body)) {
    params.headers = { 'Content-Type': 'application/json', ...options?.headers }
    params.body = JSON.stringify(body)
  } else {
    params.body = body
  }

  return { ...params, ...parameters }
}

/**
 * Internal request handler that wraps fetch with error handling
 * @param fetcher - Fetch function to use
 * @param method - HTTP method
 * @param url - Request URL
 * @param options - Custom fetch options
 * @param parameters - Additional fetch parameters
 * @param body - Request body
 * @returns Promise with parsed response or error
 */
async function _handleRequest(
  fetcher: Fetch,
  method: RequestMethodType,
  url: string,
  options?: FetchOptions,
  parameters?: VectorFetchParameters,
  body?: object
): Promise<any> {
  return new Promise((resolve, reject) => {
    fetcher(url, _getRequestParams(method, options, parameters, body))
      .then((result) => {
        if (!result.ok) throw result
        if (options?.noResolveJson) return result
        // Handle empty responses (204, empty body)
        const contentType = result.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          return {}
        }
        return result.json()
      })
      .then((data) => resolve(data))
      .catch((error) => handleError(error, reject, options))
  })
}

/**
 * Performs a GET request
 * @param fetcher - Fetch function to use
 * @param url - Request URL
 * @param options - Custom fetch options
 * @param parameters - Additional fetch parameters
 * @returns Promise with parsed response
 */
export async function get(
  fetcher: Fetch,
  url: string,
  options?: FetchOptions,
  parameters?: VectorFetchParameters
): Promise<any> {
  return _handleRequest(fetcher, 'GET', url, options, parameters)
}

/**
 * Performs a POST request
 * @param fetcher - Fetch function to use
 * @param url - Request URL
 * @param body - Request body to be JSON stringified
 * @param options - Custom fetch options
 * @param parameters - Additional fetch parameters
 * @returns Promise with parsed response
 */
export async function post(
  fetcher: Fetch,
  url: string,
  body: object,
  options?: FetchOptions,
  parameters?: VectorFetchParameters
): Promise<any> {
  return _handleRequest(fetcher, 'POST', url, options, parameters, body)
}

/**
 * Performs a PUT request
 * @param fetcher - Fetch function to use
 * @param url - Request URL
 * @param body - Request body to be JSON stringified
 * @param options - Custom fetch options
 * @param parameters - Additional fetch parameters
 * @returns Promise with parsed response
 */
export async function put(
  fetcher: Fetch,
  url: string,
  body: object,
  options?: FetchOptions,
  parameters?: VectorFetchParameters
): Promise<any> {
  return _handleRequest(fetcher, 'PUT', url, options, parameters, body)
}

/**
 * Performs a DELETE request
 * @param fetcher - Fetch function to use
 * @param url - Request URL
 * @param body - Request body to be JSON stringified
 * @param options - Custom fetch options
 * @param parameters - Additional fetch parameters
 * @returns Promise with parsed response
 */
export async function remove(
  fetcher: Fetch,
  url: string,
  body: object,
  options?: FetchOptions,
  parameters?: VectorFetchParameters
): Promise<any> {
  return _handleRequest(fetcher, 'DELETE', url, options, parameters, body)
}
