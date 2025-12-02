let parsedStackResults;
let lastKeysCount;
let cachedFilenameChunkIds;
function getFilenameToChunkIdMap(stackParser) {
    const chunkIdMap = globalThis._posthogChunkIds;
    if (!chunkIdMap) return;
    const chunkIdKeys = Object.keys(chunkIdMap);
    if (cachedFilenameChunkIds && chunkIdKeys.length === lastKeysCount) return cachedFilenameChunkIds;
    lastKeysCount = chunkIdKeys.length;
    cachedFilenameChunkIds = chunkIdKeys.reduce((acc, stackKey)=>{
        if (!parsedStackResults) parsedStackResults = {};
        const result = parsedStackResults[stackKey];
        if (result) acc[result[0]] = result[1];
        else {
            const parsedStack = stackParser(stackKey);
            for(let i = parsedStack.length - 1; i >= 0; i--){
                const stackFrame = parsedStack[i];
                const filename = stackFrame?.filename;
                const chunkId = chunkIdMap[stackKey];
                if (filename && chunkId) {
                    acc[filename] = chunkId;
                    parsedStackResults[stackKey] = [
                        filename,
                        chunkId
                    ];
                    break;
                }
            }
        }
        return acc;
    }, {});
    return cachedFilenameChunkIds;
}
export { getFilenameToChunkIdMap };
