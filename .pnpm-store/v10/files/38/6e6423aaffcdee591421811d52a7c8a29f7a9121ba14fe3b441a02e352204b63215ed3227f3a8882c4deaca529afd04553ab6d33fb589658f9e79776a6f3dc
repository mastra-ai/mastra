export const getCacheKey = async (commandName, config, options) => {
    const { accessKeyId } = await config.credentials();
    const { identifiers } = options;
    return JSON.stringify({
        ...(accessKeyId && { accessKeyId }),
        ...(identifiers && {
            commandName,
            identifiers: Object.entries(identifiers)
                .sort()
                .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
        }),
    });
};
