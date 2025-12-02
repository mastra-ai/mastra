import * as fs from 'fs-extra';
import fs__default from 'fs-extra';
import path from 'path';
import parse from '@changesets/parse';
import * as git from '@changesets/git';
import pc from 'picocolors';
import pFilter from 'p-filter';
import { warn } from '@changesets/logger';

function _toPrimitive(t, r) {
  if ("object" != typeof t || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r || "default");
    if ("object" != typeof i) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}

function _toPropertyKey(t) {
  var i = _toPrimitive(t, "string");
  return "symbol" == typeof i ? i : i + "";
}

function _defineProperty(e, r, t) {
  return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[r] = t, e;
}

function ownKeys(e, r) {
  var t = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function (r) {
      return Object.getOwnPropertyDescriptor(e, r).enumerable;
    })), t.push.apply(t, o);
  }
  return t;
}
function _objectSpread2(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys(Object(t), !0).forEach(function (r) {
      _defineProperty(e, r, t[r]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) {
      Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
    });
  }
  return e;
}

// THIS SHOULD BE REMOVED WHEN SUPPORT FOR CHANGESETS FROM V1 IS DROPPED

let importantSeparator = pc.red("===============================IMPORTANT!===============================");
let importantEnd = pc.red("----------------------------------------------------------------------");
async function getOldChangesets(changesetBase, dirs) {
  // this needs to support just not dealing with dirs that aren't set up properly
  let changesets = await pFilter(dirs, async dir => (await fs.lstat(path.join(changesetBase, dir))).isDirectory());
  const changesetContents = changesets.map(async changesetDir => {
    const jsonPath = path.join(changesetBase, changesetDir, "changes.json");
    const [summary, json] = await Promise.all([fs.readFile(path.join(changesetBase, changesetDir, "changes.md"), "utf-8"), fs.readJson(jsonPath)]);
    return {
      releases: json.releases,
      summary,
      id: changesetDir
    };
  });
  return Promise.all(changesetContents);
}

// this function only exists while we wait for v1 changesets to be obsoleted
// and should be deleted before v3
async function getOldChangesetsAndWarn(changesetBase, dirs) {
  let oldChangesets = await getOldChangesets(changesetBase, dirs);
  if (oldChangesets.length === 0) {
    return [];
  }
  warn(importantSeparator);
  warn("There were old changesets from version 1 found");
  warn("These are being applied now but the dependents graph may have changed");
  warn("Make sure you validate all your dependencies");
  warn("In a future major version, we will no longer apply these old changesets, and will instead throw here");
  warn(importantEnd);
  return oldChangesets;
}

async function filterChangesetsSinceRef(changesets, changesetBase, sinceRef) {
  const newChangesets = await git.getChangedChangesetFilesSinceRef({
    cwd: changesetBase,
    ref: sinceRef
  });
  const newHashes = newChangesets.map(c => c.split("/").pop());
  return changesets.filter(dir => newHashes.includes(dir));
}
async function getChangesets(cwd, sinceRef) {
  let changesetBase = path.join(cwd, ".changeset");
  let contents;
  try {
    contents = await fs__default.readdir(changesetBase);
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error("There is no .changeset directory in this project");
    }
    throw err;
  }
  if (sinceRef !== undefined) {
    contents = await filterChangesetsSinceRef(contents, changesetBase, sinceRef);
  }
  let oldChangesetsPromise = getOldChangesetsAndWarn(changesetBase, contents);
  let changesets = contents.filter(file => !file.startsWith(".") && file.endsWith(".md") && !/^README\.md$/i.test(file));
  const changesetContents = changesets.map(async file => {
    const changeset = await fs__default.readFile(path.join(changesetBase, file), "utf-8");
    return _objectSpread2(_objectSpread2({}, parse(changeset)), {}, {
      id: file.replace(".md", "")
    });
  });
  return [...(await oldChangesetsPromise), ...(await Promise.all(changesetContents))];
}

export { getChangesets as default };
