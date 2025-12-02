#!/bin/bash

CURRENT_PATH="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd $CURRENT_PATH

# Clean up
docker kill hash-wasm-builder
docker rm hash-wasm-builder

# Start container
docker run -it -d --name hash-wasm-builder emscripten/emsdk:3.1.55 bash

# Copy & compile
docker exec hash-wasm-builder bash -c "mkdir /source"
docker cp ./sha256.c hash-wasm-builder:/source
docker exec hash-wasm-builder bash -c "\
  cd /source && \
  emcc sha256.c -o sha256.js -msimd128 -sSINGLE_FILE -sMODULARIZE=1 -sENVIRONMENT=web,worker -sEXPORTED_FUNCTIONS=_Hash_Init,_Hash_Update,_Hash_Final,_GetBufferPtr -sFILESYSTEM=0 -fno-rtti -fno-exceptions -O1 -sMODULARIZE=1 -sEXPORT_ES6=1 \
  "
# Patch "_scriptDir" variable
docker exec hash-wasm-builder bash -c "\
  cd /source && \
  sed -i 's\var _scriptDir\var _unused\g' ./sha256.js && \
  sed -i 's\_scriptDir\false\g' ./sha256.js \
  "

# Copy back compiled file
docker cp hash-wasm-builder:/source/sha256.js .


# Clean up
docker kill hash-wasm-builder
docker rm hash-wasm-builder
