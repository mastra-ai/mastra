import process from 'node:process';
import fs from 'node:fs';
import nodePath from 'node:path';
import mergeStreams from '@sindresorhus/merge-streams';
import fastGlob from 'fast-glob';
import {isDirectory, isDirectorySync} from 'path-type';
import {toPath} from 'unicorn-magic';
import {
	GITIGNORE_FILES_PATTERN,
	isIgnoredByIgnoreFiles,
	isIgnoredByIgnoreFilesSync,
} from './ignore.js';
import {isNegativePattern} from './utilities.js';

const assertPatternsInput = patterns => {
	if (patterns.some(pattern => typeof pattern !== 'string')) {
		throw new TypeError('Patterns must be a string or an array of strings');
	}
};

const normalizePathForDirectoryGlob = (filePath, cwd) => {
	const path = isNegativePattern(filePath) ? filePath.slice(1) : filePath;
	return nodePath.isAbsolute(path) ? path : nodePath.join(cwd, path);
};

const getDirectoryGlob = ({directoryPath, files, extensions}) => {
	const extensionGlob = extensions?.length > 0 ? `.${extensions.length > 1 ? `{${extensions.join(',')}}` : extensions[0]}` : '';
	return files
		? files.map(file => nodePath.posix.join(directoryPath, `**/${nodePath.extname(file) ? file : `${file}${extensionGlob}`}`))
		: [nodePath.posix.join(directoryPath, `**${extensionGlob ? `/*${extensionGlob}` : ''}`)];
};

const directoryToGlob = async (directoryPaths, {
	cwd = process.cwd(),
	files,
	extensions,
} = {}) => {
	const globs = await Promise.all(directoryPaths.map(async directoryPath =>
		(await isDirectory(normalizePathForDirectoryGlob(directoryPath, cwd))) ? getDirectoryGlob({directoryPath, files, extensions}) : directoryPath),
	);

	return globs.flat();
};

const directoryToGlobSync = (directoryPaths, {
	cwd = process.cwd(),
	files,
	extensions,
} = {}) => directoryPaths.flatMap(directoryPath => isDirectorySync(normalizePathForDirectoryGlob(directoryPath, cwd)) ? getDirectoryGlob({directoryPath, files, extensions}) : directoryPath);

const toPatternsArray = patterns => {
	patterns = [...new Set([patterns].flat())];
	assertPatternsInput(patterns);
	return patterns;
};

const checkCwdOption = cwd => {
	if (!cwd) {
		return;
	}

	let stat;
	try {
		stat = fs.statSync(cwd);
	} catch {
		return;
	}

	if (!stat.isDirectory()) {
		throw new Error('The `cwd` option must be a path to a directory');
	}
};

const normalizeOptions = (options = {}) => {
	options = {
		...options,
		ignore: options.ignore ?? [],
		expandDirectories: options.expandDirectories ?? true,
		cwd: toPath(options.cwd),
	};

	checkCwdOption(options.cwd);

	return options;
};

const normalizeArguments = function_ => async (patterns, options) => function_(toPatternsArray(patterns), normalizeOptions(options));
const normalizeArgumentsSync = function_ => (patterns, options) => function_(toPatternsArray(patterns), normalizeOptions(options));

const getIgnoreFilesPatterns = options => {
	const {ignoreFiles, gitignore} = options;

	const patterns = ignoreFiles ? toPatternsArray(ignoreFiles) : [];
	if (gitignore) {
		patterns.push(GITIGNORE_FILES_PATTERN);
	}

	return patterns;
};

const getFilter = async options => {
	const ignoreFilesPatterns = getIgnoreFilesPatterns(options);
	return createFilterFunction(
		ignoreFilesPatterns.length > 0 && await isIgnoredByIgnoreFiles(ignoreFilesPatterns, options),
	);
};

const getFilterSync = options => {
	const ignoreFilesPatterns = getIgnoreFilesPatterns(options);
	return createFilterFunction(
		ignoreFilesPatterns.length > 0 && isIgnoredByIgnoreFilesSync(ignoreFilesPatterns, options),
	);
};

const createFilterFunction = isIgnored => {
	const seen = new Set();

	return fastGlobResult => {
		const pathKey = nodePath.normalize(fastGlobResult.path ?? fastGlobResult);

		if (seen.has(pathKey) || (isIgnored && isIgnored(pathKey))) {
			return false;
		}

		seen.add(pathKey);

		return true;
	};
};

const unionFastGlobResults = (results, filter) => results.flat().filter(fastGlobResult => filter(fastGlobResult));

const convertNegativePatterns = (patterns, options) => {
	const tasks = [];

	while (patterns.length > 0) {
		const index = patterns.findIndex(pattern => isNegativePattern(pattern));

		if (index === -1) {
			tasks.push({patterns, options});
			break;
		}

		const ignorePattern = patterns[index].slice(1);

		for (const task of tasks) {
			task.options.ignore.push(ignorePattern);
		}

		if (index !== 0) {
			tasks.push({
				patterns: patterns.slice(0, index),
				options: {
					...options,
					ignore: [
						...options.ignore,
						ignorePattern,
					],
				},
			});
		}

		patterns = patterns.slice(index + 1);
	}

	return tasks;
};

const normalizeExpandDirectoriesOption = (options, cwd) => ({
	...(cwd ? {cwd} : {}),
	...(Array.isArray(options) ? {files: options} : options),
});

const generateTasks = async (patterns, options) => {
	const globTasks = convertNegativePatterns(patterns, options);

	const {cwd, expandDirectories} = options;

	if (!expandDirectories) {
		return globTasks;
	}

	const directoryToGlobOptions = normalizeExpandDirectoriesOption(expandDirectories, cwd);

	return Promise.all(
		globTasks.map(async task => {
			let {patterns, options} = task;

			[
				patterns,
				options.ignore,
			] = await Promise.all([
				directoryToGlob(patterns, directoryToGlobOptions),
				directoryToGlob(options.ignore, {cwd}),
			]);

			return {patterns, options};
		}),
	);
};

const generateTasksSync = (patterns, options) => {
	const globTasks = convertNegativePatterns(patterns, options);
	const {cwd, expandDirectories} = options;

	if (!expandDirectories) {
		return globTasks;
	}

	const directoryToGlobSyncOptions = normalizeExpandDirectoriesOption(expandDirectories, cwd);

	return globTasks.map(task => {
		let {patterns, options} = task;
		patterns = directoryToGlobSync(patterns, directoryToGlobSyncOptions);
		options.ignore = directoryToGlobSync(options.ignore, {cwd});
		return {patterns, options};
	});
};

export const globby = normalizeArguments(async (patterns, options) => {
	const [
		tasks,
		filter,
	] = await Promise.all([
		generateTasks(patterns, options),
		getFilter(options),
	]);

	const results = await Promise.all(tasks.map(task => fastGlob(task.patterns, task.options)));
	return unionFastGlobResults(results, filter);
});

export const globbySync = normalizeArgumentsSync((patterns, options) => {
	const tasks = generateTasksSync(patterns, options);
	const filter = getFilterSync(options);
	const results = tasks.map(task => fastGlob.sync(task.patterns, task.options));
	return unionFastGlobResults(results, filter);
});

export const globbyStream = normalizeArgumentsSync((patterns, options) => {
	const tasks = generateTasksSync(patterns, options);
	const filter = getFilterSync(options);
	const streams = tasks.map(task => fastGlob.stream(task.patterns, task.options));
	const stream = mergeStreams(streams).filter(fastGlobResult => filter(fastGlobResult));

	// TODO: Make it return a web stream at some point.
	// return Readable.toWeb(stream);

	return stream;
});

export const isDynamicPattern = normalizeArgumentsSync(
	(patterns, options) => patterns.some(pattern => fastGlob.isDynamicPattern(pattern, options)),
);

export const generateGlobTasks = normalizeArguments(generateTasks);
export const generateGlobTasksSync = normalizeArgumentsSync(generateTasksSync);

export {
	isGitIgnored,
	isGitIgnoredSync,
	isIgnoredByIgnoreFiles,
	isIgnoredByIgnoreFilesSync,
} from './ignore.js';

export const {convertPathToPattern} = fastGlob;
