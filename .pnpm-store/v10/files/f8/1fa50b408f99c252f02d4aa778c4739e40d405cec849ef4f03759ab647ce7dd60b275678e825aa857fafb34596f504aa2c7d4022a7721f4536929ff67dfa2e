import node_path from "node:path";
import node_fs from "node:fs";
const getLocalPaths = (startPath)=>{
    const paths = [];
    let currentPath = startPath;
    while(true){
        paths.push(currentPath);
        const parentPath = node_path.resolve(currentPath, '..');
        if (parentPath === currentPath) break;
        currentPath = parentPath;
    }
    return paths;
};
const buildLocalBinaryPaths = (cwd)=>{
    const localPaths = getLocalPaths(node_path.resolve(cwd)).map((localPath)=>node_path.join(localPath, 'node_modules/.bin'));
    return localPaths;
};
function resolveBinaryPath(binName, options) {
    const envLocations = options.path.split(node_path.delimiter);
    const localLocations = buildLocalBinaryPaths(options.cwd);
    const directories = [
        ...new Set([
            ...localLocations,
            ...envLocations
        ])
    ];
    for (const directory of directories){
        const binaryPath = node_path.join(directory, binName);
        if (node_fs.existsSync(binaryPath)) return binaryPath;
    }
    throw new Error(`Binary ${binName} not found`);
}
export { buildLocalBinaryPaths, resolveBinaryPath };
