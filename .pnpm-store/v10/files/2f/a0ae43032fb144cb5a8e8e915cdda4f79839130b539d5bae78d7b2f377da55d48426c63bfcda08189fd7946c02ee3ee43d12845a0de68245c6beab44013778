#  Copyright 2016-2024. Couchbase, Inc.
#  All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import json
import os
import pathlib
import re
import subprocess
import sys

from functools import reduce
from typing import (Dict, List, Optional, Tuple)

import clang.cindex

# START CONFIGURATION

CXX_CLIENT_ROOT = os.path.join(pathlib.Path(__file__).parent.parent, 'deps', 'couchbase-cxx-client')
CXX_CLIENT_CACHE = os.path.join(pathlib.Path(__file__).parent.parent, 'deps', 'couchbase-cxx-cache')

CXX_DEPS_INCLUDE_PATHS = {
    'asio': ['-I{0}/asio/{1}/asio/asio/include'],
    'gsl': ['-I{0}/gsl/{1}/gsl/include'],
    'json': ['-I{0}/json/{1}/json/include',
             '-I{0}/json/{1}/json/external/PEGTL/include'
             ],
    'spdlog': ['-I{0}/spdlog/{1}/spdlog/include'],
}

FILE_LIST = [
    "core/management/analytics_dataset.hxx",
    "core/management/analytics_index.hxx",
    "core/management/analytics_link_azure_blob_external.hxx",
    "core/management/analytics_link_couchbase_remote.hxx",
    "core/management/analytics_link_s3_external.hxx",
    "core/management/bucket_settings.hxx",
    "core/management/design_document.hxx",
    "core/management/eventing_function.hxx",
    "core/management/eventing_status.hxx",
    "core/management/rbac.hxx",
    "core/management/search_index.hxx",
    "couchbase/management/query_index.hxx",
    "couchbase/retry_reason.hxx",
    "core/topology/collections_manifest.hxx",
    "core/protocol/client_opcode.hxx",
    "core/protocol/cmd_lookup_in.hxx",
    "core/protocol/cmd_mutate_in.hxx",
    "core/protocol/status.hxx",
    "core/analytics_scan_consistency.hxx",
    "core/design_document_namespace.hxx",
    "core/diagnostics.hxx",
    "core/document_id.hxx",
    "core/json_string.hxx",
    "couchbase/query_profile.hxx",
    "couchbase/query_scan_consistency.hxx",
    "core/search_highlight_style.hxx",
    "core/search_scan_consistency.hxx",
    "core/service_type.hxx",
    "core/view_on_error.hxx",
    "core/view_scan_consistency.hxx",
    "core/view_sort_order.hxx",
    "core/operations/*",
    "core/operations/management/*",
    "couchbase/durability_level.hxx",
    "couchbase/cas.hxx",
    "couchbase/error_codes.hxx",
    "couchbase/mutation_token.hxx",
    "core/error_context/key_value_status_code.hxx",
    "core/impl/subdoc/opcode.hxx",
    "core/impl/subdoc/command.hxx",
    "couchbase/store_semantics.hxx",
    "couchbase/persist_to.hxx",
    "couchbase/replicate_to.hxx",
    "couchbase/read_preference.hxx",
    "core/range_scan_options.hxx",
    "core/range_scan_orchestrator_options.hxx",
    "core/query_context.hxx",
    "core/vector_query_combination.hxx",
    "core/transactions/exceptions.hxx",
    "core/transactions/transaction_get_multi_mode.hxx",
    "core/transactions/transaction_get_multi_replicas_from_preferred_server_group_mode.hxx"
]

TYPE_LIST = [
    "couchbase::core::management::analytics::dataset",
    "couchbase::core::management::analytics::index",
    "couchbase::core::management::analytics::azure_blob_external_link",
    "couchbase::core::management::analytics::couchbase_link_encryption_level",
    "couchbase::core::management::analytics::couchbase_link_encryption_settings",
    "couchbase::core::management::analytics::couchbase_remote_link",
    "couchbase::core::management::analytics::s3_external_link",
    "couchbase::core::management::cluster::bucket_settings",
    "couchbase::core::management::cluster::bucket_type",
    "couchbase::core::management::cluster::bucket_compression",
    "couchbase::core::management::cluster::bucket_eviction_policy",
    "couchbase::core::management::cluster::bucket_conflict_resolution",
    "couchbase::core::management::cluster::bucket_storage_backend",
    "couchbase::core::management::views::design_document",
    "couchbase::core::management::eventing::function",
    "couchbase::core::management::eventing::status",
    "couchbase::core::management::rbac::role",
    "couchbase::core::management::rbac::role_and_description",
    "couchbase::core::management::rbac::origin",
    "couchbase::core::management::rbac::role_and_origins",
    "couchbase::core::management::rbac::user",
    "couchbase::core::management::rbac::auth_domain",
    "couchbase::core::management::rbac::user_and_metadata",
    "couchbase::core::management::rbac::group",
    "couchbase::core::management::search::index",
    "couchbase::management::query_index",
    "couchbase::retry_reason",
    "couchbase::core::topology::collections_manifest",
    "couchbase::core::protocol::status",
    "couchbase::core::protocol::subdoc_opcode",
    "couchbase::core::protocol::lookup_in_request_body::lookup_in_specs",
    "couchbase::core::protocol::mutate_in_request_body::mutate_in_specs",
    "couchbase::core::protocol::mutate_in_request_body::store_semantics_type",
    "couchbase::durability_level",
    "couchbase::errc::common",
    "couchbase::errc::key_value",
    "couchbase::errc::query",
    "couchbase::errc::analytics",
    "couchbase::errc::search",
    "couchbase::errc::view",
    "couchbase::errc::management",
    "couchbase::errc::field_level_encryption",
    "couchbase::errc::network",
    "couchbase::core::analytics_scan_consistency",
    "couchbase::cas",
    "couchbase::core::design_document_namespace",
    "couchbase::core::diag::cluster_state",
    "couchbase::core::diag::endpoint_state",
    "couchbase::core::diag::endpoint_diag_info",
    "couchbase::core::diag::diagnostics_result",
    "couchbase::core::diag::ping_state",
    "couchbase::core::diag::endpoint_ping_info",
    "couchbase::core::diag::ping_result",
    "couchbase::core::document_id",
    "couchbase::core::json_string",
    "couchbase::mutation_token",
    "couchbase::query_profile",
    "couchbase::query_scan_consistency",
    "couchbase::core::search_highlight_style",
    "couchbase::core::search_scan_consistency",
    "couchbase::core::service_type",
    "couchbase::core::view_on_error",
    "couchbase::core::view_scan_consistency",
    "couchbase::core::view_sort_order",
    "couchbase::core::operations::*",
    "couchbase::core::operations::management::*",
    "couchbase::core::tracing::request_span",
    "couchbase::core::key_value_status_code",
    "couchbase::core::impl::subdoc::command",
    "couchbase::core::impl::subdoc::opcode",
    "couchbase::store_semantics",
    "couchbase::persist_to",
    "couchbase::replicate_to",
    "couchbase::core::range_scan_create_options",
    "couchbase::core::range_scan_continue_options",
    "couchbase::core::range_scan_cancel_options",
    "couchbase::core::range_scan_orchestrator_options",
    "couchbase::core::mutation_state",
    "couchbase::core::scan_term",
    "couchbase::core::scan_sort",
    "couchbase::core::range_scan",
    "couchbase::core::prefix_scan",
    "couchbase::core::sampling_scan",
    "couchbase::core::range_snapshot_requirements",
    "couchbase::core::range_scan_item_body",
    "couchbase::core::range_scan_item",
    "couchbase::core::range_scan_create_result",
    "couchbase::core::range_scan_continue_result",
    "couchbase::core::range_scan_cancel_result",
    "couchbase::core::query_context",
    "couchbase::core::vector_query_combination",
    "couchbase::read_preference",
    "couchbase::core::transactions::failure_type",
    "couchbase::core::transactions::external_exception",
    "couchbase::core::transactions::transaction_get_multi_mode",
    "couchbase::core::transactions::transaction_get_multi_replicas_from_preferred_server_group_mode",
]

STD_COMPARATOR_TEMPLATES = ["std::less<{0}>", "std::greater<{0}>", "std::less_equal<{0}>", "std::greater_equal<{0}>"]
# flatten the list of lists
STD_COMPARATORS = list(reduce(lambda a, b: a + b,
                              list(map(lambda c: [c.format(s) for s in ['', 'void']], STD_COMPARATOR_TEMPLATES)),
                              []))

INTERNAL_STRUCTS = []
UNNAMED_STRUCT_DELIM = '::(unnamed struct'

# IMPORTANT: the templates must exist in the TYPE_LIST
TEMPLATED_REQUESTS = {
    'analytics_link_create_request': {
        'template_name': 'analytics_link_type',
        'templates': ['couchbase::core::management::analytics::azure_blob_external_link',
                      'couchbase::core::management::analytics::couchbase_remote_link',
                      'couchbase::core::management::analytics::s3_external_link']
    },
    'analytics_link_replace_request': {
        'template_name': 'analytics_link_type',
        'templates': ['couchbase::core::management::analytics::azure_blob_external_link',
                      'couchbase::core::management::analytics::couchbase_remote_link',
                      'couchbase::core::management::analytics::s3_external_link']
    },
}

# END - CONFIGURATION


class BindingsGenerator:

    def __init__(self,
                 llvm_clang_version: Optional[str] = None,
                 llvm_libdir: Optional[str] = None,
                 llvm_includedir: Optional[str] = None,
                 system_headers: Optional[str] = None,
                 verbose: Optional[bool] = False) -> None:
        self._op_types = []
        self._op_enums = []
        self._full_file_list = []
        # generate a list of regexps from the type list (for handling wildcards)
        self._type_list_re = list(map(lambda x: x.replace("*", "(.*)") + "(.*)", TYPE_LIST))
        self._verbose = verbose
        self.configure_generator(llvm_clang_version, llvm_libdir, llvm_includedir, system_headers)

    def configure_generator(self,
                            version: Optional[str] = None,
                            libdir: Optional[str] = None,
                            includedir: Optional[str] = None,
                            system_headers: Optional[str] = None) -> None:
        if version is None:
            version = os.environ.get('CN_LLVM_VERSION')
        if version is None:
            BindingsGenerator.find_llvm()
            version = BindingsGenerator.get_llvm_version()
        if version is None:
            raise ValueError('Missing LLVM version.')

        print(f'Using version={version}')
        llvm_root_dir = f'/opt/homebrew/Cellar/llvm/{version}'
        if not os.path.exists(llvm_root_dir):
            print(f'LLVM root directory ({llvm_root_dir}) does not exist. Attempting to find it.')
            llvm_root_dir = None
            for d in os.listdir(f'/opt/homebrew/Cellar/llvm'):
                if d.startswith(version):
                    llvm_root_dir = os.path.join('/opt/homebrew/Cellar/llvm', d)
                    print(f'Found LLVM root directory: {llvm_root_dir}')
                    break
            if llvm_root_dir is None:
                raise ValueError((f'Unable to find LLVM root directory for version {version}.'
                                  'Please use CN_LLVM_VERSION to override.'))

        if includedir is None:
            includedir = os.environ.get('CN_LLVM_INCLUDE')
        if includedir is None:
            includedir = BindingsGenerator.get_llvm_includedir()
        if includedir is None:
            raise ValueError('Missing LLVM include directory.')

        if libdir is None:
            libdir = os.environ.get('CN_LLVM_LIB')
        if libdir is None:
            libdir = BindingsGenerator.get_llvm_libdir()
        if libdir is None:
            raise ValueError('Missing LLVM lib directory.')

        if system_headers is None:
            system_headers = os.environ.get('CN_SYS_HEADERS')
        if system_headers is None:
            system_headers = BindingsGenerator.get_system_headers()
        if system_headers is None:
            raise ValueError('Missing system headers path.')

        if self._verbose:
            print(f'Using libdir={libdir}')
        clang.cindex.Config.set_library_path(libdir)

        self._include_paths = [
            '-I/opt/homebrew/opt/llvm/include/c++/v1',
            f'-I{CXX_CLIENT_ROOT}/',
            f'-I{llvm_root_dir}/lib/clang/{version[:2]}/include',
            f'-I{system_headers}/usr/include'
        ]

        for dep, inc in CXX_DEPS_INCLUDE_PATHS.items():
            self._include_paths.extend(BindingsGenerator.set_cxx_deps_include_paths(dep, inc))

        if self._verbose:
            print(f'Include paths={self._include_paths}')

        self.set_file_list()

    def gen_bindings(self) -> None:

        for headerPath in self._full_file_list:
            print("processing " + headerPath)
            index = clang.cindex.Index.create()
            if self._verbose is True:
                args = ['-std=c++17', '-v', f'-isysroot{os.getcwd()}'] + self._include_paths
            else:
                args = ['-std=c++17', f'-isysroot{os.getcwd()}'] + self._include_paths
            translation_unit = index.parse(headerPath, args=args)

            # output clang compiler diagnostics information (for debugging)
            if 1:
                for diagnostic in translation_unit.diagnostics:
                    diagnosticMsg = diagnostic.format()
                    print(diagnostic)

            self.traverse(translation_unit.cursor, [], headerPath)

        jsonData = json.dumps({
            'op_structs': self._op_types,
            'op_enums': self._op_enums
        })

        f = open("bindings.json", "w")
        f.write(jsonData)
        f.close()

    def set_file_list(self) -> None:
        for file_path in FILE_LIST:
            if "*" in file_path:
                # wildcard path
                basePath = file_path[:-1]
                if "*" in basePath:
                    # if there is still a wildcard, we have an issue...
                    raise NotImplementedError(
                        "wildcard only supported at end of file path")
                if basePath[-1] != os.path.sep:
                    tokens = basePath.split(os.path.sep)
                    # filter = tokens[-1]
                    files = BindingsGenerator.list_headers_in_dir(os.path.join(CXX_CLIENT_ROOT, *tokens[:-1]),
                                                                  tokens[-1])
                else:
                    files = BindingsGenerator.list_headers_in_dir(os.path.join(CXX_CLIENT_ROOT, basePath))
                self._full_file_list = self._full_file_list + files
            else:
                # normal path
                self._full_file_list.append(os.path.join(CXX_CLIENT_ROOT, file_path))

        # exclude _json.hxx files
        self._full_file_list = list(filter(lambda x: not x.endswith('_json.hxx'), self._full_file_list))
        # exclude _fmt.hxx files
        self._full_file_list = list(filter(lambda x: not x.endswith('_fmt.hxx'), self._full_file_list))

    def traverse(self, node, namespace, main_file) -> None:
        # only scan the elements of the file we parsed
        if node.location.file is not None and node.location.file.name != main_file:
            return

        if node.kind == clang.cindex.CursorKind.STRUCT_DECL or node.kind == clang.cindex.CursorKind.CLASS_DECL:
            full_struct_name = "::".join([*namespace, node.displayname])
            if full_struct_name.endswith('::') or UNNAMED_STRUCT_DELIM in full_struct_name:
                if full_struct_name.endswith('::'):
                    struct_name = full_struct_name
                else:
                    struct_name = full_struct_name.split(UNNAMED_STRUCT_DELIM)[0]
                match = next((s for s in INTERNAL_STRUCTS if struct_name in s), None)
                if match:
                    full_struct_name = match

            if (BindingsGenerator.is_included_type(full_struct_name, self._type_list_re)
                    or full_struct_name in INTERNAL_STRUCTS):
                struct_fields = []
                parents = []
                for child in node.get_children():
                    if child.kind == clang.cindex.CursorKind.FIELD_DECL:
                        struct_type = BindingsGenerator.parse_type(child.type)
                        type_str = child.type.get_canonical().spelling
                        if 'unnamed' in type_str:
                            name_tokens = type_str.split('::')
                            name_override = '::'.join(name_tokens[:-1] + [child.displayname])
                            struct_type['name'] = name_override
                            INTERNAL_STRUCTS.append(name_override)

                        struct_fields.append({
                            "name": child.displayname,
                            "type": struct_type,
                        })
                    elif child.kind == clang.cindex.CursorKind.CXX_BASE_SPECIFIER:
                        parents.append("::".join([*namespace, child.displayname]))

                if len(parents) > 0:
                    part_op_types = [ot for ot in self._op_types if ot['name'] in parents]
                    print(f'{part_op_types=}')
                    for sot in part_op_types:
                        struct_fields.extend(sot['fields'])

                # replica read changes introduced duplicate get requests
                if any(map(lambda op: op['name'] == full_struct_name, self._op_types)):
                    return

                self._op_types.append({
                    "name": full_struct_name,
                    "fields": struct_fields,
                })
        if node.kind == clang.cindex.CursorKind.TYPE_ALIAS_DECL:
            full_struct_name = "::".join([*namespace, node.displayname])
            if BindingsGenerator.is_included_type(full_struct_name, self._type_list_re, with_durability=True):
                type_ref = next((c for c in node.get_children() if c.kind == clang.cindex.CursorKind.TYPE_REF), None)
                if type_ref:
                    base_request_name = type_ref.displayname.replace('struct', '').strip()
                    base_request = next((op for op in self._op_types if op['name'] == base_request_name), None)
                    if base_request:
                        new_fields = [f for f in base_request['fields'] if f['name'] != 'durability_level']
                        new_fields.extend([
                            {"name": "persist_to", "type": {"name": "couchbase::persist_to"}},
                            {"name": "replicate_to", "type": {"name": "couchbase::replicate_to"}}
                        ])

                        self._op_types.append({
                            "name": full_struct_name,
                            "fields": new_fields
                        })
        if node.kind == clang.cindex.CursorKind.ENUM_DECL:
            full_enum_name = "::".join([*namespace, node.displayname])
            if BindingsGenerator.is_included_type(full_enum_name, self._type_list_re):
                enumValues = []

                for child in node.get_children():
                    if child.kind == clang.cindex.CursorKind.ENUM_CONSTANT_DECL:
                        enumValues.append({
                            "name": child.displayname,
                            "value": child.enum_value,
                        })
                self._op_enums.append({
                    "name": full_enum_name,
                    "type": BindingsGenerator.parse_type(node.enum_type),
                    "values": enumValues,
                })

        if node.kind == clang.cindex.CursorKind.NAMESPACE:
            namespace = [*namespace, node.displayname]
        if node.kind == clang.cindex.CursorKind.CLASS_DECL:
            namespace = [*namespace, node.displayname]
        if node.kind == clang.cindex.CursorKind.STRUCT_DECL:
            namespace = [*namespace, node.displayname]
        if node.kind == clang.cindex.CursorKind.CLASS_TEMPLATE:
            name_tokens = node.displayname.split('<')
            if len(name_tokens) == 2 and name_tokens[0] in TEMPLATED_REQUESTS:
                req = TEMPLATED_REQUESTS.get(name_tokens[0])
                full_struct_name = "::".join([*namespace, node.displayname])
                for template in req['templates']:
                    struct_fields = []
                    for child in node.get_children():
                        if child.kind == clang.cindex.CursorKind.FIELD_DECL:
                            type_str = child.type.get_canonical().spelling
                            if 'type-parameter' in type_str:
                                struct_type = {
                                    'name': 'template',
                                    'of': {'name': template}}
                            else:
                                struct_type = BindingsGenerator.parse_type(child.type)
                            # print(f'struct_type={child.type}; type.kind={child.type.kind}; {type_str=}, displayname={child.displayname}')
                            struct_fields.append({
                                "name": child.displayname,
                                "type": struct_type,
                            })
                    self._op_types.append({
                        "name": full_struct_name.replace(req['template_name'], template),
                        "fields": struct_fields,
                    })
                # return

        for child in node.get_children():
            self.traverse(child, namespace, main_file)

    @staticmethod
    def set_cxx_deps_include_paths(dep, includes):
        cpm_path = os.path.join(CXX_CLIENT_CACHE, dep)
        dir_pattern = r'[0-9a-z]{40}'
        cpm_hash_dir = next((d for d in os.listdir(cpm_path)
                            if os.path.isdir(os.path.join(cpm_path, d)) and re.match(dir_pattern, d)),
                            None)
        if not cpm_hash_dir:
            raise Exception(f'Unable to find CPM hash directory for path: {cpm_path}.')
        return list(map(lambda p: p.format(CXX_CLIENT_CACHE, cpm_hash_dir), includes))

    @staticmethod
    def list_headers_in_dir(path: str, file_startswith: Optional[str] = None) -> List[str]:
        # enumerates a folder but keeps the full pathing for the files returned
        # and removes certain files we don't want (like non-hxx, _json.hxx or _fmt.hxx)

        # list all the files in the folder
        files = os.listdir(path)

        if file_startswith is not None:
            files = list(filter(lambda f: f.endswith('.hxx') and f.startswith(file_startswith), files))
            # add the folder path back on
            files = list(map(lambda f: os.path.join(path, f), files))
        else:
            # only include .hxx files
            files = list(filter(lambda f: f.endswith('.hxx'), files))
            # add the folder path back on
            files = list(map(lambda f: path + f, files))
        return files

    @staticmethod
    def is_included_type(name: str, type_list_re: List[str], with_durability: Optional[bool] = False) -> bool:

        # TODO(brett19): This should be generalized somehow...
        if "is_compound_operation" in name:
            return False

        if "replica_context" in name:
            return False

        if with_durability is True and '_with_legacy_durability' not in name:
            return False

        for x in type_list_re:
            if re.fullmatch(x, name):
                return True
        return False

    @staticmethod
    def parse_type(type_: str) -> Dict[str, str]:
        type_str = type_.get_canonical().spelling
        return BindingsGenerator.parse_type_str(type_str)

    @staticmethod
    def parse_type_str(type_str: str) -> Dict[str, str]:
        if type_str == "std::mutex":
            return {"name": "std::mutex"}
        if type_str == "std::string":
            return {"name": "std::string"}
        if type_str == "std::chrono::duration<long long>":
            return {"name": "std::chrono::seconds"}
        if type_str == "std::chrono::duration<long long, std::ratio<1, 1000>>":
            return {"name": "std::chrono::milliseconds"}
        if type_str == "std::chrono::duration<long long, std::ratio<1, 1000000>>":
            return {"name": "std::chrono::microseconds"}
        if type_str == "std::chrono::duration<long long, std::ratio<1, 1000000000>>":
            return {"name": "std::chrono::nanoseconds"}
        if type_str == "std::error_code":
            return {"name": "std::error_code"}
        if type_str == "std::monostate":
            return {"name": "std::monostate"}
        if type_str == "std::byte":
            return {"name": "std::byte"}
        if type_str == "unsigned long":
            return {"name": "std::size_t"}
        if type_str == "char":
            return {"name": "std::int8_t"}
        if type_str == "unsigned char":
            return {"name": "std::uint8_t"}
        if type_str == "short":
            return {"name": "std::int16_t"}
        if type_str == "unsigned short":
            return {"name": "std::uint16_t"}
        if type_str == "int":
            return {"name": "std::int32_t"}
        if type_str == "unsigned int":
            return {"name": "std::uint32_t"}
        if type_str == "long long":
            return {"name": "std::int64_t"}
        if type_str == "unsigned long long":
            return {"name": "std::uint64_t"}
        if type_str == "bool":
            return {"name": "std::bool"}
        if type_str == "float":
            return {"name": "std::float"}
        if type_str == "double":
            return {"name": "std::double"}
        if type_str == "std::nullptr_t":
            return {"name": "std::nullptr_t"}
        if type_str in STD_COMPARATORS:
            if 'void' in type_str:
                return {"name": type_str.replace("void", "")}
            return {"name": type_str}

        tplParts = type_str.split("<", 1)
        if len(tplParts) > 1:
            tplClassName = tplParts[0]
            tplParams = tplParts[1][:-1]
            if tplClassName == "std::function":
                return {
                    "name": "std::function"
                }
            if tplClassName == "std::optional":
                return {
                    "name": "std::optional",
                    "of": BindingsGenerator.parse_type_str(tplParams)
                }
            if tplClassName == "std::vector":
                return {
                    "name": "std::vector",
                    "of": BindingsGenerator.parse_type_str(tplParams)
                }
            if tplClassName == "std::set":
                return {
                    "name": "std::set",
                    "of": BindingsGenerator. parse_type_str(tplParams)
                }
            if tplClassName == "std::variant":
                variantParts = tplParams.split(", ")
                variantTypes = []
                for variantPart in variantParts:
                    variantTypes.append(BindingsGenerator.parse_type_str(variantPart))
                return {
                    "name": "std::variant",
                    "of": variantTypes
                }
            if tplClassName == "std::array":
                variantParts = tplParams.split(", ")
                if len(variantParts) != 2:
                    print("FAILED TO PARSE ARRAY TYPES: " + type_str)
                    return {"name": "unknown", "str": type_str}
                return {
                    "name": "std::array",
                    "of": BindingsGenerator.parse_type_str(variantParts[0]),
                    "size": int(variantParts[1])
                }
            if tplClassName == "std::map":
                variantParts = tplParams.split(", ")
                if len(variantParts) < 2 or len(variantParts) > 3:
                    print("FAILED TO PARSE MAP TYPES: " + type_str)
                    return {"name": "unknown", "str": type_str}

                if len(variantParts) == 2:
                    return {
                        "name": "std::map",
                        "of": BindingsGenerator.parse_type_str(variantParts[0]),
                        "to": BindingsGenerator.parse_type_str(variantParts[1])
                    }
                else:
                    return {
                        "name": "std::map",
                        "of": BindingsGenerator.parse_type_str(variantParts[0]),
                        "to": BindingsGenerator.parse_type_str(variantParts[1]),
                        "comparator": BindingsGenerator.parse_type_str(variantParts[2])
                    }

            if tplClassName == "std::shared_ptr":
                return {
                    "name": "std::shared_ptr",
                    "of": BindingsGenerator.parse_type_str(tplParams)
                }

        if not type_str.startswith("couchbase::"):
            print("FAILED TO PARSE STRING TYPE: " + type_str)
            return {"name": "unknown", "str": type_str}

        if 'unnamed struct' in type_str:
            print("WARNING:  Found unnamed struct: " + type_str)

        return {"name": type_str}

    @staticmethod
    def sh(command: str, piped: Optional[bool] = False) -> Tuple[str, int]:
        try:
            if piped is True:
                proc = subprocess.Popen(command,
                                        stdin=subprocess.PIPE,
                                        stdout=subprocess.PIPE,
                                        stderr=subprocess.PIPE,
                                        shell=True)
            else:
                proc = subprocess.Popen(command,
                                        stdout=subprocess.PIPE,
                                        stderr=subprocess.PIPE,
                                        shell=True)
            stdout, stderr = proc.communicate()
            stderr = stderr.decode('utf-8')
            if stderr != '':
                return stderr, 1
            return stdout.decode('utf-8'), 0
        except FileNotFoundError:
            return "Error: Command not found.", 1

    @staticmethod
    def find_llvm() -> None:
        if sys.platform == 'darwin':
            output, err = BindingsGenerator.sh('which clang')
            if err:
                raise Exception(f'Unable to determine clang binary. Error code: {err}.')
            if 'llvm' not in output.strip():
                # TODO: aarch64 v. x86_64
                os_path = os.environ.get('PATH').split(':')
                os_path = ['/opt/homebrew/opt/llvm/bin'] + os_path
                os.environ.update(**{'PATH': ':'.join(os_path)})
            output, err = BindingsGenerator.sh('which clang')
            if err:
                raise Exception(f'Unable to determine clang binary. Error code: {err}.')
            if 'llvm' not in output.strip():
                raise Exception('Unable to set LLVM as default.')
        elif sys.platform == 'linux':
            print('Under construction')
        else:
            raise ValueError('Unsupported platform')

    @staticmethod
    def get_llvm_version() -> str:
        output, err = BindingsGenerator.sh('llvm-config --version')
        if err:
            raise Exception(f'Unable to determine LLVM version. Error code: {err}')
        return output.strip()

    @staticmethod
    def get_llvm_includedir() -> str:
        output, err = BindingsGenerator.sh('llvm-config --includedir')
        if err:
            raise Exception(f'Unable to determine LLVM includedir. Error code: {err}')
        return output.strip()

    @staticmethod
    def get_llvm_libdir() -> str:
        output, err = BindingsGenerator.sh('llvm-config --libdir')
        if err:
            raise Exception(f'Unable to determine LLVM libdir. Error code: {err}')
        return output.strip()

    @staticmethod
    def get_system_headers() -> str:
        if sys.platform == 'darwin':
            output, err = BindingsGenerator.sh('xcrun --show-sdk-path')
            if err:
                raise Exception(f'Unable to determine system header path. Error code: {err}.')
            return output.strip()
        elif sys.platform == 'linux':
            print('Under construction')
        else:
            raise ValueError('Unsupported platform')


if __name__ == '__main__':
    from argparse import ArgumentParser
    ap = ArgumentParser(description='Parse git version to PEP-440 version')
    ap.add_argument('-v',
                    '--version',
                    help='Set CN_LLVM_VERSION, or use command: llvm-config --version')
    ap.add_argument('-i',
                    '--includedir',
                    help='Set CN_LLVM_INCLUDE, or use command: llvm-config --includedir')
    ap.add_argument('-l',
                    '--libdir',
                    help='Set CN_LLVM_LIB, or use command: llvm-config --libdir')
    ap.add_argument('-s',
                    '--system-headers',
                    help='SET CN_SYS_HEADERS, or use command: xcrun --show-sdk-path')
    ap.add_argument('--verbose',
                    action='store_true',
                    help='Run in verbose mode',)
    options = ap.parse_args()

    generator = BindingsGenerator(options.version,
                                  options.libdir,
                                  options.includedir,
                                  options.system_headers,
                                  options.verbose)
    generator.gen_bindings()


"""

https://github.com/llvm/llvm-project/issues/86009

"""
