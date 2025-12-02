import fs from 'node:fs';
import fsPromises from 'node:fs/promises';

async function isType(fsStatType, statsMethodName, filePath) {
	if (typeof filePath !== 'string') {
		throw new TypeError(`Expected a string, got ${typeof filePath}`);
	}

	try {
		const stats = await fsPromises[fsStatType](filePath);
		return stats[statsMethodName]();
	} catch (error) {
		if (error.code === 'ENOENT') {
			return false;
		}

		throw error;
	}
}

function isTypeSync(fsStatType, statsMethodName, filePath) {
	if (typeof filePath !== 'string') {
		throw new TypeError(`Expected a string, got ${typeof filePath}`);
	}

	try {
		return fs[fsStatType](filePath)[statsMethodName]();
	} catch (error) {
		if (error.code === 'ENOENT') {
			return false;
		}

		throw error;
	}
}

export const isFile = isType.bind(undefined, 'stat', 'isFile');
export const isDirectory = isType.bind(undefined, 'stat', 'isDirectory');
export const isSymlink = isType.bind(undefined, 'lstat', 'isSymbolicLink');
export const isFileSync = isTypeSync.bind(undefined, 'statSync', 'isFile');
export const isDirectorySync = isTypeSync.bind(undefined, 'statSync', 'isDirectory');
export const isSymlinkSync = isTypeSync.bind(undefined, 'lstatSync', 'isSymbolicLink');
