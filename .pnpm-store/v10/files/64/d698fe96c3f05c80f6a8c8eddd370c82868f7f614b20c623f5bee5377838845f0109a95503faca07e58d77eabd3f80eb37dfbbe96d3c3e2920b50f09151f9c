import fs from 'fs-extra';
import humanId from 'human-id';
import path from 'path';
import prettier from 'prettier';

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    });
    keys.push.apply(keys, symbols);
  }

  return keys;
}

function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};

    if (i % 2) {
      ownKeys(Object(source), true).forEach(function (key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys(Object(source)).forEach(function (key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }

  return target;
}

function getPrettierInstance(cwd) {
  try {
    return require(require.resolve("prettier", {
      paths: [cwd]
    }));
  } catch (err) {
    if (!err || err.code !== "MODULE_NOT_FOUND") {
      throw err;
    }

    return prettier;
  }
}

async function writeChangeset(changeset, cwd, options) {
  const {
    summary,
    releases
  } = changeset;
  const changesetBase = path.resolve(cwd, ".changeset"); // Worth understanding that the ID merely needs to be a unique hash to avoid git conflicts
  // experimenting with human readable ids to make finding changesets easier

  const changesetID = humanId({
    separator: "-",
    capitalize: false
  });
  const prettierInstance = (options === null || options === void 0 ? void 0 : options.prettier) !== false ? getPrettierInstance(cwd) : undefined;
  const newChangesetPath = path.resolve(changesetBase, `${changesetID}.md`); // NOTE: The quotation marks in here are really important even though they are
  // not spec for yaml. This is because package names can contain special
  // characters that will otherwise break the parsing step

  const changesetContents = `---
${releases.map(release => `"${release.name}": ${release.type}`).join("\n")}
---

${summary}
  `;
  await fs.outputFile(newChangesetPath, prettierInstance ? // Prettier v3 returns a promise
  await prettierInstance.format(changesetContents, _objectSpread2(_objectSpread2({}, await prettierInstance.resolveConfig(newChangesetPath)), {}, {
    parser: "markdown"
  })) : changesetContents);
  return changesetID;
}

export { writeChangeset as default };
