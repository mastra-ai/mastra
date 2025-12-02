import { LangfuseCore, utils, LangfuseWebStateless } from 'langfuse-core';
export { LangfuseMedia } from 'langfuse-core';

// Methods partially borrowed from quirksmode.org/js/cookies.html
const cookieStore = {
  getItem(key) {
    try {
      const nameEQ = key + "=";
      const ca = document.cookie.split(";");
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == " ") {
          c = c.substring(1, c.length);
        }
        if (c.indexOf(nameEQ) === 0) {
          return decodeURIComponent(c.substring(nameEQ.length, c.length));
        }
      }
    } catch (err) {}
    return null;
  },
  setItem(key, value) {
    try {
      const cdomain = "",
        expires = "",
        secure = "";
      const new_cookie_val = key + "=" + encodeURIComponent(value) + expires + "; path=/" + cdomain + secure;
      document.cookie = new_cookie_val;
    } catch (err) {
      return;
    }
  },
  removeItem(name) {
    try {
      cookieStore.setItem(name, "");
    } catch (err) {
      return;
    }
  },
  clear() {
    document.cookie = "";
  },
  getAllKeys() {
    const ca = document.cookie.split(";");
    const keys = [];
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == " ") {
        c = c.substring(1, c.length);
      }
      keys.push(c.split("=")[0]);
    }
    return keys;
  }
};
const createStorageLike = store => {
  return {
    getItem(key) {
      return store.getItem(key);
    },
    setItem(key, value) {
      store.setItem(key, value);
    },
    removeItem(key) {
      store.removeItem(key);
    },
    clear() {
      store.clear();
    },
    getAllKeys() {
      const keys = [];
      for (const key in localStorage) {
        keys.push(key);
      }
      return keys;
    }
  };
};
const checkStoreIsSupported = (storage, key = "__mplssupport__") => {
  if (!window) {
    return false;
  }
  try {
    const val = "xyz";
    storage.setItem(key, val);
    if (storage.getItem(key) !== val) {
      return false;
    }
    storage.removeItem(key);
    return true;
  } catch (err) {
    return false;
  }
};
let localStore = undefined;
let sessionStore = undefined;
const createMemoryStorage = () => {
  const _cache = {};
  const store = {
    getItem(key) {
      return _cache[key];
    },
    setItem(key, value) {
      _cache[key] = value !== null ? value : undefined;
    },
    removeItem(key) {
      delete _cache[key];
    },
    clear() {
      for (const key in _cache) {
        delete _cache[key];
      }
    },
    getAllKeys() {
      const keys = [];
      for (const key in _cache) {
        keys.push(key);
      }
      return keys;
    }
  };
  return store;
};
const getStorage = (type, window) => {
  if (typeof window !== undefined && window) {
    if (!localStorage) {
      const _localStore = createStorageLike(window.localStorage);
      localStore = checkStoreIsSupported(_localStore) ? _localStore : undefined;
    }
    if (!sessionStore) {
      const _sessionStore = createStorageLike(window.sessionStorage);
      sessionStore = checkStoreIsSupported(_sessionStore) ? _sessionStore : undefined;
    }
  }
  switch (type) {
    case "cookie":
      return cookieStore || localStore || sessionStore || createMemoryStorage();
    case "localStorage":
      return localStore || sessionStore || createMemoryStorage();
    case "sessionStorage":
      return sessionStore || createMemoryStorage();
    case "memory":
      return createMemoryStorage();
    default:
      return createMemoryStorage();
  }
};

/* eslint-disable */
/* tslint:disable */
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */
var ContentType;
(function (ContentType) {
  ContentType["Json"] = "application/json";
  ContentType["FormData"] = "multipart/form-data";
  ContentType["UrlEncoded"] = "application/x-www-form-urlencoded";
  ContentType["Text"] = "text/plain";
})(ContentType || (ContentType = {}));
class HttpClient {
  constructor(apiConfig = {}) {
    this.baseUrl = "";
    this.securityData = null;
    this.abortControllers = new Map();
    this.customFetch = (...fetchParams) => fetch(...fetchParams);
    this.baseApiParams = {
      credentials: "same-origin",
      headers: {},
      redirect: "follow",
      referrerPolicy: "no-referrer"
    };
    this.setSecurityData = data => {
      this.securityData = data;
    };
    this.contentFormatters = {
      [ContentType.Json]: input => input !== null && (typeof input === "object" || typeof input === "string") ? JSON.stringify(input) : input,
      [ContentType.Text]: input => input !== null && typeof input !== "string" ? JSON.stringify(input) : input,
      [ContentType.FormData]: input => Object.keys(input || {}).reduce((formData, key) => {
        const property = input[key];
        formData.append(key, property instanceof Blob ? property : typeof property === "object" && property !== null ? JSON.stringify(property) : `${property}`);
        return formData;
      }, new FormData()),
      [ContentType.UrlEncoded]: input => this.toQueryString(input)
    };
    this.createAbortSignal = cancelToken => {
      if (this.abortControllers.has(cancelToken)) {
        const abortController = this.abortControllers.get(cancelToken);
        if (abortController) {
          return abortController.signal;
        }
        return void 0;
      }
      const abortController = new AbortController();
      this.abortControllers.set(cancelToken, abortController);
      return abortController.signal;
    };
    this.abortRequest = cancelToken => {
      const abortController = this.abortControllers.get(cancelToken);
      if (abortController) {
        abortController.abort();
        this.abortControllers.delete(cancelToken);
      }
    };
    this.request = async ({
      body,
      secure,
      path,
      type,
      query,
      format,
      baseUrl,
      cancelToken,
      ...params
    }) => {
      const secureParams = (typeof secure === "boolean" ? secure : this.baseApiParams.secure) && this.securityWorker && (await this.securityWorker(this.securityData)) || {};
      const requestParams = this.mergeRequestParams(params, secureParams);
      const queryString = query && this.toQueryString(query);
      const payloadFormatter = this.contentFormatters[type || ContentType.Json];
      const responseFormat = format || requestParams.format;
      return this.customFetch(`${baseUrl || this.baseUrl || ""}${path}${queryString ? `?${queryString}` : ""}`, {
        ...requestParams,
        headers: {
          ...(requestParams.headers || {}),
          ...(type && type !== ContentType.FormData ? {
            "Content-Type": type
          } : {})
        },
        signal: (cancelToken ? this.createAbortSignal(cancelToken) : requestParams.signal) || null,
        body: typeof body === "undefined" || body === null ? null : payloadFormatter(body)
      }).then(async response => {
        const r = response.clone();
        r.data = null;
        r.error = null;
        const data = !responseFormat ? r : await response[responseFormat]().then(data => {
          if (r.ok) {
            r.data = data;
          } else {
            r.error = data;
          }
          return r;
        }).catch(e => {
          r.error = e;
          return r;
        });
        if (cancelToken) {
          this.abortControllers.delete(cancelToken);
        }
        if (!response.ok) throw data;
        return data.data;
      });
    };
    Object.assign(this, apiConfig);
  }
  encodeQueryParam(key, value) {
    const encodedKey = encodeURIComponent(key);
    return `${encodedKey}=${encodeURIComponent(typeof value === "number" ? value : `${value}`)}`;
  }
  addQueryParam(query, key) {
    return this.encodeQueryParam(key, query[key]);
  }
  addArrayQueryParam(query, key) {
    const value = query[key];
    return value.map(v => this.encodeQueryParam(key, v)).join("&");
  }
  toQueryString(rawQuery) {
    const query = rawQuery || {};
    const keys = Object.keys(query).filter(key => "undefined" !== typeof query[key]);
    return keys.map(key => Array.isArray(query[key]) ? this.addArrayQueryParam(query, key) : this.addQueryParam(query, key)).join("&");
  }
  addQueryParams(rawQuery) {
    const queryString = this.toQueryString(rawQuery);
    return queryString ? `?${queryString}` : "";
  }
  mergeRequestParams(params1, params2) {
    return {
      ...this.baseApiParams,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...(this.baseApiParams.headers || {}),
        ...(params1.headers || {}),
        ...(params2 && params2.headers || {})
      }
    };
  }
}
/**
 * @title langfuse
 *
 * ## Authentication
 *
 * Authenticate with the API using [Basic Auth](https://en.wikipedia.org/wiki/Basic_access_authentication), get API keys in the project settings:
 *
 * - username: Langfuse Public Key
 * - password: Langfuse Secret Key
 *
 * ## Exports
 *
 * - OpenAPI spec: https://cloud.langfuse.com/generated/api/openapi.yml
 * - Postman collection: https://cloud.langfuse.com/generated/postman/collection.json
 */
class LangfusePublicApi extends HttpClient {
  constructor() {
    super(...arguments);
    this.api = {
      /**
       * @description Add an item to an annotation queue
       *
       * @tags AnnotationQueues
       * @name AnnotationQueuesCreateQueueItem
       * @request POST:/api/public/annotation-queues/{queueId}/items
       * @secure
       */
      annotationQueuesCreateQueueItem: (queueId, data, params = {}) => this.request({
        path: `/api/public/annotation-queues/${queueId}/items`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params
      }),
      /**
       * @description Remove an item from an annotation queue
       *
       * @tags AnnotationQueues
       * @name AnnotationQueuesDeleteQueueItem
       * @request DELETE:/api/public/annotation-queues/{queueId}/items/{itemId}
       * @secure
       */
      annotationQueuesDeleteQueueItem: (queueId, itemId, params = {}) => this.request({
        path: `/api/public/annotation-queues/${queueId}/items/${itemId}`,
        method: "DELETE",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get an annotation queue by ID
       *
       * @tags AnnotationQueues
       * @name AnnotationQueuesGetQueue
       * @request GET:/api/public/annotation-queues/{queueId}
       * @secure
       */
      annotationQueuesGetQueue: (queueId, params = {}) => this.request({
        path: `/api/public/annotation-queues/${queueId}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get a specific item from an annotation queue
       *
       * @tags AnnotationQueues
       * @name AnnotationQueuesGetQueueItem
       * @request GET:/api/public/annotation-queues/{queueId}/items/{itemId}
       * @secure
       */
      annotationQueuesGetQueueItem: (queueId, itemId, params = {}) => this.request({
        path: `/api/public/annotation-queues/${queueId}/items/${itemId}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get items for a specific annotation queue
       *
       * @tags AnnotationQueues
       * @name AnnotationQueuesListQueueItems
       * @request GET:/api/public/annotation-queues/{queueId}/items
       * @secure
       */
      annotationQueuesListQueueItems: ({
        queueId,
        ...query
      }, params = {}) => this.request({
        path: `/api/public/annotation-queues/${queueId}/items`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get all annotation queues
       *
       * @tags AnnotationQueues
       * @name AnnotationQueuesListQueues
       * @request GET:/api/public/annotation-queues
       * @secure
       */
      annotationQueuesListQueues: (query, params = {}) => this.request({
        path: `/api/public/annotation-queues`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Update an annotation queue item
       *
       * @tags AnnotationQueues
       * @name AnnotationQueuesUpdateQueueItem
       * @request PATCH:/api/public/annotation-queues/{queueId}/items/{itemId}
       * @secure
       */
      annotationQueuesUpdateQueueItem: (queueId, itemId, data, params = {}) => this.request({
        path: `/api/public/annotation-queues/${queueId}/items/${itemId}`,
        method: "PATCH",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params
      }),
      /**
       * @description Create a comment. Comments may be attached to different object types (trace, observation, session, prompt).
       *
       * @tags Comments
       * @name CommentsCreate
       * @request POST:/api/public/comments
       * @secure
       */
      commentsCreate: (data, params = {}) => this.request({
        path: `/api/public/comments`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params
      }),
      /**
       * @description Get all comments
       *
       * @tags Comments
       * @name CommentsGet
       * @request GET:/api/public/comments
       * @secure
       */
      commentsGet: (query, params = {}) => this.request({
        path: `/api/public/comments`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get a comment by id
       *
       * @tags Comments
       * @name CommentsGetById
       * @request GET:/api/public/comments/{commentId}
       * @secure
       */
      commentsGetById: (commentId, params = {}) => this.request({
        path: `/api/public/comments/${commentId}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Create a dataset item
       *
       * @tags DatasetItems
       * @name DatasetItemsCreate
       * @request POST:/api/public/dataset-items
       * @secure
       */
      datasetItemsCreate: (data, params = {}) => this.request({
        path: `/api/public/dataset-items`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params
      }),
      /**
       * @description Delete a dataset item and all its run items. This action is irreversible.
       *
       * @tags DatasetItems
       * @name DatasetItemsDelete
       * @request DELETE:/api/public/dataset-items/{id}
       * @secure
       */
      datasetItemsDelete: (id, params = {}) => this.request({
        path: `/api/public/dataset-items/${id}`,
        method: "DELETE",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get a dataset item
       *
       * @tags DatasetItems
       * @name DatasetItemsGet
       * @request GET:/api/public/dataset-items/{id}
       * @secure
       */
      datasetItemsGet: (id, params = {}) => this.request({
        path: `/api/public/dataset-items/${id}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get dataset items
       *
       * @tags DatasetItems
       * @name DatasetItemsList
       * @request GET:/api/public/dataset-items
       * @secure
       */
      datasetItemsList: (query, params = {}) => this.request({
        path: `/api/public/dataset-items`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Create a dataset run item
       *
       * @tags DatasetRunItems
       * @name DatasetRunItemsCreate
       * @request POST:/api/public/dataset-run-items
       * @secure
       */
      datasetRunItemsCreate: (data, params = {}) => this.request({
        path: `/api/public/dataset-run-items`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params
      }),
      /**
       * @description List dataset run items
       *
       * @tags DatasetRunItems
       * @name DatasetRunItemsList
       * @request GET:/api/public/dataset-run-items
       * @secure
       */
      datasetRunItemsList: (query, params = {}) => this.request({
        path: `/api/public/dataset-run-items`,
        method: "GET",
        query: query,
        secure: true,
        ...params
      }),
      /**
       * @description Create a dataset
       *
       * @tags Datasets
       * @name DatasetsCreate
       * @request POST:/api/public/v2/datasets
       * @secure
       */
      datasetsCreate: (data, params = {}) => this.request({
        path: `/api/public/v2/datasets`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params
      }),
      /**
       * @description Delete a dataset run and all its run items. This action is irreversible.
       *
       * @tags Datasets
       * @name DatasetsDeleteRun
       * @request DELETE:/api/public/datasets/{datasetName}/runs/{runName}
       * @secure
       */
      datasetsDeleteRun: (datasetName, runName, params = {}) => this.request({
        path: `/api/public/datasets/${datasetName}/runs/${runName}`,
        method: "DELETE",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get a dataset
       *
       * @tags Datasets
       * @name DatasetsGet
       * @request GET:/api/public/v2/datasets/{datasetName}
       * @secure
       */
      datasetsGet: (datasetName, params = {}) => this.request({
        path: `/api/public/v2/datasets/${datasetName}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get a dataset run and its items
       *
       * @tags Datasets
       * @name DatasetsGetRun
       * @request GET:/api/public/datasets/{datasetName}/runs/{runName}
       * @secure
       */
      datasetsGetRun: (datasetName, runName, params = {}) => this.request({
        path: `/api/public/datasets/${datasetName}/runs/${runName}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get dataset runs
       *
       * @tags Datasets
       * @name DatasetsGetRuns
       * @request GET:/api/public/datasets/{datasetName}/runs
       * @secure
       */
      datasetsGetRuns: ({
        datasetName,
        ...query
      }, params = {}) => this.request({
        path: `/api/public/datasets/${datasetName}/runs`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get all datasets
       *
       * @tags Datasets
       * @name DatasetsList
       * @request GET:/api/public/v2/datasets
       * @secure
       */
      datasetsList: (query, params = {}) => this.request({
        path: `/api/public/v2/datasets`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Check health of API and database
       *
       * @tags Health
       * @name HealthHealth
       * @request GET:/api/public/health
       */
      healthHealth: (params = {}) => this.request({
        path: `/api/public/health`,
        method: "GET",
        format: "json",
        ...params
      }),
      /**
       * @description Batched ingestion for Langfuse Tracing. If you want to use tracing via the API, such as to build your own Langfuse client implementation, this is the only API route you need to implement. Within each batch, there can be multiple events. Each event has a type, an id, a timestamp, metadata and a body. Internally, we refer to this as the "event envelope" as it tells us something about the event but not the trace. We use the event id within this envelope to deduplicate messages to avoid processing the same event twice, i.e. the event id should be unique per request. The event.body.id is the ID of the actual trace and will be used for updates and will be visible within the Langfuse App. I.e. if you want to update a trace, you'd use the same body id, but separate event IDs. Notes: - Introduction to data model: https://langfuse.com/docs/tracing-data-model - Batch sizes are limited to 3.5 MB in total. You need to adjust the number of events per batch accordingly. - The API does not return a 4xx status code for input errors. Instead, it responds with a 207 status code, which includes a list of the encountered errors.
       *
       * @tags Ingestion
       * @name IngestionBatch
       * @request POST:/api/public/ingestion
       * @secure
       */
      ingestionBatch: (data, params = {}) => this.request({
        path: `/api/public/ingestion`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params
      }),
      /**
       * @description Get a media record
       *
       * @tags Media
       * @name MediaGet
       * @request GET:/api/public/media/{mediaId}
       * @secure
       */
      mediaGet: (mediaId, params = {}) => this.request({
        path: `/api/public/media/${mediaId}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get a presigned upload URL for a media record
       *
       * @tags Media
       * @name MediaGetUploadUrl
       * @request POST:/api/public/media
       * @secure
       */
      mediaGetUploadUrl: (data, params = {}) => this.request({
        path: `/api/public/media`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params
      }),
      /**
       * @description Patch a media record
       *
       * @tags Media
       * @name MediaPatch
       * @request PATCH:/api/public/media/{mediaId}
       * @secure
       */
      mediaPatch: (mediaId, data, params = {}) => this.request({
        path: `/api/public/media/${mediaId}`,
        method: "PATCH",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params
      }),
      /**
       * @description Get metrics from the Langfuse project using a query object
       *
       * @tags Metrics
       * @name MetricsMetrics
       * @request GET:/api/public/metrics
       * @secure
       */
      metricsMetrics: (query, params = {}) => this.request({
        path: `/api/public/metrics`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Create a model
       *
       * @tags Models
       * @name ModelsCreate
       * @request POST:/api/public/models
       * @secure
       */
      modelsCreate: (data, params = {}) => this.request({
        path: `/api/public/models`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params
      }),
      /**
       * @description Delete a model. Cannot delete models managed by Langfuse. You can create your own definition with the same modelName to override the definition though.
       *
       * @tags Models
       * @name ModelsDelete
       * @request DELETE:/api/public/models/{id}
       * @secure
       */
      modelsDelete: (id, params = {}) => this.request({
        path: `/api/public/models/${id}`,
        method: "DELETE",
        secure: true,
        ...params
      }),
      /**
       * @description Get a model
       *
       * @tags Models
       * @name ModelsGet
       * @request GET:/api/public/models/{id}
       * @secure
       */
      modelsGet: (id, params = {}) => this.request({
        path: `/api/public/models/${id}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get all models
       *
       * @tags Models
       * @name ModelsList
       * @request GET:/api/public/models
       * @secure
       */
      modelsList: (query, params = {}) => this.request({
        path: `/api/public/models`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get a observation
       *
       * @tags Observations
       * @name ObservationsGet
       * @request GET:/api/public/observations/{observationId}
       * @secure
       */
      observationsGet: (observationId, params = {}) => this.request({
        path: `/api/public/observations/${observationId}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get a list of observations
       *
       * @tags Observations
       * @name ObservationsGetMany
       * @request GET:/api/public/observations
       * @secure
       */
      observationsGetMany: (query, params = {}) => this.request({
        path: `/api/public/observations`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get all memberships for the organization associated with the API key (requires organization-scoped API key)
       *
       * @tags Organizations
       * @name OrganizationsGetOrganizationMemberships
       * @request GET:/api/public/organizations/memberships
       * @secure
       */
      organizationsGetOrganizationMemberships: (params = {}) => this.request({
        path: `/api/public/organizations/memberships`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get all projects for the organization associated with the API key (requires organization-scoped API key)
       *
       * @tags Organizations
       * @name OrganizationsGetOrganizationProjects
       * @request GET:/api/public/organizations/projects
       * @secure
       */
      organizationsGetOrganizationProjects: (params = {}) => this.request({
        path: `/api/public/organizations/projects`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get all memberships for a specific project (requires organization-scoped API key)
       *
       * @tags Organizations
       * @name OrganizationsGetProjectMemberships
       * @request GET:/api/public/projects/{projectId}/memberships
       * @secure
       */
      organizationsGetProjectMemberships: (projectId, params = {}) => this.request({
        path: `/api/public/projects/${projectId}/memberships`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Create or update a membership for the organization associated with the API key (requires organization-scoped API key)
       *
       * @tags Organizations
       * @name OrganizationsUpdateOrganizationMembership
       * @request PUT:/api/public/organizations/memberships
       * @secure
       */
      organizationsUpdateOrganizationMembership: (data, params = {}) => this.request({
        path: `/api/public/organizations/memberships`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params
      }),
      /**
       * @description Create or update a membership for a specific project (requires organization-scoped API key). The user must already be a member of the organization.
       *
       * @tags Organizations
       * @name OrganizationsUpdateProjectMembership
       * @request PUT:/api/public/projects/{projectId}/memberships
       * @secure
       */
      organizationsUpdateProjectMembership: (projectId, data, params = {}) => this.request({
        path: `/api/public/projects/${projectId}/memberships`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params
      }),
      /**
       * @description Create a new project (requires organization-scoped API key)
       *
       * @tags Projects
       * @name ProjectsCreate
       * @request POST:/api/public/projects
       * @secure
       */
      projectsCreate: (data, params = {}) => this.request({
        path: `/api/public/projects`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params
      }),
      /**
       * @description Create a new API key for a project (requires organization-scoped API key)
       *
       * @tags Projects
       * @name ProjectsCreateApiKey
       * @request POST:/api/public/projects/{projectId}/apiKeys
       * @secure
       */
      projectsCreateApiKey: (projectId, data, params = {}) => this.request({
        path: `/api/public/projects/${projectId}/apiKeys`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params
      }),
      /**
       * @description Delete a project by ID (requires organization-scoped API key). Project deletion is processed asynchronously.
       *
       * @tags Projects
       * @name ProjectsDelete
       * @request DELETE:/api/public/projects/{projectId}
       * @secure
       */
      projectsDelete: (projectId, params = {}) => this.request({
        path: `/api/public/projects/${projectId}`,
        method: "DELETE",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Delete an API key for a project (requires organization-scoped API key)
       *
       * @tags Projects
       * @name ProjectsDeleteApiKey
       * @request DELETE:/api/public/projects/{projectId}/apiKeys/{apiKeyId}
       * @secure
       */
      projectsDeleteApiKey: (projectId, apiKeyId, params = {}) => this.request({
        path: `/api/public/projects/${projectId}/apiKeys/${apiKeyId}`,
        method: "DELETE",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get Project associated with API key
       *
       * @tags Projects
       * @name ProjectsGet
       * @request GET:/api/public/projects
       * @secure
       */
      projectsGet: (params = {}) => this.request({
        path: `/api/public/projects`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get all API keys for a project (requires organization-scoped API key)
       *
       * @tags Projects
       * @name ProjectsGetApiKeys
       * @request GET:/api/public/projects/{projectId}/apiKeys
       * @secure
       */
      projectsGetApiKeys: (projectId, params = {}) => this.request({
        path: `/api/public/projects/${projectId}/apiKeys`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Update a project by ID (requires organization-scoped API key).
       *
       * @tags Projects
       * @name ProjectsUpdate
       * @request PUT:/api/public/projects/{projectId}
       * @secure
       */
      projectsUpdate: (projectId, data, params = {}) => this.request({
        path: `/api/public/projects/${projectId}`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params
      }),
      /**
       * @description Create a new version for the prompt with the given `name`
       *
       * @tags Prompts
       * @name PromptsCreate
       * @request POST:/api/public/v2/prompts
       * @secure
       */
      promptsCreate: (data, params = {}) => this.request({
        path: `/api/public/v2/prompts`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params
      }),
      /**
       * @description Get a prompt
       *
       * @tags Prompts
       * @name PromptsGet
       * @request GET:/api/public/v2/prompts/{promptName}
       * @secure
       */
      promptsGet: ({
        promptName,
        ...query
      }, params = {}) => this.request({
        path: `/api/public/v2/prompts/${promptName}`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get a list of prompt names with versions and labels
       *
       * @tags Prompts
       * @name PromptsList
       * @request GET:/api/public/v2/prompts
       * @secure
       */
      promptsList: (query, params = {}) => this.request({
        path: `/api/public/v2/prompts`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Update labels for a specific prompt version
       *
       * @tags PromptVersion
       * @name PromptVersionUpdate
       * @request PATCH:/api/public/v2/prompts/{name}/versions/{version}
       * @secure
       */
      promptVersionUpdate: (name, version, data, params = {}) => this.request({
        path: `/api/public/v2/prompts/${name}/versions/${version}`,
        method: "PATCH",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params
      }),
      /**
       * @description Create a new user in the organization (requires organization-scoped API key)
       *
       * @tags Scim
       * @name ScimCreateUser
       * @request POST:/api/public/scim/Users
       * @secure
       */
      scimCreateUser: (data, params = {}) => this.request({
        path: `/api/public/scim/Users`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params
      }),
      /**
       * @description Remove a user from the organization (requires organization-scoped API key). Note that this only removes the user from the organization but does not delete the user entity itself.
       *
       * @tags Scim
       * @name ScimDeleteUser
       * @request DELETE:/api/public/scim/Users/{userId}
       * @secure
       */
      scimDeleteUser: (userId, params = {}) => this.request({
        path: `/api/public/scim/Users/${userId}`,
        method: "DELETE",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get SCIM Resource Types (requires organization-scoped API key)
       *
       * @tags Scim
       * @name ScimGetResourceTypes
       * @request GET:/api/public/scim/ResourceTypes
       * @secure
       */
      scimGetResourceTypes: (params = {}) => this.request({
        path: `/api/public/scim/ResourceTypes`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get SCIM Schemas (requires organization-scoped API key)
       *
       * @tags Scim
       * @name ScimGetSchemas
       * @request GET:/api/public/scim/Schemas
       * @secure
       */
      scimGetSchemas: (params = {}) => this.request({
        path: `/api/public/scim/Schemas`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get SCIM Service Provider Configuration (requires organization-scoped API key)
       *
       * @tags Scim
       * @name ScimGetServiceProviderConfig
       * @request GET:/api/public/scim/ServiceProviderConfig
       * @secure
       */
      scimGetServiceProviderConfig: (params = {}) => this.request({
        path: `/api/public/scim/ServiceProviderConfig`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get a specific user by ID (requires organization-scoped API key)
       *
       * @tags Scim
       * @name ScimGetUser
       * @request GET:/api/public/scim/Users/{userId}
       * @secure
       */
      scimGetUser: (userId, params = {}) => this.request({
        path: `/api/public/scim/Users/${userId}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description List users in the organization (requires organization-scoped API key)
       *
       * @tags Scim
       * @name ScimListUsers
       * @request GET:/api/public/scim/Users
       * @secure
       */
      scimListUsers: (query, params = {}) => this.request({
        path: `/api/public/scim/Users`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Create a score configuration (config). Score configs are used to define the structure of scores
       *
       * @tags ScoreConfigs
       * @name ScoreConfigsCreate
       * @request POST:/api/public/score-configs
       * @secure
       */
      scoreConfigsCreate: (data, params = {}) => this.request({
        path: `/api/public/score-configs`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params
      }),
      /**
       * @description Get all score configs
       *
       * @tags ScoreConfigs
       * @name ScoreConfigsGet
       * @request GET:/api/public/score-configs
       * @secure
       */
      scoreConfigsGet: (query, params = {}) => this.request({
        path: `/api/public/score-configs`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get a score config
       *
       * @tags ScoreConfigs
       * @name ScoreConfigsGetById
       * @request GET:/api/public/score-configs/{configId}
       * @secure
       */
      scoreConfigsGetById: (configId, params = {}) => this.request({
        path: `/api/public/score-configs/${configId}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Create a score (supports both trace and session scores)
       *
       * @tags Score
       * @name ScoreCreate
       * @request POST:/api/public/scores
       * @secure
       */
      scoreCreate: (data, params = {}) => this.request({
        path: `/api/public/scores`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params
      }),
      /**
       * @description Delete a score (supports both trace and session scores)
       *
       * @tags Score
       * @name ScoreDelete
       * @request DELETE:/api/public/scores/{scoreId}
       * @secure
       */
      scoreDelete: (scoreId, params = {}) => this.request({
        path: `/api/public/scores/${scoreId}`,
        method: "DELETE",
        secure: true,
        ...params
      }),
      /**
       * @description Get a list of scores (supports both trace and session scores)
       *
       * @tags ScoreV2
       * @name ScoreV2Get
       * @request GET:/api/public/v2/scores
       * @secure
       */
      scoreV2Get: (query, params = {}) => this.request({
        path: `/api/public/v2/scores`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get a score (supports both trace and session scores)
       *
       * @tags ScoreV2
       * @name ScoreV2GetById
       * @request GET:/api/public/v2/scores/{scoreId}
       * @secure
       */
      scoreV2GetById: (scoreId, params = {}) => this.request({
        path: `/api/public/v2/scores/${scoreId}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get a session. Please note that `traces` on this endpoint are not paginated, if you plan to fetch large sessions, consider `GET /api/public/traces?sessionId=<sessionId>`
       *
       * @tags Sessions
       * @name SessionsGet
       * @request GET:/api/public/sessions/{sessionId}
       * @secure
       */
      sessionsGet: (sessionId, params = {}) => this.request({
        path: `/api/public/sessions/${sessionId}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get sessions
       *
       * @tags Sessions
       * @name SessionsList
       * @request GET:/api/public/sessions
       * @secure
       */
      sessionsList: (query, params = {}) => this.request({
        path: `/api/public/sessions`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Delete a specific trace
       *
       * @tags Trace
       * @name TraceDelete
       * @request DELETE:/api/public/traces/{traceId}
       * @secure
       */
      traceDelete: (traceId, params = {}) => this.request({
        path: `/api/public/traces/${traceId}`,
        method: "DELETE",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Delete multiple traces
       *
       * @tags Trace
       * @name TraceDeleteMultiple
       * @request DELETE:/api/public/traces
       * @secure
       */
      traceDeleteMultiple: (data, params = {}) => this.request({
        path: `/api/public/traces`,
        method: "DELETE",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params
      }),
      /**
       * @description Get a specific trace
       *
       * @tags Trace
       * @name TraceGet
       * @request GET:/api/public/traces/{traceId}
       * @secure
       */
      traceGet: (traceId, params = {}) => this.request({
        path: `/api/public/traces/${traceId}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params
      }),
      /**
       * @description Get list of traces
       *
       * @tags Trace
       * @name TraceList
       * @request GET:/api/public/traces
       * @secure
       */
      traceList: (query, params = {}) => this.request({
        path: `/api/public/traces`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params
      })
    };
  }
}

var version = "3.38.6";

class Langfuse extends LangfuseCore {
  constructor(params) {
    const langfuseConfig = utils.configLangfuseSDK(params);
    super(langfuseConfig);
    if (typeof window !== "undefined" && "Deno" in window === false) {
      this._storageKey = params?.persistence_name ? `lf_${params.persistence_name}` : `lf_${langfuseConfig.publicKey}_langfuse`;
      this._storage = getStorage(params?.persistence || "localStorage", window);
    } else {
      this._storageKey = `lf_${langfuseConfig.publicKey}_langfuse`;
      this._storage = getStorage("memory", undefined);
    }
    this.api = new LangfusePublicApi({
      baseUrl: this.baseUrl,
      baseApiParams: {
        headers: {
          "X-Langfuse-Sdk-Name": "langfuse-js",
          "X-Langfuse-Sdk-Version": this.getLibraryVersion(),
          "X-Langfuse-Sdk-Variant": this.getLibraryId(),
          "X-Langfuse-Sdk-Integration": this.sdkIntegration,
          "X-Langfuse-Public-Key": this.publicKey,
          ...this.additionalHeaders,
          ...this.constructAuthorizationHeader(this.publicKey, this.secretKey)
        }
      }
    }).api;
  }
  getPersistedProperty(key) {
    if (!this._storageCache) {
      this._storageCache = JSON.parse(this._storage.getItem(this._storageKey) || "{}") || {};
    }
    return this._storageCache[key];
  }
  setPersistedProperty(key, value) {
    if (!this._storageCache) {
      this._storageCache = JSON.parse(this._storage.getItem(this._storageKey) || "{}") || {};
    }
    if (value === null) {
      delete this._storageCache[key];
    } else {
      this._storageCache[key] = value;
    }
    this._storage.setItem(this._storageKey, JSON.stringify(this._storageCache));
  }
  fetch(url, options) {
    return fetch(url, options);
  }
  getLibraryId() {
    return "langfuse";
  }
  getLibraryVersion() {
    return version;
  }
  getCustomUserAgent() {
    return;
  }
}
class LangfuseWeb extends LangfuseWebStateless {
  constructor(params) {
    const langfuseConfig = utils.configLangfuseSDK(params, false);
    super(langfuseConfig);
    if (typeof window !== "undefined") {
      this._storageKey = params?.persistence_name ? `lf_${params.persistence_name}` : `lf_${langfuseConfig.publicKey}_langfuse`;
      this._storage = getStorage(params?.persistence || "localStorage", window);
    } else {
      this._storageKey = `lf_${langfuseConfig.publicKey}_langfuse`;
      this._storage = getStorage("memory", undefined);
    }
  }
  getPersistedProperty(key) {
    if (!this._storageCache) {
      this._storageCache = JSON.parse(this._storage.getItem(this._storageKey) || "{}") || {};
    }
    return this._storageCache[key];
  }
  setPersistedProperty(key, value) {
    if (!this._storageCache) {
      this._storageCache = JSON.parse(this._storage.getItem(this._storageKey) || "{}") || {};
    }
    if (value === null) {
      delete this._storageCache[key];
    } else {
      this._storageCache[key] = value;
    }
    this._storage.setItem(this._storageKey, JSON.stringify(this._storageCache));
  }
  fetch(url, options) {
    return fetch(url, options);
  }
  getLibraryId() {
    return "langfuse-frontend";
  }
  getLibraryVersion() {
    return version;
  }
  getCustomUserAgent() {
    return;
  }
}

/**
 * Represents a singleton instance of the Langfuse client.
 */
class LangfuseSingleton {
  /**
   * Returns the singleton instance of the Langfuse client.
   * @param params Optional parameters for initializing the Langfuse instance. Only used for the first call.
   * @returns The singleton instance of the Langfuse client.
   */
  static getInstance(params) {
    if (!LangfuseSingleton.instance) {
      LangfuseSingleton.instance = new Langfuse(params);
    }
    return LangfuseSingleton.instance;
  }
}
LangfuseSingleton.instance = null; // Lazy initialization

const parseInputArgs = args => {
  let params = {};
  params = {
    frequency_penalty: args.frequency_penalty,
    logit_bias: args.logit_bias,
    logprobs: args.logprobs,
    max_tokens: args.max_tokens,
    n: args.n,
    presence_penalty: args.presence_penalty,
    seed: args.seed,
    stop: args.stop,
    stream: args.stream,
    temperature: args.temperature,
    top_p: args.top_p,
    user: args.user,
    response_format: args.response_format,
    top_logprobs: args.top_logprobs
  };
  let input = args.input;
  if (args && typeof args === "object" && !Array.isArray(args) && "messages" in args) {
    input = {};
    input.messages = args.messages;
    if ("function_call" in args) {
      input.function_call = args.function_call;
    }
    if ("functions" in args) {
      input.functions = args.functions;
    }
    if ("tools" in args) {
      input.tools = args.tools;
    }
    if ("tool_choice" in args) {
      input.tool_choice = args.tool_choice;
    }
  } else if (!input) {
    input = args.prompt;
  }
  return {
    model: args.model,
    input: input,
    modelParameters: params
  };
};
const parseCompletionOutput = res => {
  if (res instanceof Object && "output_text" in res && res["output_text"] !== "") {
    return res["output_text"];
  }
  if (typeof res === "object" && res && "output" in res && Array.isArray(res["output"])) {
    const output = res["output"];
    if (output.length > 1) {
      return output;
    }
    if (output.length === 1) {
      return output[0];
    }
    return null;
  }
  if (!(res instanceof Object && "choices" in res && Array.isArray(res.choices))) {
    return "";
  }
  return "message" in res.choices[0] ? res.choices[0].message : res.choices[0].text ?? "";
};
const parseUsage = res => {
  if (hasCompletionUsage(res)) {
    const {
      prompt_tokens,
      completion_tokens,
      total_tokens
    } = res.usage;
    return {
      input: prompt_tokens,
      output: completion_tokens,
      total: total_tokens
    };
  }
};
const parseUsageDetails = completionUsage => {
  if ("prompt_tokens" in completionUsage) {
    const {
      prompt_tokens,
      completion_tokens,
      total_tokens,
      completion_tokens_details,
      prompt_tokens_details
    } = completionUsage;
    return {
      input: prompt_tokens,
      output: completion_tokens,
      total: total_tokens,
      ...Object.fromEntries(Object.entries(prompt_tokens_details ?? {}).map(([key, value]) => [`input_${key}`, value])),
      ...Object.fromEntries(Object.entries(completion_tokens_details ?? {}).map(([key, value]) => [`output_${key}`, value]))
    };
  } else if ("input_tokens" in completionUsage) {
    const {
      input_tokens,
      output_tokens,
      total_tokens,
      input_tokens_details,
      output_tokens_details
    } = completionUsage;
    return {
      input: input_tokens,
      output: output_tokens,
      total: total_tokens,
      ...Object.fromEntries(Object.entries(input_tokens_details ?? {}).map(([key, value]) => [`input_${key}`, value])),
      ...Object.fromEntries(Object.entries(output_tokens_details ?? {}).map(([key, value]) => [`output_${key}`, value]))
    };
  }
};
const parseUsageDetailsFromResponse = res => {
  if (hasCompletionUsage(res)) {
    return parseUsageDetails(res.usage);
  }
};
const parseChunk = rawChunk => {
  let isToolCall = false;
  const _chunk = rawChunk;
  const chunkData = _chunk?.choices?.[0];
  try {
    if ("delta" in chunkData && "tool_calls" in chunkData.delta && Array.isArray(chunkData.delta.tool_calls)) {
      isToolCall = true;
      return {
        isToolCall,
        data: chunkData.delta.tool_calls[0]
      };
    }
    if ("delta" in chunkData) {
      return {
        isToolCall,
        data: chunkData.delta?.content || ""
      };
    }
    if ("text" in chunkData) {
      return {
        isToolCall,
        data: chunkData.text || ""
      };
    }
  } catch (e) {}
  return {
    isToolCall: false,
    data: ""
  };
};
// Type guard to check if an unknown object is a UsageResponse
function hasCompletionUsage(obj) {
  return obj instanceof Object && "usage" in obj && obj.usage instanceof Object && (
  // Completion API Usage format
  typeof obj.usage.prompt_tokens === "number" && typeof obj.usage.completion_tokens === "number" && typeof obj.usage.total_tokens === "number" ||
  // Response API Usage format
  typeof obj.usage.input_tokens === "number" && typeof obj.usage.output_tokens === "number" && typeof obj.usage.total_tokens === "number");
}
const getToolCallOutput = toolCallChunks => {
  let name = "";
  let toolArguments = "";
  for (const toolCall of toolCallChunks) {
    name = toolCall.function?.name || name;
    toolArguments += toolCall.function?.arguments || "";
  }
  return {
    tool_calls: [{
      function: {
        name,
        arguments: toolArguments
      }
    }]
  };
};
const parseModelDataFromResponse = res => {
  if (typeof res !== "object" || res === null) {
    return {
      model: undefined,
      modelParameters: undefined,
      metadata: undefined
    };
  }
  const model = "model" in res ? res["model"] : undefined;
  const modelParameters = {};
  const modelParamKeys = ["max_output_tokens", "parallel_tool_calls", "store", "temperature", "tool_choice", "top_p", "truncation", "user"];
  const metadata = {};
  const metadataKeys = ["reasoning", "incomplete_details", "instructions", "previous_response_id", "tools", "metadata", "status", "error"];
  for (const key of modelParamKeys) {
    const val = key in res ? res[key] : null;
    if (val !== null && val !== undefined) {
      modelParameters[key] = val;
    }
  }
  for (const key of metadataKeys) {
    const val = key in res ? res[key] : null;
    if (val) {
      metadata[key] = val;
    }
  }
  return {
    model,
    modelParameters: Object.keys(modelParameters).length > 0 ? modelParameters : undefined,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined
  };
};

const isAsyncIterable = x => x != null && typeof x === "object" && typeof x[Symbol.asyncIterator] === "function";

const withTracing = (tracedMethod, config) => {
  return (...args) => wrapMethod(tracedMethod, config, ...args);
};
const wrapMethod = (tracedMethod, config, ...args) => {
  const {
    model,
    input,
    modelParameters
  } = parseInputArgs(args[0] ?? {});
  const finalModelParams = {
    ...modelParameters,
    response_format: null
  };
  const finalMetadata = {
    ...config?.metadata,
    response_format: "response_format" in modelParameters ? modelParameters.response_format : undefined
  };
  let observationData = {
    model,
    input,
    modelParameters: finalModelParams,
    name: config?.generationName,
    startTime: new Date(),
    promptName: config?.langfusePrompt?.name,
    promptVersion: config?.langfusePrompt?.version,
    metadata: finalMetadata
  };
  let langfuseParent;
  const hasUserProvidedParent = config && "parent" in config;
  if (hasUserProvidedParent) {
    langfuseParent = config.parent;
    // Remove the parent from the config to avoid circular references in the generation body
    const filteredConfig = {
      ...config,
      parent: undefined
    };
    observationData = {
      ...filteredConfig,
      ...observationData,
      promptName: config?.promptName ?? config?.langfusePrompt?.name,
      // Maintain backward compatibility for users who use promptName
      promptVersion: config?.promptVersion ?? config?.langfusePrompt?.version // Maintain backward compatibility for users who use promptVersion
    };
  } else {
    const langfuse = LangfuseSingleton.getInstance(config?.clientInitParams);
    langfuseParent = langfuse.trace({
      ...config,
      ...observationData,
      id: config?.traceId,
      name: config?.traceName,
      timestamp: observationData.startTime
    });
  }
  try {
    const res = tracedMethod(...args);
    // Handle stream responses
    if (isAsyncIterable(res)) {
      return wrapAsyncIterable(res, langfuseParent, hasUserProvidedParent, observationData);
    }
    if (res instanceof Promise) {
      const wrappedPromise = res.then(result => {
        if (isAsyncIterable(result)) {
          return wrapAsyncIterable(result, langfuseParent, hasUserProvidedParent, observationData);
        }
        const output = parseCompletionOutput(result);
        const usage = parseUsage(result);
        const usageDetails = parseUsageDetailsFromResponse(result);
        const {
          model: modelFromResponse,
          modelParameters: modelParametersFromResponse,
          metadata: metadataFromResponse
        } = parseModelDataFromResponse(result);
        langfuseParent.generation({
          ...observationData,
          output,
          endTime: new Date(),
          usage,
          usageDetails,
          model: modelFromResponse || observationData.model,
          modelParameters: {
            ...observationData.modelParameters,
            ...modelParametersFromResponse
          },
          metadata: {
            ...observationData.metadata,
            ...metadataFromResponse
          }
        });
        if (!hasUserProvidedParent) {
          langfuseParent.update({
            output
          });
        }
        return result;
      }).catch(err => {
        langfuseParent.generation({
          ...observationData,
          endTime: new Date(),
          statusMessage: String(err),
          level: "ERROR",
          usage: {
            inputCost: 0,
            outputCost: 0,
            totalCost: 0
          },
          costDetails: {
            input: 0,
            output: 0,
            total: 0
          }
        });
        throw err;
      });
      return wrappedPromise;
    }
    return res;
  } catch (error) {
    langfuseParent.generation({
      ...observationData,
      endTime: new Date(),
      statusMessage: String(error),
      level: "ERROR",
      usage: {
        inputCost: 0,
        outputCost: 0,
        totalCost: 0
      },
      costDetails: {
        input: 0,
        output: 0,
        total: 0
      }
    });
    throw error;
  }
};
function wrapAsyncIterable(iterable, langfuseParent, hasUserProvidedParent, observationData) {
  async function* tracedOutputGenerator() {
    const response = iterable;
    const textChunks = [];
    const toolCallChunks = [];
    let completionStartTime = null;
    let usage = null;
    let usageDetails = undefined;
    let output = null;
    for await (const rawChunk of response) {
      completionStartTime = completionStartTime ?? new Date();
      // Handle Response API chunks
      if (typeof rawChunk === "object" && rawChunk && "response" in rawChunk) {
        const result = rawChunk["response"];
        output = parseCompletionOutput(result);
        usageDetails = parseUsageDetailsFromResponse(result);
        const {
          model: modelFromResponse,
          modelParameters: modelParametersFromResponse,
          metadata: metadataFromResponse
        } = parseModelDataFromResponse(result);
        observationData["model"] = modelFromResponse ?? observationData["model"];
        observationData["modelParameters"] = {
          ...observationData.modelParameters,
          ...modelParametersFromResponse
        };
        observationData["metadata"] = {
          ...observationData.metadata,
          ...metadataFromResponse
        };
      }
      if (typeof rawChunk === "object" && rawChunk != null && "usage" in rawChunk) {
        usage = rawChunk.usage;
      }
      const processedChunk = parseChunk(rawChunk);
      if (!processedChunk.isToolCall) {
        textChunks.push(processedChunk.data);
      } else {
        toolCallChunks.push(processedChunk.data);
      }
      yield rawChunk;
    }
    output = output ?? (toolCallChunks.length > 0 ? getToolCallOutput(toolCallChunks) : textChunks.join(""));
    langfuseParent.generation({
      ...observationData,
      output,
      endTime: new Date(),
      completionStartTime,
      usage: usage ? {
        input: "prompt_tokens" in usage ? usage.prompt_tokens : undefined,
        output: "completion_tokens" in usage ? usage.completion_tokens : undefined,
        total: "total_tokens" in usage ? usage.total_tokens : undefined
      } : undefined,
      usageDetails: usageDetails ?? (usage ? parseUsageDetails(usage) : undefined)
    });
    if (!hasUserProvidedParent) {
      langfuseParent.update({
        output
      });
    }
  }
  return tracedOutputGenerator();
}

/**
 * Wraps an OpenAI SDK object with Langfuse tracing. Function calls are extended with a tracer that logs detailed information about the call, including the method name,
 * input parameters, and output.
 *
 * @param {T} sdk - The OpenAI SDK object to be wrapped.
 * @param {LangfuseConfig} [langfuseConfig] - Optional configuration object for the wrapper.
 * @param {string} [langfuseConfig.traceName] - The name to use for tracing. If not provided, a default name based on the SDK's constructor name and the method name will be used.
 * @param {string} [langfuseConfig.sessionId] - Optional session ID for tracing.
 * @param {string} [langfuseConfig.userId] - Optional user ID for tracing.
 * @param {string} [langfuseConfig.release] - Optional release version for tracing.
 * @param {string} [langfuseConfig.version] - Optional version for tracing.
 * @param {string} [langfuseConfig.metadata] - Optional metadata for tracing.
 * @param {string} [langfuseConfig.tags] - Optional tags for tracing.
 * @returns {T} - A proxy of the original SDK object with methods wrapped for tracing.
 *
 * @example
 * const client = new OpenAI();
 * const res = observeOpenAI(client, { traceName: "My.OpenAI.Chat.Trace" }).chat.completions.create({
 *      messages: [{ role: "system", content: "Say this is a test!" }],
        model: "gpt-3.5-turbo",
        user: "langfuse",
        max_tokens: 300
 * });
 * */
const observeOpenAI = (sdk, langfuseConfig) => {
  return new Proxy(sdk, {
    get(wrappedSdk, propKey, proxy) {
      const originalProperty = wrappedSdk[propKey];
      const defaultGenerationName = `${sdk.constructor?.name}.${propKey.toString()}`;
      const generationName = langfuseConfig?.generationName ?? defaultGenerationName;
      const traceName = langfuseConfig && "traceName" in langfuseConfig ? langfuseConfig.traceName : generationName;
      const config = {
        ...langfuseConfig,
        generationName,
        traceName
      };
      // Add a flushAsync method to the OpenAI SDK that flushes the Langfuse client
      if (propKey === "flushAsync") {
        let langfuseClient;
        // Flush the correct client depending on whether a parent client is provided
        if (langfuseConfig && "parent" in langfuseConfig) {
          langfuseClient = langfuseConfig.parent.client;
        } else {
          langfuseClient = LangfuseSingleton.getInstance();
        }
        return langfuseClient.flushAsync.bind(langfuseClient);
      }
      // Add a shutdownAsync method to the OpenAI SDK that flushes the Langfuse client
      if (propKey === "shutdownAsync") {
        let langfuseClient;
        // Flush the correct client depending on whether a parent client is provided
        if (langfuseConfig && "parent" in langfuseConfig) {
          langfuseClient = langfuseConfig.parent.client;
        } else {
          langfuseClient = LangfuseSingleton.getInstance();
        }
        return langfuseClient.shutdownAsync.bind(langfuseClient);
      }
      // Trace methods of the OpenAI SDK
      if (typeof originalProperty === "function") {
        return withTracing(originalProperty.bind(wrappedSdk), config);
      }
      const isNestedOpenAIObject = originalProperty && !Array.isArray(originalProperty) && !(originalProperty instanceof Date) && typeof originalProperty === "object";
      // Recursively wrap nested objects to ensure all nested properties or methods are also traced
      if (isNestedOpenAIObject) {
        return observeOpenAI(originalProperty, config);
      }
      // Fallback to returning the original value
      return Reflect.get(wrappedSdk, propKey, proxy);
    }
  });
};

export { Langfuse, LangfuseWeb, Langfuse as default, observeOpenAI };
//# sourceMappingURL=index.mjs.map
