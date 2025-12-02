/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 */

/*
 * This file was generated from the OpenSearch API Spec. Do NOT edit it
 * manually. If you want to make changes, either update the spec or
 * modify the API generator.
 */

'use strict';

const { kConfigErr } = require('./utils')
const kApiModules = Symbol('api modules')

class OpenSearchAPI {
  constructor (opts) {
    this[kConfigErr] = opts.ConfigurationError
    this[kApiModules] = {
      asynchronousSearch: new(require('./asynchronousSearch/_api'))(this),
      cat: new(require('./cat/_api'))(this),
      cluster: new(require('./cluster/_api'))(this),
      danglingIndices: new(require('./danglingIndices/_api'))(this),
      flowFramework: new(require('./flowFramework/_api'))(this),
      http: new(require('./http/_api'))(this),
      indices: new(require('./indices/_api'))(this),
      ingest: new(require('./ingest/_api'))(this),
      insights: new(require('./insights/_api'))(this),
      ism: new(require('./ism/_api'))(this),
      knn: new(require('./knn/_api'))(this),
      list: new(require('./list/_api'))(this),
      ltr: new(require('./ltr/_api'))(this),
      ml: new(require('./ml/_api'))(this),
      nodes: new(require('./nodes/_api'))(this),
      notifications: new(require('./notifications/_api'))(this),
      observability: new(require('./observability/_api'))(this),
      ppl: new(require('./ppl/_api'))(this),
      query: new(require('./query/_api'))(this),
      remoteStore: new(require('./remoteStore/_api'))(this),
      replication: new(require('./replication/_api'))(this),
      rollups: new(require('./rollups/_api'))(this),
      searchPipeline: new(require('./searchPipeline/_api'))(this),
      security: new(require('./security/_api'))(this),
      sm: new(require('./sm/_api'))(this),
      snapshot: new(require('./snapshot/_api'))(this),
      sql: new(require('./sql/_api'))(this),
      tasks: new(require('./tasks/_api'))(this),
      transforms: new(require('./transforms/_api'))(this),
      wlm: new(require('./wlm/_api'))(this),
    }

    // Setup Root API Functions
    /** @namespace API-Core */
    this.bulk = require('./_core/bulk').bind(this)
    this.bulkStream = require('./_core/bulkStream').bind(this)
    this.clearScroll = require('./_core/clearScroll').bind(this)
    this.count = require('./_core/count').bind(this)
    this.create = require('./_core/create').bind(this)
    this.createPit = require('./_core/createPit').bind(this)
    this.delete = require('./_core/delete').bind(this)
    this.deleteAllPits = require('./_core/deleteAllPits').bind(this)
    this.deleteByQuery = require('./_core/deleteByQuery').bind(this)
    this.deleteByQueryRethrottle = require('./_core/deleteByQueryRethrottle').bind(this)
    this.deletePit = require('./_core/deletePit').bind(this)
    this.deleteScript = require('./_core/deleteScript').bind(this)
    this.exists = require('./_core/exists').bind(this)
    this.existsSource = require('./_core/existsSource').bind(this)
    this.explain = require('./_core/explain').bind(this)
    this.fieldCaps = require('./_core/fieldCaps').bind(this)
    this.get = require('./_core/get').bind(this)
    this.getAllPits = require('./_core/getAllPits').bind(this)
    this.getScript = require('./_core/getScript').bind(this)
    this.getScriptContext = require('./_core/getScriptContext').bind(this)
    this.getScriptLanguages = require('./_core/getScriptLanguages').bind(this)
    this.getSource = require('./_core/getSource').bind(this)
    this.index = require('./_core/index').bind(this)
    this.info = require('./_core/info').bind(this)
    this.mget = require('./_core/mget').bind(this)
    this.msearch = require('./_core/msearch').bind(this)
    this.msearchTemplate = require('./_core/msearchTemplate').bind(this)
    this.mtermvectors = require('./_core/mtermvectors').bind(this)
    this.ping = require('./_core/ping').bind(this)
    this.putScript = require('./_core/putScript').bind(this)
    this.rankEval = require('./_core/rankEval').bind(this)
    this.reindex = require('./_core/reindex').bind(this)
    this.reindexRethrottle = require('./_core/reindexRethrottle').bind(this)
    this.renderSearchTemplate = require('./_core/renderSearchTemplate').bind(this)
    this.scriptsPainlessExecute = require('./_core/scriptsPainlessExecute').bind(this)
    this.scroll = require('./_core/scroll').bind(this)
    this.search = require('./_core/search').bind(this)
    this.searchShards = require('./_core/searchShards').bind(this)
    this.searchTemplate = require('./_core/searchTemplate').bind(this)
    this.termvectors = require('./_core/termvectors').bind(this)
    this.update = require('./_core/update').bind(this)
    this.updateByQuery = require('./_core/updateByQuery').bind(this)
    this.updateByQueryRethrottle = require('./_core/updateByQueryRethrottle').bind(this)

    // Deprecated: Use bulkStream instead.
    this.bulk_stream = require('./_core/bulkStream').bind(this)
    // Deprecated: Use clearScroll instead.
    this.clear_scroll = require('./_core/clearScroll').bind(this)
    // Deprecated: Use createPit instead.
    this.create_pit = require('./_core/createPit').bind(this)
    // Deprecated: Use deleteAllPits instead.
    this.delete_all_pits = require('./_core/deleteAllPits').bind(this)
    // Deprecated: Use deleteByQuery instead.
    this.delete_by_query = require('./_core/deleteByQuery').bind(this)
    // Deprecated: Use deleteByQueryRethrottle instead.
    this.delete_by_query_rethrottle = require('./_core/deleteByQueryRethrottle').bind(this)
    // Deprecated: Use deletePit instead.
    this.delete_pit = require('./_core/deletePit').bind(this)
    // Deprecated: Use deleteScript instead.
    this.delete_script = require('./_core/deleteScript').bind(this)
    // Deprecated: Use existsSource instead.
    this.exists_source = require('./_core/existsSource').bind(this)
    // Deprecated: Use fieldCaps instead.
    this.field_caps = require('./_core/fieldCaps').bind(this)
    // Deprecated: Use getAllPits instead.
    this.get_all_pits = require('./_core/getAllPits').bind(this)
    // Deprecated: Use getScript instead.
    this.get_script = require('./_core/getScript').bind(this)
    // Deprecated: Use getScriptContext instead.
    this.get_script_context = require('./_core/getScriptContext').bind(this)
    // Deprecated: Use getScriptLanguages instead.
    this.get_script_languages = require('./_core/getScriptLanguages').bind(this)
    // Deprecated: Use getSource instead.
    this.get_source = require('./_core/getSource').bind(this)
    // Deprecated: Use msearchTemplate instead.
    this.msearch_template = require('./_core/msearchTemplate').bind(this)
    // Deprecated: Use putScript instead.
    this.put_script = require('./_core/putScript').bind(this)
    // Deprecated: Use rankEval instead.
    this.rank_eval = require('./_core/rankEval').bind(this)
    // Deprecated: Use reindexRethrottle instead.
    this.reindex_rethrottle = require('./_core/reindexRethrottle').bind(this)
    // Deprecated: Use renderSearchTemplate instead.
    this.render_search_template = require('./_core/renderSearchTemplate').bind(this)
    // Deprecated: Use scriptsPainlessExecute instead.
    this.scripts_painless_execute = require('./_core/scriptsPainlessExecute').bind(this)
    // Deprecated: Use searchShards instead.
    this.search_shards = require('./_core/searchShards').bind(this)
    // Deprecated: Use searchTemplate instead.
    this.search_template = require('./_core/searchTemplate').bind(this)
    // Deprecated: Use updateByQuery instead.
    this.update_by_query = require('./_core/updateByQuery').bind(this)
    // Deprecated: Use updateByQueryRethrottle instead.
    this.update_by_query_rethrottle = require('./_core/updateByQueryRethrottle').bind(this)

    // Setup API Modules
    Object.defineProperties(this, {
      asynchronousSearch: { get() { return this[kApiModules].asynchronousSearch } },
      cat: { get() { return this[kApiModules].cat } },
      cluster: { get() { return this[kApiModules].cluster } },
      danglingIndices: { get() { return this[kApiModules].danglingIndices } },
      flowFramework: { get() { return this[kApiModules].flowFramework } },
      http: { get() { return this[kApiModules].http } },
      indices: { get() { return this[kApiModules].indices } },
      ingest: { get() { return this[kApiModules].ingest } },
      insights: { get() { return this[kApiModules].insights } },
      ism: { get() { return this[kApiModules].ism } },
      knn: { get() { return this[kApiModules].knn } },
      list: { get() { return this[kApiModules].list } },
      ltr: { get() { return this[kApiModules].ltr } },
      ml: { get() { return this[kApiModules].ml } },
      nodes: { get() { return this[kApiModules].nodes } },
      notifications: { get() { return this[kApiModules].notifications } },
      observability: { get() { return this[kApiModules].observability } },
      ppl: { get() { return this[kApiModules].ppl } },
      query: { get() { return this[kApiModules].query } },
      remoteStore: { get() { return this[kApiModules].remoteStore } },
      replication: { get() { return this[kApiModules].replication } },
      rollups: { get() { return this[kApiModules].rollups } },
      searchPipeline: { get() { return this[kApiModules].searchPipeline } },
      security: { get() { return this[kApiModules].security } },
      sm: { get() { return this[kApiModules].sm } },
      snapshot: { get() { return this[kApiModules].snapshot } },
      sql: { get() { return this[kApiModules].sql } },
      tasks: { get() { return this[kApiModules].tasks } },
      transforms: { get() { return this[kApiModules].transforms } },
      wlm: { get() { return this[kApiModules].wlm } },

      // Deprecated: Use asynchronousSearch instead.
      asynchronous_search: { get() { return this[kApiModules].asynchronousSearch } },
      // Deprecated: Use danglingIndices instead.
      dangling_indices: { get() { return this[kApiModules].danglingIndices } },
      // Deprecated: Use flowFramework instead.
      flow_framework: { get() { return this[kApiModules].flowFramework } },
      // Deprecated: Use remoteStore instead.
      remote_store: { get() { return this[kApiModules].remoteStore } },
      // Deprecated: Use searchPipeline instead.
      search_pipeline: { get() { return this[kApiModules].searchPipeline } },
    })
  }
}

module.exports = OpenSearchAPI;
