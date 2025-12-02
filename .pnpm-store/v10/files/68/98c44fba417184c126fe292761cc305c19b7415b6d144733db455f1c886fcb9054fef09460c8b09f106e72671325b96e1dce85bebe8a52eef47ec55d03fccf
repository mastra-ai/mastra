import { dirname, posix, sep } from "path";
function createModulerModifier() {
    const getModuleFromFileName = createGetModuleFromFilename();
    return async (frames)=>{
        for (const frame of frames)frame.module = getModuleFromFileName(frame.filename);
        return frames;
    };
}
function createGetModuleFromFilename(basePath = process.argv[1] ? dirname(process.argv[1]) : process.cwd(), isWindows = '\\' === sep) {
    const normalizedBase = isWindows ? normalizeWindowsPath(basePath) : basePath;
    return (filename)=>{
        if (!filename) return;
        const normalizedFilename = isWindows ? normalizeWindowsPath(filename) : filename;
        let { dir, base: file, ext } = posix.parse(normalizedFilename);
        if ('.js' === ext || '.mjs' === ext || '.cjs' === ext) file = file.slice(0, -1 * ext.length);
        const decodedFile = decodeURIComponent(file);
        if (!dir) dir = '.';
        const n = dir.lastIndexOf('/node_modules');
        if (n > -1) return `${dir.slice(n + 14).replace(/\//g, '.')}:${decodedFile}`;
        if (dir.startsWith(normalizedBase)) {
            const moduleName = dir.slice(normalizedBase.length + 1).replace(/\//g, '.');
            return moduleName ? `${moduleName}:${decodedFile}` : decodedFile;
        }
        return decodedFile;
    };
}
function normalizeWindowsPath(path) {
    return path.replace(/^[A-Z]:/, '').replace(/\\/g, '/');
}
export { createModulerModifier };
