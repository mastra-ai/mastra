"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/vendor/hash-wasm/sha256.js
var import_meta, Module, sha256_default;
var init_sha256 = __esm({
  "src/vendor/hash-wasm/sha256.js"() {
    "use strict";
    import_meta = {};
    Module = (() => {
      var _unused = import_meta.url;
      return function(moduleArg = {}) {
        var Module2 = moduleArg;
        var readyPromiseResolve, readyPromiseReject;
        Module2["ready"] = new Promise((resolve2, reject) => {
          readyPromiseResolve = resolve2;
          readyPromiseReject = reject;
        });
        var moduleOverrides = Object.assign({}, Module2);
        var arguments_ = [];
        var thisProgram = "./this.program";
        var quit_ = (status, toThrow) => {
          throw toThrow;
        };
        var ENVIRONMENT_IS_WEB = typeof window == "object";
        var ENVIRONMENT_IS_WORKER = typeof importScripts == "function";
        var ENVIRONMENT_IS_NODE = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string";
        var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
        var scriptDirectory = "";
        function locateFile(path) {
          if (Module2["locateFile"]) {
            return Module2["locateFile"](path, scriptDirectory);
          }
          return scriptDirectory + path;
        }
        var read_, readAsync, readBinary;
        if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
          if (ENVIRONMENT_IS_WORKER) {
            scriptDirectory = self.location.href;
          } else if (typeof document != "undefined" && document.currentScript) {
            scriptDirectory = document.currentScript.src;
          }
          if (false) {
            scriptDirectory = false;
          }
          if (scriptDirectory.startsWith("blob:")) {
            scriptDirectory = "";
          } else {
            scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1);
          }
          {
            read_ = (url) => {
              var xhr = new XMLHttpRequest();
              xhr.open("GET", url, false);
              xhr.send(null);
              return xhr.responseText;
            };
            if (ENVIRONMENT_IS_WORKER) {
              readBinary = (url) => {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, false);
                xhr.responseType = "arraybuffer";
                xhr.send(null);
                return new Uint8Array(
                  /** @type{!ArrayBuffer} */
                  xhr.response
                );
              };
            }
            readAsync = (url, onload, onerror) => {
              var xhr = new XMLHttpRequest();
              xhr.open("GET", url, true);
              xhr.responseType = "arraybuffer";
              xhr.onload = () => {
                if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                  onload(xhr.response);
                  return;
                }
                onerror();
              };
              xhr.onerror = onerror;
              xhr.send(null);
            };
          }
        } else {
        }
        var out = Module2["print"] || console.log.bind(console);
        var err = Module2["printErr"] || console.error.bind(console);
        Object.assign(Module2, moduleOverrides);
        moduleOverrides = null;
        if (Module2["arguments"])
          arguments_ = Module2["arguments"];
        if (Module2["thisProgram"])
          thisProgram = Module2["thisProgram"];
        if (Module2["quit"])
          quit_ = Module2["quit"];
        var wasmBinary;
        if (Module2["wasmBinary"])
          wasmBinary = Module2["wasmBinary"];
        if (typeof WebAssembly != "object") {
          abort("no native wasm support detected");
        }
        function intArrayFromBase64(s) {
          var decoded = atob(s);
          var bytes = new Uint8Array(decoded.length);
          for (var i = 0; i < decoded.length; ++i) {
            bytes[i] = decoded.charCodeAt(i);
          }
          return bytes;
        }
        function tryParseAsDataURI(filename) {
          if (!isDataURI(filename)) {
            return;
          }
          return intArrayFromBase64(filename.slice(dataURIPrefix.length));
        }
        var wasmMemory;
        var ABORT = false;
        var EXITSTATUS;
        function assert(condition, text) {
          if (!condition) {
            abort(text);
          }
        }
        var HEAP, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
        function updateMemoryViews() {
          var b = wasmMemory.buffer;
          Module2["HEAP8"] = HEAP8 = new Int8Array(b);
          Module2["HEAP16"] = HEAP16 = new Int16Array(b);
          Module2["HEAPU8"] = HEAPU8 = new Uint8Array(b);
          Module2["HEAPU16"] = HEAPU16 = new Uint16Array(b);
          Module2["HEAP32"] = HEAP32 = new Int32Array(b);
          Module2["HEAPU32"] = HEAPU32 = new Uint32Array(b);
          Module2["HEAPF32"] = HEAPF32 = new Float32Array(b);
          Module2["HEAPF64"] = HEAPF64 = new Float64Array(b);
        }
        var __ATPRERUN__ = [];
        var __ATINIT__ = [];
        var __ATEXIT__ = [];
        var __ATPOSTRUN__ = [];
        var runtimeInitialized = false;
        function preRun() {
          if (Module2["preRun"]) {
            if (typeof Module2["preRun"] == "function")
              Module2["preRun"] = [Module2["preRun"]];
            while (Module2["preRun"].length) {
              addOnPreRun(Module2["preRun"].shift());
            }
          }
          callRuntimeCallbacks(__ATPRERUN__);
        }
        function initRuntime() {
          runtimeInitialized = true;
          callRuntimeCallbacks(__ATINIT__);
        }
        function postRun() {
          if (Module2["postRun"]) {
            if (typeof Module2["postRun"] == "function")
              Module2["postRun"] = [Module2["postRun"]];
            while (Module2["postRun"].length) {
              addOnPostRun(Module2["postRun"].shift());
            }
          }
          callRuntimeCallbacks(__ATPOSTRUN__);
        }
        function addOnPreRun(cb) {
          __ATPRERUN__.unshift(cb);
        }
        function addOnInit(cb) {
          __ATINIT__.unshift(cb);
        }
        function addOnExit(cb) {
        }
        function addOnPostRun(cb) {
          __ATPOSTRUN__.unshift(cb);
        }
        var runDependencies = 0;
        var runDependencyWatcher = null;
        var dependenciesFulfilled = null;
        function getUniqueRunDependency(id) {
          return id;
        }
        function addRunDependency(id) {
          runDependencies++;
          Module2["monitorRunDependencies"]?.(runDependencies);
        }
        function removeRunDependency(id) {
          runDependencies--;
          Module2["monitorRunDependencies"]?.(runDependencies);
          if (runDependencies == 0) {
            if (runDependencyWatcher !== null) {
              clearInterval(runDependencyWatcher);
              runDependencyWatcher = null;
            }
            if (dependenciesFulfilled) {
              var callback = dependenciesFulfilled;
              dependenciesFulfilled = null;
              callback();
            }
          }
        }
        function abort(what) {
          Module2["onAbort"]?.(what);
          what = "Aborted(" + what + ")";
          err(what);
          ABORT = true;
          EXITSTATUS = 1;
          what += ". Build with -sASSERTIONS for more info.";
          var e = new WebAssembly.RuntimeError(what);
          readyPromiseReject(e);
          throw e;
        }
        var dataURIPrefix = "data:application/octet-stream;base64,";
        var isDataURI = (filename) => filename.startsWith(dataURIPrefix);
        var isFileURI = (filename) => filename.startsWith("file://");
        var wasmBinaryFile;
        wasmBinaryFile = "data:application/octet-stream;base64,AGFzbQEAAAABHQZgAX8AYAABf2AAAGABfwF/YAJ/fwBgA39/fwF/Aw0MAgAEAgMBBQABAQADBAUBcAEBAQUGAQGAAoACBg4CfwFB8IuEBAt/AUEACweYAQoGbWVtb3J5AgARX193YXNtX2NhbGxfY3RvcnMAAAtIYXNoX1VwZGF0ZQABCkhhc2hfRmluYWwAAwlIYXNoX0luaXQABAxHZXRCdWZmZXJQdHIABRlfX2luZGlyZWN0X2Z1bmN0aW9uX3RhYmxlAQAJc3RhY2tTYXZlAAkMc3RhY2tSZXN0b3JlAAoKc3RhY2tBbGxvYwALCossDAIAC+4CAgV/AX5BACgCwAoiASABKQNAIgYgAK18NwNAAkACQAJAIAanQT9xIgINAEGACyEBIAAhAgwBC0HAACACayEDAkAgAEUNACADIAAgAyAASRshBCABIAJqIQVBACEBA0AgBSABIgFqQYALIAFqLQAAOgAAIAFBAWoiAiEBIAIgBEcNAAsLAkACQCAAIANJIgRFDQBBgAshASAAIQIMAQtBACgCwAoiAUHIAGogARACQYALIANqIQEgACADayECCyABIQEgAiECIAQNAQsgASEBAkACQCACIgJBwABPDQAgASEFIAIhAAwBCyACIQIgASEEA0BBACgCwApByABqIAQiBBACIAJBQGoiASECIARBwABqIgUhBCAFIQUgASEAIAFBP0sNAAsLIAUhBSAAIgBFDQBBACEBQQAhAgNAQQAoAsAKIAEiAWogBSABai0AADoAACACQQFqIgJB/wFxIgQhASACIQIgACAESw0ACwsLqCEBK38gACgCCCICIAAoAgQiAyAAKAIAIgRzcSADIARxcyAEQR53IARBE3dzIARBCndzaiAAKAIQIgVBGncgBUEVd3MgBUEHd3MgACgCHCIGaiAAKAIYIgcgACgCFCIIcyAFcSAHc2ogASgCACIJQRh0IAlBgP4DcUEIdHIgCUEIdkGA/gNxIAlBGHZyciIKakGY36iUBGoiC2oiCSAEcyADcSAJIARxcyAJQR53IAlBE3dzIAlBCndzaiAHIAEoAgQiDEEYdCAMQYD+A3FBCHRyIAxBCHZBgP4DcSAMQRh2cnIiDWogCyAAKAIMIg5qIg8gCCAFc3EgCHNqIA9BGncgD0EVd3MgD0EHd3NqQZGJ3YkHaiIQaiIMIAlzIARxIAwgCXFzIAxBHncgDEETd3MgDEEKd3NqIAggASgCCCILQRh0IAtBgP4DcUEIdHIgC0EIdkGA/gNxIAtBGHZyciIRaiAQIAJqIhIgDyAFc3EgBXNqIBJBGncgEkEVd3MgEkEHd3NqQc/3g657aiITaiILIAxzIAlxIAsgDHFzIAtBHncgC0ETd3MgC0EKd3NqIAUgASgCDCIQQRh0IBBBgP4DcUEIdHIgEEEIdkGA/gNxIBBBGHZyciIUaiATIANqIhMgEiAPc3EgD3NqIBNBGncgE0EVd3MgE0EHd3NqQaW3181+aiIVaiIQIAtzIAxxIBAgC3FzIBBBHncgEEETd3MgEEEKd3NqIA8gASgCECIWQRh0IBZBgP4DcUEIdHIgFkEIdkGA/gNxIBZBGHZyciIXaiAVIARqIhYgEyASc3EgEnNqIBZBGncgFkEVd3MgFkEHd3NqQduE28oDaiIYaiIPIBBzIAtxIA8gEHFzIA9BHncgD0ETd3MgD0EKd3NqIAEoAhQiFUEYdCAVQYD+A3FBCHRyIBVBCHZBgP4DcSAVQRh2cnIiGSASaiAYIAlqIhIgFiATc3EgE3NqIBJBGncgEkEVd3MgEkEHd3NqQfGjxM8FaiIYaiIJIA9zIBBxIAkgD3FzIAlBHncgCUETd3MgCUEKd3NqIAEoAhgiFUEYdCAVQYD+A3FBCHRyIBVBCHZBgP4DcSAVQRh2cnIiGiATaiAYIAxqIhMgEiAWc3EgFnNqIBNBGncgE0EVd3MgE0EHd3NqQaSF/pF5aiIYaiIMIAlzIA9xIAwgCXFzIAxBHncgDEETd3MgDEEKd3NqIAEoAhwiFUEYdCAVQYD+A3FBCHRyIBVBCHZBgP4DcSAVQRh2cnIiGyAWaiAYIAtqIhYgEyASc3EgEnNqIBZBGncgFkEVd3MgFkEHd3NqQdW98dh6aiIYaiILIAxzIAlxIAsgDHFzIAtBHncgC0ETd3MgC0EKd3NqIAEoAiAiFUEYdCAVQYD+A3FBCHRyIBVBCHZBgP4DcSAVQRh2cnIiHCASaiAYIBBqIhIgFiATc3EgE3NqIBJBGncgEkEVd3MgEkEHd3NqQZjVnsB9aiIYaiIQIAtzIAxxIBAgC3FzIBBBHncgEEETd3MgEEEKd3NqIAEoAiQiFUEYdCAVQYD+A3FBCHRyIBVBCHZBgP4DcSAVQRh2cnIiHSATaiAYIA9qIhMgEiAWc3EgFnNqIBNBGncgE0EVd3MgE0EHd3NqQYG2jZQBaiIYaiIPIBBzIAtxIA8gEHFzIA9BHncgD0ETd3MgD0EKd3NqIAEoAigiFUEYdCAVQYD+A3FBCHRyIBVBCHZBgP4DcSAVQRh2cnIiHiAWaiAYIAlqIhYgEyASc3EgEnNqIBZBGncgFkEVd3MgFkEHd3NqQb6LxqECaiIYaiIJIA9zIBBxIAkgD3FzIAlBHncgCUETd3MgCUEKd3NqIAEoAiwiFUEYdCAVQYD+A3FBCHRyIBVBCHZBgP4DcSAVQRh2cnIiHyASaiAYIAxqIhIgFiATc3EgE3NqIBJBGncgEkEVd3MgEkEHd3NqQcP7sagFaiIYaiIMIAlzIA9xIAwgCXFzIAxBHncgDEETd3MgDEEKd3NqIAEoAjAiFUEYdCAVQYD+A3FBCHRyIBVBCHZBgP4DcSAVQRh2cnIiICATaiAYIAtqIhMgEiAWc3EgFnNqIBNBGncgE0EVd3MgE0EHd3NqQfS6+ZUHaiIYaiILIAxzIAlxIAsgDHFzIAtBHncgC0ETd3MgC0EKd3NqIAEoAjQiFUEYdCAVQYD+A3FBCHRyIBVBCHZBgP4DcSAVQRh2cnIiISAWaiAYIBBqIhAgEyASc3EgEnNqIBBBGncgEEEVd3MgEEEHd3NqQf7j+oZ4aiIYaiIWIAtzIAxxIBYgC3FzIBZBHncgFkETd3MgFkEKd3NqIAEoAjgiFUEYdCAVQYD+A3FBCHRyIBVBCHZBgP4DcSAVQRh2cnIiIiASaiAYIA9qIg8gECATc3EgE3NqIA9BGncgD0EVd3MgD0EHd3NqQaeN8N55aiIVaiISIBZzIAtxIBIgFnFzIBJBHncgEkETd3MgEkEKd3NqIAEoAjwiAUEYdCABQYD+A3FBCHRyIAFBCHZBgP4DcSABQRh2cnIiIyATaiAVIAlqIgEgDyAQc3EgEHNqIAFBGncgAUEVd3MgAUEHd3NqQfTi74x8aiIJaiEVIBIhGCAWISQgCyElIAkgDGohJiABIScgDyEoIBAhKSAjISMgIiEiICEhISAgISAgHyEfIB4hHiAdIR0gHCEcIBshGyAaIRogGSEZIBchFyAUIRQgESERIA0hECAKIQxBgAkhAUEQISoDQCAVIgkgGCIKcyAkIitxIAkgCnFzIAlBHncgCUETd3MgCUEKd3NqIBAiEEEZdyAQQQ53cyAQQQN2cyAMaiAdIh1qICIiFkEPdyAWQQ13cyAWQQp2c2oiDCApaiAmIhIgJyIPICgiE3NxIBNzaiASQRp3IBJBFXdzIBJBB3dzaiABIgEoAgBqIiRqIgsgCXMgCnEgCyAJcXMgC0EedyALQRN3cyALQQp3c2ogESIYQRl3IBhBDndzIBhBA3ZzIBBqIB4iHmogIyIVQQ93IBVBDXdzIBVBCnZzaiINIBNqIAEoAgRqICQgJWoiEyASIA9zcSAPc2ogE0EadyATQRV3cyATQQd3c2oiJWoiECALcyAJcSAQIAtxcyAQQR53IBBBE3dzIBBBCndzaiAUIiRBGXcgJEEOd3MgJEEDdnMgGGogHyIfaiAMQQ93IAxBDXdzIAxBCnZzaiIRIA9qIAEoAghqICUgK2oiGCATIBJzcSASc2ogGEEadyAYQRV3cyAYQQd3c2oiJWoiDyAQcyALcSAPIBBxcyAPQR53IA9BE3dzIA9BCndzaiAXIhdBGXcgF0EOd3MgF0EDdnMgJGogICIgaiANQQ93IA1BDXdzIA1BCnZzaiIUIBJqIAEoAgxqICUgCmoiCiAYIBNzcSATc2ogCkEadyAKQRV3cyAKQQd3c2oiJWoiEiAPcyAQcSASIA9xcyASQR53IBJBE3dzIBJBCndzaiATIBkiJEEZdyAkQQ53cyAkQQN2cyAXaiAhIiFqIBFBD3cgEUENd3MgEUEKdnNqIhdqIAEoAhBqICUgCWoiEyAKIBhzcSAYc2ogE0EadyATQRV3cyATQQd3c2oiJWoiCSAScyAPcSAJIBJxcyAJQR53IAlBE3dzIAlBCndzaiABKAIUIBoiGkEZdyAaQQ53cyAaQQN2cyAkaiAWaiAUQQ93IBRBDXdzIBRBCnZzaiIZaiAYaiAlIAtqIhggEyAKc3EgCnNqIBhBGncgGEEVd3MgGEEHd3NqIiVqIgsgCXMgEnEgCyAJcXMgC0EedyALQRN3cyALQQp3c2ogASgCGCAbIiRBGXcgJEEOd3MgJEEDdnMgGmogFWogF0EPdyAXQQ13cyAXQQp2c2oiGmogCmogJSAQaiIKIBggE3NxIBNzaiAKQRp3IApBFXdzIApBB3dzaiIlaiIQIAtzIAlxIBAgC3FzIBBBHncgEEETd3MgEEEKd3NqIAEoAhwgHCIcQRl3IBxBDndzIBxBA3ZzICRqIAxqIBlBD3cgGUENd3MgGUEKdnNqIhtqIBNqICUgD2oiJCAKIBhzcSAYc2ogJEEadyAkQRV3cyAkQQd3c2oiE2oiDyAQcyALcSAPIBBxcyAPQR53IA9BE3dzIA9BCndzaiABKAIgIB1BGXcgHUEOd3MgHUEDdnMgHGogDWogGkEPdyAaQQ13cyAaQQp2c2oiHGogGGogEyASaiIYICQgCnNxIApzaiAYQRp3IBhBFXdzIBhBB3dzaiITaiISIA9zIBBxIBIgD3FzIBJBHncgEkETd3MgEkEKd3NqIAEoAiQgHkEZdyAeQQ53cyAeQQN2cyAdaiARaiAbQQ93IBtBDXdzIBtBCnZzaiIdaiAKaiATIAlqIgkgGCAkc3EgJHNqIAlBGncgCUEVd3MgCUEHd3NqIgpqIhMgEnMgD3EgEyAScXMgE0EedyATQRN3cyATQQp3c2ogASgCKCAfQRl3IB9BDndzIB9BA3ZzIB5qIBRqIBxBD3cgHEENd3MgHEEKdnNqIh5qICRqIAogC2oiCiAJIBhzcSAYc2ogCkEadyAKQRV3cyAKQQd3c2oiJGoiCyATcyAScSALIBNxcyALQR53IAtBE3dzIAtBCndzaiABKAIsICBBGXcgIEEOd3MgIEEDdnMgH2ogF2ogHUEPdyAdQQ13cyAdQQp2c2oiH2ogGGogJCAQaiIYIAogCXNxIAlzaiAYQRp3IBhBFXdzIBhBB3dzaiIkaiIQIAtzIBNxIBAgC3FzIBBBHncgEEETd3MgEEEKd3NqIAEoAjAgIUEZdyAhQQ53cyAhQQN2cyAgaiAZaiAeQQ93IB5BDXdzIB5BCnZzaiIgaiAJaiAkIA9qIiQgGCAKc3EgCnNqICRBGncgJEEVd3MgJEEHd3NqIg9qIgkgEHMgC3EgCSAQcXMgCUEedyAJQRN3cyAJQQp3c2ogASgCNCAWQRl3IBZBDndzIBZBA3ZzICFqIBpqIB9BD3cgH0ENd3MgH0EKdnNqIiFqIApqIA8gEmoiDyAkIBhzcSAYc2ogD0EadyAPQRV3cyAPQQd3c2oiCmoiEiAJcyAQcSASIAlxcyASQR53IBJBE3dzIBJBCndzaiABKAI4IBVBGXcgFUEOd3MgFUEDdnMgFmogG2ogIEEPdyAgQQ13cyAgQQp2c2oiImogGGogCiATaiITIA8gJHNxICRzaiATQRp3IBNBFXdzIBNBB3dzaiIYaiIWIBJzIAlxIBYgEnFzIBZBHncgFkETd3MgFkEKd3NqIAEoAjwgDEEZdyAMQQ53cyAMQQN2cyAVaiAcaiAhQQ93ICFBDXdzICFBCnZzaiIKaiAkaiAYIAtqIgsgEyAPc3EgD3NqIAtBGncgC0EVd3MgC0EHd3NqIiZqIishFSAWIRggEiEkIAkhJSAmIBBqIiwhJiALIScgEyEoIA8hKSAKISMgIiEiICEhISAgISAgHyEfIB4hHiAdIR0gHCEcIBshGyAaIRogGSEZIBchFyAUIRQgESERIA0hECAMIQwgAUHAAGohASAqIgpBEGohKiAKQTBJDQALIAAgDyAGajYCHCAAIBMgB2o2AhggACALIAhqNgIUIAAgLCAFajYCECAAIAkgDmo2AgwgACASIAJqNgIIIAAgFiADajYCBCAAICsgBGo2AgAL1AMDBX8BfgF7QQAoAsAKIgAgACgCQCIBQQJ2QQ9xIgJBAnRqIgMgAygCAEF/IAFBA3QiAXRBf3NxQYABIAF0czYCAAJAAkAgAkEOTw0AIAJBAWohAAwBCwJAIAJBDkcNACAAQQA2AjwLIABByABqIAAQAkEAIQALAkAgACIAQQ1LDQBBACgCwAogAEECdCIAakEAQTggAGsQBhoLQQAoAsAKIgAgACkDQCIFpyICQRt0IAJBC3RBgID8B3FyIAJBBXZBgP4DcSACQQN0QRh2cnI2AjwgACAFQh2IpyICQRh0IAJBgP4DcUEIdHIgAkEIdkGA/gNxIAJBGHZycjYCOCAAQcgAaiAAEAJBACgCwApBPGohAUEAIQADQCABQQcgACIAa0ECdGoiAiAC/QACACAG/Q0MDQ4PCAkKCwQFBgcAAQIDIAb9DQMCAQAHBgUECwoJCA8ODQwgBv0NDA0ODwgJCgsEBQYHAAECA/0LAgAgAEEEaiICIQAgAkEIRw0ACwJAQQAoAsAKIgMoAmhFDQAgA0HIAGohBEEAIQBBACECA0BBgAsgACIAaiAEIABqLQAAOgAAIAJBAWoiAkH/AXEiASEAIAIhAiADKAJoIAFLDQALCwtxAQJ/QQAoAsAKIgFCADcDQCABQcgAaiECAkAgAEHgAUcNACABQRw2AmggAkEQakEA/QAEsAj9CwIAIAJBAP0ABKAI/QsCAEEADwsgAUEgNgJoIAJBEGpBAP0ABJAI/QsCACACQQD9AASACP0LAgBBAAsFAEGACwvyAgIDfwF+AkAgAkUNACAAIAE6AAAgACACaiIDQX9qIAE6AAAgAkEDSQ0AIAAgAToAAiAAIAE6AAEgA0F9aiABOgAAIANBfmogAToAACACQQdJDQAgACABOgADIANBfGogAToAACACQQlJDQAgAEEAIABrQQNxIgRqIgMgAUH/AXFBgYKECGwiATYCACADIAIgBGtBfHEiBGoiAkF8aiABNgIAIARBCUkNACADIAE2AgggAyABNgIEIAJBeGogATYCACACQXRqIAE2AgAgBEEZSQ0AIAMgATYCGCADIAE2AhQgAyABNgIQIAMgATYCDCACQXBqIAE2AgAgAkFsaiABNgIAIAJBaGogATYCACACQWRqIAE2AgAgBCADQQRxQRhyIgVrIgJBIEkNACABrUKBgICAEH4hBiADIAVqIQEDQCABIAY3AxggASAGNwMQIAEgBjcDCCABIAY3AwAgAUEgaiEBIAJBYGoiAkEfSw0ACwsgAAsGACAAJAELBAAjAQsEACMACwYAIAAkAAsSAQJ/IwAgAGtBcHEiASQAIAELC9ICAgBBgAgLwAJn5glqha5nu3Lzbjw69U+lf1IOUYxoBZur2YMfGc3gW9ieBcEH1Xw2F91wMDlZDvcxC8D/ERVYaKeP+WSkT/q+mC+KQpFEN3HP+8C1pdu16VvCVjnxEfFZpII/ktVeHKuYqgfYAVuDEr6FMSTDfQxVdF2+cv6x3oCnBtybdPGbwcFpm+SGR77vxp3BD8yhDCRvLOktqoR0StypsFzaiPl2UlE+mG3GMajIJwOwx39Zv/ML4MZHkafVUWPKBmcpKRSFCrcnOCEbLvxtLE0TDThTVHMKZbsKanYuycKBhSxykqHov6JLZhqocItLwqNRbMcZ6JLRJAaZ1oU1DvRwoGoQFsGkGQhsNx5Md0gntbywNLMMHDlKqthOT8qcW/NvLmjugo90b2OleBR4yIQIAseM+v++kOtsUKT3o/m+8nhxxgBBwAoLBIAFgAA=";
        if (!isDataURI(wasmBinaryFile)) {
          wasmBinaryFile = locateFile(wasmBinaryFile);
        }
        function getBinarySync(file) {
          if (file == wasmBinaryFile && wasmBinary) {
            return new Uint8Array(wasmBinary);
          }
          var binary = tryParseAsDataURI(file);
          if (binary) {
            return binary;
          }
          if (readBinary) {
            return readBinary(file);
          }
          throw "both async and sync fetching of the wasm failed";
        }
        function getBinaryPromise(binaryFile) {
          return Promise.resolve().then(() => getBinarySync(binaryFile));
        }
        function instantiateArrayBuffer(binaryFile, imports, receiver) {
          return getBinaryPromise(binaryFile).then((binary) => {
            return WebAssembly.instantiate(binary, imports);
          }).then(receiver, (reason) => {
            err(`failed to asynchronously prepare wasm: ${reason}`);
            abort(reason);
          });
        }
        function instantiateAsync(binary, binaryFile, imports, callback) {
          return instantiateArrayBuffer(binaryFile, imports, callback);
        }
        function createWasm() {
          var info = {
            "env": wasmImports,
            "wasi_snapshot_preview1": wasmImports
          };
          function receiveInstance(instance, module2) {
            wasmExports = instance.exports;
            wasmMemory = wasmExports["memory"];
            updateMemoryViews();
            addOnInit(wasmExports["__wasm_call_ctors"]);
            removeRunDependency("wasm-instantiate");
            return wasmExports;
          }
          addRunDependency("wasm-instantiate");
          function receiveInstantiationResult(result) {
            receiveInstance(result["instance"]);
          }
          if (Module2["instantiateWasm"]) {
            try {
              return Module2["instantiateWasm"](info, receiveInstance);
            } catch (e) {
              err(`Module.instantiateWasm callback failed with error: ${e}`);
              readyPromiseReject(e);
            }
          }
          instantiateAsync(wasmBinary, wasmBinaryFile, info, receiveInstantiationResult).catch(readyPromiseReject);
          return {};
        }
        var tempDouble;
        var tempI64;
        function ExitStatus(status) {
          this.name = "ExitStatus";
          this.message = `Program terminated with exit(${status})`;
          this.status = status;
        }
        var callRuntimeCallbacks = (callbacks) => {
          while (callbacks.length > 0) {
            callbacks.shift()(Module2);
          }
        };
        function getValue(ptr, type = "i8") {
          if (type.endsWith("*"))
            type = "*";
          switch (type) {
            case "i1":
              return HEAP8[ptr];
            case "i8":
              return HEAP8[ptr];
            case "i16":
              return HEAP16[ptr >> 1];
            case "i32":
              return HEAP32[ptr >> 2];
            case "i64":
              abort("to do getValue(i64) use WASM_BIGINT");
            case "float":
              return HEAPF32[ptr >> 2];
            case "double":
              return HEAPF64[ptr >> 3];
            case "*":
              return HEAPU32[ptr >> 2];
            default:
              abort(`invalid type for getValue: ${type}`);
          }
        }
        var noExitRuntime = Module2["noExitRuntime"] || true;
        function setValue(ptr, value, type = "i8") {
          if (type.endsWith("*"))
            type = "*";
          switch (type) {
            case "i1":
              HEAP8[ptr] = value;
              break;
            case "i8":
              HEAP8[ptr] = value;
              break;
            case "i16":
              HEAP16[ptr >> 1] = value;
              break;
            case "i32":
              HEAP32[ptr >> 2] = value;
              break;
            case "i64":
              abort("to do setValue(i64) use WASM_BIGINT");
            case "float":
              HEAPF32[ptr >> 2] = value;
              break;
            case "double":
              HEAPF64[ptr >> 3] = value;
              break;
            case "*":
              HEAPU32[ptr >> 2] = value;
              break;
            default:
              abort(`invalid type for setValue: ${type}`);
          }
        }
        var wasmImports = {};
        var wasmExports = createWasm();
        var ___wasm_call_ctors = () => (___wasm_call_ctors = wasmExports["__wasm_call_ctors"])();
        var _Hash_Update = Module2["_Hash_Update"] = (a0) => (_Hash_Update = Module2["_Hash_Update"] = wasmExports["Hash_Update"])(a0);
        var _Hash_Final = Module2["_Hash_Final"] = () => (_Hash_Final = Module2["_Hash_Final"] = wasmExports["Hash_Final"])();
        var _Hash_Init = Module2["_Hash_Init"] = (a0) => (_Hash_Init = Module2["_Hash_Init"] = wasmExports["Hash_Init"])(a0);
        var _GetBufferPtr = Module2["_GetBufferPtr"] = () => (_GetBufferPtr = Module2["_GetBufferPtr"] = wasmExports["GetBufferPtr"])();
        var stackSave = () => (stackSave = wasmExports["stackSave"])();
        var stackRestore = (a0) => (stackRestore = wasmExports["stackRestore"])(a0);
        var stackAlloc = (a0) => (stackAlloc = wasmExports["stackAlloc"])(a0);
        var calledRun;
        dependenciesFulfilled = function runCaller() {
          if (!calledRun)
            run();
          if (!calledRun)
            dependenciesFulfilled = runCaller;
        };
        function run() {
          if (runDependencies > 0) {
            return;
          }
          preRun();
          if (runDependencies > 0) {
            return;
          }
          function doRun() {
            if (calledRun)
              return;
            calledRun = true;
            Module2["calledRun"] = true;
            if (ABORT)
              return;
            initRuntime();
            readyPromiseResolve(Module2);
            if (Module2["onRuntimeInitialized"])
              Module2["onRuntimeInitialized"]();
            postRun();
          }
          if (Module2["setStatus"]) {
            Module2["setStatus"]("Running...");
            setTimeout(function() {
              setTimeout(function() {
                Module2["setStatus"]("");
              }, 1);
              doRun();
            }, 1);
          } else {
            doRun();
          }
        }
        if (Module2["preInit"]) {
          if (typeof Module2["preInit"] == "function")
            Module2["preInit"] = [Module2["preInit"]];
          while (Module2["preInit"].length > 0) {
            Module2["preInit"].pop()();
          }
        }
        run();
        return moduleArg.ready;
      };
    })();
    sha256_default = Module;
  }
});

// src/vendor/hash-wasm/sha256-wrapper.ts
var sha256_wrapper_exports = {};
__export(sha256_wrapper_exports, {
  createSHA256: () => createSHA256,
  createSHA256WorkerCode: () => createSHA256WorkerCode
});
async function createSHA256(isInsideWorker = false) {
  const BUFFER_MAX_SIZE = 8 * 1024 * 1024;
  const wasm = isInsideWorker ? (
    // @ts-expect-error WasmModule will be populated inside self object
    await self["SHA256WasmModule"]()
  ) : await sha256_default();
  const heap = wasm.HEAPU8.subarray(wasm._GetBufferPtr());
  return {
    init() {
      wasm._Hash_Init(256);
    },
    update(data) {
      let byteUsed = 0;
      while (byteUsed < data.byteLength) {
        const bytesLeft = data.byteLength - byteUsed;
        const length = Math.min(bytesLeft, BUFFER_MAX_SIZE);
        heap.set(data.subarray(byteUsed, byteUsed + length));
        wasm._Hash_Update(length);
        byteUsed += length;
      }
    },
    digest(method) {
      if (method !== "hex") {
        throw new Error("Only digest hex is supported");
      }
      wasm._Hash_Final();
      const result = Array.from(heap.slice(0, 32));
      return result.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  };
}
function createSHA256WorkerCode() {
  return `
		self.addEventListener('message', async (event) => {
      const { file } = event.data;
      const sha256 = await self.createSHA256(true);
      sha256.init();
      const reader = file.stream().getReader();
      const total = file.size;
      let bytesDone = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        sha256.update(value);
        bytesDone += value.length;
        postMessage({ progress: bytesDone / total });
      }
      postMessage({ sha256: sha256.digest('hex') });
    });
    self.SHA256WasmModule = ${sha256_default.toString()};
    self.createSHA256 = ${createSHA256.toString()};
  `;
}
var init_sha256_wrapper = __esm({
  "src/vendor/hash-wasm/sha256-wrapper.ts"() {
    "use strict";
    init_sha256();
  }
});

// src/utils/sha256-node.ts
var sha256_node_exports = {};
__export(sha256_node_exports, {
  sha256Node: () => sha256Node
});
async function* sha256Node(buffer, opts) {
  const sha256Stream = (0, import_node_crypto.createHash)("sha256");
  const size = buffer instanceof Blob ? buffer.size : buffer.byteLength;
  let done = 0;
  const readable = buffer instanceof Blob ? import_node_stream.Readable.fromWeb(buffer.stream()) : import_node_stream.Readable.from(Buffer.from(buffer));
  for await (const buffer2 of readable) {
    sha256Stream.update(buffer2);
    done += buffer2.length;
    yield done / size;
    opts?.abortSignal?.throwIfAborted();
  }
  return sha256Stream.digest("hex");
}
var import_node_stream, import_node_crypto;
var init_sha256_node = __esm({
  "src/utils/sha256-node.ts"() {
    "use strict";
    import_node_stream = require("stream");
    import_node_crypto = require("crypto");
  }
});

// src/utils/FileBlob.ts
var FileBlob_exports = {};
__export(FileBlob_exports, {
  FileBlob: () => FileBlob
});
var import_node_fs, import_promises, import_node_stream2, import_node_url, FileBlob;
var init_FileBlob = __esm({
  "src/utils/FileBlob.ts"() {
    "use strict";
    import_node_fs = require("fs");
    import_promises = require("fs/promises");
    import_node_stream2 = require("stream");
    import_node_url = require("url");
    FileBlob = class extends Blob {
      /**
       * Creates a new FileBlob on the provided file.
       *
       * @param path Path to the file to be lazy readed
       */
      static async create(path) {
        path = path instanceof URL ? (0, import_node_url.fileURLToPath)(path) : path;
        const { size } = await (0, import_promises.stat)(path);
        const fileBlob = new FileBlob(path, 0, size);
        return fileBlob;
      }
      path;
      start;
      end;
      constructor(path, start, end) {
        super();
        this.path = path;
        this.start = start;
        this.end = end;
      }
      /**
       * Returns the size of the blob.
       */
      get size() {
        return this.end - this.start;
      }
      /**
       * Returns a new instance of FileBlob that is a slice of the current one.
       *
       * The slice is inclusive of the start and exclusive of the end.
       *
       * The slice method does not supports negative start/end.
       *
       * @param start beginning of the slice
       * @param end end of the slice
       */
      slice(start = 0, end = this.size) {
        if (start < 0 || end < 0) {
          new TypeError("Unsupported negative start/end on FileBlob.slice");
        }
        const slice = new FileBlob(this.path, this.start + start, Math.min(this.start + end, this.end));
        return slice;
      }
      /**
       * Read the part of the file delimited by the FileBlob and returns it as an ArrayBuffer.
       */
      async arrayBuffer() {
        const slice = await this.execute((file) => file.read(Buffer.alloc(this.size), 0, this.size, this.start));
        return slice.buffer;
      }
      /**
       * Read the part of the file delimited by the FileBlob and returns it as a string.
       */
      async text() {
        const buffer = await this.arrayBuffer();
        return buffer.toString("utf8");
      }
      /**
       * Returns a stream around the part of the file delimited by the FileBlob.
       */
      stream() {
        return import_node_stream2.Readable.toWeb((0, import_node_fs.createReadStream)(this.path, { start: this.start, end: this.end - 1 }));
      }
      /**
       * We are opening and closing the file for each action to prevent file descriptor leaks.
       *
       * It is an intended choice of developer experience over performances.
       */
      async execute(action) {
        const file = await (0, import_promises.open)(this.path, "r");
        try {
          return await action(file);
        } finally {
          await file.close();
        }
      }
    };
  }
});

// index.ts
var hub_exports = {};
__export(hub_exports, {
  HubApiError: () => HubApiError,
  InvalidApiResponseFormatError: () => InvalidApiResponseFormatError,
  RE_SAFETENSORS_FILE: () => RE_SAFETENSORS_FILE,
  RE_SAFETENSORS_INDEX_FILE: () => RE_SAFETENSORS_INDEX_FILE,
  RE_SAFETENSORS_SHARD_FILE: () => RE_SAFETENSORS_SHARD_FILE,
  SAFETENSORS_FILE: () => SAFETENSORS_FILE,
  SAFETENSORS_INDEX_FILE: () => SAFETENSORS_INDEX_FILE,
  __internal_sha256: () => sha256,
  commit: () => commit,
  commitIter: () => commitIter,
  countCommits: () => countCommits,
  createRepo: () => createRepo,
  deleteFile: () => deleteFile,
  deleteFiles: () => deleteFiles,
  deleteRepo: () => deleteRepo,
  downloadFile: () => downloadFile,
  fileDownloadInfo: () => fileDownloadInfo,
  fileExists: () => fileExists,
  listCommits: () => listCommits,
  listDatasets: () => listDatasets,
  listFiles: () => listFiles,
  listModels: () => listModels,
  listSpaces: () => listSpaces,
  oauthHandleRedirect: () => oauthHandleRedirect,
  oauthHandleRedirectIfPresent: () => oauthHandleRedirectIfPresent,
  oauthLoginUrl: () => oauthLoginUrl,
  parseSafetensorsMetadata: () => parseSafetensorsMetadata,
  parseSafetensorsShardFilename: () => parseSafetensorsShardFilename,
  uploadFile: () => uploadFile,
  uploadFiles: () => uploadFiles,
  uploadFilesWithProgress: () => uploadFilesWithProgress,
  whoAmI: () => whoAmI
});
module.exports = __toCommonJS(hub_exports);

// src/consts.ts
var HUB_URL = "https://huggingface.co";

// src/error.ts
async function createApiError(response, opts) {
  const error = new HubApiError(response.url, response.status, response.headers.get("X-Request-Id") ?? opts?.requestId);
  error.message = `Api error with status ${error.statusCode}${opts?.message ? `. ${opts.message}` : ""}`;
  const trailer = [`URL: ${error.url}`, error.requestId ? `Request ID: ${error.requestId}` : void 0].filter(Boolean).join(". ");
  if (response.headers.get("Content-Type")?.startsWith("application/json")) {
    const json = await response.json();
    error.message = json.error || json.message || error.message;
    error.data = json;
  } else {
    error.data = { message: await response.text() };
  }
  error.message += `. ${trailer}`;
  throw error;
}
var HubApiError = class extends Error {
  statusCode;
  url;
  requestId;
  data;
  constructor(url, statusCode, requestId, message) {
    super(message);
    this.statusCode = statusCode;
    this.requestId = requestId;
    this.url = url;
  }
};
var InvalidApiResponseFormatError = class extends Error {
};

// src/utils/checkCredentials.ts
function checkCredentials(credentials) {
  if (!credentials || credentials.accessToken === void 0 || credentials.accessToken === null) {
    return;
  }
  if (!credentials.accessToken.startsWith("hf_")) {
    throw new TypeError("Your access token must start with 'hf_'");
  }
}

// src/utils/range.ts
function range(n, b) {
  return b ? Array(b - n).fill(0).map((_, i) => n + i) : Array(n).fill(0).map((_, i) => i);
}

// src/utils/chunk.ts
function chunk(arr, chunkSize) {
  if (isNaN(chunkSize) || chunkSize < 1) {
    throw new RangeError("Invalid chunk size: " + chunkSize);
  }
  if (!arr.length) {
    return [];
  }
  if (arr.length <= chunkSize) {
    return [arr];
  }
  return range(Math.ceil(arr.length / chunkSize)).map((i) => {
    return arr.slice(i * chunkSize, (i + 1) * chunkSize);
  });
}

// src/utils/promisesQueue.ts
async function promisesQueue(factories, concurrency) {
  const results = [];
  const executing = /* @__PURE__ */ new Set();
  let index = 0;
  for (const factory of factories) {
    const closureIndex = index++;
    const e = factory().then((r) => {
      results[closureIndex] = r;
      executing.delete(e);
    });
    executing.add(e);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
  return results;
}

// src/utils/promisesQueueStreaming.ts
async function promisesQueueStreaming(factories, concurrency) {
  const executing = [];
  for await (const factory of factories) {
    const e = factory().then(() => {
      executing.splice(executing.indexOf(e), 1);
    });
    executing.push(e);
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}

// src/utils/eventToGenerator.ts
async function* eventToGenerator(cb) {
  const promises = [];
  function addPromise() {
    let resolve2;
    let reject;
    const p = new Promise((res, rej) => {
      resolve2 = res;
      reject = rej;
    });
    promises.push({ p, resolve: resolve2, reject });
  }
  addPromise();
  const callbackRes = Promise.resolve().then(
    () => cb(
      (y) => {
        addPromise();
        promises.at(-2)?.resolve({ done: false, value: y });
      },
      (r) => {
        addPromise();
        promises.at(-2)?.resolve({ done: true, value: r });
      },
      (err) => promises.shift()?.reject(err)
    )
  ).catch((err) => promises.shift()?.reject(err));
  while (1) {
    const p = promises[0];
    if (!p) {
      throw new Error("Logic error in eventGenerator, promises should never be empty");
    }
    const result = await p.p;
    promises.shift();
    if (result.done) {
      await callbackRes;
      return result.value;
    }
    yield result.value;
  }
  throw new Error("Unreachable");
}

// src/utils/hexFromBytes.ts
function hexFromBytes(arr) {
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(arr).toString("hex");
  } else {
    const bin = [];
    arr.forEach((byte) => {
      bin.push(byte.toString(16).padStart(2, "0"));
    });
    return bin.join("");
  }
}

// src/utils/isBackend.ts
var isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";
var isWebWorker = typeof self === "object" && self.constructor && self.constructor.name === "DedicatedWorkerGlobalScope";
var isBackend = !isBrowser && !isWebWorker;

// src/utils/isFrontend.ts
var isFrontend = !isBackend;

// src/utils/sha256.ts
async function getWebWorkerCode() {
  const sha256Module = await Promise.resolve().then(() => (init_sha256_wrapper(), sha256_wrapper_exports));
  return URL.createObjectURL(new Blob([sha256Module.createSHA256WorkerCode()]));
}
var pendingWorkers = [];
var runningWorkers = /* @__PURE__ */ new Set();
var resolve;
var waitPromise = new Promise((r) => {
  resolve = r;
});
async function getWorker(poolSize) {
  {
    const worker2 = pendingWorkers.pop();
    if (worker2) {
      runningWorkers.add(worker2);
      return worker2;
    }
  }
  if (!poolSize) {
    const worker2 = new Worker(await getWebWorkerCode());
    runningWorkers.add(worker2);
    return worker2;
  }
  if (poolSize <= 0) {
    throw new TypeError("Invalid webworker pool size: " + poolSize);
  }
  while (runningWorkers.size >= poolSize) {
    await waitPromise;
  }
  const worker = new Worker(await getWebWorkerCode());
  runningWorkers.add(worker);
  return worker;
}
async function freeWorker(worker, poolSize) {
  if (!poolSize) {
    return destroyWorker(worker);
  }
  runningWorkers.delete(worker);
  pendingWorkers.push(worker);
  const r = resolve;
  waitPromise = new Promise((r2) => {
    resolve = r2;
  });
  r();
}
function destroyWorker(worker) {
  runningWorkers.delete(worker);
  worker.terminate();
  const r = resolve;
  waitPromise = new Promise((r2) => {
    resolve = r2;
  });
  r();
}
async function* sha256(buffer, opts) {
  yield 0;
  const maxCryptoSize = typeof opts?.useWebWorker === "object" && opts?.useWebWorker.minSize !== void 0 ? opts.useWebWorker.minSize : 1e7;
  if (buffer.size < maxCryptoSize && globalThis.crypto?.subtle) {
    const res = hexFromBytes(
      new Uint8Array(
        await globalThis.crypto.subtle.digest("SHA-256", buffer instanceof Blob ? await buffer.arrayBuffer() : buffer)
      )
    );
    yield 1;
    return res;
  }
  if (isFrontend) {
    if (opts?.useWebWorker) {
      try {
        const poolSize = typeof opts?.useWebWorker === "object" ? opts.useWebWorker.poolSize : void 0;
        const worker = await getWorker(poolSize);
        return yield* eventToGenerator((yieldCallback, returnCallback, rejectCallack) => {
          worker.addEventListener("message", (event) => {
            if (event.data.sha256) {
              freeWorker(worker, poolSize);
              returnCallback(event.data.sha256);
            } else if (event.data.progress) {
              yieldCallback(event.data.progress);
              try {
                opts.abortSignal?.throwIfAborted();
              } catch (err) {
                destroyWorker(worker);
                rejectCallack(err);
              }
            } else {
              destroyWorker(worker);
              rejectCallack(event);
            }
          });
          worker.addEventListener("error", (event) => {
            destroyWorker(worker);
            rejectCallack(event.error);
          });
          worker.postMessage({ file: buffer });
        });
      } catch (err) {
        console.warn("Failed to use web worker for sha256", err);
      }
    }
    if (!wasmModule) {
      wasmModule = await Promise.resolve().then(() => (init_sha256_wrapper(), sha256_wrapper_exports));
    }
    const sha2562 = await wasmModule.createSHA256();
    sha2562.init();
    const reader = buffer.stream().getReader();
    const total = buffer.size;
    let bytesDone = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      sha2562.update(value);
      bytesDone += value.length;
      yield bytesDone / total;
      opts?.abortSignal?.throwIfAborted();
    }
    return sha2562.digest("hex");
  }
  if (!cryptoModule) {
    cryptoModule = await Promise.resolve().then(() => (init_sha256_node(), sha256_node_exports));
  }
  return yield* cryptoModule.sha256Node(buffer, { abortSignal: opts?.abortSignal });
}
var cryptoModule;
var wasmModule;

// src/utils/toRepoId.ts
function toRepoId(repo) {
  if (typeof repo !== "string") {
    return repo;
  }
  if (repo.startsWith("model/") || repo.startsWith("models/")) {
    throw new TypeError(
      "A repo designation for a model should not start with 'models/', directly specify the model namespace / name"
    );
  }
  if (repo.startsWith("space/")) {
    throw new TypeError("Spaces should start with 'spaces/', plural, not 'space/'");
  }
  if (repo.startsWith("dataset/")) {
    throw new TypeError("Datasets should start with 'dataset/', plural, not 'dataset/'");
  }
  const slashes = repo.split("/").length - 1;
  if (repo.startsWith("spaces/")) {
    if (slashes !== 2) {
      throw new TypeError("Space Id must include namespace and name of the space");
    }
    return {
      type: "space",
      name: repo.slice("spaces/".length)
    };
  }
  if (repo.startsWith("datasets/")) {
    if (slashes > 2) {
      throw new TypeError("Too many slashes in repo designation: " + repo);
    }
    return {
      type: "dataset",
      name: repo.slice("datasets/".length)
    };
  }
  if (slashes > 1) {
    throw new TypeError("Too many slashes in repo designation: " + repo);
  }
  return {
    type: "model",
    name: repo
  };
}

// src/utils/WebBlob.ts
var WebBlob = class extends Blob {
  static async create(url, opts) {
    const customFetch = opts?.fetch ?? fetch;
    const response = await customFetch(url, { method: "HEAD" });
    const size = Number(response.headers.get("content-length"));
    const contentType = response.headers.get("content-type") || "";
    const supportRange = response.headers.get("accept-ranges") === "bytes";
    if (!supportRange || size < (opts?.cacheBelow ?? 1e6)) {
      return await (await customFetch(url)).blob();
    }
    return new WebBlob(url, 0, size, contentType, true, customFetch);
  }
  url;
  start;
  end;
  contentType;
  full;
  fetch;
  constructor(url, start, end, contentType, full, customFetch) {
    super([]);
    this.url = url;
    this.start = start;
    this.end = end;
    this.contentType = contentType;
    this.full = full;
    this.fetch = customFetch;
  }
  get size() {
    return this.end - this.start;
  }
  get type() {
    return this.contentType;
  }
  slice(start = 0, end = this.size) {
    if (start < 0 || end < 0) {
      new TypeError("Unsupported negative start/end on FileBlob.slice");
    }
    const slice = new WebBlob(
      this.url,
      this.start + start,
      Math.min(this.start + end, this.end),
      this.contentType,
      start === 0 && end === this.size ? this.full : false,
      this.fetch
    );
    return slice;
  }
  async arrayBuffer() {
    const result = await this.fetchRange();
    return result.arrayBuffer();
  }
  async text() {
    const result = await this.fetchRange();
    return result.text();
  }
  stream() {
    const stream = new TransformStream();
    this.fetchRange().then((response) => response.body?.pipeThrough(stream)).catch((error) => stream.writable.abort(error.message));
    return stream.readable;
  }
  fetchRange() {
    const fetch2 = this.fetch;
    if (this.full) {
      return fetch2(this.url);
    }
    return fetch2(this.url, {
      headers: {
        Range: `bytes=${this.start}-${this.end - 1}`
      }
    });
  }
};

// src/utils/createBlob.ts
async function createBlob(url, opts) {
  if (url.protocol === "http:" || url.protocol === "https:") {
    return WebBlob.create(url, { fetch: opts?.fetch });
  }
  if (isFrontend) {
    throw new TypeError(`Unsupported URL protocol "${url.protocol}"`);
  }
  if (url.protocol === "file:") {
    const { FileBlob: FileBlob2 } = await Promise.resolve().then(() => (init_FileBlob(), FileBlob_exports));
    return FileBlob2.create(url);
  }
  throw new TypeError(`Unsupported URL protocol "${url.protocol}"`);
}

// src/utils/base64FromBytes.ts
function base64FromBytes(arr) {
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(arr).toString("base64");
  } else {
    const bin = [];
    arr.forEach((byte) => {
      bin.push(String.fromCharCode(byte));
    });
    return globalThis.btoa(bin.join(""));
  }
}

// src/lib/commit.ts
var CONCURRENT_SHAS = 5;
var CONCURRENT_LFS_UPLOADS = 5;
var MULTIPART_PARALLEL_UPLOAD = 5;
function isFileOperation(op) {
  const ret = op.operation === "addOrUpdate";
  if (ret && !(op.content instanceof Blob)) {
    throw new TypeError("Precondition failed: op.content should be a Blob");
  }
  return ret;
}
async function* commitIter(params) {
  checkCredentials(params.credentials);
  const repoId = toRepoId(params.repo);
  yield { event: "phase", phase: "preuploading" };
  const lfsShas = /* @__PURE__ */ new Map();
  const abortController = new AbortController();
  const abortSignal = abortController.signal;
  if (!abortSignal.throwIfAborted) {
    abortSignal.throwIfAborted = () => {
      if (abortSignal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
    };
  }
  if (params.abortSignal) {
    params.abortSignal.addEventListener("abort", () => abortController.abort());
  }
  try {
    const allOperations = await Promise.all(
      params.operations.map(async (operation) => {
        if (operation.operation !== "addOrUpdate") {
          return operation;
        }
        if (!(operation.content instanceof URL)) {
          return { ...operation, content: operation.content };
        }
        const lazyBlob = await createBlob(operation.content, { fetch: params.fetch });
        abortSignal?.throwIfAborted();
        return {
          ...operation,
          content: lazyBlob
        };
      })
    );
    const gitAttributes = allOperations.filter(isFileOperation).find((op) => op.path === ".gitattributes")?.content;
    for (const operations of chunk(allOperations.filter(isFileOperation), 100)) {
      const payload = {
        gitAttributes: gitAttributes && await gitAttributes.text(),
        files: await Promise.all(
          operations.map(async (operation) => ({
            path: operation.path,
            size: operation.content.size,
            sample: base64FromBytes(new Uint8Array(await operation.content.slice(0, 512).arrayBuffer()))
          }))
        )
      };
      abortSignal?.throwIfAborted();
      const res = await (params.fetch ?? fetch)(
        `${params.hubUrl ?? HUB_URL}/api/${repoId.type}s/${repoId.name}/preupload/${encodeURIComponent(
          params.branch ?? "main"
        )}` + (params.isPullRequest ? "?create_pr=1" : ""),
        {
          method: "POST",
          headers: {
            ...params.credentials && { Authorization: `Bearer ${params.credentials.accessToken}` },
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          signal: abortSignal
        }
      );
      if (!res.ok) {
        throw await createApiError(res);
      }
      const json = await res.json();
      for (const file of json.files) {
        if (file.uploadMode === "lfs") {
          lfsShas.set(file.path, null);
        }
      }
    }
    yield { event: "phase", phase: "uploadingLargeFiles" };
    for (const operations of chunk(
      allOperations.filter(isFileOperation).filter((op) => lfsShas.has(op.path)),
      100
    )) {
      const shas = yield* eventToGenerator((yieldCallback, returnCallback, rejectCallack) => {
        return promisesQueue(
          operations.map((op) => async () => {
            const iterator = sha256(op.content, { useWebWorker: params.useWebWorkers, abortSignal });
            let res2;
            do {
              res2 = await iterator.next();
              if (!res2.done) {
                yieldCallback({ event: "fileProgress", path: op.path, progress: res2.value, state: "hashing" });
              }
            } while (!res2.done);
            const sha = res2.value;
            lfsShas.set(op.path, res2.value);
            return sha;
          }),
          CONCURRENT_SHAS
        ).then(returnCallback, rejectCallack);
      });
      abortSignal?.throwIfAborted();
      const payload = {
        operation: "upload",
        // multipart is a custom protocol for HF
        transfers: ["basic", "multipart"],
        hash_algo: "sha_256",
        ...!params.isPullRequest && {
          ref: {
            name: params.branch ?? "main"
          }
        },
        objects: operations.map((op, i) => ({
          oid: shas[i],
          size: op.content.size
        }))
      };
      const res = await (params.fetch ?? fetch)(
        `${params.hubUrl ?? HUB_URL}/${repoId.type === "model" ? "" : repoId.type + "s/"}${repoId.name}.git/info/lfs/objects/batch`,
        {
          method: "POST",
          headers: {
            ...params.credentials && { Authorization: `Bearer ${params.credentials.accessToken}` },
            Accept: "application/vnd.git-lfs+json",
            "Content-Type": "application/vnd.git-lfs+json"
          },
          body: JSON.stringify(payload),
          signal: abortSignal
        }
      );
      if (!res.ok) {
        throw await createApiError(res);
      }
      const json = await res.json();
      const batchRequestId = res.headers.get("X-Request-Id") || void 0;
      const shaToOperation = new Map(operations.map((op, i) => [shas[i], op]));
      yield* eventToGenerator((yieldCallback, returnCallback, rejectCallback) => {
        return promisesQueueStreaming(
          json.objects.map((obj) => async () => {
            const op = shaToOperation.get(obj.oid);
            if (!op) {
              throw new InvalidApiResponseFormatError("Unrequested object ID in response");
            }
            abortSignal?.throwIfAborted();
            if (obj.error) {
              const errorMessage = `Error while doing LFS batch call for ${operations[shas.indexOf(obj.oid)].path}: ${obj.error.message}${batchRequestId ? ` - Request ID: ${batchRequestId}` : ""}`;
              throw new HubApiError(res.url, obj.error.code, batchRequestId, errorMessage);
            }
            if (!obj.actions?.upload) {
              yieldCallback({
                event: "fileProgress",
                path: op.path,
                progress: 1,
                state: "uploading"
              });
              return;
            }
            yieldCallback({
              event: "fileProgress",
              path: op.path,
              progress: 0,
              state: "uploading"
            });
            const content = op.content;
            const header = obj.actions.upload.header;
            if (header?.chunk_size) {
              const chunkSize = parseInt(header.chunk_size);
              const completionUrl = obj.actions.upload.href;
              const parts = Object.keys(header).filter((key) => /^[0-9]+$/.test(key));
              if (parts.length !== Math.ceil(content.size / chunkSize)) {
                throw new Error("Invalid server response to upload large LFS file, wrong number of parts");
              }
              const completeReq = {
                oid: obj.oid,
                parts: parts.map((part) => ({
                  partNumber: +part,
                  etag: ""
                }))
              };
              const progressCallback = (progress) => yieldCallback({ event: "fileProgress", path: op.path, progress, state: "uploading" });
              await promisesQueueStreaming(
                parts.map((part) => async () => {
                  abortSignal?.throwIfAborted();
                  const index = parseInt(part) - 1;
                  const slice = content.slice(index * chunkSize, (index + 1) * chunkSize);
                  const res3 = await (params.fetch ?? fetch)(header[part], {
                    method: "PUT",
                    /** Unfortunately, browsers don't support our inherited version of Blob in fetch calls */
                    body: slice instanceof WebBlob && isFrontend ? await slice.arrayBuffer() : slice,
                    signal: abortSignal,
                    ...{
                      progressHint: {
                        path: op.path,
                        part: index,
                        numParts: parts.length,
                        progressCallback
                      }
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    }
                  });
                  if (!res3.ok) {
                    throw await createApiError(res3, {
                      requestId: batchRequestId,
                      message: `Error while uploading part ${part} of ${operations[shas.indexOf(obj.oid)].path} to LFS storage`
                    });
                  }
                  const eTag = res3.headers.get("ETag");
                  if (!eTag) {
                    throw new Error("Cannot get ETag of part during multipart upload");
                  }
                  completeReq.parts[Number(part) - 1].etag = eTag;
                }),
                MULTIPART_PARALLEL_UPLOAD
              );
              abortSignal?.throwIfAborted();
              const res2 = await (params.fetch ?? fetch)(completionUrl, {
                method: "POST",
                body: JSON.stringify(completeReq),
                headers: {
                  Accept: "application/vnd.git-lfs+json",
                  "Content-Type": "application/vnd.git-lfs+json"
                },
                signal: abortSignal
              });
              if (!res2.ok) {
                throw await createApiError(res2, {
                  requestId: batchRequestId,
                  message: `Error completing multipart upload of ${operations[shas.indexOf(obj.oid)].path} to LFS storage`
                });
              }
              yieldCallback({
                event: "fileProgress",
                path: op.path,
                progress: 1,
                state: "uploading"
              });
            } else {
              const res2 = await (params.fetch ?? fetch)(obj.actions.upload.href, {
                method: "PUT",
                headers: {
                  ...batchRequestId ? { "X-Request-Id": batchRequestId } : void 0
                },
                /** Unfortunately, browsers don't support our inherited version of Blob in fetch calls */
                body: content instanceof WebBlob && isFrontend ? await content.arrayBuffer() : content,
                signal: abortSignal,
                ...{
                  progressHint: {
                    path: op.path,
                    progressCallback: (progress) => yieldCallback({
                      event: "fileProgress",
                      path: op.path,
                      progress,
                      state: "uploading"
                    })
                  }
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                }
              });
              if (!res2.ok) {
                throw await createApiError(res2, {
                  requestId: batchRequestId,
                  message: `Error while uploading ${operations[shas.indexOf(obj.oid)].path} to LFS storage`
                });
              }
              yieldCallback({
                event: "fileProgress",
                path: op.path,
                progress: 1,
                state: "uploading"
              });
            }
          }),
          CONCURRENT_LFS_UPLOADS
        ).then(returnCallback, rejectCallback);
      });
    }
    abortSignal?.throwIfAborted();
    yield { event: "phase", phase: "committing" };
    return yield* eventToGenerator(
      async (yieldCallback, returnCallback, rejectCallback) => (params.fetch ?? fetch)(
        `${params.hubUrl ?? HUB_URL}/api/${repoId.type}s/${repoId.name}/commit/${encodeURIComponent(
          params.branch ?? "main"
        )}` + (params.isPullRequest ? "?create_pr=1" : ""),
        {
          method: "POST",
          headers: {
            ...params.credentials && { Authorization: `Bearer ${params.credentials.accessToken}` },
            "Content-Type": "application/x-ndjson"
          },
          body: [
            {
              key: "header",
              value: {
                summary: params.title,
                description: params.description,
                parentCommit: params.parentCommit
              }
            },
            ...await Promise.all(
              allOperations.map((operation) => {
                if (isFileOperation(operation)) {
                  const sha = lfsShas.get(operation.path);
                  if (sha) {
                    return {
                      key: "lfsFile",
                      value: {
                        path: operation.path,
                        algo: "sha256",
                        size: operation.content.size,
                        oid: sha
                      }
                    };
                  }
                }
                return convertOperationToNdJson(operation);
              })
            )
          ].map((x) => JSON.stringify(x)).join("\n"),
          signal: abortSignal,
          ...{
            progressHint: {
              progressCallback: (progress) => {
                for (const op of allOperations) {
                  if (isFileOperation(op) && !lfsShas.has(op.path)) {
                    yieldCallback({
                      event: "fileProgress",
                      path: op.path,
                      progress,
                      state: "uploading"
                    });
                  }
                }
              }
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }
        }
      ).then(async (res) => {
        if (!res.ok) {
          throw await createApiError(res);
        }
        const json = await res.json();
        returnCallback({
          pullRequestUrl: json.pullRequestUrl,
          commit: {
            oid: json.commitOid,
            url: json.commitUrl
          },
          hookOutput: json.hookOutput
        });
      }).catch(rejectCallback)
    );
  } catch (err) {
    abortController.abort();
    throw err;
  }
}
async function commit(params) {
  const iterator = commitIter(params);
  let res = await iterator.next();
  while (!res.done) {
    res = await iterator.next();
  }
  return res.value;
}
async function convertOperationToNdJson(operation) {
  switch (operation.operation) {
    case "addOrUpdate": {
      return {
        key: "file",
        value: {
          content: base64FromBytes(new Uint8Array(await operation.content.arrayBuffer())),
          path: operation.path,
          encoding: "base64"
        }
      };
    }
    case "delete": {
      return {
        key: "deletedFile",
        value: {
          path: operation.path
        }
      };
    }
    default:
      throw new TypeError("Unknown operation: " + operation.operation);
  }
}

// src/lib/count-commits.ts
async function countCommits(params) {
  checkCredentials(params.credentials);
  const repoId = toRepoId(params.repo);
  const url = `${params.hubUrl ?? HUB_URL}/api/${repoId.type}s/${repoId.name}/commits/${params.revision ?? "main"}?limit=1`;
  const res = await (params.fetch ?? fetch)(url, {
    headers: params.credentials ? { Authorization: `Bearer ${params.credentials.accessToken}` } : {}
  });
  if (!res.ok) {
    throw await createApiError(res);
  }
  return parseInt(res.headers.get("x-total-count") ?? "0", 10);
}

// src/lib/create-repo.ts
async function createRepo(params) {
  checkCredentials(params.credentials);
  const repoId = toRepoId(params.repo);
  const [namespace, repoName] = repoId.name.split("/");
  if (!namespace || !repoName) {
    throw new TypeError(
      `"${repoId.name}" is not a fully qualified repo name. It should be of the form "{namespace}/{repoName}".`
    );
  }
  const res = await (params.fetch ?? fetch)(`${params.hubUrl ?? HUB_URL}/api/repos/create`, {
    method: "POST",
    body: JSON.stringify({
      name: repoName,
      private: params.private,
      organization: namespace,
      license: params.license,
      ...repoId.type === "space" ? {
        type: "space",
        sdk: "static"
      } : {
        type: repoId.type
      },
      files: params.files ? await Promise.all(
        params.files.map(async (file) => ({
          encoding: "base64",
          path: file.path,
          content: base64FromBytes(
            new Uint8Array(file.content instanceof Blob ? await file.content.arrayBuffer() : file.content)
          )
        }))
      ) : void 0
    }),
    headers: {
      Authorization: `Bearer ${params.credentials.accessToken}`,
      "Content-Type": "application/json"
    }
  });
  if (!res.ok) {
    throw await createApiError(res);
  }
  const output = await res.json();
  return { repoUrl: output.url };
}

// src/lib/delete-file.ts
function deleteFile(params) {
  return commit({
    credentials: params.credentials,
    repo: params.repo,
    operations: [
      {
        operation: "delete",
        path: params.path
      }
    ],
    title: params.commitTitle ?? `Delete ${params.path}`,
    description: params.commitDescription,
    hubUrl: params.hubUrl,
    branch: params.branch,
    isPullRequest: params.isPullRequest,
    parentCommit: params.parentCommit,
    fetch: params.fetch
  });
}

// src/lib/delete-files.ts
function deleteFiles(params) {
  return commit({
    credentials: params.credentials,
    repo: params.repo,
    operations: params.paths.map((path) => ({
      operation: "delete",
      path
    })),
    title: params.commitTitle ?? `Deletes ${params.paths.length} files`,
    description: params.commitDescription,
    hubUrl: params.hubUrl,
    branch: params.branch,
    isPullRequest: params.isPullRequest,
    parentCommit: params.parentCommit,
    fetch: params.fetch
  });
}

// src/lib/delete-repo.ts
async function deleteRepo(params) {
  checkCredentials(params.credentials);
  const repoId = toRepoId(params.repo);
  const [namespace, repoName] = repoId.name.split("/");
  const res = await (params.fetch ?? fetch)(`${params.hubUrl ?? HUB_URL}/api/repos/delete`, {
    method: "DELETE",
    body: JSON.stringify({
      name: repoName,
      organization: namespace,
      type: repoId.type
    }),
    headers: {
      Authorization: `Bearer ${params.credentials.accessToken}`,
      "Content-Type": "application/json"
    }
  });
  if (!res.ok) {
    throw await createApiError(res);
  }
}

// src/lib/download-file.ts
async function downloadFile(params) {
  checkCredentials(params.credentials);
  const repoId = toRepoId(params.repo);
  const url = `${params.hubUrl ?? HUB_URL}/${repoId.type === "model" ? "" : `${repoId.type}s/`}${repoId.name}/${params.raw ? "raw" : "resolve"}/${encodeURIComponent(params.revision ?? "main")}/${params.path}`;
  const resp = await (params.fetch ?? fetch)(url, {
    headers: {
      ...params.credentials ? {
        Authorization: `Bearer ${params.credentials.accessToken}`
      } : {},
      ...params.range ? {
        Range: `bytes=${params.range[0]}-${params.range[1]}`
      } : {}
    }
  });
  if (resp.status === 404 && resp.headers.get("X-Error-Code") === "EntryNotFound") {
    return null;
  } else if (!resp.ok) {
    throw await createApiError(resp);
  }
  return resp;
}

// src/lib/file-download-info.ts
async function fileDownloadInfo(params) {
  checkCredentials(params.credentials);
  const repoId = toRepoId(params.repo);
  const hubUrl = params.hubUrl ?? HUB_URL;
  const url = `${hubUrl}/${repoId.type === "model" ? "" : `${repoId.type}s/`}${repoId.name}/${params.raw ? "raw" : "resolve"}/${encodeURIComponent(params.revision ?? "main")}/${params.path}` + (params.noContentDisposition ? "?noContentDisposition=1" : "");
  const resp = await (params.fetch ?? fetch)(url, {
    method: "GET",
    headers: {
      ...params.credentials && {
        Authorization: `Bearer ${params.credentials.accessToken}`
      },
      Range: "bytes=0-0"
    }
  });
  if (resp.status === 404 && resp.headers.get("X-Error-Code") === "EntryNotFound") {
    return null;
  }
  if (!resp.ok) {
    throw await createApiError(resp);
  }
  const etag = resp.headers.get("ETag");
  if (!etag) {
    throw new InvalidApiResponseFormatError("Expected ETag");
  }
  const contentRangeHeader = resp.headers.get("content-range");
  if (!contentRangeHeader) {
    throw new InvalidApiResponseFormatError("Expected size information");
  }
  const [, parsedSize] = contentRangeHeader.split("/");
  const size = parseInt(parsedSize);
  if (isNaN(size)) {
    throw new InvalidApiResponseFormatError("Invalid file size received");
  }
  return {
    etag,
    size,
    downloadLink: new URL(resp.url).hostname !== new URL(hubUrl).hostname ? resp.url : null
  };
}

// src/lib/file-exists.ts
async function fileExists(params) {
  checkCredentials(params.credentials);
  const repoId = toRepoId(params.repo);
  const hubUrl = params.hubUrl ?? HUB_URL;
  const url = `${hubUrl}/${repoId.type === "model" ? "" : `${repoId.type}s/`}${repoId.name}/raw/${encodeURIComponent(
    params.revision ?? "main"
  )}/${params.path}`;
  const resp = await (params.fetch ?? fetch)(url, {
    method: "HEAD",
    headers: params.credentials ? { Authorization: `Bearer ${params.credentials.accessToken}` } : {}
  });
  if (resp.status === 404) {
    return false;
  }
  if (!resp.ok) {
    throw await createApiError(resp);
  }
  return true;
}

// src/utils/parseLinkHeader.ts
function parseLinkHeader(header) {
  const regex = /<(https?:[/][/][^>]+)>;\s+rel="([^"]+)"/g;
  return Object.fromEntries([...header.matchAll(regex)].map(([, url, rel]) => [rel, url]));
}

// src/lib/list-commits.ts
async function* listCommits(params) {
  checkCredentials(params.credentials);
  const repoId = toRepoId(params.repo);
  let url = `${params.hubUrl ?? HUB_URL}/api/${repoId.type}s/${repoId.name}/commits/${params.revision ?? "main"}?limit=${params.batchSize ?? 100}`;
  while (url) {
    const res = await (params.fetch ?? fetch)(url, {
      headers: params.credentials ? { Authorization: `Bearer ${params.credentials.accessToken}` } : {}
    });
    if (!res.ok) {
      throw await createApiError(res);
    }
    const resJson = await res.json();
    for (const commit2 of resJson) {
      yield {
        oid: commit2.id,
        title: commit2.title,
        message: commit2.message,
        authors: commit2.authors.map((author) => ({
          username: author.user,
          avatarUrl: author.avatar
        })),
        date: new Date(commit2.date)
      };
    }
    const linkHeader = res.headers.get("Link");
    url = linkHeader ? parseLinkHeader(linkHeader).next : void 0;
  }
}

// src/utils/pick.ts
function pick(o, props) {
  return Object.assign(
    {},
    ...props.map((prop) => {
      if (o[prop] !== void 0) {
        return { [prop]: o[prop] };
      }
    })
  );
}

// src/lib/list-datasets.ts
var EXPAND_KEYS = [
  "private",
  "downloads",
  "gated",
  "likes",
  "lastModified"
];
async function* listDatasets(params) {
  checkCredentials(params?.credentials);
  let totalToFetch = params?.limit ?? Infinity;
  const search = new URLSearchParams([
    ...Object.entries({
      limit: String(Math.min(totalToFetch, 500)),
      ...params?.search?.owner ? { author: params.search.owner } : void 0,
      ...params?.search?.query ? { search: params.search.query } : void 0
    }),
    ...params?.search?.tags?.map((tag) => ["filter", tag]) ?? [],
    ...EXPAND_KEYS.map((val) => ["expand", val]),
    ...params?.additionalFields?.map((val) => ["expand", val]) ?? []
  ]).toString();
  let url = `${params?.hubUrl || HUB_URL}/api/datasets` + (search ? "?" + search : "");
  while (url) {
    const res = await (params?.fetch ?? fetch)(url, {
      headers: {
        accept: "application/json",
        ...params?.credentials ? { Authorization: `Bearer ${params.credentials.accessToken}` } : void 0
      }
    });
    if (!res.ok) {
      throw await createApiError(res);
    }
    const items = await res.json();
    for (const item of items) {
      yield {
        ...params?.additionalFields && pick(item, params.additionalFields),
        id: item._id,
        name: item.id,
        private: item.private,
        downloads: item.downloads,
        likes: item.likes,
        gated: item.gated,
        updatedAt: new Date(item.lastModified)
      };
      totalToFetch--;
      if (totalToFetch <= 0) {
        return;
      }
    }
    const linkHeader = res.headers.get("Link");
    url = linkHeader ? parseLinkHeader(linkHeader).next : void 0;
  }
}

// src/lib/list-files.ts
async function* listFiles(params) {
  checkCredentials(params.credentials);
  const repoId = toRepoId(params.repo);
  let url = `${params.hubUrl || HUB_URL}/api/${repoId.type}s/${repoId.name}/tree/${params.revision || "main"}${params.path ? "/" + params.path : ""}?recursive=${!!params.recursive}&expand=${!!params.expand}`;
  while (url) {
    const res = await (params.fetch ?? fetch)(url, {
      headers: {
        accept: "application/json",
        ...params.credentials ? { Authorization: `Bearer ${params.credentials.accessToken}` } : void 0
      }
    });
    if (!res.ok) {
      throw await createApiError(res);
    }
    const items = await res.json();
    for (const item of items) {
      yield item;
    }
    const linkHeader = res.headers.get("Link");
    url = linkHeader ? parseLinkHeader(linkHeader).next : void 0;
  }
}

// src/lib/list-models.ts
var EXPAND_KEYS2 = [
  "pipeline_tag",
  "private",
  "gated",
  "downloads",
  "likes",
  "lastModified"
];
async function* listModels(params) {
  checkCredentials(params?.credentials);
  let totalToFetch = params?.limit ?? Infinity;
  const search = new URLSearchParams([
    ...Object.entries({
      limit: String(Math.min(totalToFetch, 500)),
      ...params?.search?.owner ? { author: params.search.owner } : void 0,
      ...params?.search?.task ? { pipeline_tag: params.search.task } : void 0,
      ...params?.search?.query ? { search: params.search.query } : void 0
    }),
    ...params?.search?.tags?.map((tag) => ["filter", tag]) ?? [],
    ...EXPAND_KEYS2.map((val) => ["expand", val]),
    ...params?.additionalFields?.map((val) => ["expand", val]) ?? []
  ]).toString();
  let url = `${params?.hubUrl || HUB_URL}/api/models?${search}`;
  while (url) {
    const res = await (params?.fetch ?? fetch)(url, {
      headers: {
        accept: "application/json",
        ...params?.credentials ? { Authorization: `Bearer ${params.credentials.accessToken}` } : void 0
      }
    });
    if (!res.ok) {
      throw await createApiError(res);
    }
    const items = await res.json();
    for (const item of items) {
      yield {
        ...params?.additionalFields && pick(item, params.additionalFields),
        id: item._id,
        name: item.id,
        private: item.private,
        task: item.pipeline_tag,
        downloads: item.downloads,
        gated: item.gated,
        likes: item.likes,
        updatedAt: new Date(item.lastModified)
      };
      totalToFetch--;
      if (totalToFetch <= 0) {
        return;
      }
    }
    const linkHeader = res.headers.get("Link");
    url = linkHeader ? parseLinkHeader(linkHeader).next : void 0;
  }
}

// src/lib/list-spaces.ts
var EXPAND_KEYS3 = ["sdk", "likes", "private", "lastModified"];
async function* listSpaces(params) {
  checkCredentials(params?.credentials);
  const search = new URLSearchParams([
    ...Object.entries({
      limit: "500",
      ...params?.search?.owner ? { author: params.search.owner } : void 0,
      ...params?.search?.query ? { search: params.search.query } : void 0
    }),
    ...params?.search?.tags?.map((tag) => ["filter", tag]) ?? [],
    ...[...EXPAND_KEYS3, ...params?.additionalFields ?? []].map((val) => ["expand", val])
  ]).toString();
  let url = `${params?.hubUrl || HUB_URL}/api/spaces?${search}`;
  while (url) {
    const res = await (params?.fetch ?? fetch)(url, {
      headers: {
        accept: "application/json",
        ...params?.credentials ? { Authorization: `Bearer ${params.credentials.accessToken}` } : void 0
      }
    });
    if (!res.ok) {
      throw await createApiError(res);
    }
    const items = await res.json();
    for (const item of items) {
      yield {
        ...params?.additionalFields && pick(item, params.additionalFields),
        id: item._id,
        name: item.id,
        sdk: item.sdk,
        likes: item.likes,
        private: item.private,
        updatedAt: new Date(item.lastModified)
      };
    }
    const linkHeader = res.headers.get("Link");
    url = linkHeader ? parseLinkHeader(linkHeader).next : void 0;
  }
}

// src/lib/oauth-handle-redirect.ts
async function oauthHandleRedirect(opts) {
  if (typeof window === "undefined") {
    throw new Error("oauthHandleRedirect is only available in the browser");
  }
  const searchParams = new URLSearchParams(window.location.search);
  const [error, errorDescription] = [searchParams.get("error"), searchParams.get("error_description")];
  if (error) {
    throw new Error(`${error}: ${errorDescription}`);
  }
  const code = searchParams.get("code");
  const nonce = localStorage.getItem("huggingface.co:oauth:nonce");
  if (!code) {
    throw new Error("Missing oauth code from query parameters in redirected URL");
  }
  if (!nonce) {
    throw new Error("Missing oauth nonce from localStorage");
  }
  const codeVerifier = localStorage.getItem("huggingface.co:oauth:code_verifier");
  if (!codeVerifier) {
    throw new Error("Missing oauth code_verifier from localStorage");
  }
  const state = searchParams.get("state");
  if (!state) {
    throw new Error("Missing oauth state from query parameters in redirected URL");
  }
  let parsedState;
  try {
    parsedState = JSON.parse(state);
  } catch {
    throw new Error("Invalid oauth state in redirected URL, unable to parse JSON: " + state);
  }
  if (parsedState.nonce !== nonce) {
    throw new Error("Invalid oauth state in redirected URL");
  }
  const hubUrl = opts?.hubUrl || HUB_URL;
  const openidConfigUrl = `${new URL(hubUrl).origin}/.well-known/openid-configuration`;
  const openidConfigRes = await fetch(openidConfigUrl, {
    headers: {
      Accept: "application/json"
    }
  });
  if (!openidConfigRes.ok) {
    throw await createApiError(openidConfigRes);
  }
  const opendidConfig = await openidConfigRes.json();
  const tokenRes = await fetch(opendidConfig.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: parsedState.redirectUri,
      code_verifier: codeVerifier
    }).toString()
  });
  localStorage.removeItem("huggingface.co:oauth:code_verifier");
  localStorage.removeItem("huggingface.co:oauth:nonce");
  if (!tokenRes.ok) {
    throw await createApiError(tokenRes);
  }
  const token = await tokenRes.json();
  const accessTokenExpiresAt = new Date(Date.now() + token.expires_in * 1e3);
  const userInfoRes = await fetch(opendidConfig.userinfo_endpoint, {
    headers: {
      Authorization: `Bearer ${token.access_token}`
    }
  });
  if (!userInfoRes.ok) {
    throw await createApiError(userInfoRes);
  }
  const userInfo = await userInfoRes.json();
  return {
    accessToken: token.access_token,
    accessTokenExpiresAt,
    userInfo: {
      id: userInfo.sub,
      name: userInfo.name,
      fullname: userInfo.preferred_username,
      email: userInfo.email,
      emailVerified: userInfo.email_verified,
      avatarUrl: userInfo.picture,
      websiteUrl: userInfo.website,
      isPro: userInfo.isPro,
      orgs: userInfo.orgs?.map((org) => ({
        id: org.sub,
        name: org.name,
        fullname: org.name,
        isEnterprise: org.isEnterprise,
        canPay: org.canPay,
        avatarUrl: org.picture,
        roleInOrg: org.roleInOrg
      })) ?? []
    },
    state: parsedState.state,
    scope: token.scope
  };
}
async function oauthHandleRedirectIfPresent(opts) {
  if (typeof window === "undefined") {
    throw new Error("oauthHandleRedirect is only available in the browser");
  }
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.has("error")) {
    return oauthHandleRedirect(opts);
  }
  if (searchParams.has("code")) {
    if (!localStorage.getItem("huggingface.co:oauth:nonce")) {
      console.warn(
        "Missing oauth nonce from localStorage. This can happen when the user refreshes the page after logging in, without changing the URL."
      );
      return false;
    }
    return oauthHandleRedirect(opts);
  }
  return false;
}

// src/lib/oauth-login-url.ts
async function oauthLoginUrl(opts) {
  if (typeof window === "undefined") {
    throw new Error("oauthLogin is only available in the browser");
  }
  const hubUrl = opts?.hubUrl || HUB_URL;
  const openidConfigUrl = `${new URL(hubUrl).origin}/.well-known/openid-configuration`;
  const openidConfigRes = await fetch(openidConfigUrl, {
    headers: {
      Accept: "application/json"
    }
  });
  if (!openidConfigRes.ok) {
    throw await createApiError(openidConfigRes);
  }
  const opendidConfig = await openidConfigRes.json();
  const newNonce = globalThis.crypto.randomUUID();
  const newCodeVerifier = globalThis.crypto.randomUUID() + globalThis.crypto.randomUUID();
  localStorage.setItem("huggingface.co:oauth:nonce", newNonce);
  localStorage.setItem("huggingface.co:oauth:code_verifier", newCodeVerifier);
  const redirectUri = opts?.redirectUrl || window.location.href;
  const state = JSON.stringify({
    nonce: newNonce,
    redirectUri,
    state: opts?.state
  });
  const variables = window?.huggingface?.variables ?? null;
  const clientId = opts?.clientId || variables?.OAUTH_CLIENT_ID;
  if (!clientId) {
    if (variables) {
      throw new Error("Missing clientId, please add hf_oauth: true to the README.md's metadata in your static Space");
    }
    throw new Error("Missing clientId");
  }
  const challenge = base64FromBytes(
    new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(newCodeVerifier)))
  ).replace(/[+]/g, "-").replace(/[/]/g, "_").replace(/=/g, "");
  return `${opendidConfig.authorization_endpoint}?${new URLSearchParams({
    client_id: clientId,
    scope: opts?.scopes || variables?.OAUTH_SCOPES || "openid profile",
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256"
  }).toString()}`;
}

// src/utils/typedInclude.ts
function typedInclude(arr, v) {
  return arr.includes(v);
}

// src/utils/omit.ts
function omit(o, props) {
  const propsArr = Array.isArray(props) ? props : [props];
  const letsKeep = Object.keys(o).filter((prop) => !typedInclude(propsArr, prop));
  return pick(o, letsKeep);
}

// src/utils/typedEntries.ts
function typedEntries(obj) {
  return Object.entries(obj);
}

// src/lib/parse-safetensors-metadata.ts
var SAFETENSORS_FILE = "model.safetensors";
var SAFETENSORS_INDEX_FILE = "model.safetensors.index.json";
var RE_SAFETENSORS_FILE = /\.safetensors$/;
var RE_SAFETENSORS_INDEX_FILE = /\.safetensors\.index\.json$/;
var RE_SAFETENSORS_SHARD_FILE = /^(?<prefix>(?<basePrefix>.*?)[_-])(?<shard>\d{5})-of-(?<total>\d{5})\.safetensors$/;
function parseSafetensorsShardFilename(filename) {
  const match = RE_SAFETENSORS_SHARD_FILE.exec(filename);
  if (match && match.groups) {
    return {
      prefix: match.groups["prefix"],
      basePrefix: match.groups["basePrefix"],
      shard: match.groups["shard"],
      total: match.groups["total"]
    };
  }
  return null;
}
var PARALLEL_DOWNLOADS = 20;
var MAX_HEADER_LENGTH = 25e6;
var SafetensorParseError = class extends Error {
};
async function parseSingleFile(path, params) {
  const firstResp = await downloadFile({
    ...params,
    path,
    range: [0, 7]
  });
  if (!firstResp) {
    throw new SafetensorParseError(`Failed to parse file ${path}: failed to fetch safetensors header length.`);
  }
  const bufLengthOfHeaderLE = await firstResp.arrayBuffer();
  const lengthOfHeader = new DataView(bufLengthOfHeaderLE).getBigUint64(0, true);
  if (lengthOfHeader <= 0) {
    throw new SafetensorParseError(`Failed to parse file ${path}: safetensors header is malformed.`);
  }
  if (lengthOfHeader > MAX_HEADER_LENGTH) {
    throw new SafetensorParseError(
      `Failed to parse file ${path}: safetensor header is too big. Maximum supported size is ${MAX_HEADER_LENGTH} bytes.`
    );
  }
  const secondResp = await downloadFile({ ...params, path, range: [8, 7 + Number(lengthOfHeader)] });
  if (!secondResp) {
    throw new SafetensorParseError(`Failed to parse file ${path}: failed to fetch safetensors header.`);
  }
  try {
    const header = await secondResp.json();
    return header;
  } catch (err) {
    throw new SafetensorParseError(`Failed to parse file ${path}: safetensors header is not valid JSON.`);
  }
}
async function parseShardedIndex(path, params) {
  const indexResp = await downloadFile({
    ...params,
    path,
    range: [0, 1e7]
  });
  if (!indexResp) {
    throw new SafetensorParseError(`Failed to parse file ${path}: failed to fetch safetensors index.`);
  }
  let index;
  try {
    index = await indexResp.json();
  } catch (error) {
    throw new SafetensorParseError(`Failed to parse file ${path}: not a valid JSON.`);
  }
  const pathPrefix = path.slice(0, path.lastIndexOf("/") + 1);
  const filenames = [...new Set(Object.values(index.weight_map))];
  const shardedMap = Object.fromEntries(
    await promisesQueue(
      filenames.map(
        (filename) => async () => [filename, await parseSingleFile(pathPrefix + filename, params)]
      ),
      PARALLEL_DOWNLOADS
    )
  );
  return { index, headers: shardedMap };
}
async function parseSafetensorsMetadata(params) {
  checkCredentials(params.credentials);
  const repoId = toRepoId(params.repo);
  if (repoId.type !== "model") {
    throw new TypeError("Only model repos should contain safetensors files.");
  }
  if (RE_SAFETENSORS_FILE.test(params.path ?? "") || await fileExists({ ...params, path: SAFETENSORS_FILE })) {
    const header = await parseSingleFile(params.path ?? SAFETENSORS_FILE, params);
    return {
      sharded: false,
      header,
      ...params.computeParametersCount && {
        parameterCount: computeNumOfParamsByDtypeSingleFile(header)
      }
    };
  } else if (RE_SAFETENSORS_INDEX_FILE.test(params.path ?? "") || await fileExists({ ...params, path: SAFETENSORS_INDEX_FILE })) {
    const { index, headers } = await parseShardedIndex(params.path ?? SAFETENSORS_INDEX_FILE, params);
    return {
      sharded: true,
      index,
      headers,
      ...params.computeParametersCount && {
        parameterCount: computeNumOfParamsByDtypeSharded(headers)
      }
    };
  } else {
    throw new Error("model id does not seem to contain safetensors weights");
  }
}
function computeNumOfParamsByDtypeSingleFile(header) {
  const counter = {};
  const tensors = omit(header, "__metadata__");
  for (const [, v] of typedEntries(tensors)) {
    if (v.shape.length === 0) {
      continue;
    }
    counter[v.dtype] = (counter[v.dtype] ?? 0) + v.shape.reduce((a, b) => a * b);
  }
  return counter;
}
function computeNumOfParamsByDtypeSharded(shardedMap) {
  const counter = {};
  for (const header of Object.values(shardedMap)) {
    for (const [k, v] of typedEntries(computeNumOfParamsByDtypeSingleFile(header))) {
      counter[k] = (counter[k] ?? 0) + (v ?? 0);
    }
  }
  return counter;
}

// src/lib/upload-file.ts
function uploadFile(params) {
  const path = params.file instanceof URL ? params.file.pathname.split("/").at(-1) ?? "file" : "path" in params.file ? params.file.path : params.file.name;
  return commit({
    credentials: params.credentials,
    repo: params.repo,
    operations: [
      {
        operation: "addOrUpdate",
        path,
        content: "content" in params.file ? params.file.content : params.file
      }
    ],
    title: params.commitTitle ?? `Add ${path}`,
    description: params.commitDescription,
    hubUrl: params.hubUrl,
    branch: params.branch,
    isPullRequest: params.isPullRequest,
    parentCommit: params.parentCommit,
    fetch: params.fetch,
    useWebWorkers: params.useWebWorkers,
    abortSignal: params.abortSignal
  });
}

// src/lib/upload-files.ts
function uploadFiles(params) {
  return commit({
    credentials: params.credentials,
    repo: params.repo,
    operations: params.files.map((file) => ({
      operation: "addOrUpdate",
      path: file instanceof URL ? file.pathname.split("/").at(-1) ?? "file" : "path" in file ? file.path : file.name,
      content: "content" in file ? file.content : file
    })),
    title: params.commitTitle ?? `Add ${params.files.length} files`,
    description: params.commitDescription,
    hubUrl: params.hubUrl,
    branch: params.branch,
    isPullRequest: params.isPullRequest,
    parentCommit: params.parentCommit,
    fetch: params.fetch,
    useWebWorkers: params.useWebWorkers,
    abortSignal: params.abortSignal
  });
}

// src/lib/upload-files-with-progress.ts
var multipartUploadTracking = /* @__PURE__ */ new WeakMap();
async function* uploadFilesWithProgress(params) {
  return yield* commitIter({
    credentials: params.credentials,
    repo: params.repo,
    operations: params.files.map((file) => ({
      operation: "addOrUpdate",
      path: file instanceof URL ? file.pathname.split("/").at(-1) ?? "file" : "path" in file ? file.path : file.name,
      content: "content" in file ? file.content : file
    })),
    title: params.commitTitle ?? `Add ${params.files.length} files`,
    description: params.commitDescription,
    hubUrl: params.hubUrl,
    branch: params.branch,
    isPullRequest: params.isPullRequest,
    parentCommit: params.parentCommit,
    useWebWorkers: params.useWebWorkers,
    abortSignal: params.abortSignal,
    fetch: async (input, init) => {
      if (!init) {
        return fetch(input);
      }
      if (!typedInclude(["PUT", "POST"], init.method) || !("progressHint" in init) || !init.progressHint || typeof XMLHttpRequest === "undefined" || typeof input !== "string" || !(init.body instanceof ArrayBuffer) && !(init.body instanceof Blob) && !(init.body instanceof File) && typeof init.body !== "string") {
        return fetch(input, init);
      }
      const progressHint = init.progressHint;
      const progressCallback = progressHint.progressCallback;
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          if (progressHint.part !== void 0) {
            let tracking = multipartUploadTracking.get(progressCallback);
            if (!tracking) {
              tracking = { numParts: progressHint.numParts, partsProgress: {} };
              multipartUploadTracking.set(progressCallback, tracking);
            }
            tracking.partsProgress[progressHint.part] = event.loaded / event.total;
            let totalProgress = 0;
            for (const partProgress of Object.values(tracking.partsProgress)) {
              totalProgress += partProgress;
            }
            if (totalProgress === tracking.numParts) {
              progressCallback(0.9999999999);
            } else {
              progressCallback(totalProgress / tracking.numParts);
            }
          } else {
            if (event.loaded === event.total) {
              progressCallback(0.9999999999);
            } else {
              progressCallback(event.loaded / event.total);
            }
          }
        }
      });
      xhr.open(init.method, input, true);
      if (init.headers) {
        const headers = new Headers(init.headers);
        headers.forEach((value, key) => {
          xhr.setRequestHeader(key, value);
        });
      }
      init.signal?.throwIfAborted();
      xhr.send(init.body);
      return new Promise((resolve2, reject) => {
        xhr.addEventListener("load", () => {
          resolve2(
            new Response(xhr.responseText, {
              status: xhr.status,
              statusText: xhr.statusText,
              headers: Object.fromEntries(
                xhr.getAllResponseHeaders().trim().split("\n").map((header) => [header.slice(0, header.indexOf(":")), header.slice(header.indexOf(":") + 1).trim()])
              )
            })
          );
        });
        xhr.addEventListener("error", () => {
          reject(new Error(xhr.statusText));
        });
        if (init.signal) {
          init.signal.addEventListener("abort", () => {
            xhr.abort();
            try {
              init.signal?.throwIfAborted();
            } catch (err) {
              reject(err);
            }
          });
        }
      });
    }
  });
}

// src/lib/who-am-i.ts
async function whoAmI(params) {
  checkCredentials(params.credentials);
  const res = await (params.fetch ?? fetch)(`${params.hubUrl ?? HUB_URL}/api/whoami-v2`, {
    headers: {
      Authorization: `Bearer ${params.credentials.accessToken}`
    }
  });
  if (!res.ok) {
    throw await createApiError(res);
  }
  const response = await res.json();
  if (typeof response.auth.accessToken?.createdAt === "string") {
    response.auth.accessToken.createdAt = new Date(response.auth.accessToken.createdAt);
  }
  return response;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  HubApiError,
  InvalidApiResponseFormatError,
  RE_SAFETENSORS_FILE,
  RE_SAFETENSORS_INDEX_FILE,
  RE_SAFETENSORS_SHARD_FILE,
  SAFETENSORS_FILE,
  SAFETENSORS_INDEX_FILE,
  __internal_sha256,
  commit,
  commitIter,
  countCommits,
  createRepo,
  deleteFile,
  deleteFiles,
  deleteRepo,
  downloadFile,
  fileDownloadInfo,
  fileExists,
  listCommits,
  listDatasets,
  listFiles,
  listModels,
  listSpaces,
  oauthHandleRedirect,
  oauthHandleRedirectIfPresent,
  oauthLoginUrl,
  parseSafetensorsMetadata,
  parseSafetensorsShardFilename,
  uploadFile,
  uploadFiles,
  uploadFilesWithProgress,
  whoAmI
});
