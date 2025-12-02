// src/index.ts
import axios, { AxiosError } from "axios";
import "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// node_modules/typescript-event-target/dist/index.mjs
var e = class extends EventTarget {
  dispatchTypedEvent(s, t) {
    return super.dispatchEvent(t);
  }
};

// src/index.ts
var FirecrawlError = class extends Error {
  statusCode;
  details;
  constructor(message, statusCode, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
};
var FirecrawlApp = class {
  apiKey;
  apiUrl;
  version = "1.25.1";
  isCloudService(url) {
    return url.includes("api.firecrawl.dev");
  }
  async getVersion() {
    try {
      const packageJson = await import("./package-Z6F7JDXI.js");
      return packageJson.default.version;
    } catch (error) {
      console.error("Error getting version:", error);
      return "1.25.1";
    }
  }
  async init() {
    this.version = await this.getVersion();
  }
  /**
   * Initializes a new instance of the FirecrawlApp class.
   * @param config - Configuration options for the FirecrawlApp instance.
   */
  constructor({ apiKey = null, apiUrl = null }) {
    const baseUrl = apiUrl || "https://api.firecrawl.dev";
    if (this.isCloudService(baseUrl) && typeof apiKey !== "string") {
      throw new FirecrawlError("No API key provided", 401);
    }
    this.apiKey = apiKey || "";
    this.apiUrl = baseUrl;
    this.init();
  }
  /**
   * Scrapes a URL using the Firecrawl API.
   * @param url - The URL to scrape.
   * @param params - Additional parameters for the scrape request.
   * @returns The response from the scrape operation.
   */
  async scrapeUrl(url, params) {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`
    };
    let jsonData = { url, ...params, origin: `js-sdk@${this.version}` };
    if (jsonData?.extract?.schema) {
      let schema = jsonData.extract.schema;
      try {
        schema = zodToJsonSchema(schema);
      } catch (error) {
      }
      jsonData = {
        ...jsonData,
        extract: {
          ...jsonData.extract,
          schema
        }
      };
    }
    if (jsonData?.jsonOptions?.schema) {
      let schema = jsonData.jsonOptions.schema;
      try {
        schema = zodToJsonSchema(schema);
      } catch (error) {
      }
      jsonData = {
        ...jsonData,
        jsonOptions: {
          ...jsonData.jsonOptions,
          schema
        }
      };
    }
    try {
      const response = await axios.post(
        this.apiUrl + `/v1/scrape`,
        jsonData,
        { headers, timeout: params?.timeout !== void 0 ? params.timeout + 5e3 : void 0 }
      );
      if (response.status === 200) {
        const responseData = response.data;
        if (responseData.success) {
          return {
            success: true,
            warning: responseData.warning,
            error: responseData.error,
            ...responseData.data
          };
        } else {
          throw new FirecrawlError(`Failed to scrape URL. Error: ${responseData.error}`, response.status);
        }
      } else {
        this.handleError(response, "scrape URL");
      }
    } catch (error) {
      this.handleError(error.response, "scrape URL");
    }
    return { success: false, error: "Internal server error." };
  }
  /**
   * Searches using the Firecrawl API and optionally scrapes the results.
   * @param query - The search query string.
   * @param params - Optional parameters for the search request.
   * @returns The response from the search operation.
   */
  async search(query, params) {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`
    };
    let jsonData = {
      query,
      limit: params?.limit ?? 5,
      tbs: params?.tbs,
      filter: params?.filter,
      lang: params?.lang ?? "en",
      country: params?.country ?? "us",
      location: params?.location,
      origin: `js-sdk@${this.version}`,
      timeout: params?.timeout ?? 6e4,
      scrapeOptions: params?.scrapeOptions ?? { formats: [] }
    };
    if (jsonData?.scrapeOptions?.extract?.schema) {
      let schema = jsonData.scrapeOptions.extract.schema;
      try {
        schema = zodToJsonSchema(schema);
      } catch (error) {
      }
      jsonData = {
        ...jsonData,
        scrapeOptions: {
          ...jsonData.scrapeOptions,
          extract: {
            ...jsonData.scrapeOptions.extract,
            schema
          }
        }
      };
    }
    try {
      const response = await this.postRequest(
        this.apiUrl + `/v1/search`,
        jsonData,
        headers
      );
      if (response.status === 200) {
        const responseData = response.data;
        if (responseData.success) {
          return {
            success: true,
            data: responseData.data,
            warning: responseData.warning
          };
        } else {
          throw new FirecrawlError(`Failed to search. Error: ${responseData.error}`, response.status);
        }
      } else {
        this.handleError(response, "search");
      }
    } catch (error) {
      if (error.response?.data?.error) {
        throw new FirecrawlError(`Request failed with status code ${error.response.status}. Error: ${error.response.data.error} ${error.response.data.details ? ` - ${JSON.stringify(error.response.data.details)}` : ""}`, error.response.status);
      } else {
        throw new FirecrawlError(error.message, 500);
      }
    }
    return { success: false, error: "Internal server error.", data: [] };
  }
  /**
   * Initiates a crawl job for a URL using the Firecrawl API.
   * @param url - The URL to crawl.
   * @param params - Additional parameters for the crawl request.
   * @param pollInterval - Time in seconds for job status checks.
   * @param idempotencyKey - Optional idempotency key for the request.
   * @returns The response from the crawl operation.
   */
  async crawlUrl(url, params, pollInterval = 2, idempotencyKey) {
    const headers = this.prepareHeaders(idempotencyKey);
    let jsonData = { url, ...params, origin: `js-sdk@${this.version}` };
    try {
      const response = await this.postRequest(
        this.apiUrl + `/v1/crawl`,
        jsonData,
        headers
      );
      if (response.status === 200) {
        const id = response.data.id;
        return this.monitorJobStatus(id, headers, pollInterval);
      } else {
        this.handleError(response, "start crawl job");
      }
    } catch (error) {
      if (error.response?.data?.error) {
        throw new FirecrawlError(`Request failed with status code ${error.response.status}. Error: ${error.response.data.error} ${error.response.data.details ? ` - ${JSON.stringify(error.response.data.details)}` : ""}`, error.response.status);
      } else {
        throw new FirecrawlError(error.message, 500);
      }
    }
    return { success: false, error: "Internal server error." };
  }
  async asyncCrawlUrl(url, params, idempotencyKey) {
    const headers = this.prepareHeaders(idempotencyKey);
    let jsonData = { url, ...params, origin: `js-sdk@${this.version}` };
    try {
      const response = await this.postRequest(
        this.apiUrl + `/v1/crawl`,
        jsonData,
        headers
      );
      if (response.status === 200) {
        return response.data;
      } else {
        this.handleError(response, "start crawl job");
      }
    } catch (error) {
      if (error.response?.data?.error) {
        throw new FirecrawlError(`Request failed with status code ${error.response.status}. Error: ${error.response.data.error} ${error.response.data.details ? ` - ${JSON.stringify(error.response.data.details)}` : ""}`, error.response.status);
      } else {
        throw new FirecrawlError(error.message, 500);
      }
    }
    return { success: false, error: "Internal server error." };
  }
  /**
   * Checks the status of a crawl job using the Firecrawl API.
   * @param id - The ID of the crawl operation.
   * @param getAllData - Paginate through all the pages of documents, returning the full list of all documents. (default: `false`)
   * @param nextURL - The `next` URL from the previous crawl status. Only required if you're not manually increasing `skip`. Only used when `getAllData = false`.
   * @param skip - How many entries to skip to paginate. Only required if you're not providing `nextURL`. Only used when `getAllData = false`.
   * @param limit - How many entries to return. Only used when `getAllData = false`.
   * @returns The response containing the job status.
   */
  async checkCrawlStatus(id, getAllData = false, nextURL, skip, limit) {
    if (!id) {
      throw new FirecrawlError("No crawl ID provided", 400);
    }
    const headers = this.prepareHeaders();
    const targetURL = new URL(nextURL ?? `${this.apiUrl}/v1/crawl/${id}`);
    if (skip !== void 0) {
      targetURL.searchParams.set("skip", skip.toString());
    }
    if (limit !== void 0) {
      targetURL.searchParams.set("limit", limit.toString());
    }
    try {
      const response = await this.getRequest(
        targetURL.href,
        headers
      );
      if (response.status === 200) {
        let allData = response.data.data;
        if (getAllData && response.data.status === "completed") {
          let statusData = response.data;
          if ("data" in statusData) {
            let data = statusData.data;
            while (typeof statusData === "object" && "next" in statusData) {
              if (data.length === 0) {
                break;
              }
              statusData = (await this.getRequest(statusData.next, headers)).data;
              data = data.concat(statusData.data);
            }
            allData = data;
          }
        }
        let resp = {
          success: response.data.success,
          status: response.data.status,
          total: response.data.total,
          completed: response.data.completed,
          creditsUsed: response.data.creditsUsed,
          next: getAllData ? void 0 : response.data.next,
          expiresAt: new Date(response.data.expiresAt),
          data: allData
        };
        if (!response.data.success && response.data.error) {
          resp = {
            ...resp,
            success: false,
            error: response.data.error
          };
        }
        if (response.data.next) {
          resp.next = response.data.next;
        }
        return resp;
      } else {
        this.handleError(response, "check crawl status");
      }
    } catch (error) {
      throw new FirecrawlError(error.message, 500);
    }
    return { success: false, error: "Internal server error." };
  }
  /**
   * Returns information about crawl errors.
   * @param id - The ID of the crawl operation.
   * @returns Information about crawl errors.
   */
  async checkCrawlErrors(id) {
    const headers = this.prepareHeaders();
    try {
      const response = await this.deleteRequest(
        `${this.apiUrl}/v1/crawl/${id}/errors`,
        headers
      );
      if (response.status === 200) {
        return response.data;
      } else {
        this.handleError(response, "check crawl errors");
      }
    } catch (error) {
      throw new FirecrawlError(error.message, 500);
    }
    return { success: false, error: "Internal server error." };
  }
  /**
   * Cancels a crawl job using the Firecrawl API.
   * @param id - The ID of the crawl operation.
   * @returns The response from the cancel crawl operation.
   */
  async cancelCrawl(id) {
    const headers = this.prepareHeaders();
    try {
      const response = await this.deleteRequest(
        `${this.apiUrl}/v1/crawl/${id}`,
        headers
      );
      if (response.status === 200) {
        return response.data;
      } else {
        this.handleError(response, "cancel crawl job");
      }
    } catch (error) {
      throw new FirecrawlError(error.message, 500);
    }
    return { success: false, error: "Internal server error." };
  }
  /**
   * Initiates a crawl job and returns a CrawlWatcher to monitor the job via WebSocket.
   * @param url - The URL to crawl.
   * @param params - Additional parameters for the crawl request.
   * @param idempotencyKey - Optional idempotency key for the request.
   * @returns A CrawlWatcher instance to monitor the crawl job.
   */
  async crawlUrlAndWatch(url, params, idempotencyKey) {
    const crawl = await this.asyncCrawlUrl(url, params, idempotencyKey);
    if (crawl.success && crawl.id) {
      const id = crawl.id;
      return new CrawlWatcher(id, this);
    }
    throw new FirecrawlError("Crawl job failed to start", 400);
  }
  /**
   * Maps a URL using the Firecrawl API.
   * @param url - The URL to map.
   * @param params - Additional parameters for the map request.
   * @returns The response from the map operation.
   */
  async mapUrl(url, params) {
    const headers = this.prepareHeaders();
    let jsonData = { url, ...params, origin: `js-sdk@${this.version}` };
    try {
      const response = await this.postRequest(
        this.apiUrl + `/v1/map`,
        jsonData,
        headers
      );
      if (response.status === 200) {
        return response.data;
      } else {
        this.handleError(response, "map");
      }
    } catch (error) {
      throw new FirecrawlError(error.message, 500);
    }
    return { success: false, error: "Internal server error." };
  }
  /**
   * Initiates a batch scrape job for multiple URLs using the Firecrawl API.
   * @param url - The URLs to scrape.
   * @param params - Additional parameters for the scrape request.
   * @param pollInterval - Time in seconds for job status checks.
   * @param idempotencyKey - Optional idempotency key for the request.
   * @param webhook - Optional webhook for the batch scrape.
   * @param ignoreInvalidURLs - Optional flag to ignore invalid URLs.
   * @returns The response from the crawl operation.
   */
  async batchScrapeUrls(urls, params, pollInterval = 2, idempotencyKey, webhook, ignoreInvalidURLs, maxConcurrency) {
    const headers = this.prepareHeaders(idempotencyKey);
    let jsonData = { urls, webhook, ignoreInvalidURLs, maxConcurrency, ...params, origin: `js-sdk@${this.version}` };
    if (jsonData?.extract?.schema) {
      let schema = jsonData.extract.schema;
      try {
        schema = zodToJsonSchema(schema);
      } catch (error) {
      }
      jsonData = {
        ...jsonData,
        extract: {
          ...jsonData.extract,
          schema
        }
      };
    }
    if (jsonData?.jsonOptions?.schema) {
      let schema = jsonData.jsonOptions.schema;
      try {
        schema = zodToJsonSchema(schema);
      } catch (error) {
      }
      jsonData = {
        ...jsonData,
        jsonOptions: {
          ...jsonData.jsonOptions,
          schema
        }
      };
    }
    try {
      const response = await this.postRequest(
        this.apiUrl + `/v1/batch/scrape`,
        jsonData,
        headers
      );
      if (response.status === 200) {
        const id = response.data.id;
        return this.monitorJobStatus(id, headers, pollInterval);
      } else {
        this.handleError(response, "start batch scrape job");
      }
    } catch (error) {
      if (error.response?.data?.error) {
        throw new FirecrawlError(`Request failed with status code ${error.response.status}. Error: ${error.response.data.error} ${error.response.data.details ? ` - ${JSON.stringify(error.response.data.details)}` : ""}`, error.response.status);
      } else {
        throw new FirecrawlError(error.message, 500);
      }
    }
    return { success: false, error: "Internal server error." };
  }
  async asyncBatchScrapeUrls(urls, params, idempotencyKey, webhook, ignoreInvalidURLs) {
    const headers = this.prepareHeaders(idempotencyKey);
    let jsonData = { urls, webhook, ignoreInvalidURLs, ...params, origin: `js-sdk@${this.version}` };
    try {
      const response = await this.postRequest(
        this.apiUrl + `/v1/batch/scrape`,
        jsonData,
        headers
      );
      if (response.status === 200) {
        return response.data;
      } else {
        this.handleError(response, "start batch scrape job");
      }
    } catch (error) {
      if (error.response?.data?.error) {
        throw new FirecrawlError(`Request failed with status code ${error.response.status}. Error: ${error.response.data.error} ${error.response.data.details ? ` - ${JSON.stringify(error.response.data.details)}` : ""}`, error.response.status);
      } else {
        throw new FirecrawlError(error.message, 500);
      }
    }
    return { success: false, error: "Internal server error." };
  }
  /**
   * Initiates a batch scrape job and returns a CrawlWatcher to monitor the job via WebSocket.
   * @param urls - The URL to scrape.
   * @param params - Additional parameters for the scrape request.
   * @param idempotencyKey - Optional idempotency key for the request.
   * @returns A CrawlWatcher instance to monitor the crawl job.
   */
  async batchScrapeUrlsAndWatch(urls, params, idempotencyKey, webhook, ignoreInvalidURLs) {
    const crawl = await this.asyncBatchScrapeUrls(urls, params, idempotencyKey, webhook, ignoreInvalidURLs);
    if (crawl.success && crawl.id) {
      const id = crawl.id;
      return new CrawlWatcher(id, this);
    }
    throw new FirecrawlError("Batch scrape job failed to start", 400);
  }
  /**
   * Checks the status of a batch scrape job using the Firecrawl API.
   * @param id - The ID of the batch scrape operation.
   * @param getAllData - Paginate through all the pages of documents, returning the full list of all documents. (default: `false`)
   * @param nextURL - The `next` URL from the previous batch scrape status. Only required if you're not manually increasing `skip`. Only used when `getAllData = false`.
   * @param skip - How many entries to skip to paginate. Only used when `getAllData = false`.
   * @param limit - How many entries to return. Only used when `getAllData = false`.
   * @returns The response containing the job status.
   */
  async checkBatchScrapeStatus(id, getAllData = false, nextURL, skip, limit) {
    if (!id) {
      throw new FirecrawlError("No batch scrape ID provided", 400);
    }
    const headers = this.prepareHeaders();
    const targetURL = new URL(nextURL ?? `${this.apiUrl}/v1/batch/scrape/${id}`);
    if (skip !== void 0) {
      targetURL.searchParams.set("skip", skip.toString());
    }
    if (limit !== void 0) {
      targetURL.searchParams.set("limit", limit.toString());
    }
    try {
      const response = await this.getRequest(
        targetURL.href,
        headers
      );
      if (response.status === 200) {
        let allData = response.data.data;
        if (getAllData && response.data.status === "completed") {
          let statusData = response.data;
          if ("data" in statusData) {
            let data = statusData.data;
            while (typeof statusData === "object" && "next" in statusData) {
              if (data.length === 0) {
                break;
              }
              statusData = (await this.getRequest(statusData.next, headers)).data;
              data = data.concat(statusData.data);
            }
            allData = data;
          }
        }
        let resp = {
          success: response.data.success,
          status: response.data.status,
          total: response.data.total,
          completed: response.data.completed,
          creditsUsed: response.data.creditsUsed,
          next: getAllData ? void 0 : response.data.next,
          expiresAt: new Date(response.data.expiresAt),
          data: allData
        };
        if (!response.data.success && response.data.error) {
          resp = {
            ...resp,
            success: false,
            error: response.data.error
          };
        }
        if (response.data.next) {
          resp.next = response.data.next;
        }
        return resp;
      } else {
        this.handleError(response, "check batch scrape status");
      }
    } catch (error) {
      throw new FirecrawlError(error.message, 500);
    }
    return { success: false, error: "Internal server error." };
  }
  /**
   * Returns information about batch scrape errors.
   * @param id - The ID of the batch scrape operation.
   * @returns Information about batch scrape errors.
   */
  async checkBatchScrapeErrors(id) {
    const headers = this.prepareHeaders();
    try {
      const response = await this.deleteRequest(
        `${this.apiUrl}/v1/batch/scrape/${id}/errors`,
        headers
      );
      if (response.status === 200) {
        return response.data;
      } else {
        this.handleError(response, "check batch scrape errors");
      }
    } catch (error) {
      throw new FirecrawlError(error.message, 500);
    }
    return { success: false, error: "Internal server error." };
  }
  /**
   * Extracts information from URLs using the Firecrawl API.
   * Currently in Beta. Expect breaking changes on future minor versions.
   * @param urls - The URLs to extract information from. Optional if using other methods for data extraction.
   * @param params - Additional parameters for the extract request.
   * @returns The response from the extract operation.
   */
  async extract(urls, params) {
    const headers = this.prepareHeaders();
    let jsonData = { urls, ...params };
    let jsonSchema;
    try {
      if (!params?.schema) {
        jsonSchema = void 0;
      } else {
        try {
          jsonSchema = zodToJsonSchema(params.schema);
        } catch (_) {
          jsonSchema = params.schema;
        }
      }
    } catch (error) {
      throw new FirecrawlError("Invalid schema. Schema must be either a valid Zod schema or JSON schema object.", 400);
    }
    try {
      const response = await this.postRequest(
        this.apiUrl + `/v1/extract`,
        { ...jsonData, schema: jsonSchema, origin: `js-sdk@${this.version}` },
        headers
      );
      if (response.status === 200) {
        const jobId = response.data.id;
        let extractStatus;
        do {
          const statusResponse = await this.getRequest(
            `${this.apiUrl}/v1/extract/${jobId}`,
            headers
          );
          extractStatus = statusResponse.data;
          if (extractStatus.status === "completed") {
            if (extractStatus.success) {
              return {
                success: true,
                data: extractStatus.data,
                warning: extractStatus.warning,
                error: extractStatus.error,
                sources: extractStatus?.sources || void 0
              };
            } else {
              throw new FirecrawlError(`Failed to extract data. Error: ${extractStatus.error}`, statusResponse.status);
            }
          } else if (extractStatus.status === "failed" || extractStatus.status === "cancelled") {
            throw new FirecrawlError(`Extract job ${extractStatus.status}. Error: ${extractStatus.error}`, statusResponse.status);
          }
          await new Promise((resolve) => setTimeout(resolve, 1e3));
        } while (extractStatus.status !== "completed");
      } else {
        this.handleError(response, "extract");
      }
    } catch (error) {
      throw new FirecrawlError(error.message, 500, error.response?.data?.details);
    }
    return { success: false, error: "Internal server error." };
  }
  /**
   * Initiates an asynchronous extract job for a URL using the Firecrawl API.
   * @param url - The URL to extract data from.
   * @param params - Additional parameters for the extract request.
   * @param idempotencyKey - Optional idempotency key for the request.
   * @returns The response from the extract operation.
   */
  async asyncExtract(urls, params, idempotencyKey) {
    const headers = this.prepareHeaders(idempotencyKey);
    let jsonData = { urls, ...params };
    let jsonSchema;
    try {
      if (!params?.schema) {
        jsonSchema = void 0;
      } else {
        try {
          jsonSchema = zodToJsonSchema(params.schema);
        } catch (_) {
          jsonSchema = params.schema;
        }
      }
    } catch (error) {
      throw new FirecrawlError("Invalid schema. Schema must be either a valid Zod schema or JSON schema object.", 400);
    }
    try {
      const response = await this.postRequest(
        this.apiUrl + `/v1/extract`,
        { ...jsonData, schema: jsonSchema, origin: `js-sdk@${this.version}` },
        headers
      );
      if (response.status === 200) {
        return response.data;
      } else {
        this.handleError(response, "start extract job");
      }
    } catch (error) {
      throw new FirecrawlError(error.message, 500, error.response?.data?.details);
    }
    return { success: false, error: "Internal server error." };
  }
  /**
   * Retrieves the status of an extract job.
   * @param jobId - The ID of the extract job.
   * @returns The status of the extract job.
   */
  async getExtractStatus(jobId) {
    try {
      const response = await this.getRequest(
        `${this.apiUrl}/v1/extract/${jobId}`,
        this.prepareHeaders()
      );
      if (response.status === 200) {
        return response.data;
      } else {
        this.handleError(response, "get extract status");
      }
    } catch (error) {
      throw new FirecrawlError(error.message, 500);
    }
  }
  /**
   * Prepares the headers for an API request.
   * @param idempotencyKey - Optional key to ensure idempotency.
   * @returns The prepared headers.
   */
  prepareHeaders(idempotencyKey) {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}
    };
  }
  /**
   * Sends a POST request to the specified URL.
   * @param url - The URL to send the request to.
   * @param data - The data to send in the request.
   * @param headers - The headers for the request.
   * @returns The response from the POST request.
   */
  postRequest(url, data, headers) {
    return axios.post(url, data, { headers, timeout: data?.timeout ? data.timeout + 5e3 : void 0 });
  }
  /**
   * Sends a GET request to the specified URL.
   * @param url - The URL to send the request to.
   * @param headers - The headers for the request.
   * @returns The response from the GET request.
   */
  async getRequest(url, headers) {
    try {
      return await axios.get(url, { headers });
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        return error.response;
      } else {
        throw error;
      }
    }
  }
  /**
   * Sends a DELETE request to the specified URL.
   * @param url - The URL to send the request to.
   * @param headers - The headers for the request.
   * @returns The response from the DELETE request.
   */
  async deleteRequest(url, headers) {
    try {
      return await axios.delete(url, { headers });
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        return error.response;
      } else {
        throw error;
      }
    }
  }
  /**
   * Monitors the status of a crawl job until completion or failure.
   * @param id - The ID of the crawl operation.
   * @param headers - The headers for the request.
   * @param checkInterval - Interval in seconds for job status checks.
   * @param checkUrl - Optional URL to check the status (used for v1 API)
   * @returns The final job status or data.
   */
  async monitorJobStatus(id, headers, checkInterval) {
    let failedTries = 0;
    let networkRetries = 0;
    const maxNetworkRetries = 3;
    while (true) {
      try {
        let statusResponse = await this.getRequest(
          `${this.apiUrl}/v1/crawl/${id}`,
          headers
        );
        if (statusResponse.status === 200) {
          failedTries = 0;
          networkRetries = 0;
          let statusData = statusResponse.data;
          if (statusData.status === "completed") {
            if ("data" in statusData) {
              let data = statusData.data;
              while (typeof statusData === "object" && "next" in statusData) {
                if (data.length === 0) {
                  break;
                }
                statusResponse = await this.getRequest(statusData.next, headers);
                statusData = statusResponse.data;
                data = data.concat(statusData.data);
              }
              statusData.data = data;
              return statusData;
            } else {
              throw new FirecrawlError("Crawl job completed but no data was returned", 500);
            }
          } else if (["active", "paused", "pending", "queued", "waiting", "scraping"].includes(statusData.status)) {
            checkInterval = Math.max(checkInterval, 2);
            await new Promise(
              (resolve) => setTimeout(resolve, checkInterval * 1e3)
            );
          } else {
            throw new FirecrawlError(
              `Crawl job failed or was stopped. Status: ${statusData.status}`,
              500
            );
          }
        } else {
          failedTries++;
          if (failedTries >= 3) {
            this.handleError(statusResponse, "check crawl status");
          }
        }
      } catch (error) {
        if (this.isRetryableError(error) && networkRetries < maxNetworkRetries) {
          networkRetries++;
          const backoffDelay = Math.min(1e3 * Math.pow(2, networkRetries - 1), 1e4);
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          continue;
        }
        throw new FirecrawlError(error, 500);
      }
    }
  }
  /**
   * Determines if an error is retryable (transient network error)
   * @param error - The error to check
   * @returns True if the error should be retried
   */
  isRetryableError(error) {
    if (error instanceof AxiosError) {
      if (!error.response) {
        const code = error.code;
        const message = error.message?.toLowerCase() || "";
        return code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ENOTFOUND" || code === "ECONNREFUSED" || message.includes("socket hang up") || message.includes("network error") || message.includes("timeout");
      }
      if (error.response?.status === 408 || error.response?.status === 504) {
        return true;
      }
    }
    if (error && typeof error === "object") {
      const code = error.code;
      const message = error.message?.toLowerCase() || "";
      if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ENOTFOUND" || code === "ECONNREFUSED" || message.includes("socket hang up") || message.includes("network error") || message.includes("timeout")) {
        return true;
      }
      if (error.response?.status === 408 || error.response?.status === 504) {
        return true;
      }
    }
    return false;
  }
  /**
   * Handles errors from API responses.
   * @param {AxiosResponse} response - The response from the API.
   * @param {string} action - The action being performed when the error occurred.
   */
  handleError(response, action) {
    if (!response) {
      throw new FirecrawlError(
        `No response received while trying to ${action}. This may be a network error or the server is unreachable.`,
        0
      );
    }
    if ([400, 402, 403, 408, 409, 500].includes(response.status)) {
      const errorMessage = response.data.error || "Unknown error occurred";
      const details = response.data.details ? ` - ${JSON.stringify(response.data.details)}` : "";
      throw new FirecrawlError(
        `Failed to ${action}. Status code: ${response.status}. Error: ${errorMessage}${details}`,
        response.status,
        response?.data?.details
      );
    } else {
      throw new FirecrawlError(
        `Unexpected error occurred while trying to ${action}. Status code: ${response.status}`,
        response.status
      );
    }
  }
  /**
   * Initiates a deep research operation on a given query and polls until completion.
   * @param query - The query to research.
   * @param params - Parameters for the deep research operation.
   * @param onActivity - Optional callback to receive activity updates in real-time.
   * @param onSource - Optional callback to receive source updates in real-time.
   * @returns The final research results.
   */
  async deepResearch(query, params, onActivity, onSource) {
    try {
      const response = await this.asyncDeepResearch(query, params);
      if (!response.success || "error" in response) {
        return { success: false, error: "error" in response ? response.error : "Unknown error" };
      }
      if (!response.id) {
        throw new FirecrawlError(`Failed to start research. No job ID returned.`, 500);
      }
      const jobId = response.id;
      let researchStatus;
      let lastActivityCount = 0;
      let lastSourceCount = 0;
      while (true) {
        researchStatus = await this.checkDeepResearchStatus(jobId);
        if ("error" in researchStatus && !researchStatus.success) {
          return researchStatus;
        }
        if (onActivity && researchStatus.activities) {
          const newActivities = researchStatus.activities.slice(lastActivityCount);
          for (const activity of newActivities) {
            onActivity(activity);
          }
          lastActivityCount = researchStatus.activities.length;
        }
        if (onSource && researchStatus.sources) {
          const newSources = researchStatus.sources.slice(lastSourceCount);
          for (const source of newSources) {
            onSource(source);
          }
          lastSourceCount = researchStatus.sources.length;
        }
        if (researchStatus.status === "completed") {
          return researchStatus;
        }
        if (researchStatus.status === "failed") {
          throw new FirecrawlError(
            `Research job ${researchStatus.status}. Error: ${researchStatus.error}`,
            500
          );
        }
        if (researchStatus.status !== "processing") {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 2e3));
      }
      return { success: false, error: "Research job terminated unexpectedly" };
    } catch (error) {
      throw new FirecrawlError(error.message, 500, error.response?.data?.details);
    }
  }
  /**
   * Initiates a deep research operation on a given query without polling.
   * @param params - Parameters for the deep research operation.
   * @returns The response containing the research job ID.
   */
  async asyncDeepResearch(query, params) {
    const headers = this.prepareHeaders();
    let jsonData = { query, ...params, origin: `js-sdk@${this.version}` };
    if (jsonData?.jsonOptions?.schema) {
      let schema = jsonData.jsonOptions.schema;
      try {
        schema = zodToJsonSchema(schema);
      } catch (error) {
      }
      jsonData = {
        ...jsonData,
        jsonOptions: {
          ...jsonData.jsonOptions,
          schema
        }
      };
    }
    try {
      const response = await this.postRequest(
        `${this.apiUrl}/v1/deep-research`,
        jsonData,
        headers
      );
      if (response.status === 200) {
        return response.data;
      } else {
        this.handleError(response, "start deep research");
      }
    } catch (error) {
      if (error.response?.data?.error) {
        throw new FirecrawlError(`Request failed with status code ${error.response.status}. Error: ${error.response.data.error} ${error.response.data.details ? ` - ${JSON.stringify(error.response.data.details)}` : ""}`, error.response.status);
      } else {
        throw new FirecrawlError(error.message, 500);
      }
    }
    return { success: false, error: "Internal server error." };
  }
  /**
   * Checks the status of a deep research operation.
   * @param id - The ID of the deep research operation.
   * @returns The current status and results of the research operation.
   */
  async checkDeepResearchStatus(id) {
    const headers = this.prepareHeaders();
    try {
      const response = await this.getRequest(
        `${this.apiUrl}/v1/deep-research/${id}`,
        headers
      );
      if (response.status === 200) {
        return response.data;
      } else if (response.status === 404) {
        throw new FirecrawlError("Deep research job not found", 404);
      } else {
        this.handleError(response, "check deep research status");
      }
    } catch (error) {
      if (error.response?.data?.error) {
        throw new FirecrawlError(`Request failed with status code ${error.response.status}. Error: ${error.response.data.error} ${error.response.data.details ? ` - ${JSON.stringify(error.response.data.details)}` : ""}`, error.response.status);
      } else {
        throw new FirecrawlError(error.message, 500);
      }
    }
    return { success: false, error: "Internal server error." };
  }
  /**
   * @deprecated Use deepResearch() instead
   * Initiates a deep research operation on a given topic and polls until completion.
   * @param topic - The topic to research.
   * @param params - Parameters for the deep research operation.
   * @param onActivity - Optional callback to receive activity updates in real-time.
   * @returns The final research results.
   */
  async __deepResearch(topic, params, onActivity) {
    try {
      const response = await this.__asyncDeepResearch(topic, params);
      if (!response.success || "error" in response) {
        return { success: false, error: "error" in response ? response.error : "Unknown error" };
      }
      if (!response.id) {
        throw new FirecrawlError(`Failed to start research. No job ID returned.`, 500);
      }
      const jobId = response.id;
      let researchStatus;
      let lastActivityCount = 0;
      while (true) {
        researchStatus = await this.__checkDeepResearchStatus(jobId);
        if ("error" in researchStatus && !researchStatus.success) {
          return researchStatus;
        }
        if (onActivity && researchStatus.activities) {
          const newActivities = researchStatus.activities.slice(lastActivityCount);
          for (const activity of newActivities) {
            onActivity(activity);
          }
          lastActivityCount = researchStatus.activities.length;
        }
        if (researchStatus.status === "completed") {
          return researchStatus;
        }
        if (researchStatus.status === "failed") {
          throw new FirecrawlError(
            `Research job ${researchStatus.status}. Error: ${researchStatus.error}`,
            500
          );
        }
        if (researchStatus.status !== "processing") {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 2e3));
      }
      return { success: false, error: "Research job terminated unexpectedly" };
    } catch (error) {
      throw new FirecrawlError(error.message, 500, error.response?.data?.details);
    }
  }
  /**
   * @deprecated Use asyncDeepResearch() instead
   * Initiates a deep research operation on a given topic without polling.
   * @param params - Parameters for the deep research operation.
   * @returns The response containing the research job ID.
   */
  async __asyncDeepResearch(topic, params) {
    const headers = this.prepareHeaders();
    try {
      let jsonData = { topic, ...params, origin: `js-sdk@${this.version}` };
      const response = await this.postRequest(
        `${this.apiUrl}/v1/deep-research`,
        jsonData,
        headers
      );
      if (response.status === 200) {
        return response.data;
      } else {
        this.handleError(response, "start deep research");
      }
    } catch (error) {
      if (error.response?.data?.error) {
        throw new FirecrawlError(`Request failed with status code ${error.response.status}. Error: ${error.response.data.error} ${error.response.data.details ? ` - ${JSON.stringify(error.response.data.details)}` : ""}`, error.response.status);
      } else {
        throw new FirecrawlError(error.message, 500);
      }
    }
    return { success: false, error: "Internal server error." };
  }
  /**
   * @deprecated Use checkDeepResearchStatus() instead
   * Checks the status of a deep research operation.
   * @param id - The ID of the deep research operation.
   * @returns The current status and results of the research operation.
   */
  async __checkDeepResearchStatus(id) {
    const headers = this.prepareHeaders();
    try {
      const response = await this.getRequest(
        `${this.apiUrl}/v1/deep-research/${id}`,
        headers
      );
      if (response.status === 200) {
        return response.data;
      } else if (response.status === 404) {
        throw new FirecrawlError("Deep research job not found", 404);
      } else {
        this.handleError(response, "check deep research status");
      }
    } catch (error) {
      if (error.response?.data?.error) {
        throw new FirecrawlError(`Request failed with status code ${error.response.status}. Error: ${error.response.data.error} ${error.response.data.details ? ` - ${JSON.stringify(error.response.data.details)}` : ""}`, error.response.status);
      } else {
        throw new FirecrawlError(error.message, 500);
      }
    }
    return { success: false, error: "Internal server error." };
  }
  /**
   * Generates LLMs.txt for a given URL and polls until completion.
   * @param url - The URL to generate LLMs.txt from.
   * @param params - Parameters for the LLMs.txt generation operation.
   * @returns The final generation results.
   */
  async generateLLMsText(url, params) {
    try {
      const response = await this.asyncGenerateLLMsText(url, params);
      if (!response.success || "error" in response) {
        return { success: false, error: "error" in response ? response.error : "Unknown error" };
      }
      if (!response.id) {
        throw new FirecrawlError(`Failed to start LLMs.txt generation. No job ID returned.`, 500);
      }
      const jobId = response.id;
      let generationStatus;
      while (true) {
        generationStatus = await this.checkGenerateLLMsTextStatus(jobId);
        if ("error" in generationStatus && !generationStatus.success) {
          return generationStatus;
        }
        if (generationStatus.status === "completed") {
          return generationStatus;
        }
        if (generationStatus.status === "failed") {
          throw new FirecrawlError(
            `LLMs.txt generation job ${generationStatus.status}. Error: ${generationStatus.error}`,
            500
          );
        }
        if (generationStatus.status !== "processing") {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 2e3));
      }
      return { success: false, error: "LLMs.txt generation job terminated unexpectedly" };
    } catch (error) {
      throw new FirecrawlError(error.message, 500, error.response?.data?.details);
    }
  }
  /**
   * Initiates a LLMs.txt generation operation without polling.
   * @param url - The URL to generate LLMs.txt from.
   * @param params - Parameters for the LLMs.txt generation operation.
   * @returns The response containing the generation job ID.
   */
  async asyncGenerateLLMsText(url, params) {
    const headers = this.prepareHeaders();
    let jsonData = { url, ...params, origin: `js-sdk@${this.version}` };
    try {
      const response = await this.postRequest(
        `${this.apiUrl}/v1/llmstxt`,
        jsonData,
        headers
      );
      if (response.status === 200) {
        return response.data;
      } else {
        this.handleError(response, "start LLMs.txt generation");
      }
    } catch (error) {
      if (error.response?.data?.error) {
        throw new FirecrawlError(`Request failed with status code ${error.response.status}. Error: ${error.response.data.error} ${error.response.data.details ? ` - ${JSON.stringify(error.response.data.details)}` : ""}`, error.response.status);
      } else {
        throw new FirecrawlError(error.message, 500);
      }
    }
    return { success: false, error: "Internal server error." };
  }
  /**
   * Checks the status of a LLMs.txt generation operation.
   * @param id - The ID of the LLMs.txt generation operation.
   * @returns The current status and results of the generation operation.
   */
  async checkGenerateLLMsTextStatus(id) {
    const headers = this.prepareHeaders();
    try {
      const response = await this.getRequest(
        `${this.apiUrl}/v1/llmstxt/${id}`,
        headers
      );
      if (response.status === 200) {
        return response.data;
      } else if (response.status === 404) {
        throw new FirecrawlError("LLMs.txt generation job not found", 404);
      } else {
        this.handleError(response, "check LLMs.txt generation status");
      }
    } catch (error) {
      if (error.response?.data?.error) {
        throw new FirecrawlError(`Request failed with status code ${error.response.status}. Error: ${error.response.data.error} ${error.response.data.details ? ` - ${JSON.stringify(error.response.data.details)}` : ""}`, error.response.status);
      } else {
        throw new FirecrawlError(error.message, 500);
      }
    }
    return { success: false, error: "Internal server error." };
  }
};
var CrawlWatcher = class extends e {
  ws;
  data;
  status;
  id;
  constructor(id, app) {
    super();
    this.id = id;
    const wsUrl = app.apiUrl.replace(/^http/, "ws");
    this.ws = new WebSocket(`${wsUrl}/v1/crawl/${id}`, app.apiKey);
    this.status = "scraping";
    this.data = [];
    const messageHandler = (msg) => {
      if (msg.type === "done") {
        this.status = "completed";
        this.dispatchTypedEvent("done", new CustomEvent("done", {
          detail: {
            status: this.status,
            data: this.data,
            id: this.id
          }
        }));
      } else if (msg.type === "error") {
        this.status = "failed";
        this.dispatchTypedEvent("error", new CustomEvent("error", {
          detail: {
            status: this.status,
            data: this.data,
            error: msg.error,
            id: this.id
          }
        }));
      } else if (msg.type === "catchup") {
        this.status = msg.data.status;
        this.data.push(...msg.data.data ?? []);
        for (const doc of this.data) {
          this.dispatchTypedEvent("document", new CustomEvent("document", {
            detail: {
              ...doc,
              id: this.id
            }
          }));
        }
      } else if (msg.type === "document") {
        this.dispatchTypedEvent("document", new CustomEvent("document", {
          detail: {
            ...msg.data,
            id: this.id
          }
        }));
      }
    };
    this.ws.onmessage = ((ev) => {
      if (typeof ev.data !== "string") {
        this.ws.close();
        return;
      }
      try {
        const msg = JSON.parse(ev.data);
        messageHandler(msg);
      } catch (error) {
        console.error("Error on message", error);
      }
    }).bind(this);
    this.ws.onclose = ((ev) => {
      try {
        const msg = JSON.parse(ev.reason);
        messageHandler(msg);
      } catch (error) {
        console.error("Error on close", error);
      }
    }).bind(this);
    this.ws.onerror = ((_) => {
      this.status = "failed";
      this.dispatchTypedEvent("error", new CustomEvent("error", {
        detail: {
          status: this.status,
          data: this.data,
          error: "WebSocket error",
          id: this.id
        }
      }));
    }).bind(this);
  }
  close() {
    this.ws.close();
  }
};
export {
  CrawlWatcher,
  FirecrawlError,
  FirecrawlApp as default
};
