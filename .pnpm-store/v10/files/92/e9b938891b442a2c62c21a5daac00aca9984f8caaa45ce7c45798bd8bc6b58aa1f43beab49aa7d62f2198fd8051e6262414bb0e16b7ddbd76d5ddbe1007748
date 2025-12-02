'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var yaml = require('js-yaml');

function _interopDefault (e) { return e && e.__esModule ? e : { 'default': e }; }

var yaml__default = /*#__PURE__*/_interopDefault(yaml);

const mdRegex = /\s*---([^]*?)\n\s*---(\s*(?:\n|$)[^]*)/;
function parseChangesetFile(contents) {
  const execResult = mdRegex.exec(contents);

  if (!execResult) {
    throw new Error(`could not parse changeset - invalid frontmatter: ${contents}`);
  }

  let [, roughReleases, roughSummary] = execResult;
  let summary = roughSummary.trim();
  let releases;

  try {
    const yamlStuff = yaml__default["default"].safeLoad(roughReleases);

    if (yamlStuff) {
      releases = Object.entries(yamlStuff).map(([name, type]) => ({
        name,
        type
      }));
    } else {
      releases = [];
    }
  } catch (e) {
    throw new Error(`could not parse changeset - invalid frontmatter: ${contents}`);
  }

  if (!releases) {
    throw new Error(`could not parse changeset - unknown error: ${contents}`);
  }

  return {
    releases,
    summary
  };
}

exports["default"] = parseChangesetFile;
