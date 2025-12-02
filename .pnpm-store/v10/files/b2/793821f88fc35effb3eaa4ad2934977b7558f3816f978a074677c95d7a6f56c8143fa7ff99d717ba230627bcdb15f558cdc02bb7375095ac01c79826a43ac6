{
  "interfaces": {
    "google.firestore.v1beta1.Firestore": {
      "retry_codes": {
        "non_idempotent": [],
        "idempotent": [
          "DEADLINE_EXCEEDED",
          "UNAVAILABLE"
        ]
      },
      "retry_params": {
        "default": {
          "initial_retry_delay_millis": 100,
          "retry_delay_multiplier": 1.3,
          "max_retry_delay_millis": 60000,
          "initial_rpc_timeout_millis": 60000,
          "rpc_timeout_multiplier": 1,
          "max_rpc_timeout_millis": 60000,
          "total_timeout_millis": 600000
        }
      },
      "methods": {
        "GetDocument": {
          "timeout_millis": 60000,
          "retry_codes_name": "idempotent",
          "retry_params_name": "default"
        },
        "ListDocuments": {
          "timeout_millis": 60000,
          "retry_codes_name": "idempotent",
          "retry_params_name": "default"
        },
        "UpdateDocument": {
          "timeout_millis": 60000,
          "retry_codes_name": "non_idempotent",
          "retry_params_name": "default"
        },
        "DeleteDocument": {
          "timeout_millis": 60000,
          "retry_codes_name": "idempotent",
          "retry_params_name": "default"
        },
        "BatchGetDocuments": {
          "timeout_millis": 300000,
          "retry_codes_name": "idempotent",
          "retry_params_name": "default"
        },
        "BeginTransaction": {
          "timeout_millis": 60000,
          "retry_codes_name": "idempotent",
          "retry_params_name": "default"
        },
        "Commit": {
          "timeout_millis": 60000,
          "retry_codes_name": "non_idempotent",
          "retry_params_name": "default"
        },
        "Rollback": {
          "timeout_millis": 60000,
          "retry_codes_name": "idempotent",
          "retry_params_name": "default"
        },
        "RunQuery": {
          "timeout_millis": 300000,
          "retry_codes_name": "idempotent",
          "retry_params_name": "default"
        },
        "PartitionQuery": {
          "retry_codes_name": "non_idempotent",
          "retry_params_name": "default"
        },
        "Write": {
          "timeout_millis": 86400000,
          "retry_codes_name": "non_idempotent",
          "retry_params_name": "default"
        },
        "Listen": {
          "timeout_millis": 86400000,
          "retry_codes_name": "idempotent",
          "retry_params_name": "default"
        },
        "ListCollectionIds": {
          "timeout_millis": 60000,
          "retry_codes_name": "idempotent",
          "retry_params_name": "default"
        },
        "BatchWrite": {
          "retry_codes_name": "non_idempotent",
          "retry_params_name": "default"
        },
        "CreateDocument": {
          "timeout_millis": 60000,
          "retry_codes_name": "non_idempotent",
          "retry_params_name": "default"
        }
      }
    }
  }
}
