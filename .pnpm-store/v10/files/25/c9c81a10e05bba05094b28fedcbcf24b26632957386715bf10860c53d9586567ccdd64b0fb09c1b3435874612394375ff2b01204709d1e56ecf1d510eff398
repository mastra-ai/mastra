import process from 'node:process';
import {stripVTControlCharacters} from 'node:util';

export const getContext = raw => ({
	start: process.hrtime.bigint(),
	command: raw.map(part => getCommandPart(stripVTControlCharacters(part))).join(' '),
	state: {
		stdout: '', stderr: '', output: '', isIterating: {}, nonIterable: [false, false],
	},
});

const getCommandPart = part => /[^\w./-]/.test(part)
	? `'${part.replaceAll('\'', '\'\\\'\'')}'`
	: part;
