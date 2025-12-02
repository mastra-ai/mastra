# Based on the article from Cristian Adam
#
# Source: https://cristianadam.eu/20190501/bundling-together-static-libraries-with-cmake/
#
# Archived: https://archive.is/OcuwT

function(bundle_static_library tgt_name bundled_tgt_name)
  list(APPEND static_libs ${tgt_name})

  function(strip_build_interface input output)
    string(
      REGEX MATCH
            "\\$<BUILD_INTERFACE:([^>]+)>"
            _match
            "${input}")
    if(_match)
      string(
        REGEX
        REPLACE "\\$<BUILD_INTERFACE:([^>]+)>"
                "\\1"
                stripped
                "${input}")
      set(${output}
          "${stripped}"
          PARENT_SCOPE)
    else()
      set(${output}
          "${input}"
          PARENT_SCOPE)
    endif()
  endfunction()

  function(_recursively_collect_dependencies input_target)
    set(_input_link_libraries LINK_LIBRARIES)
    get_target_property(_input_type ${input_target} TYPE)
    if(${_input_type} STREQUAL "INTERFACE_LIBRARY")
      set(_input_link_libraries INTERFACE_LINK_LIBRARIES)
    endif()
    get_target_property(public_dependencies ${input_target} ${_input_link_libraries})
    foreach(candidate IN LISTS public_dependencies)
      strip_build_interface("${candidate}" dependency)
      if(TARGET ${dependency})
        get_target_property(alias ${dependency} ALIASED_TARGET)
        if(TARGET ${alias})
          set(dependency ${alias})
        endif()
        get_target_property(_type ${dependency} TYPE)
        if(${_type} STREQUAL "STATIC_LIBRARY")
          list(APPEND static_libs ${dependency})
        endif()

        get_property(library_already_added GLOBAL PROPERTY _${tgt_name}_static_bundle_${dependency})
        if(NOT library_already_added)
          set_property(GLOBAL PROPERTY _${tgt_name}_static_bundle_${dependency} ON)
          _recursively_collect_dependencies(${dependency})
        endif()
      endif()
    endforeach()
    set(static_libs
        ${static_libs}
        PARENT_SCOPE)
  endfunction()

  _recursively_collect_dependencies(${tgt_name})

  list(REMOVE_DUPLICATES static_libs)

  set(bundled_tgt_full_name
      ${CMAKE_BINARY_DIR}/${CMAKE_STATIC_LIBRARY_PREFIX}${bundled_tgt_name}${CMAKE_STATIC_LIBRARY_SUFFIX})

  if(CMAKE_CXX_COMPILER_ID MATCHES "^(Clang|GNU)$")
    file(WRITE ${CMAKE_BINARY_DIR}/${bundled_tgt_name}.ar.in "CREATE ${bundled_tgt_full_name}\n")

    foreach(tgt IN LISTS static_libs)
      file(APPEND ${CMAKE_BINARY_DIR}/${bundled_tgt_name}.ar.in "ADDLIB $<TARGET_FILE:${tgt}>\n")
    endforeach()

    file(APPEND ${CMAKE_BINARY_DIR}/${bundled_tgt_name}.ar.in "SAVE\n")
    file(APPEND ${CMAKE_BINARY_DIR}/${bundled_tgt_name}.ar.in "END\n")

    file(
      GENERATE
      OUTPUT ${CMAKE_BINARY_DIR}/${bundled_tgt_name}.ar
      INPUT ${CMAKE_BINARY_DIR}/${bundled_tgt_name}.ar.in)

    set(ar_tool ${CMAKE_AR})
    if(CMAKE_INTERPROCEDURAL_OPTIMIZATION)
      set(ar_tool ${CMAKE_CXX_COMPILER_AR})
    endif()

    add_custom_command(
      COMMAND ${ar_tool} -M < ${CMAKE_BINARY_DIR}/${bundled_tgt_name}.ar
      OUTPUT ${bundled_tgt_full_name}
      DEPENDS ${tgt_name} ${static_libs}
      COMMENT "Bundling ${bundled_tgt_name}"
      VERBATIM)
  elseif(CMAKE_CXX_COMPILER_ID STREQUAL "AppleClang")
    find_program(find NAMES find REQUIRED)

    set(AR_EXTRACT_DIR "${CMAKE_CURRENT_BINARY_DIR}/tmp_ar_extract")
    set(EXTRACT_COMMANDS "")
    foreach(tgt IN LISTS static_libs)
      list(
        APPEND EXTRACT_COMMANDS
        COMMAND ${CMAKE_COMMAND} -E make_directory ${AR_EXTRACT_DIR}/${tgt}
        COMMAND ${CMAKE_COMMAND} -E chdir ${AR_EXTRACT_DIR}/${tgt} ${CMAKE_AR} -x $<TARGET_FILE:${tgt}>)
    endforeach()

    add_custom_command(
      OUTPUT ${bundled_tgt_full_name}
      COMMAND ${CMAKE_COMMAND} -E rm -rf ${AR_EXTRACT_DIR}
      COMMAND ${CMAKE_COMMAND} -E make_directory ${AR_EXTRACT_DIR} ${EXTRACT_COMMANDS}
      COMMAND ${find} ${AR_EXTRACT_DIR} -name *.o -exec ${CMAKE_AR} -rcs ${bundled_tgt_full_name} {} +
      COMMAND ${CMAKE_AR} -s ${bundled_tgt_full_name}
      COMMAND ${CMAKE_COMMAND} -E rm -rf ${AR_EXTRACT_DIR}
      DEPENDS ${tgt_name} ${static_libs}
      COMMENT "Bundling ${bundled_tgt_name}"
      VERBATIM)
  elseif(MSVC)
    get_filename_component(LINKER_DIR "${CMAKE_LINKER}" DIRECTORY)
    find_program(
      lib_tool
      NAMES lib
      HINTS "${LINKER_DIR}" REQUIRED)

    foreach(tgt IN LISTS static_libs)
      list(APPEND static_libs_full_names $<TARGET_FILE:${tgt}>)
    endforeach()

    add_custom_command(
      COMMAND ${lib_tool} /NOLOGO /OUT:${bundled_tgt_full_name} ${static_libs_full_names}
      OUTPUT ${bundled_tgt_full_name}
      DEPENDS ${tgt_name} ${static_libs}
      COMMENT "Bundling ${bundled_tgt_name}"
      VERBATIM)
  else()
    message(FATAL_ERROR "Unknown bundle scenario: CMAKE_CXX_COMPILER_ID=${CMAKE_CXX_COMPILER_ID}, MSVC=${MSVC}!")
  endif()

  add_custom_target(bundling_target ALL DEPENDS ${bundled_tgt_full_name})
  add_dependencies(bundling_target ${tgt_name})

  add_library(${bundled_tgt_name} STATIC IMPORTED)
  set_target_properties(
    ${bundled_tgt_name}
    PROPERTIES IMPORTED_LOCATION ${bundled_tgt_full_name} INTERFACE_INCLUDE_DIRECTORIES
                                                          $<TARGET_PROPERTY:${tgt_name},INTERFACE_INCLUDE_DIRECTORIES>)
  add_dependencies(${bundled_tgt_name} bundling_target)
endfunction()
