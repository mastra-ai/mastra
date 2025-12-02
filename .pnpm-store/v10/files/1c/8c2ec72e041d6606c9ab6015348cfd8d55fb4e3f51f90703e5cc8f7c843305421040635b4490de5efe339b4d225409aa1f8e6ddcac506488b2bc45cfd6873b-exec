#!/usr/bin/env node

import { readFileSync } from "node:fs";
import * as consoleFormatter from "../lib/formatters/console.js";
import * as jsonpatchFormatter from "../lib/formatters/jsonpatch.js";
import { create } from "../lib/with-text-diffs.js";

const allowedFlags = [
	"--help",
	"--format",
	"--omit-removed-values",
	"--no-moves",
	"--no-text-diff",
	"--object-keys",
];

const args = process.argv.slice(2);
const flags = {};
const files = [];
for (const arg of args) {
	if (arg.startsWith("--")) {
		const argParts = arg.split("=");
		if (allowedFlags.indexOf(argParts[0]) === -1) {
			console.error(`unrecognized option: ${argParts[0]}`);
			process.exit(2);
		}
		flags[argParts[0]] = argParts[1] ?? true;
	} else {
		files.push(arg);
	}
}

const usage = () => {
	return `usage: jsondiffpatch left.json right.json
  note: http and https URLs are also supported

flags:
    --format=console       (default) print a readable colorized diff
    --format=json          output the pure JSON diff
    --format=json-compact  pure JSON diff, no indentation
    --format=jsonpatch     output JSONPatch (RFC 6902)

    --omit-removed-values  omits removed values from the diff
    --no-moves             disable array moves detection
    --no-text-diff         disable text diffs
    --object-keys=...      (defaults to: id,key) optional comma-separated properties to match 2 objects between array versions (see objectHash)

example:`;
};

function createInstance() {
	const format =
		typeof flags["--format"] === "string" ? flags["--format"] : "console";
	const objectKeys = (flags["--object-keys="] ?? "id,key")
		.split(",")
		.map((key) => key.trim());

	const jsondiffpatch = create({
		objectHash: (obj, index) => {
			if (obj && typeof obj === "object") {
				for (const key of objectKeys) {
					if (key in obj) {
						return obj[key];
					}
				}
			}
			return index;
		},
		arrays: {
			detectMove: !flags["--no-moves"],
		},
		omitRemovedValues: !!flags["--omit-removed-values"],
		textDiff: {
			...(format === "jsonpatch" || !!flags["--no-text-diff"]
				? {
						// text diff not supported by jsonpatch
						minLength: Number.MAX_VALUE,
					}
				: {}),
		},
	});
	return jsondiffpatch;
}

function printDiff(delta) {
	if (flags["--format"] === "json") {
		console.log(JSON.stringify(delta, null, 2));
	} else if (flags["--format"] === "json-compact") {
		console.log(JSON.stringify(delta));
	} else if (flags["--format"] === "jsonpatch") {
		jsonpatchFormatter.log(delta);
	} else {
		consoleFormatter.log(delta);
	}
}

function getJson(path) {
	if (/^https?:\/\//i.test(path)) {
		// an absolute URL, fetch it
		return fetch(path).then((response) => response.json());
	}
	return JSON.parse(readFileSync(path));
}

const jsondiffpatch = createInstance();

if (files.length !== 2 || flags["--help"]) {
	console.log(usage());
	const delta = jsondiffpatch.diff(
		{
			property: "before",
			list: [{ id: 1 }, { id: 2 }, { id: 3, name: "item removed" }],
			longText:
				"when a text is very 🦕 long, diff-match-patch is used to create a text diff that only captures the changes, comparing each characther",
		},
		{
			property: "after",
			newProperty: "added",
			list: [{ id: 2 }, { id: 1 }, { id: 4, name: "item added" }],
			longText:
				"when a text a bit long, diff-match-patch creates a text diff that captures the changes, comparing each characther",
		},
	);
	printDiff(delta);
} else {
	Promise.all([files[0], files[1]].map(getJson)).then(([left, right]) => {
		const delta = jsondiffpatch.diff(left, right);
		if (delta === undefined) {
			process.exit(0);
		} else {
			printDiff(delta);
			// exit code 1 to be consistent with GNU diff
			process.exit(1);
		}
	});
}
