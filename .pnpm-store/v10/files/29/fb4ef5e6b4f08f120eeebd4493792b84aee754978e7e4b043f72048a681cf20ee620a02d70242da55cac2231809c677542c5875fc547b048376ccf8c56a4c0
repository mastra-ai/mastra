`highlight.js` syntax definition for Vue.

Support for single-file [Vue.js](https://vuejs.org/) components.
The files with `.vue` extension allow to write html, javascript/typescript and styles in the same file.

### Usage

Simply include the `highlight.js` script package in your webpage or node app, load up this module and apply it to `hljs`.

If you're not using a build system and just want to embed this in your webpage:

```html
<script src="https://cdn.jsdelivr.net/npm/highlightjs"></script>
<script src="https://cdn.jsdelivr.net/npm/highlightjs-vue"></script>
<script>
  hljs.registerLanguage("vue", window.hljsDefineVue);
  hljs.initHighlightingOnLoad();
</script>
```

If you're using webpack / rollup / browserify / node:

```javascript
var hljs = require("highlightjs");
var hljsDefineVue = require("highlightjs-vue");

hljsDefineVue(hljs);
hljs.initHighlightingOnLoad();
```

### License

[![License: CC0-1.0](https://img.shields.io/badge/License-CC0%201.0-lightgrey.svg)](http://creativecommons.org/publicdomain/zero/1.0/)
