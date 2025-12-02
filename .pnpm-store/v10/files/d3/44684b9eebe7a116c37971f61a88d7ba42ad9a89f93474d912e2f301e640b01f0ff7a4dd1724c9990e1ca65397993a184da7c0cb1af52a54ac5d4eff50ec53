const fsp = require('fs/promises')

const CustomDefinedTypes = [
  'couchbase::core::json_string',
  'couchbase::core::document_id',
  'couchbase::cas',
  'couchbase::mutation_token',
  'couchbase::retry_strategy',
  'couchbase::core::query_context',
]

const handleJsVariant = {
  names: [
    'couchbase::core::range_scan_create_options',
    'couchbase::core::management::eventing::function_url_binding',
  ],
  fields: ['scan_type', 'auth'],
}

function getTsType(type, typeDb) {
  // special case for std::vector<std::byte> which is a Buffer
  if (type.name === 'std::vector' && type.of.name === 'std::byte') {
    return 'Buffer'
  }

  switch (type.name) {
    case 'std::string':
      return 'string'
    case 'std::chrono::milliseconds':
      return 'CppMilliseconds'
    case 'std::chrono::microseconds':
      return 'CppMilliseconds'
    case 'std::chrono::nanoseconds':
      return 'CppMilliseconds'
    case 'std::chrono::seconds':
      return 'CppMilliseconds'
    case 'std::error_code':
      return 'CppError'
    case 'std::monostate':
      return 'undefined'
    case 'std::size_t':
      return 'number'
    case 'std::int8_t':
      return 'number'
    case 'std::uint8_t':
      return 'number'
    case 'std::byte':
      return 'number'
    case 'std::int16_t':
      return 'number'
    case 'std::uint16_t':
      return 'number'
    case 'std::int32_t':
      return 'number'
    case 'std::uint32_t':
      return 'number'
    case 'std::int64_t':
      return 'number'
    case 'std::uint64_t':
      return 'number'
    case 'std::bool':
      return 'boolean'
    case 'std::float':
      return 'number'
    case 'std::double':
      return 'number'
    case 'std::optional':
      return getTsType(type.of, typeDb) + ' | undefined'
    case 'std::variant':
      return type.of.map((v) => getTsType(v, typeDb)).join(' | ')
    case 'std::vector':
      return getTsType(type.of, typeDb) + '[]'
    case 'std::array':
      return getTsType(type.of, typeDb) + '[]'
    case 'std::set':
      return getTsType(type.of, typeDb) + '[]'
    case 'std::map':
      return (
        '{[key: string /*' +
        getTsType(type.of, typeDb) +
        '*/]: ' +
        getTsType(type.to, typeDb) +
        '}'
      )

    // special cased types
    //case 'couchbase::json_string':
    //  return 'CppJsonString'
    case 'couchbase::core::impl::subdoc::opcode':
      return 'number'
  }

  const opsStructs = typeDb.op_structs
  const foundStruct = opsStructs.find((x) => x.name === type.name)
  if (foundStruct) {
    return getStructTsName(type.name)
  }

  const opsEnums = typeDb.op_enums
  const foundEnum = opsEnums.find((x) => x.name === type.name)
  if (foundEnum) {
    return getEnumTsName(type.name)
  }

  throw new Error('unexpected type:' + JSON.stringify(type))
}

function getCppType(type) {
  if (type.name === 'std::bool') {
    return 'bool'
  } else if (type.name === 'std::int') {
    return 'int'
  } else if (type.name === 'std::double') {
    return 'double'
  } else if (type.name === 'std::float') {
    return 'float'
  } else if (type.name === 'std::vector') {
    const ofType = getCppType(type.of)
    return `${type.name}<${ofType}>`
  } else if (type.name === 'std::optional') {
    const ofType = getCppType(type.of)
    return `${type.name}<${ofType}>`
  } else if (type.name === 'std::set') {
    const ofType = getCppType(type.of)
    return `${type.name}<${ofType}>`
  } else if (type.name === 'std::variant') {
    const ofTypes = type.of.map((x) => getCppType(x)).join(', ')
    return `${type.name}<${ofTypes}>`
  } else if (type.name === 'std::map') {
    const ofType = getCppType(type.of)
    const toType = getCppType(type.to)
    if (type.comparator !== undefined) {
      const comparatorType = getCppType(type.comparator)
      return `${type.name}<${ofType}, ${toType}, ${comparatorType}>`
    }
    return `${type.name}<${ofType}, ${toType}>`
  } else if (type.name === 'std::array') {
    const ofType = getCppType(type.of)
    const sizeVal = type.size
    return `${type.name}<${ofType}, ${sizeVal}>`
  } else if (type.name == 'template') {
    return getCppType(type.of)
  }

  if (type.of) {
    throw new Error('unexpected type:' + JSON.stringify(type))
  }

  return type.name
}

function getUnprefixedName(name) {
  const basePrefix = 'couchbase::'
  const corePrefix = 'couchbase::core::'
  const opsPrefix = 'couchbase::core::operations::'

  if (name.startsWith(opsPrefix)) {
    name = name.substr(opsPrefix.length)
  } else if (name.startsWith(corePrefix)) {
    name = name.substr(corePrefix.length)
  } else if (name.startsWith(basePrefix)) {
    name = name.substr(basePrefix.length)
  } else {
    throw new Error('unexpected struct name')
  }

  // handle templated names
  if (name.includes('<')) {
    const nameTokens = name.split('<')
    const templateNameTokens = nameTokens[1].replace('>', '').split('::')
    const templateName = uppercaseFirstLetter(
      templateNameTokens[templateNameTokens.length - 1]
    )
    // move the _request to the end of the name
    if (nameTokens[0].includes('_request')) {
      name = nameTokens[0].replace('_request', '') + templateName + '_request'
    } else {
      name = nameTokens[0] + templateName
    }
  }

  // replace all namespace separators with underscores
  name = name.replace(/::/g, '_')
  if (name.includes('_with_legacy_durability')) {
    name = name.replace('_request_', '_')
  }

  return name
}

function getTsNiceName(name) {
  // drop the prefix
  name = getUnprefixedName(name)

  // convert underscores to camel case
  name = name.replace(/_a/g, 'A')
  name = name.replace(/_b/g, 'B')
  name = name.replace(/_c/g, 'C')
  name = name.replace(/_d/g, 'D')
  name = name.replace(/_e/g, 'E')
  name = name.replace(/_f/g, 'F')
  name = name.replace(/_g/g, 'G')
  name = name.replace(/_h/g, 'H')
  name = name.replace(/_i/g, 'I')
  name = name.replace(/_j/g, 'J')
  name = name.replace(/_k/g, 'K')
  name = name.replace(/_l/g, 'L')
  name = name.replace(/_m/g, 'M')
  name = name.replace(/_n/g, 'N')
  name = name.replace(/_o/g, 'O')
  name = name.replace(/_p/g, 'P')
  name = name.replace(/_q/g, 'Q')
  name = name.replace(/_r/g, 'R')
  name = name.replace(/_s/g, 'S')
  name = name.replace(/_t/g, 'T')
  name = name.replace(/_u/g, 'U')
  name = name.replace(/_v/g, 'V')
  name = name.replace(/_w/g, 'W')
  name = name.replace(/_x/g, 'X')
  name = name.replace(/_y/g, 'Y')
  name = name.replace(/_z/g, 'Z')

  return name
}

function uppercaseFirstLetter(name) {
  return name.substr(0, 1).toUpperCase() + name.substr(1)
}

function getEnumTsName(name) {
  return 'Cpp' + uppercaseFirstLetter(getTsNiceName(name))
}

function getStructTsName(name) {
  return 'Cpp' + uppercaseFirstLetter(getTsNiceName(name))
}

const StructsWithAllowedPrivateField = [
  'couchbase::core::impl::subdoc::command',
  'couchbase::core::range_scan',
]

function isIgnoredField(st, fieldName) {
  if (
    fieldName === 'retries' ||
    fieldName === 'ctx' ||
    fieldName === 'row_callback' ||
    fieldName === 'parent_span' ||
    fieldName === 'retry_strategy' ||
    fieldName === 'internal' ||
    fieldName === 'revive_document' ||
    fieldName === 'num_vbuckets' ||
    (fieldName.endsWith('_') &&
      !StructsWithAllowedPrivateField.includes(st.name))
  ) {
    return true
  }

  return false
}

const FILE_WRITER_DEBUG = false
class FileWriter {
  constructor(regionName) {
    this.regionName = regionName
    this.output = ''
  }

  write(data) {
    if (FILE_WRITER_DEBUG) {
      console.log(data)
    }

    this.output += data + '\n'
  }

  genProlog() {
    return `//#region ${this.regionName}`
  }
  genEpilog() {
    return `//#endregion ${this.regionName}`
  }

  async save(filePath) {
    const prolog = this.genProlog()
    const epilog = this.genEpilog()

    let fileOutput = ''
    fileOutput += prolog + '\n'
    fileOutput += this.output
    fileOutput += epilog + '\n'

    await fsp.writeFile(filePath, fileOutput)
  }

  async saveToRegion(filePath) {
    const prolog = this.genProlog()
    const epilog = this.genEpilog()

    const fileDataBuf = await fsp.readFile(filePath)
    const fileData = fileDataBuf.toString('utf-8')

    const prologPos = fileData.indexOf(prolog)
    if (prologPos === -1) {
      throw new Error(
        `failed to insert code into ${filePath} due to missing region ${this.regionName} prolog`
      )
    }
    const epilogPos = fileData.indexOf(epilog)
    if (epilogPos === -1) {
      throw new Error(
        `failed to insert code into ${filePath} due to missing region ${this.regionName} epilog`
      )
    }

    const preProlog = fileData.substr(0, prologPos)
    const postProlog = fileData.substr(epilogPos + epilog.length)

    let fileOutput = ''
    fileOutput += preProlog
    fileOutput += prolog + '\n'
    fileOutput += '\n' + this.output + '\n'
    fileOutput += epilog
    fileOutput += postProlog

    await fsp.writeFile(filePath, fileOutput)
  }
}

async function go() {
  const opsJson = await fsp.readFile('./bindings.json')
  const ops = JSON.parse(opsJson)

  let opsStructs = ops.op_structs
  let opsEnums = ops.op_enums

  // filter out mcbp_noop_request because its currently broken...
  opsStructs = opsStructs.filter(
    (x) => x.name != 'couchbase::core::operations::mcbp_noop_request'
  )

  const opReqTypes = []
  opsStructs.forEach((opStruct) => {
    if (opStruct.name.endsWith('_request')) {
      const opReqName = opStruct.name.substr(0, opStruct.name.length - 8)
      opReqTypes.push(opReqName)
    }
    if (opStruct.name.endsWith('_with_legacy_durability')) {
      opReqTypes.push(opStruct.name)
    }
    if (opStruct.name.endsWith('>')) {
      opReqTypes.push(opStruct.name.replace('_request', ''))
    }
  })

  // filter out the custom types
  opsStructs = opsStructs.filter(
    (x) =>
      !CustomDefinedTypes.includes(x.name) && !x.name.endsWith('::internal')
  )

  const outJsAll = new FileWriter('Autogenerated Bindings')
  outJsAll.write('')

  /*
  export enum CppViewScanConsistency {}
  */
  opsEnums.forEach((x) => {
    const jsEnumName = getEnumTsName(x.name)
    outJsAll.write(`export enum ${jsEnumName} {}`)
  })
  outJsAll.write('')

  /*
  export interface CppMutateInEntry {
    opcode: CppSubdocOpcode
    flags: CppMutateInPathFlag
    path: string
    param: Buffer
  }
  */
  opsStructs.forEach((opStruct) => {
    const jsTypeName = opStruct.name.endsWith('_with_legacy_durability')
      ? getStructTsName(opStruct.name + '_request')
      : getStructTsName(opStruct.name)

    outJsAll.write(`export interface ${jsTypeName} {`)
    opStruct.fields.forEach((field) => {
      // ignnore the ctx and retries fields
      if (isIgnoredField(opStruct, field.name)) {
        outJsAll.write(`  // ${field.name}`)
        return
      }

      // special case for optional fields
      if (field.type.name === 'std::optional') {
        const jsFieldName = field.name
        const jsFieldType = getTsType(field.type.of, ops)

        outJsAll.write(`  ${jsFieldName}?: ${jsFieldType}`)
      } else if (field.type.name === 'template') {
        const jsFieldName = field.name
        const jsFieldType = getStructTsName(field.type.of.name)

        outJsAll.write(`  ${jsFieldName}: ${jsFieldType}`)
      } else {
        const jsFieldName = field.name
        const jsFieldType = getTsType(field.type, ops)

        if (
          opStruct.name === 'couchbase::core::impl::subdoc::command' &&
          field.name === 'value_'
        ) {
          outJsAll.write(`  ${jsFieldName}?: ${jsFieldType}`)
        } else if (
          handleJsVariant.names.includes(opStruct.name) &&
          handleJsVariant.fields.includes(field.name)
        ) {
          outJsAll.write(`  ${jsFieldName}_name: string`)
          outJsAll.write(`  ${jsFieldName}_value: ${jsFieldType}`)
        } else if (jsFieldType === 'CppCas' && jsTypeName.endsWith('Request')) {
          outJsAll.write(`  ${jsFieldName}: CppCasInput`)
        } else {
          outJsAll.write(`  ${jsFieldName}: ${jsFieldType}`)
        }
      }
    })
    outJsAll.write(`}`)
  })
  outJsAll.write('')

  /*
  lookupIn(
    options: ReqType,
    callback: (
      err: CppError | null,
      result: ResType
    ) => void
  ): void
  */
  outJsAll.write('export interface CppConnectionAutogen {')
  opReqTypes.forEach((x) => {
    const jsOpName = getTsNiceName(x)
    const jsReqName = getStructTsName(x + '_request')
    let jsRespName
    if (x.endsWith('_with_legacy_durability')) {
      jsRespName = getStructTsName(x.substr(0, x.length - 31) + '_response')
    } else if (x.endsWith('>')) {
      const reqTokens = x.split('<')
      jsRespName = getStructTsName(reqTokens[0] + '_response')
    } else {
      jsRespName = getStructTsName(x + '_response')
    }

    outJsAll.write(`  ${jsOpName}(`)
    outJsAll.write(`    options: ${jsReqName},`)
    outJsAll.write(`    callback: (`)
    outJsAll.write(`      err: CppError | null,`)
    outJsAll.write(`      result: ${jsRespName}`)
    outJsAll.write(`    ) => void`)
    outJsAll.write(`  ): void`)
  })
  outJsAll.write('}')
  outJsAll.write('')

  /*
  view_scan_consistency: {
    not_bounded: CppViewScanConsistency
    update_after: CppViewScanConsistency
    request_plus: CppViewScanConsistency
  }
  */
  outJsAll.write('export interface CppBindingAutogen {')
  opsEnums.forEach((x) => {
    const jsEnumName = getEnumTsName(x.name)
    const jsPropName = getUnprefixedName(x.name)
    outJsAll.write(`  ${jsPropName}: {`)
    x.values.forEach((y) => {
      const jsValName = y.name
      outJsAll.write(`    ${jsValName}: ${jsEnumName}`)
    })
    outJsAll.write(`  }`)
  })
  outJsAll.write('}')
  outJsAll.write('')

  //outJsAll.write('//#endregion Autogen Code')
  //await outJsAll.save('./out/js_all.ts')
  await outJsAll.saveToRegion('../lib/binding.ts')

  /*
  Napi::Value jsGet(const Napi::CallbackInfo &info);
  */
  const outCppFuncDecls = new FileWriter('Autogenerated Method Declarations')
  opReqTypes.forEach((x) => {
    const cppJsOpName = 'js' + uppercaseFirstLetter(getTsNiceName(x))
    outCppFuncDecls.write(
      ` Napi::Value ${cppJsOpName}(const Napi::CallbackInfo &info);`
    )
  })
  //await outCppFuncDecls.save('./out/cpp_func_decls.hxx')
  await outCppFuncDecls.saveToRegion('../src/connection.hpp')

  /*
  Napi::Value Connection::jsExists(const Napi::CallbackInfo &info)
  {
      auto optsJsObj = info[0].As<Napi::Object>();
      auto callbackJsFn = info[1].As<Napi::Function>();

      executeOp("exists",
                jsToCbpp<couchbase::operations::exists_request>(optsJsObj),
                callbackJsFn);

      return info.Env().Null();
  }
  */
  const outCppFuncDefs = new FileWriter('Autogenerated Method Definitions')
  opReqTypes.forEach((x) => {
    const cppBaseOpName = getTsNiceName(x)
    const cppJsOpName = 'js' + uppercaseFirstLetter(cppBaseOpName)
    outCppFuncDefs.write(
      `Napi::Value Connection::${cppJsOpName}(const Napi::CallbackInfo &info)`
    )
    outCppFuncDefs.write(`{`)
    outCppFuncDefs.write(`    auto optsJsObj = info[0].As<Napi::Object>();`)
    outCppFuncDefs.write(
      `    auto callbackJsFn = info[1].As<Napi::Function>();`
    )
    outCppFuncDefs.write(``)
    outCppFuncDefs.write(`    executeOp("${cppBaseOpName}",`)
    if (x.endsWith('_with_legacy_durability')) {
      outCppFuncDefs.write(`              jsToCbpp<${x}>(optsJsObj),`)
    } else if (x.endsWith('>')) {
      const reqTokens = x.split('<')
      const cppReqName = reqTokens[0] + '_request<' + reqTokens[1]
      outCppFuncDefs.write(`              jsToCbpp<${cppReqName}>(optsJsObj),`)
    } else {
      outCppFuncDefs.write(`              jsToCbpp<${x}_request>(optsJsObj),`)
    }
    outCppFuncDefs.write(`              callbackJsFn);`)
    outCppFuncDefs.write(``)
    outCppFuncDefs.write(`    return info.Env().Null();`)
    outCppFuncDefs.write(`}`)
    outCppFuncDefs.write(``)
  })
  //await outCppFuncDefs.save('./out/cpp_func_defs.hxx')
  await outCppFuncDefs.saveToRegion('../src/connection_autogen.cpp')

  // InstanceMethod<&Connection::jsGet>("get"),
  const outCppFuncSpec = new FileWriter('Autogenerated Method Registration')
  opReqTypes.forEach((x) => {
    const cppBaseOpName = getTsNiceName(x)
    const cppJsOpName = 'js' + uppercaseFirstLetter(cppBaseOpName)
    outCppFuncSpec.write(
      `InstanceMethod<&Connection::${cppJsOpName}>("${cppBaseOpName}"),`
    )
  })
  //await outCppFuncSpec.save('./out/cpp_func_specs.hxx')
  await outCppFuncSpec.saveToRegion('../src/connection.cpp')

  /*
    exports.Set(
        "view_scan_consistency",
        cbppEnumToJs<
            couchbase::operations::document_view_request::scan_consistency>(
            env,
            {
                {"not_bounded", couchbase::operations::document_view_request::
                                    scan_consistency::not_bounded},
                {"update_after", couchbase::operations::document_view_request::
                                     scan_consistency::update_after},
                {"request_plus", couchbase::operations::document_view_request::
                                     scan_consistency::request_plus},
            }));
  */
  const outCppEnumDefs = new FileWriter('Autogenerated Constants')
  opsEnums.forEach((x) => {
    const jsPropName = getUnprefixedName(x.name)

    outCppEnumDefs.write(`exports.Set(`)
    outCppEnumDefs.write(`  "${jsPropName}",`)
    outCppEnumDefs.write(`  cbppEnumToJs<${x.name}>(`)
    outCppEnumDefs.write('    env, {')
    x.values.forEach((y) => {
      outCppEnumDefs.write(`      {"${y.name}", ${x.name}::${y.name}},`)
    })
    outCppEnumDefs.write(`    }));`)
    outCppEnumDefs.write(``)
  })
  await outCppEnumDefs.saveToRegion('../src/constants.cpp')
  //await outCppEnumDefs.save('./out/cpp_enum_defs.cpp')

  /*
  template <>
  struct js_to_cbpp_t<couchbase::operations::remove_response> {
      static inline couchbase::operations::remove_request
      from_js(Napi::Value jsVal)
      {
          auto jsObj = jsVal.ToObject();
          couchbase::operations::remove_request cppObj;
          js_to_cbpp(cppObj.cas, jsObj.Get("cas"));
          js_to_cbpp(cppObj.token, jsObj.Get("token"));
          return cppObj;
      }

      static inline Napi::Value
      to_js(Napi::Env env, const couchbase::operations::remove_response &cppObj)
      {
          auto resObj = Napi::Object::New(env);
          resObj.Set("cas", cbpp_to_js(env, cppObj.cas));
          resObj.Set("token", cbpp_to_js(env, cppObj.token));
          return resObj;
      }
  };
  */
  const outCppStructDefs = new FileWriter('Autogenerated Marshalling')
  opsStructs.forEach((st) => {
    outCppStructDefs.write(`template <>`)
    outCppStructDefs.write(`struct js_to_cbpp_t<${st.name}> {`)

    outCppStructDefs.write(`    static inline ${st.name}`)
    outCppStructDefs.write(`    from_js(Napi::Value jsVal)`)
    outCppStructDefs.write(`    {`)
    outCppStructDefs.write(`        auto jsObj = jsVal.ToObject();`)
    const variantFields = st.fields.filter((field) => {
      return (
        handleJsVariant.names.includes(st.name) &&
        handleJsVariant.fields.includes(field.name)
      )
    })
    variantFields.forEach((field) => {
      outCppStructDefs.write(
        `        auto ${field.name}_name = jsToCbpp<std::string>(jsObj.Get("${field.name}_name"));`
      )
      const ofTypes = field.type.of.filter((f) => !f.name.includes('monostate'))
      const includeMonostate = field.type.of.find((f) =>
        f.name.includes('monostate')
      )
      outCppStructDefs.write(
        `        std::variant<${
          includeMonostate ? 'std::monostate,' : ''
        }${ofTypes.map((x) => getCppType(x)).join(', ')}> ${field.name};`
      )
      for (let i = 0; i < ofTypes.length; i++) {
        if (i == field.type.of.length - 1) {
          outCppStructDefs.write(`        else {`)
        } else {
          const ifStatement = i > 0 ? 'else if(' : 'if('
          const nameTokens = ofTypes[i].name.split('::')
          outCppStructDefs.write(
            `        ${ifStatement} ${field.name}_name.compare("${
              nameTokens[nameTokens.length - 1]
            }") == 0 ) {`
          )
        }
        const cppType = ofTypes[i].name
        outCppStructDefs.write(
          `            ${field.name} = js_to_cbpp<${cppType}>(jsObj.Get("${field.name}_value"));`
        )
        outCppStructDefs.write(`        }`)
      }
      return
    })
    outCppStructDefs.write(`        ${st.name} cppObj;`)
    st.fields.forEach((field) => {
      if (isIgnoredField(st, field.name)) {
        outCppStructDefs.write(`        // ${field.name}`)
      } else if (
        handleJsVariant.names.includes(st.name) &&
        handleJsVariant.fields.includes(field.name)
      ) {
        outCppStructDefs.write(`        cppObj.${field.name} = ${field.name};`)
      } else {
        const fieldType = getCppType(field.type)
        outCppStructDefs.write(
          `        js_to_cbpp<${fieldType}>(cppObj.${field.name}, jsObj.Get("${field.name}"));`
        )
      }
    })
    outCppStructDefs.write(`        return cppObj;`)
    outCppStructDefs.write(`    }`)

    outCppStructDefs.write(`    static inline Napi::Value`)
    outCppStructDefs.write(`    to_js(Napi::Env env, const ${st.name} &cppObj)`)
    outCppStructDefs.write(`    {`)
    outCppStructDefs.write(`        auto resObj = Napi::Object::New(env);`)
    variantFields.forEach((field) => {
      const ofTypes = field.type.of.filter((f) => !f.name.includes('monostate'))
      for (let i = 0; i < ofTypes.length; i++) {
        const nameTokens = ofTypes[i].name.split('::')
        if (i == field.type.of.length - 1) {
          outCppStructDefs.write(`        else {`)
        } else {
          const ifStatement = i > 0 ? 'else if(' : 'if('
          outCppStructDefs.write(
            `        ${ifStatement} std::holds_alternative<${ofTypes[i].name}>(cppObj.${field.name})) {`
          )
        }
        outCppStructDefs.write(
          `            resObj.Set("${
            field.name
          }_name", cbpp_to_js<std::string>(env, "${
            nameTokens[nameTokens.length - 1]
          }"));`
        )
        outCppStructDefs.write(`        }`)
      }
      return
    })
    st.fields.forEach((field) => {
      if (isIgnoredField(st, field.name)) {
        outCppStructDefs.write(`        // ${field.name}`)
        return
      }
      let fieldName = field.name
      if (
        handleJsVariant.names.includes(st.name) &&
        handleJsVariant.fields.includes(field.name)
      ) {
        fieldName = `${fieldName}_value`
      }
      const fieldType = getCppType(field.type)
      outCppStructDefs.write(
        `        resObj.Set("${fieldName}", cbpp_to_js<${fieldType}>(env, cppObj.${field.name}));`
      )
    })
    outCppStructDefs.write(`        return resObj;`)
    outCppStructDefs.write(`    }`)

    outCppStructDefs.write(`};`)
    outCppStructDefs.write(``)
  })
  //await outCppStructDefs.save('./out/cpp_struct_defs.cpp')
  await outCppStructDefs.saveToRegion('../src/jstocbpp_autogen.hpp')
}

go()
  .then((res) => console.log('RES:', res))
  .catch((e) => console.error('ERR:', e))
