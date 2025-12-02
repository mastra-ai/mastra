/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2023-Present Couchbase, Inc.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

#include "core/cluster.hxx"
#include "core/impl/error.hxx"
#include "core/logger/logger.hxx"

#include "core/management/analytics_link_azure_blob_external.hxx"
#include "core/management/analytics_link_couchbase_remote.hxx"
#include "core/management/analytics_link_s3_external.hxx"
#include "core/operations/management/analytics_dataset_create.hxx"
#include "core/operations/management/analytics_dataset_drop.hxx"
#include "core/operations/management/analytics_dataset_get_all.hxx"
#include "core/operations/management/analytics_dataverse_create.hxx"
#include "core/operations/management/analytics_dataverse_drop.hxx"
#include "core/operations/management/analytics_get_pending_mutations.hxx"
#include "core/operations/management/analytics_index_create.hxx"
#include "core/operations/management/analytics_index_drop.hxx"
#include "core/operations/management/analytics_index_get_all.hxx"
#include "core/operations/management/analytics_link_connect.hxx"
#include "core/operations/management/analytics_link_create.hxx"
#include "core/operations/management/analytics_link_disconnect.hxx"
#include "core/operations/management/analytics_link_drop.hxx"
#include "core/operations/management/analytics_link_get_all.hxx"
#include "core/operations/management/analytics_link_replace.hxx"

#include <couchbase/analytics_index_manager.hxx>
#include <couchbase/connect_link_analytics_options.hxx>
#include <couchbase/create_dataset_analytics_options.hxx>
#include <couchbase/create_dataverse_analytics_options.hxx>
#include <couchbase/create_index_analytics_options.hxx>
#include <couchbase/create_link_analytics_options.hxx>
#include <couchbase/disconnect_link_analytics_options.hxx>
#include <couchbase/drop_dataset_analytics_options.hxx>
#include <couchbase/drop_dataverse_analytics_options.hxx>
#include <couchbase/drop_index_analytics_options.hxx>
#include <couchbase/drop_link_analytics_options.hxx>
#include <couchbase/error.hxx>
#include <couchbase/get_all_datasets_analytics_options.hxx>
#include <couchbase/get_all_indexes_analytics_options.hxx>
#include <couchbase/get_links_analytics_options.hxx>
#include <couchbase/get_pending_mutations_analytics_options.hxx>
#include <couchbase/management/analytics_dataset.hxx>
#include <couchbase/management/analytics_index.hxx>
#include <couchbase/management/analytics_link.hxx>
#include <couchbase/replace_link_analytics_options.hxx>

#include <cstdint>
#include <future>
#include <map>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace couchbase
{
namespace
{
auto
to_core_couchbase_remote_link(const management::analytics_link& link)
  -> core::management::analytics::couchbase_remote_link
{
  auto cb_link = dynamic_cast<const management::couchbase_remote_analytics_link&>(link);
  core::management::analytics::couchbase_remote_link core_link{
    cb_link.name,
    cb_link.dataverse_name,
    cb_link.hostname,
    cb_link.username,
    cb_link.password,
    core::management::analytics::couchbase_link_encryption_settings{
      {},
      cb_link.encryption.certificate,
      cb_link.encryption.client_certificate,
      cb_link.encryption.client_key,
    }
  };
  switch (cb_link.encryption.encryption_level) {
    case management::analytics_encryption_level::none:
      core_link.encryption.level =
        core::management::analytics::couchbase_link_encryption_level::none;
      break;
    case management::analytics_encryption_level::half:
      core_link.encryption.level =
        core::management::analytics::couchbase_link_encryption_level::half;
      break;
    case management::analytics_encryption_level::full:
      core_link.encryption.level =
        core::management::analytics::couchbase_link_encryption_level::full;
      break;
  }
  return core_link;
}

auto
to_core_azure_blob_external_link(const management::analytics_link& link)
  -> core::management::analytics::azure_blob_external_link
{
  auto azure_link = dynamic_cast<const management::azure_blob_external_analytics_link&>(link);
  return core::management::analytics::azure_blob_external_link{
    azure_link.name,          azure_link.dataverse_name,  azure_link.connection_string,
    azure_link.account_name,  azure_link.account_key,     azure_link.shared_access_signature,
    azure_link.blob_endpoint, azure_link.endpoint_suffix,
  };
}

auto
to_core_s3_external_link(const management::analytics_link& link)
  -> core::management::analytics::s3_external_link
{
  auto s3_link = dynamic_cast<const management::s3_external_analytics_link&>(link);
  return core::management::analytics::s3_external_link{
    s3_link.name,
    s3_link.dataverse_name,
    s3_link.access_key_id,
    s3_link.secret_access_key,
    s3_link.session_token,
    s3_link.region,
    s3_link.service_endpoint,
  };
}

constexpr auto DEFAULT_DATAVERSE_NAME = "Default";
constexpr auto DEFAULT_LINK_NAME = "Local";
} // namespace

class analytics_index_manager_impl
  : public std::enable_shared_from_this<analytics_index_manager_impl>
{
public:
  explicit analytics_index_manager_impl(core::cluster core)
    : core_{ std::move(core) }
  {
  }

  void create_dataverse(const std::string& dataverse_name,
                        const create_dataverse_analytics_options::built& options,
                        create_dataverse_analytics_handler&& handler) const
  {
    return core_.execute(
      core::operations::management::analytics_dataverse_create_request{
        dataverse_name,
        options.ignore_if_exists,
        {},
        options.timeout,
      },
      [dataverse_name, handler = std::move(handler)](const auto& resp) {
        CB_LOG_DEBUG(
          "Dataverse create for {} error code = {}", dataverse_name, resp.ctx.ec.value());
        handler(core::impl::make_error(resp.ctx));
      });
  }

  void drop_dataverse(const std::string& dataverse_name,
                      const drop_dataverse_analytics_options::built& options,
                      drop_dataverse_analytics_handler&& handler) const
  {
    return core_.execute(
      core::operations::management::analytics_dataverse_drop_request{
        dataverse_name,
        options.ignore_if_not_exists,
        {},
        options.timeout,
      },
      [handler = std::move(handler)](const auto& resp) {
        handler(core::impl::make_error(resp.ctx));
      });
  }

  void create_dataset(const std::string& dataset_name,
                      const std::string& bucket_name,
                      const create_dataset_analytics_options::built& options,
                      create_dataset_analytics_handler&& handler) const
  {
    return core_.execute(
      core::operations::management::analytics_dataset_create_request{
        options.dataverse_name.value_or(DEFAULT_DATAVERSE_NAME),
        dataset_name,
        bucket_name,
        options.condition,
        {},
        options.timeout,
        options.ignore_if_exists,
      },
      [handler = std::move(handler)](const auto& resp) {
        handler(core::impl::make_error(resp.ctx));
      });
  }

  void drop_dataset(const std::string& dataset_name,
                    const drop_dataset_analytics_options::built& options,
                    drop_dataset_analytics_handler&& handler) const
  {
    return core_.execute(
      core::operations::management::analytics_dataset_drop_request{
        options.dataverse_name.value_or(DEFAULT_DATAVERSE_NAME),
        dataset_name,
        options.ignore_if_not_exists,
        {},
        options.timeout,
      },
      [handler = std::move(handler)](const auto& resp) {
        handler(core::impl::make_error(resp.ctx));
      });
  }

  void get_all_datasets(const get_all_datasets_analytics_options::built& options,
                        get_all_datasets_analytics_handler&& handler) const
  {
    return core_.execute(
      core::operations::management::analytics_dataset_get_all_request{
        {},
        options.timeout,
      },
      [handler = std::move(handler)](
        const core::operations::management::analytics_dataset_get_all_response& resp) {
        if (resp.ctx.ec) {
          return handler(core::impl::make_error(resp.ctx), {});
        }
        std::vector<management::analytics_dataset> datasets{};
        datasets.reserve(resp.datasets.size());
        for (const auto& d : resp.datasets) {
          datasets.push_back(management::analytics_dataset{
            d.name,
            d.dataverse_name,
            d.link_name,
            d.bucket_name,
          });
        }
        handler(core::impl::make_error(resp.ctx), datasets);
      });
  }

  void create_index(const std::string& index_name,
                    const std::string& dataset_name,
                    const std::map<std::string, std::string>& fields,
                    const create_index_analytics_options::built& options,
                    create_index_analytics_handler&& handler) const
  {
    return core_.execute(
      core::operations::management::analytics_index_create_request{
        options.dataverse_name.value_or(DEFAULT_DATAVERSE_NAME),
        dataset_name,
        index_name,
        fields,
        options.ignore_if_exists,
        {},
        options.timeout,
      },
      [handler = std::move(handler)](const auto& resp) {
        handler(core::impl::make_error(resp.ctx));
      });
  }

  void drop_index(const std::string& index_name,
                  const std::string& dataset_name,
                  const drop_index_analytics_options::built& options,
                  drop_index_analytics_handler&& handler) const
  {
    return core_.execute(
      core::operations::management::analytics_index_drop_request{
        options.dataverse_name.value_or(DEFAULT_DATAVERSE_NAME),
        dataset_name,
        index_name,
        options.ignore_if_not_exists,
        {},
        options.timeout,
      },
      [handler = std::move(handler)](const auto& resp) {
        handler(core::impl::make_error(resp.ctx));
      });
  }

  void get_all_indexes(const get_all_indexes_analytics_options::built& options,
                       get_all_indexes_analytics_handler&& handler) const
  {
    return core_.execute(
      core::operations::management::analytics_index_get_all_request{
        {},
        options.timeout,
      },
      [handler = std::move(handler)](
        const core::operations::management::analytics_index_get_all_response& resp) {
        if (resp.ctx.ec) {
          return handler(core::impl::make_error(resp.ctx), {});
        }
        std::vector<management::analytics_index> indexes{};
        indexes.reserve(resp.indexes.size());
        for (const auto& idx : resp.indexes) {
          indexes.push_back(management::analytics_index{
            idx.name,
            idx.dataset_name,
            idx.dataverse_name,
            idx.is_primary,
          });
        }
        handler(core::impl::make_error(resp.ctx), indexes);
      });
  }

  void connect_link(const connect_link_analytics_options::built& options,
                    connect_link_analytics_handler&& handler) const
  {
    return core_.execute(
      core::operations::management::analytics_link_connect_request{
        options.dataverse_name.value_or(DEFAULT_DATAVERSE_NAME),
        options.link_name.value_or(DEFAULT_LINK_NAME),
        options.force,
        {},
        options.timeout,
      },
      [handler = std::move(handler)](const auto& resp) {
        handler(core::impl::make_error(resp.ctx));
      });
  }

  void disconnect_link(const disconnect_link_analytics_options::built& options,
                       disconnect_link_analytics_handler&& handler) const
  {
    return core_.execute(
      core::operations::management::analytics_link_disconnect_request{
        options.dataverse_name.value_or(DEFAULT_DATAVERSE_NAME),
        options.link_name.value_or(DEFAULT_LINK_NAME),
        {},
        options.timeout,
      },
      [handler = std::move(handler)](const auto& resp) {
        handler(core::impl::make_error(resp.ctx));
      });
  }

  void get_pending_mutations(const get_pending_mutations_analytics_options::built& options,
                             get_pending_mutations_analytics_handler&& handler) const
  {
    return core_.execute(
      core::operations::management::analytics_get_pending_mutations_request{
        {},
        options.timeout,
      },
      [handler = std::move(handler)](
        const core::operations::management::analytics_get_pending_mutations_response& resp) {
        if (resp.ctx.ec) {
          return handler(core::impl::make_error(resp.ctx), {});
        }
        std::map<std::string, std::map<std::string, std::int64_t>> pending_mutations{};
        const std::string separator{ "." };
        for (const auto& [key, mutation_count] : resp.stats) {
          // Keys are encoded as `dataverse.dataset`
          auto separator_pos = key.find(separator);
          auto dataverse_name = key.substr(0, separator_pos);
          auto dataset_name = key.substr(separator_pos + 1, key.size() - separator_pos - 1);
          if (pending_mutations.count(dataverse_name) == 0) {
            pending_mutations.insert({ dataverse_name, {} });
          }
          pending_mutations.at(dataverse_name).insert({ dataset_name, mutation_count });
        }
        handler(core::impl::make_error(resp.ctx), pending_mutations);
      });
  }

  void create_link(const management::analytics_link& link,
                   const create_link_analytics_options::built& options,
                   create_link_analytics_handler&& handler) const
  {
    switch (link.link_type()) {
      case management::s3_external:
        return core_.execute(
          core::operations::management::analytics_link_create_request<
            core::management::analytics::s3_external_link>{
            to_core_s3_external_link(link),
            {},
            options.timeout,
          },
          [handler = std::move(handler)](const auto& resp) {
            handler(core::impl::make_error(resp.ctx));
          });

      case management::azure_external:
        return core_.execute(
          core::operations::management::analytics_link_create_request<
            core::management::analytics::azure_blob_external_link>{
            to_core_azure_blob_external_link(link),
            {},
            options.timeout,
          },
          [handler = std::move(handler)](const auto& resp) {
            handler(core::impl::make_error(resp.ctx));
          });

      case management::couchbase_remote:
        return core_.execute(
          core::operations::management::analytics_link_create_request<
            core::management::analytics::couchbase_remote_link>{
            to_core_couchbase_remote_link(link),
            {},
            options.timeout,
          },
          [handler = std::move(handler)](const auto& resp) {
            handler(core::impl::make_error(resp.ctx));
          });
    }
  }

  void replace_link(const management::analytics_link& link,
                    const replace_link_analytics_options::built& options,
                    replace_link_analytics_handler&& handler) const
  {
    switch (link.link_type()) {
      case management::s3_external:
        return core_.execute(
          core::operations::management::analytics_link_replace_request<
            core::management::analytics::s3_external_link>{
            to_core_s3_external_link(link),
            {},
            options.timeout,
          },
          [handler = std::move(handler)](const auto& resp) {
            handler(core::impl::make_error(resp.ctx));
          });

      case management::azure_external:
        return core_.execute(
          core::operations::management::analytics_link_replace_request<
            core::management::analytics::azure_blob_external_link>{
            to_core_azure_blob_external_link(link),
            {},
            options.timeout,
          },
          [handler = std::move(handler)](const auto& resp) {
            handler(core::impl::make_error(resp.ctx));
          });

      case management::couchbase_remote:
        return core_.execute(
          core::operations::management::analytics_link_replace_request<
            core::management::analytics::couchbase_remote_link>{
            to_core_couchbase_remote_link(link),
            {},
            options.timeout,
          },
          [handler = std::move(handler)](const auto& resp) {
            handler(core::impl::make_error(resp.ctx));
          });
    }
  }

  void drop_link(const std::string& link_name,
                 const std::string& dataverse_name,
                 const drop_link_analytics_options::built& options,
                 drop_link_analytics_handler&& handler) const
  {
    return core_.execute(
      core::operations::management::analytics_link_drop_request{
        link_name,
        dataverse_name,
        {},
        options.timeout,
      },
      [handler = std::move(handler)](const auto& resp) {
        handler(core::impl::make_error(resp.ctx));
      });
  }

  void get_links(const get_links_analytics_options::built& options,
                 get_links_analytics_handler&& handler) const
  {
    core::operations::management::analytics_link_get_all_request req{
      {}, {}, {}, {}, options.timeout,
    };
    if (options.name.has_value()) {
      req.link_name = options.name.value();
    }
    if (options.dataverse_name.has_value()) {
      req.dataverse_name = options.dataverse_name.value();
    }
    if (options.link_type.has_value()) {
      switch (options.link_type.value()) {
        case management::s3_external:
          req.link_type = "s3";
          break;
        case management::azure_external:
          req.link_type = "azureblob";
          break;
        case management::couchbase_remote:
          req.link_type = "couchbase";
          break;
      }
    }
    return core_.execute(
      req,
      [handler = std::move(handler)](
        const core::operations::management::analytics_link_get_all_response& resp) {
        if (resp.ctx.ec) {
          return handler(core::impl::make_error(resp.ctx), {});
        }
        std::vector<std::unique_ptr<management::analytics_link>> links{};

        for (const auto& link : resp.couchbase) {
          auto cb_link = std::make_unique<management::couchbase_remote_analytics_link>();
          cb_link->name = link.link_name;
          cb_link->dataverse_name = link.dataverse;
          cb_link->hostname = link.hostname;
          switch (link.encryption.level) {
            case core::management::analytics::couchbase_link_encryption_level::none:
              cb_link->encryption.encryption_level = management::analytics_encryption_level::none;
              break;
            case core::management::analytics::couchbase_link_encryption_level::half:
              cb_link->encryption.encryption_level = management::analytics_encryption_level::half;
              break;
            case core::management::analytics::couchbase_link_encryption_level::full:
              cb_link->encryption.encryption_level = management::analytics_encryption_level::full;
              break;
          }
          cb_link->encryption.certificate = link.encryption.certificate;
          cb_link->encryption.client_certificate = link.encryption.client_certificate;
          cb_link->username = link.username;
          links.push_back(std::move(cb_link));
        }

        for (const auto& link : resp.s3) {
          auto s3_link = std::make_unique<management::s3_external_analytics_link>();
          s3_link->name = link.link_name;
          s3_link->dataverse_name = link.dataverse;
          s3_link->access_key_id = link.access_key_id;
          s3_link->region = link.region;
          s3_link->service_endpoint = link.service_endpoint;
          links.push_back(std::move(s3_link));
        }

        for (const auto& link : resp.azure_blob) {
          auto azure_link = std::make_unique<management::azure_blob_external_analytics_link>();
          azure_link->name = link.link_name;
          azure_link->dataverse_name = link.dataverse;
          azure_link->account_name = link.account_name;
          azure_link->blob_endpoint = link.blob_endpoint;
          azure_link->endpoint_suffix = link.endpoint_suffix;
          links.push_back(std::move(azure_link));
        }

        handler(core::impl::make_error(resp.ctx), std::move(links));
      });
  }

private:
  core::cluster core_;
};

analytics_index_manager::analytics_index_manager(core::cluster core)
  : impl_(std::make_shared<analytics_index_manager_impl>(std::move(core)))
{
}

void
analytics_index_manager::create_dataverse(const std::string& dataverse_name,
                                          const create_dataverse_analytics_options& options,
                                          create_dataverse_analytics_handler&& handler) const
{
  return impl_->create_dataverse(dataverse_name, options.build(), std::move(handler));
}

auto
analytics_index_manager::create_dataverse(const std::string& dataverse_name,
                                          const create_dataverse_analytics_options& options) const
  -> std::future<error>
{
  auto barrier = std::make_shared<std::promise<error>>();
  auto future = barrier->get_future();
  create_dataverse(dataverse_name, options, [barrier](auto err) mutable {
    barrier->set_value({ std::move(err) });
  });
  return future;
}

void
analytics_index_manager::drop_dataverse(const std::string& dataverse_name,
                                        const drop_dataverse_analytics_options& options,
                                        drop_dataverse_analytics_handler&& handler) const
{
  return impl_->drop_dataverse(dataverse_name, options.build(), std::move(handler));
}

auto
analytics_index_manager::drop_dataverse(const std::string& dataverse_name,
                                        const drop_dataverse_analytics_options& options) const
  -> std::future<error>
{
  auto barrier = std::make_shared<std::promise<error>>();
  auto future = barrier->get_future();
  drop_dataverse(dataverse_name, options, [barrier](auto err) mutable {
    barrier->set_value({ std::move(err) });
  });
  return future;
}

void
analytics_index_manager::create_dataset(const std::string& dataset_name,
                                        const std::string& bucket_name,
                                        const create_dataset_analytics_options& options,
                                        create_dataset_analytics_handler&& handler) const
{
  return impl_->create_dataset(dataset_name, bucket_name, options.build(), std::move(handler));
}

auto
analytics_index_manager::create_dataset(const std::string& dataset_name,
                                        const std::string& bucket_name,
                                        const create_dataset_analytics_options& options) const
  -> std::future<error>
{
  auto barrier = std::make_shared<std::promise<error>>();
  auto future = barrier->get_future();
  create_dataset(dataset_name, bucket_name, options, [barrier](auto err) mutable {
    barrier->set_value({ std::move(err) });
  });
  return future;
}

void
analytics_index_manager::drop_dataset(const std::string& dataset_name,
                                      const drop_dataset_analytics_options& options,
                                      drop_dataset_analytics_handler&& handler) const
{
  return impl_->drop_dataset(dataset_name, options.build(), std::move(handler));
}

auto
analytics_index_manager::drop_dataset(const std::string& dataset_name,
                                      const drop_dataset_analytics_options& options) const
  -> std::future<error>
{
  auto barrier = std::make_shared<std::promise<error>>();
  auto future = barrier->get_future();
  drop_dataset(dataset_name, options, [barrier](auto err) mutable {
    barrier->set_value({ std::move(err) });
  });
  return future;
}

void
analytics_index_manager::get_all_datasets(const get_all_datasets_analytics_options& options,
                                          get_all_datasets_analytics_handler&& handler) const
{
  return impl_->get_all_datasets(options.build(), std::move(handler));
}

auto
analytics_index_manager::get_all_datasets(const get_all_datasets_analytics_options& options) const
  -> std::future<std::pair<error, std::vector<management::analytics_dataset>>>
{
  auto barrier =
    std::make_shared<std::promise<std::pair<error, std::vector<management::analytics_dataset>>>>();
  auto future = barrier->get_future();
  get_all_datasets(options, [barrier](auto err, auto resp) mutable {
    barrier->set_value({ std::move(err), std::move(resp) });
  });
  return future;
}

void
analytics_index_manager::create_index(const std::string& index_name,
                                      const std::string& dataset_name,
                                      const std::map<std::string, std::string>& fields,
                                      const create_index_analytics_options& options,
                                      create_index_analytics_handler&& handler) const
{
  return impl_->create_index(index_name, dataset_name, fields, options.build(), std::move(handler));
}

auto
analytics_index_manager::create_index(const std::string& index_name,
                                      const std::string& dataset_name,
                                      const std::map<std::string, std::string>& fields,
                                      const create_index_analytics_options& options) const
  -> std::future<error>
{
  auto barrier = std::make_shared<std::promise<error>>();
  auto future = barrier->get_future();
  create_index(index_name, dataset_name, fields, options, [barrier](auto err) mutable {
    barrier->set_value({ std::move(err) });
  });
  return future;
}

void
analytics_index_manager::drop_index(const std::string& index_name,
                                    const std::string& dataset_name,
                                    const drop_index_analytics_options& options,
                                    drop_index_analytics_handler&& handler) const
{
  return impl_->drop_index(index_name, dataset_name, options.build(), std::move(handler));
}

auto
analytics_index_manager::drop_index(const std::string& index_name,
                                    const std::string& dataset_name,
                                    const drop_index_analytics_options& options) const
  -> std::future<error>
{
  auto barrier = std::make_shared<std::promise<error>>();
  auto future = barrier->get_future();
  drop_index(index_name, dataset_name, options, [barrier](auto err) mutable {
    barrier->set_value({ std::move(err) });
  });
  return future;
}

void
analytics_index_manager::get_all_indexes(const get_all_indexes_analytics_options& options,
                                         get_all_indexes_analytics_handler&& handler) const
{
  return impl_->get_all_indexes(options.build(), std::move(handler));
}

auto
analytics_index_manager::get_all_indexes(const get_all_indexes_analytics_options& options) const
  -> std::future<std::pair<error, std::vector<management::analytics_index>>>
{
  auto barrier =
    std::make_shared<std::promise<std::pair<error, std::vector<management::analytics_index>>>>();
  auto future = barrier->get_future();
  get_all_indexes(options, [barrier](auto err, auto resp) mutable {
    barrier->set_value({ std::move(err), std::move(resp) });
  });
  return future;
}

void
analytics_index_manager::connect_link(const connect_link_analytics_options& options,
                                      connect_link_analytics_handler&& handler) const
{
  return impl_->connect_link(options.build(), std::move(handler));
}

auto
analytics_index_manager::connect_link(const connect_link_analytics_options& options) const
  -> std::future<error>
{
  auto barrier = std::make_shared<std::promise<error>>();
  auto future = barrier->get_future();
  connect_link(options, [barrier](auto err) mutable {
    barrier->set_value({ std::move(err) });
  });
  return future;
}

void
analytics_index_manager::disconnect_link(const disconnect_link_analytics_options& options,
                                         disconnect_link_analytics_handler&& handler) const
{
  return impl_->disconnect_link(options.build(), std::move(handler));
}

auto
analytics_index_manager::disconnect_link(const disconnect_link_analytics_options& options) const
  -> std::future<error>
{
  auto barrier = std::make_shared<std::promise<error>>();
  auto future = barrier->get_future();
  disconnect_link(options, [barrier](auto err) mutable {
    barrier->set_value({ std::move(err) });
  });
  return future;
}

void
analytics_index_manager::get_pending_mutations(
  const get_pending_mutations_analytics_options& options,
  get_pending_mutations_analytics_handler&& handler) const
{
  return impl_->get_pending_mutations(options.build(), std::move(handler));
}

auto
analytics_index_manager::get_pending_mutations(
  const get_pending_mutations_analytics_options& options) const
  -> std::future<std::pair<error, std::map<std::string, std::map<std::string, std::int64_t>>>>
{
  auto barrier = std::make_shared<
    std::promise<std::pair<error, std::map<std::string, std::map<std::string, std::int64_t>>>>>();
  auto future = barrier->get_future();
  get_pending_mutations(options, [barrier](auto err, auto resp) mutable {
    barrier->set_value({ std::move(err), std::move(resp) });
  });
  return future;
}

void
analytics_index_manager::create_link(const management::analytics_link& link,
                                     const create_link_analytics_options& options,
                                     create_link_analytics_handler&& handler) const
{
  return impl_->create_link(link, options.build(), std::move(handler));
}

auto
analytics_index_manager::create_link(const management::analytics_link& link,
                                     const create_link_analytics_options& options) const
  -> std::future<error>
{
  auto barrier = std::make_shared<std::promise<error>>();
  auto future = barrier->get_future();
  create_link(link, options, [barrier](auto err) mutable {
    barrier->set_value({ std::move(err) });
  });
  return future;
}

void
analytics_index_manager::replace_link(const management::analytics_link& link,
                                      const replace_link_analytics_options& options,
                                      replace_link_analytics_handler&& handler) const
{
  return impl_->replace_link(link, options.build(), std::move(handler));
}

auto
analytics_index_manager::replace_link(const management::analytics_link& link,
                                      const replace_link_analytics_options& options) const
  -> std::future<error>
{
  auto barrier = std::make_shared<std::promise<error>>();
  auto future = barrier->get_future();
  replace_link(link, options, [barrier](auto err) mutable {
    barrier->set_value({ std::move(err) });
  });
  return future;
}

void
analytics_index_manager::drop_link(const std::string& link_name,
                                   const std::string& dataverse_name,
                                   const drop_link_analytics_options& options,
                                   drop_link_analytics_handler&& handler) const
{
  return impl_->drop_link(link_name, dataverse_name, options.build(), std::move(handler));
}

auto
analytics_index_manager::drop_link(const std::string& link_name,
                                   const std::string& dataverse_name,
                                   const drop_link_analytics_options& options) const
  -> std::future<error>
{
  auto barrier = std::make_shared<std::promise<error>>();
  auto future = barrier->get_future();
  drop_link(link_name, dataverse_name, options, [barrier](auto err) mutable {
    barrier->set_value({ std::move(err) });
  });
  return future;
}

void
analytics_index_manager::get_links(const get_links_analytics_options& options,
                                   get_links_analytics_handler&& handler) const
{
  return impl_->get_links(options.build(), std::move(handler));
}

auto
analytics_index_manager::get_links(const get_links_analytics_options& options) const
  -> std::future<std::pair<error, std::vector<std::unique_ptr<management::analytics_link>>>>
{
  auto barrier = std::make_shared<
    std::promise<std::pair<error, std::vector<std::unique_ptr<management::analytics_link>>>>>();
  auto future = barrier->get_future();
  get_links(options, [barrier](auto err, auto resp) mutable {
    barrier->set_value({ std::move(err), std::move(resp) });
  });
  return future;
}

management::analytics_link::analytics_link(std::string name, std::string dataverse_name)
  : name(std::move(name))
  , dataverse_name(std::move(dataverse_name))
{
}

management::couchbase_remote_analytics_link::couchbase_remote_analytics_link(
  std::string name,
  std::string dataverse_name,
  std::string hostname,
  couchbase_analytics_encryption_settings encryption,
  std::optional<std::string> username,
  std::optional<std::string> password)
  : analytics_link(std::move(name), std::move(dataverse_name))
  , hostname(std::move(hostname))
  , encryption(std::move(encryption))
  , username(std::move(username))
  , password(std::move(password))
{
}

management::s3_external_analytics_link::s3_external_analytics_link(
  std::string name,
  std::string dataverse_name,
  std::string access_key_id,
  std::string secret_access_key,
  std::string region,
  std::optional<std::string> session_token,
  std::optional<std::string> service_endpoint)
  : analytics_link(std::move(name), std::move(dataverse_name))
  , access_key_id(std::move(access_key_id))
  , secret_access_key(std::move(secret_access_key))
  , region(std::move(region))
  , session_token(std::move(session_token))
  , service_endpoint(std::move(service_endpoint))
{
}

management::azure_blob_external_analytics_link::azure_blob_external_analytics_link(
  std::string name,
  std::string dataverse_name,
  std::optional<std::string> connection_string,
  std::optional<std::string> account_name,
  std::optional<std::string> account_key,
  std::optional<std::string> shared_access_signature,
  std::optional<std::string> blob_endpoint,
  std::optional<std::string> endpoint_suffix)
  : analytics_link(std::move(name), std::move(dataverse_name))
  , connection_string(std::move(connection_string))
  , account_name(std::move(account_name))
  , account_key(std::move(account_key))
  , shared_access_signature(std::move(shared_access_signature))
  , blob_endpoint(std::move(blob_endpoint))
  , endpoint_suffix(std::move(endpoint_suffix))
{
}
} // namespace couchbase
