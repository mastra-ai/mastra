include(GNUInstallDirs)
include(CMakePackageConfigHelpers)

install(DIRECTORY ${PROJECT_SOURCE_DIR}/couchbase DESTINATION ${CMAKE_INSTALL_INCLUDEDIR})
install(FILES LICENSE.txt DESTINATION ${CMAKE_INSTALL_DOCDIR})

set(COUCHBASE_CXX_CLIENT_PKGCONFIG_VERSION
    "${COUCHBASE_CXX_CLIENT_SEMVER}"
    CACHE STRING "The version to use in couchbase_cxx_client.pc")

write_basic_package_version_file(
  couchbase_cxx_client-version.cmake
  VERSION ${couchbase_cxx_client_VERSION}
  COMPATIBILITY SameMinorVersion)
install(FILES ${PROJECT_BINARY_DIR}/couchbase_cxx_client-version.cmake
        DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/couchbase_cxx_client)

if(COUCHBASE_CXX_CLIENT_BUILD_TOOLS)
  install(TARGETS cbc RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})
endif()

if(COUCHBASE_CXX_CLIENT_BUILD_STATIC)
  get_target_property(couchbase_cxx_client_static_IMPORTED_LOCATION couchbase_cxx_client_static IMPORTED_LOCATION)

  configure_package_config_file(
    ${PROJECT_SOURCE_DIR}/cmake/couchbase_cxx_client_static-config.cmake.in
    ${PROJECT_BINARY_DIR}/couchbase_cxx_client_static-config.cmake
    INSTALL_DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/couchbase_cxx_client_static)
  install(FILES ${PROJECT_BINARY_DIR}/couchbase_cxx_client_static-config.cmake
          DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/couchbase_cxx_client_static)

  configure_file(${PROJECT_SOURCE_DIR}/cmake/couchbase_cxx_client_static.pc.in
                 ${PROJECT_BINARY_DIR}/packaging/couchbase_cxx_client_static.pc @ONLY)
  install(FILES ${PROJECT_BINARY_DIR}/packaging/couchbase_cxx_client_static.pc
          DESTINATION ${CMAKE_INSTALL_LIBDIR}/pkgconfig)

  install(FILES ${couchbase_cxx_client_static_IMPORTED_LOCATION} DESTINATION ${CMAKE_INSTALL_LIBDIR})
endif()

if(COUCHBASE_CXX_CLIENT_BUILD_SHARED)
  configure_file(${PROJECT_SOURCE_DIR}/cmake/couchbase_cxx_client.pc.in
                 ${PROJECT_BINARY_DIR}/packaging/couchbase_cxx_client.pc @ONLY)
  install(FILES ${PROJECT_BINARY_DIR}/packaging/couchbase_cxx_client.pc DESTINATION ${CMAKE_INSTALL_LIBDIR}/pkgconfig)
  configure_package_config_file(
    ${PROJECT_SOURCE_DIR}/cmake/couchbase_cxx_client-config.cmake.in
    ${PROJECT_BINARY_DIR}/couchbase_cxx_client-config.cmake
    INSTALL_DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/couchbase_cxx_client)
  install(FILES ${PROJECT_BINARY_DIR}/couchbase_cxx_client-config.cmake
          DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/couchbase_cxx_client)

  install(
    TARGETS couchbase_cxx_client
    EXPORT couchbase_cxx_client-targets
    DESTINATION ${CMAKE_INSTALL_LIBDIR})

  install(
    EXPORT couchbase_cxx_client-targets
    NAMESPACE couchbase_cxx_client::
    FILE couchbase_cxx_client-targets.cmake
    DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/couchbase_cxx_client)
endif()

set(COUCHBASE_CXX_CLIENT_TARBALL_NAME "couchbase-cxx-client-${COUCHBASE_CXX_CLIENT_SEMVER}")
set(COUCHBASE_CXX_CLIENT_TARBALL "${PROJECT_BINARY_DIR}/packaging/${COUCHBASE_CXX_CLIENT_TARBALL_NAME}.tar.gz")
set(COUCHBASE_CXX_CLIENT_MANIFEST "${PROJECT_BINARY_DIR}/packaging/MANIFEST")

if(APPLE)
  find_program(TAR gtar)
  find_program(SED gsed)
  find_program(XARGS gxargs)
  find_program(CP gcp)
else()
  find_program(TAR tar)
  find_program(SED sed)
  find_program(XARGS xargs)
  find_program(CP cp)
endif()

add_custom_command(
  OUTPUT ${COUCHBASE_CXX_CLIENT_MANIFEST}
  WORKING_DIRECTORY ${PROJECT_SOURCE_DIR}
  COMMAND git ls-files --recurse-submodules | LC_ALL=C sort > ${COUCHBASE_CXX_CLIENT_MANIFEST})

set(COUCHBASE_CXX_TARBALL_THIRD_PARTY_GLOB_FILE ${PROJECT_SOURCE_DIR}/cmake/tarball_glob.txt)

if(COUCHBASE_CXX_RECORD_BUILD_INFO_FOR_TARBALL)
  file(
    WRITE "${CMAKE_SOURCE_DIR}/cmake/TarballRelease.cmake"
    "
set(CPM_DOWNLOAD_ALL OFF CACHE BOOL \"\" FORCE)
set(CPM_USE_NAMED_CACHE_DIRECTORIES ON CACHE BOOL \"\" FORCE)
set(CPM_USE_LOCAL_PACKAGES OFF CACHE BOOL \"\" FORCE)
set(CPM_SOURCE_CACHE \"\${PROJECT_SOURCE_DIR}/third_party_cache\" CACHE STRING \"\" FORCE)
set(COUCHBASE_CXX_CLIENT_GIT_REVISION \"${COUCHBASE_CXX_CLIENT_GIT_REVISION}\")
set(COUCHBASE_CXX_CLIENT_GIT_DESCRIBE \"${COUCHBASE_CXX_CLIENT_GIT_DESCRIBE}\")
set(COUCHBASE_CXX_CLIENT_BUILD_TIMESTAMP \"${COUCHBASE_CXX_CLIENT_BUILD_TIMESTAMP}\")
set(COUCHBASE_CXX_CLIENT_EMBED_MOZILLA_CA_BUNDLE_ROOT \"\${PROJECT_SOURCE_DIR}/third_party_cache\" CACHE STRING \"\" FORCE)
message(STATUS \"Building from Tarball: ${COUCHBASE_CXX_CLIENT_TARBALL_NAME}.tar.gz\")
")
endif()

add_custom_command(
  OUTPUT ${COUCHBASE_CXX_CLIENT_TARBALL}
  WORKING_DIRECTORY "${PROJECT_BINARY_DIR}/packaging"
  COMMAND ${CMAKE_COMMAND} -E rm -rf "${COUCHBASE_CXX_CLIENT_TARBALL_NAME}"
  COMMAND ${CMAKE_COMMAND} -E make_directory "${COUCHBASE_CXX_CLIENT_TARBALL_NAME}"
  COMMAND ${TAR} -cf - -C ${PROJECT_SOURCE_DIR} -T ${COUCHBASE_CXX_CLIENT_MANIFEST} | ${TAR} xf - -C
          "${COUCHBASE_CXX_CLIENT_TARBALL_NAME}"
  COMMAND
    ${CMAKE_COMMAND} -S "${PROJECT_BINARY_DIR}/packaging/${COUCHBASE_CXX_CLIENT_TARBALL_NAME}" -B
    "${PROJECT_BINARY_DIR}/packaging/${COUCHBASE_CXX_CLIENT_TARBALL_NAME}/tmp/build"
    -DCPM_SOURCE_CACHE="${PROJECT_BINARY_DIR}/packaging/${COUCHBASE_CXX_CLIENT_TARBALL_NAME}/tmp/cache"
    -DCOUCHBASE_CXX_CLIENT_EMBED_MOZILLA_CA_BUNDLE_ROOT="${PROJECT_BINARY_DIR}/packaging/${COUCHBASE_CXX_CLIENT_TARBALL_NAME}/tmp/cache"
    -DCOUCHBASE_CXX_CLIENT_BUILD_TESTS=OFF -DCOUCHBASE_CXX_CLIENT_BUILD_TOOLS=ON -DCOUCHBASE_CXX_CLIENT_BUILD_DOCS=OFF
    -DCOUCHBASE_CXX_CLIENT_STATIC_BORINGSSL=ON -DCPM_DOWNLOAD_ALL=ON -DCPM_USE_NAMED_CACHE_DIRECTORIES=ON
    -DCPM_USE_LOCAL_PACKAGES=OFF -DCOUCHBASE_CXX_CLIENT_BUILD_STATIC=ON -DCOUCHBASE_CXX_CLIENT_BUILD_SHARED=ON
    -DCOUCHBASE_CXX_CLIENT_INSTALL=ON -DCOUCHBASE_CXX_RECORD_BUILD_INFO_FOR_TARBALL=ON
  COMMAND
    ${XARGS} --arg-file=${COUCHBASE_CXX_TARBALL_THIRD_PARTY_GLOB_FILE} -I {} find
    "${COUCHBASE_CXX_CLIENT_TARBALL_NAME}/tmp/cache" -wholename "${COUCHBASE_CXX_CLIENT_TARBALL_NAME}/tmp/cache/{}"
    -type f | grep -v "crypto_test_data\\|googletest" | uniq >
    "${COUCHBASE_CXX_CLIENT_TARBALL_NAME}/tmp/third_party_manifest.txt"
  COMMAND ${CMAKE_COMMAND} -E make_directory "${COUCHBASE_CXX_CLIENT_TARBALL_NAME}/tmp/filtered_cache"
  COMMAND ${XARGS} --arg-file="${COUCHBASE_CXX_CLIENT_TARBALL_NAME}/tmp/third_party_manifest.txt" -I {} ${CP} --parents
          {} "${COUCHBASE_CXX_CLIENT_TARBALL_NAME}/tmp/filtered_cache"
  COMMAND
    ${CMAKE_COMMAND} -E rename
    "${COUCHBASE_CXX_CLIENT_TARBALL_NAME}/tmp/filtered_cache/${COUCHBASE_CXX_CLIENT_TARBALL_NAME}/tmp/cache"
    "${COUCHBASE_CXX_CLIENT_TARBALL_NAME}/third_party_cache"
  COMMAND ${SED} -i "s/VERSION 3.25.0/VERSION 3.22.0/g"
          "${COUCHBASE_CXX_CLIENT_TARBALL_NAME}/third_party_cache/llhttp/*/llhttp/CMakeLists.txt"
  COMMAND ${SED} -i "s/Git REQUIRED/Git/g\;s/NOT GIT/NOT CHECK_DIRTY OR NOT GIT/g"
          "${COUCHBASE_CXX_CLIENT_TARBALL_NAME}/third_party_cache/cpm/CPM_*.cmake"
  COMMAND ${CMAKE_COMMAND} -E rm -rf "${COUCHBASE_CXX_CLIENT_TARBALL_NAME}/tmp"
  # https://reproducible-builds.org/docs/archives/
  COMMAND ${TAR} --sort=name --mtime="${COUCHBASE_CXX_CLIENT_BUILD_TIMESTAMP}Z" --owner=0 --group=0 --numeric-owner -czf
          "${COUCHBASE_CXX_CLIENT_TARBALL_NAME}.tar.gz" "${COUCHBASE_CXX_CLIENT_TARBALL_NAME}"
  COMMAND ${CMAKE_COMMAND} -E rm -rf "${COUCHBASE_CXX_CLIENT_TARBALL_NAME}"
  DEPENDS ${COUCHBASE_CXX_CLIENT_MANIFEST})

add_custom_target(packaging_tarball DEPENDS ${COUCHBASE_CXX_CLIENT_TARBALL})

option(COUCHBASE_CXX_CLIENT_DEB_TARGETS "Enable targets for building DEBs" FALSE)
if(COUCHBASE_CXX_CLIENT_DEB_TARGETS)
  find_program(DPKG_BUILDPACKAGE dpkg-buildpackage REQUIRED) # apt install -y dpkg-dev
  find_program(SUDO sudo REQUIRED) # apt install -y sudo
  find_program(COWBUILDER cowbuilder REQUIRED) # apt install -y cowbuilder

  string(TIMESTAMP COUCHBASE_CXX_CLIENT_DEB_DATE "%a, %d %b %Y %H:%M:%S %z" UTC)

  file(MAKE_DIRECTORY "${PROJECT_BINARY_DIR}/packaging/workspace/debian/source/")

  set(COUCHBASE_CXX_CLIENT_DEBIAN_CHANGELOG "${PROJECT_BINARY_DIR}/packaging/workspace/debian/changelog")
  configure_file(${PROJECT_SOURCE_DIR}/cmake/debian/changelog.in "${COUCHBASE_CXX_CLIENT_DEBIAN_CHANGELOG}" @ONLY)

  file(COPY ${PROJECT_SOURCE_DIR}/cmake/debian/compat ${PROJECT_SOURCE_DIR}/cmake/debian/control
            ${PROJECT_SOURCE_DIR}/cmake/debian/rules DESTINATION "${PROJECT_BINARY_DIR}/packaging/workspace/debian/")
  file(COPY ${PROJECT_SOURCE_DIR}/cmake/debian/source/format ${PROJECT_SOURCE_DIR}/cmake/debian/source/options
       DESTINATION "${PROJECT_BINARY_DIR}/packaging/workspace/debian/source/")

  set(COUCHBASE_CXX_CLIENT_DEBIAN_ORIG_TARBALL
      "${PROJECT_BINARY_DIR}/packaging/couchbase-cxx-client_${COUCHBASE_CXX_CLIENT_PACKAGE_VERSION}.orig.tar.gz")
  add_custom_command(
    OUTPUT ${COUCHBASE_CXX_CLIENT_DEBIAN_ORIG_TARBALL}
    WORKING_DIRECTORY "${PROJECT_BINARY_DIR}/packaging"
    COMMAND ${CMAKE_COMMAND} -E copy "${COUCHBASE_CXX_CLIENT_TARBALL}" "${COUCHBASE_CXX_CLIENT_DEBIAN_ORIG_TARBALL}"
    DEPENDS ${COUCHBASE_CXX_CLIENT_TARBALL})

  set(COUCHBASE_CXX_CLIENT_DEBIAN_TARBALL_EXTRACTED "${PROJECT_BINARY_DIR}/packaging/tarball_extracted.txt")
  add_custom_command(
    OUTPUT ${COUCHBASE_CXX_CLIENT_DEBIAN_TARBALL_EXTRACTED}
    WORKING_DIRECTORY "${PROJECT_BINARY_DIR}/packaging/workspace"
    COMMAND ${TAR} --strip-components=1 -xf "${COUCHBASE_CXX_CLIENT_TARBALL}"
    COMMAND touch ${COUCHBASE_CXX_CLIENT_DEBIAN_TARBALL_EXTRACTED}
    DEPENDS ${COUCHBASE_CXX_CLIENT_TARBALL})

  set(COUCHBASE_CXX_CLIENT_DEBIAN_DSC
      "${PROJECT_BINARY_DIR}/packaging/couchbase-cxx-client_${COUCHBASE_CXX_CLIENT_PACKAGE_VERSION}-${COUCHBASE_CXX_CLIENT_PACKAGE_RELEASE}.dsc"
  )
  add_custom_command(
    OUTPUT ${COUCHBASE_CXX_CLIENT_DEBIAN_DSC}
    WORKING_DIRECTORY "${PROJECT_BINARY_DIR}/packaging/workspace"
    COMMAND ${DPKG_BUILDPACKAGE} -us -uc
    DEPENDS ${COUCHBASE_CXX_CLIENT_DEBIAN_ORIG_TARBALL} ${COUCHBASE_CXX_CLIENT_DEBIAN_TARBALL_EXTRACTED})

  function(select_mirror_options distro options)
    if(${distro} STREQUAL "bookworm" OR ${distro} STREQUAL "trixie")
      set(${options}
          --components
          main
          --mirror
          https://ftp.debian.org/debian
          PARENT_SCOPE)
    else()
      if(${CMAKE_SYSTEM_PROCESSOR} STREQUAL "aarch64")
        set(${options}
            --components
            "main universe"
            --mirror
            http://ports.ubuntu.com/ubuntu-ports
            PARENT_SCOPE)
      else()
        set(${options}
            --components
            "main universe"
            --mirror
            http://archive.ubuntu.com/ubuntu
            PARENT_SCOPE)
      endif()
    endif()
  endfunction()

  set(cowbuilder_results "${PROJECT_BINARY_DIR}/packaging/results")
  file(MAKE_DIRECTORY "${cowbuilder_results}")

  list(
    APPEND
    COUCHBASE_CXX_CLIENT_SUPPORTED_DISTROS
    "jammy"
    "noble"
    "bookworm"
    "trixie")

  set(pbuilder_root "${PROJECT_BINARY_DIR}/packaging/base.cow")
  set(cowbuilder_root "${PROJECT_BINARY_DIR}/packaging/root.cow")
  set(last_output "")
  foreach(distro ${COUCHBASE_CXX_CLIENT_SUPPORTED_DISTROS})
    select_mirror_options(${distro} mirror_options)
    set(timestamp "${PROJECT_BINARY_DIR}/packaging/${distro}_done.txt")
    set(dependencies ${COUCHBASE_CXX_CLIENT_DEBIAN_DSC})

    if(last_output)
      list(APPEND dependencies ${last_output})
    endif()

    add_custom_command(
      COMMENT "Building DEB for ${distro}"
      OUTPUT ${timestamp}
      WORKING_DIRECTORY "${PROJECT_BINARY_DIR}/packaging"
      COMMAND ${SUDO} ${CMAKE_COMMAND} -E rm -rf "${cowbuilder_root}"
      COMMAND ${SUDO} ${COWBUILDER} --create --buildplace "${pbuilder_root}" --basepath "${cowbuilder_root}"
              --distribution ${distro} ${mirror_options}
      COMMAND
        ${SUDO} ${COWBUILDER} --build --buildplace "${pbuilder_root}" --basepath "${cowbuilder_root}" --buildresult
        "${cowbuilder_results}/couchbase-cxx-client-${COUCHBASE_CXX_CLIENT_PACKAGE_VERSION}-${COUCHBASE_CXX_CLIENT_PACKAGE_RELEASE}.${distro}.${CMAKE_SYSTEM_PROCESSOR}"
        --debbuildopts -j8 --debbuildopts "-us -uc" ${COUCHBASE_CXX_CLIENT_DEBIAN_DSC}
      COMMAND touch ${timestamp}
      DEPENDS ${dependencies})

    set(last_output ${timestamp})
  endforeach()

  add_custom_target(packaging_deb DEPENDS ${last_output})
endif()

option(COUCHBASE_CXX_CLIENT_RPM_TARGETS "Enable targets for building RPMs" FALSE)
if(COUCHBASE_CXX_CLIENT_RPM_TARGETS)
  find_program(MOCK mock REQUIRED) # dnf install -y mock
  find_program(SPECTOOL spectool REQUIRED) # dnf install -y rpmdevtools

  string(TIMESTAMP COUCHBASE_CXX_CLIENT_RPM_DATE "%a %b %d %Y" UTC)

  set(COUCHBASE_CXX_CLIENT_SPEC "${PROJECT_BINARY_DIR}/packaging/couchbase-cxx-client.spec")
  configure_file(${PROJECT_SOURCE_DIR}/cmake/couchbase-cxx-client.spec.in "${COUCHBASE_CXX_CLIENT_SPEC}" @ONLY)

  set(COUCHBASE_CXX_CLIENT_DEFAULT_ROOT "rocky-9-${CMAKE_SYSTEM_PROCESSOR}")
  set(COUCHBASE_CXX_CLIENT_RPM_NAME
      "couchbase-cxx-client-${COUCHBASE_CXX_CLIENT_PACKAGE_VERSION}-${COUCHBASE_CXX_CLIENT_PACKAGE_RELEASE}")
  set(COUCHBASE_CXX_CLIENT_SRPM "${PROJECT_BINARY_DIR}/packaging/srpm/${COUCHBASE_CXX_CLIENT_RPM_NAME}.el9.src.rpm")

  add_custom_command(
    OUTPUT ${COUCHBASE_CXX_CLIENT_SRPM}
    WORKING_DIRECTORY "${PROJECT_BINARY_DIR}/packaging"
    COMMAND ${SPECTOOL} --get-files couchbase-cxx-client.spec
    COMMAND ${MOCK} --buildsrpm --root=${COUCHBASE_CXX_CLIENT_DEFAULT_ROOT}
            --resultdir=${PROJECT_BINARY_DIR}/packaging/srpm --spec couchbase-cxx-client.spec --sources .
    DEPENDS ${COUCHBASE_CXX_CLIENT_TARBALL} ${COUCHBASE_CXX_CLIENT_SPEC})

  add_custom_target(packaging_srpm DEPENDS ${COUCHBASE_CXX_CLIENT_SRPM})

  list(
    APPEND
    COUCHBASE_CXX_CLIENT_SUPPORTED_ROOTS
    "opensuse-leap-15.6-${CMAKE_SYSTEM_PROCESSOR}"
    "rocky-10-${CMAKE_SYSTEM_PROCESSOR}"
    "rocky-9-${CMAKE_SYSTEM_PROCESSOR}"
    "rocky-8-${CMAKE_SYSTEM_PROCESSOR}"
    "amazonlinux-2023-${CMAKE_SYSTEM_PROCESSOR}"
    "fedora-43-${CMAKE_SYSTEM_PROCESSOR}"
    "fedora-42-${CMAKE_SYSTEM_PROCESSOR}"
    "fedora-41-${CMAKE_SYSTEM_PROCESSOR}")

  message(STATUS "Supported build roots for RPM packages: ${COUCHBASE_CXX_CLIENT_SUPPORTED_ROOTS}")

  # Build the chain of the dependencies from the timestamps, so that everything will be executed one-by-one in order,
  # because the mock cannot run multiple roots simultaneously
  set(last_output "")
  foreach(root ${COUCHBASE_CXX_CLIENT_SUPPORTED_ROOTS})
    set(timestamp "${PROJECT_BINARY_DIR}/packaging/rpm/${root}/done.txt")
    set(dependencies ${COUCHBASE_CXX_CLIENT_SRPM})

    if(last_output)
      list(APPEND dependencies ${last_output})
    endif()

    add_custom_command(
      COMMENT "Building RPM for ${root}"
      OUTPUT ${timestamp}
      WORKING_DIRECTORY "${PROJECT_BINARY_DIR}/packaging"
      COMMAND ${MOCK} --rebuild --root=${root} --resultdir=${PROJECT_BINARY_DIR}/packaging/rpm/${root}
              "${COUCHBASE_CXX_CLIENT_SRPM}"
      COMMAND touch ${timestamp}
      DEPENDS ${dependencies})

    set(last_output ${timestamp})
  endforeach()

  # add target that depends on the last root
  add_custom_target(packaging_rpm DEPENDS ${last_output})
endif()

option(COUCHBASE_CXX_CLIENT_APK_TARGETS "Enable targets for building APKs (for Alpine Linux)" FALSE)
if(COUCHBASE_CXX_CLIENT_APK_TARGETS)
  find_program(ABUILD abuild REQUIRED) # apk add alpine-sdk

  set(COUCHBASE_CXX_CLIENT_TARBALL_NAME_ALPINE "${COUCHBASE_CXX_CLIENT_TARBALL_NAME}")
  set(COUCHBASE_CXX_CLIENT_TARBALL_ALPINE
      "${PROJECT_BINARY_DIR}/packaging/${COUCHBASE_CXX_CLIENT_TARBALL_NAME_ALPINE}.tar.gz")
  if(${COUCHBASE_CXX_CLIENT_NUMBER_OF_COMMITS} GREATER 0)
    set(COUCHBASE_CXX_CLIENT_TARBALL_NAME_ALPINE
        "couchbase-cxx-client-${COUCHBASE_CXX_CLIENT_PACKAGE_VERSION}_p${COUCHBASE_CXX_CLIENT_NUMBER_OF_COMMITS}")
    set(COUCHBASE_CXX_CLIENT_TARBALL_ALPINE
        "${PROJECT_BINARY_DIR}/packaging/${COUCHBASE_CXX_CLIENT_TARBALL_NAME_ALPINE}.tar.gz")
  endif()

  set(cxxcbc_apkbuild_file "${PROJECT_BINARY_DIR}/packaging/APKBUILD")
  configure_file(${PROJECT_SOURCE_DIR}/cmake/APKBUILD.in "${cxxcbc_apkbuild_file}" @ONLY)

  if(NOT
     "${COUCHBASE_CXX_CLIENT_TARBALL}"
     STREQUAL
     "${COUCHBASE_CXX_CLIENT_TARBALL_ALPINE}")
    add_custom_command(
      OUTPUT ${COUCHBASE_CXX_CLIENT_TARBALL_ALPINE}
      WORKING_DIRECTORY "${PROJECT_BINARY_DIR}/packaging"
      COMMAND ${CMAKE_COMMAND} -E copy "${COUCHBASE_CXX_CLIENT_TARBALL}" "${COUCHBASE_CXX_CLIENT_TARBALL_ALPINE}"
      DEPENDS ${COUCHBASE_CXX_CLIENT_TARBALL})
  endif()

  set(cxxcbc_apkbuild_checksum "${PROJECT_BINARY_DIR}/packaging/apk_checksum_updated.txt")
  add_custom_command(
    OUTPUT ${cxxcbc_apkbuild_checksum}
    WORKING_DIRECTORY "${PROJECT_BINARY_DIR}/packaging"
    COMMAND ${ABUILD} checksum
    COMMAND touch ${cxxcbc_apkbuild_checksum}
    DEPENDS ${COUCHBASE_CXX_CLIENT_TARBALL_ALPINE} ${cxxcbc_apkbuild_file})

  set(cxxcbc_apkbuild_timestamp "${PROJECT_BINARY_DIR}/packaging/apk_timestamp.txt")
  add_custom_command(
    OUTPUT ${cxxcbc_apkbuild_timestamp}
    WORKING_DIRECTORY "${PROJECT_BINARY_DIR}/packaging"
    COMMAND ${ABUILD} -r
    COMMAND touch ${cxxcbc_apkbuild_timestamp}
    DEPENDS ${COUCHBASE_CXX_CLIENT_TARBALL_ALPINE} ${cxxcbc_apkbuild_checksum})

  add_custom_target(packaging_apk DEPENDS ${cxxcbc_apkbuild_timestamp})
endif()
