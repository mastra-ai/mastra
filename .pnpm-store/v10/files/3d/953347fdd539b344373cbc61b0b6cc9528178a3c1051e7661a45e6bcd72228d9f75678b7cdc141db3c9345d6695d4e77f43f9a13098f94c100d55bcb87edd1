const requestQueue = {};
export const updateDiscoveredEndpointInCache = async (config, options) => new Promise((resolve, reject) => {
    const { endpointCache } = config;
    const { cacheKey, commandName, identifiers } = options;
    const endpoints = endpointCache.get(cacheKey);
    if (endpoints && endpoints.length === 1 && endpoints[0].Address === "") {
        if (options.isDiscoveredEndpointRequired) {
            if (!requestQueue[cacheKey])
                requestQueue[cacheKey] = [];
            requestQueue[cacheKey].push({ resolve, reject });
        }
        else {
            resolve();
        }
    }
    else if (endpoints && endpoints.length > 0) {
        resolve();
    }
    else {
        const placeholderEndpoints = [{ Address: "", CachePeriodInMinutes: 1 }];
        endpointCache.set(cacheKey, placeholderEndpoints);
        const command = new options.endpointDiscoveryCommandCtor({
            Operation: commandName.slice(0, -7),
            Identifiers: identifiers,
        });
        const handler = command.resolveMiddleware(options.clientStack, config, options.options);
        handler(command)
            .then((result) => {
            endpointCache.set(cacheKey, result.output.Endpoints);
            if (requestQueue[cacheKey]) {
                requestQueue[cacheKey].forEach(({ resolve }) => {
                    resolve();
                });
                delete requestQueue[cacheKey];
            }
            resolve();
        })
            .catch((error) => {
            endpointCache.delete(cacheKey);
            const errorToThrow = Object.assign(new Error(`The operation to discover endpoint failed.` +
                ` Please retry, or provide a custom endpoint and disable endpoint discovery to proceed.`), { reason: error });
            if (requestQueue[cacheKey]) {
                requestQueue[cacheKey].forEach(({ reject }) => {
                    reject(errorToThrow);
                });
                delete requestQueue[cacheKey];
            }
            if (options.isDiscoveredEndpointRequired) {
                reject(errorToThrow);
            }
            else {
                endpointCache.set(cacheKey, placeholderEndpoints);
                resolve();
            }
        });
    }
});
