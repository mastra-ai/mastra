/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    INetworkModule,
    NetworkRequestOptions,
    NetworkResponse,
    HttpStatus,
} from "@azure/msal-common/node";
import { HttpMethod, Constants, ProxyStatus } from "../utils/Constants.js";
import { NetworkUtils } from "../utils/NetworkUtils.js";
import http from "http";
import https from "https";

/**
 * This class implements the API for network requests.
 */
export class HttpClient implements INetworkModule {
    private proxyUrl: string;
    private customAgentOptions: http.AgentOptions | https.AgentOptions;

    constructor(
        proxyUrl?: string,
        customAgentOptions?: http.AgentOptions | https.AgentOptions
    ) {
        this.proxyUrl = proxyUrl || "";
        this.customAgentOptions = customAgentOptions || {};
    }

    /**
     * Http Get request
     * @param url
     * @param options
     */
    async sendGetRequestAsync<T>(
        url: string,
        options?: NetworkRequestOptions,
        timeout?: number
    ): Promise<NetworkResponse<T>> {
        if (this.proxyUrl) {
            return networkRequestViaProxy(
                url,
                this.proxyUrl,
                HttpMethod.GET,
                options,
                this.customAgentOptions as http.AgentOptions,
                timeout
            );
        } else {
            return networkRequestViaHttps(
                url,
                HttpMethod.GET,
                options,
                this.customAgentOptions as https.AgentOptions,
                timeout
            );
        }
    }

    /**
     * Http Post request
     * @param url
     * @param options
     */
    async sendPostRequestAsync<T>(
        url: string,
        options?: NetworkRequestOptions
    ): Promise<NetworkResponse<T>> {
        if (this.proxyUrl) {
            return networkRequestViaProxy(
                url,
                this.proxyUrl,
                HttpMethod.POST,
                options,
                this.customAgentOptions as http.AgentOptions
            );
        } else {
            return networkRequestViaHttps(
                url,
                HttpMethod.POST,
                options,
                this.customAgentOptions as https.AgentOptions
            );
        }
    }
}

const networkRequestViaProxy = <T>(
    destinationUrlString: string,
    proxyUrlString: string,
    httpMethod: string,
    options?: NetworkRequestOptions,
    agentOptions?: http.AgentOptions,
    timeout?: number
): Promise<NetworkResponse<T>> => {
    const destinationUrl = new URL(destinationUrlString);
    const proxyUrl = new URL(proxyUrlString);

    // "method: connect" must be used to establish a connection to the proxy
    const headers = options?.headers || ({} as Record<string, string>);
    const tunnelRequestOptions: https.RequestOptions = {
        host: proxyUrl.hostname,
        port: proxyUrl.port,
        method: "CONNECT",
        path: destinationUrl.hostname,
        headers: headers,
    };

    if (agentOptions && Object.keys(agentOptions).length) {
        tunnelRequestOptions.agent = new http.Agent(agentOptions);
    }

    // compose a request string for the socket
    let postRequestStringContent: string = "";
    if (httpMethod === HttpMethod.POST) {
        const body = options?.body || "";
        postRequestStringContent =
            "Content-Type: application/x-www-form-urlencoded\r\n" +
            `Content-Length: ${body.length}\r\n` +
            `\r\n${body}`;
    } else {
        // optional timeout is only for get requests (regionDiscovery, for example)
        if (timeout) {
            tunnelRequestOptions.timeout = timeout;
        }
    }
    const outgoingRequestString =
        `${httpMethod.toUpperCase()} ${destinationUrl.href} HTTP/1.1\r\n` +
        `Host: ${destinationUrl.host}\r\n` +
        "Connection: close\r\n" +
        postRequestStringContent +
        "\r\n";

    return new Promise<NetworkResponse<T>>((resolve, reject) => {
        const request = http.request(tunnelRequestOptions);

        if (timeout) {
            request.on("timeout", () => {
                request.destroy();
                reject(new Error("Request time out"));
            });
        }

        request.end();

        // establish connection to the proxy
        request.on("connect", (response, socket) => {
            const proxyStatusCode =
                response?.statusCode || ProxyStatus.SERVER_ERROR;
            if (
                proxyStatusCode < ProxyStatus.SUCCESS_RANGE_START ||
                proxyStatusCode > ProxyStatus.SUCCESS_RANGE_END
            ) {
                request.destroy();
                socket.destroy();
                reject(
                    new Error(
                        `Error connecting to proxy. Http status code: ${
                            response.statusCode
                        }. Http status message: ${
                            response?.statusMessage || "Unknown"
                        }`
                    )
                );
            }

            // make a request over an HTTP tunnel
            socket.write(outgoingRequestString);

            const data: Buffer[] = [];
            socket.on("data", (chunk) => {
                data.push(chunk);
            });

            socket.on("end", () => {
                // combine all received buffer streams into one buffer, and then into a string
                const dataString = Buffer.concat([...data]).toString();

                // separate each line into it's own entry in an arry
                const dataStringArray = dataString.split("\r\n");
                // the first entry will contain the statusCode and statusMessage
                const httpStatusCode = parseInt(
                    dataStringArray[0].split(" ")[1]
                );
                // remove "HTTP/1.1" and the status code to get the status message
                const statusMessage = dataStringArray[0]
                    .split(" ")
                    .slice(2)
                    .join(" ");
                // the last entry will contain the body
                const body = dataStringArray[dataStringArray.length - 1];

                // everything in between the first and last entries are the headers
                const headersArray = dataStringArray.slice(
                    1,
                    dataStringArray.length - 2
                );

                // build an object out of all the headers
                const entries = new Map();
                headersArray.forEach((header) => {
                    /**
                     * the header might look like "Content-Length: 1531", but that is just a string
                     * it needs to be converted to a key/value pair
                     * split the string at the first instance of ":"
                     * there may be more than one ":" if the value of the header is supposed to be a JSON object
                     */
                    const headerKeyValue = header.split(new RegExp(/:\s(.*)/s));
                    const headerKey = headerKeyValue[0];
                    let headerValue = headerKeyValue[1];

                    // check if the value of the header is supposed to be a JSON object
                    try {
                        const object = JSON.parse(headerValue);

                        // if it is, then convert it from a string to a JSON object
                        if (object && typeof object === "object") {
                            headerValue = object;
                        }
                    } catch (e) {
                        // otherwise, leave it as a string
                    }

                    entries.set(headerKey, headerValue);
                });
                const headers = Object.fromEntries(entries);

                const parsedHeaders = headers as Record<string, string>;
                const networkResponse = NetworkUtils.getNetworkResponse(
                    parsedHeaders,
                    parseBody(
                        httpStatusCode,
                        statusMessage,
                        parsedHeaders,
                        body
                    ) as T,
                    httpStatusCode
                );

                if (
                    (httpStatusCode < HttpStatus.SUCCESS_RANGE_START ||
                        httpStatusCode > HttpStatus.SUCCESS_RANGE_END) &&
                    // do not destroy the request for the device code flow
                    networkResponse.body["error"] !==
                        Constants.AUTHORIZATION_PENDING
                ) {
                    request.destroy();
                }
                resolve(networkResponse);
            });

            socket.on("error", (chunk) => {
                request.destroy();
                socket.destroy();
                reject(new Error(chunk.toString()));
            });
        });

        request.on("error", (chunk) => {
            request.destroy();
            reject(new Error(chunk.toString()));
        });
    });
};

const networkRequestViaHttps = <T>(
    urlString: string,
    httpMethod: string,
    options?: NetworkRequestOptions,
    agentOptions?: https.AgentOptions,
    timeout?: number
): Promise<NetworkResponse<T>> => {
    const isPostRequest = httpMethod === HttpMethod.POST;
    const body: string = options?.body || "";

    const url = new URL(urlString);
    const headers = options?.headers || ({} as Record<string, string>);
    const customOptions: https.RequestOptions = {
        method: httpMethod,
        headers: headers,
        ...NetworkUtils.urlToHttpOptions(url),
    };

    if (agentOptions && Object.keys(agentOptions).length) {
        customOptions.agent = new https.Agent(agentOptions);
    }

    if (isPostRequest) {
        // needed for post request to work
        customOptions.headers = {
            ...customOptions.headers,
            "Content-Length": body.length,
        };
    } else {
        // optional timeout is only for get requests (regionDiscovery, for example)
        if (timeout) {
            customOptions.timeout = timeout;
        }
    }

    return new Promise<NetworkResponse<T>>((resolve, reject) => {
        let request: http.ClientRequest;
        // managed identity sources use http instead of https
        if (customOptions.protocol === "http:") {
            request = http.request(customOptions);
        } else {
            request = https.request(customOptions);
        }

        if (isPostRequest) {
            request.write(body);
        }

        if (timeout) {
            request.on("timeout", () => {
                request.destroy();
                reject(new Error("Request time out"));
            });
        }

        request.end();

        request.on("response", (response) => {
            const headers = response.headers;
            const statusCode = response.statusCode as number;
            const statusMessage = response.statusMessage;

            const data: Buffer[] = [];
            response.on("data", (chunk) => {
                data.push(chunk);
            });

            response.on("end", () => {
                // combine all received buffer streams into one buffer, and then into a string
                const body = Buffer.concat([...data]).toString();

                const parsedHeaders = headers as Record<string, string>;
                const networkResponse = NetworkUtils.getNetworkResponse(
                    parsedHeaders,
                    parseBody(
                        statusCode,
                        statusMessage,
                        parsedHeaders,
                        body
                    ) as T,
                    statusCode
                );

                if (
                    (statusCode < HttpStatus.SUCCESS_RANGE_START ||
                        statusCode > HttpStatus.SUCCESS_RANGE_END) &&
                    // do not destroy the request for the device code flow
                    networkResponse.body["error"] !==
                        Constants.AUTHORIZATION_PENDING
                ) {
                    request.destroy();
                }
                resolve(networkResponse);
            });
        });

        request.on("error", (chunk) => {
            request.destroy();
            reject(new Error(chunk.toString()));
        });
    });
};

/**
 * Check if extra parsing is needed on the repsonse from the server
 * @param statusCode {number} the status code of the response from the server
 * @param statusMessage {string | undefined} the status message of the response from the server
 * @param headers {Record<string, string>} the headers of the response from the server
 * @param body {string} the body from the response of the server
 * @returns {Object} JSON parsed body or error object
 */
const parseBody = (
    statusCode: number,
    statusMessage: string | undefined,
    headers: Record<string, string>,
    body: string
) => {
    /*
     * Informational responses (100 – 199)
     * Successful responses (200 – 299)
     * Redirection messages (300 – 399)
     * Client error responses (400 – 499)
     * Server error responses (500 – 599)
     */

    let parsedBody;
    try {
        parsedBody = JSON.parse(body);
    } catch (error) {
        let errorType;
        let errorDescriptionHelper;
        if (
            statusCode >= HttpStatus.CLIENT_ERROR_RANGE_START &&
            statusCode <= HttpStatus.CLIENT_ERROR_RANGE_END
        ) {
            errorType = "client_error";
            errorDescriptionHelper = "A client";
        } else if (
            statusCode >= HttpStatus.SERVER_ERROR_RANGE_START &&
            statusCode <= HttpStatus.SERVER_ERROR_RANGE_END
        ) {
            errorType = "server_error";
            errorDescriptionHelper = "A server";
        } else {
            errorType = "unknown_error";
            errorDescriptionHelper = "An unknown";
        }

        parsedBody = {
            error: errorType,
            error_description: `${errorDescriptionHelper} error occured.\nHttp status code: ${statusCode}\nHttp status message: ${
                statusMessage || "Unknown"
            }\nHeaders: ${JSON.stringify(headers)}`,
        };
    }

    return parsedBody;
};
