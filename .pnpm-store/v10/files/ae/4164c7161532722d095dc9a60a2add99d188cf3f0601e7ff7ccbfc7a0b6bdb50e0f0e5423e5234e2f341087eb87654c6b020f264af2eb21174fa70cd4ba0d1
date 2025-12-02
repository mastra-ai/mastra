/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

const Collection = require("../Collection");
const NodeCollection = require("./Node");

const assert = require("assert");
const once = require("../utils/once");
const recast = require("recast");

const types = recast.types.namedTypes;

const globalMethods = {
  /**
   * Inserts an ImportDeclaration at the top of the AST
   *
   * @param {string} sourcePath
   * @param {Array} specifiers
   */
  insertImportDeclaration: function (sourcePath, specifiers) {
    assert.ok(
      sourcePath && typeof sourcePath === "string",
      "insertImportDeclaration(...) needs a source path"
    );

    assert.ok(
      specifiers && Array.isArray(specifiers),
      "insertImportDeclaration(...) needs an array of specifiers"
    );

    if (this.hasImportDeclaration(sourcePath)) {
      return this;
    }

    const importDeclaration = recast.types.builders.importDeclaration(
      specifiers,
      recast.types.builders.stringLiteral(sourcePath)
    );

    return this.forEach((path) => {
      if (path.value.type === "Program") {
        path.value.body.unshift(importDeclaration);
      }
    });
  },
  /**
   * Finds all ImportDeclarations optionally filtered by name
   *
   * @param {string} sourcePath
   * @return {Collection}
   */
  findImportDeclarations: function (sourcePath) {
    assert.ok(
      sourcePath && typeof sourcePath === "string",
      "findImportDeclarations(...) needs a source path"
    );

    return this.find(types.ImportDeclaration, {
      source: { value: sourcePath },
    });
  },

  /**
   * Determines if the collection has an ImportDeclaration with the given sourcePath
   *
   * @param {string} sourcePath
   * @returns {boolean}
   */
  hasImportDeclaration: function (sourcePath) {
    assert.ok(
      sourcePath && typeof sourcePath === "string",
      "findImportDeclarations(...) needs a source path"
    );

    return this.findImportDeclarations(sourcePath).length > 0;
  },

  /**
   * Renames all ImportDeclarations with the given name
   *
   * @param {string} sourcePath
   * @param {string} newSourcePath
   * @return {Collection}
   */
  renameImportDeclaration: function (sourcePath, newSourcePath) {
    assert.ok(
      sourcePath && typeof sourcePath === "string",
      "renameImportDeclaration(...) needs a name to look for"
    );

    assert.ok(
      newSourcePath && typeof newSourcePath === "string",
      "renameImportDeclaration(...) needs a new name to rename to"
    );

    return this.findImportDeclarations(sourcePath).forEach((path) => {
      path.value.source.value = newSourcePath;
    });
  },
};

function register() {
  NodeCollection.register();
  Collection.registerMethods(globalMethods, types.Node);
}

exports.register = once(register);
