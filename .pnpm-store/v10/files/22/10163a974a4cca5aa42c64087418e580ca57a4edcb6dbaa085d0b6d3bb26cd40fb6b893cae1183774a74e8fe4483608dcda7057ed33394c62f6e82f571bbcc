#pragma once
#include <asio/io_context.hpp>
#include <core/cluster.hxx>
#include <core/logger/logger.hxx>
#include <memory>
#include <thread>

namespace couchnode
{

class Instance
{
private:
    ~Instance();

public:
    Instance();

    void asyncDestroy();

    asio::io_context _io;
    std::thread _ioThread;
    couchbase::core::cluster _cluster;
};

} // namespace couchnode
