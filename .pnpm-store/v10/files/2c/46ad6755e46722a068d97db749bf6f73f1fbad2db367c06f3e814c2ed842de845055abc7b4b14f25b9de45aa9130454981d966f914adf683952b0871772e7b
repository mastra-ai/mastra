add_library(
  couchbase_sasl OBJECT
  client.cc
  context.cc
  mechanism.cc
  plain/plain.cc
  scram-sha/scram-sha.cc
  scram-sha/stringutils.cc)
set_target_properties(couchbase_sasl PROPERTIES POSITION_INDEPENDENT_CODE ON)
target_include_directories(couchbase_sasl PRIVATE ../..)
set_project_warnings(couchbase_sasl)
set_project_options(couchbase_sasl)
target_link_libraries(couchbase_sasl PRIVATE Microsoft.GSL::GSL spdlog::spdlog)
