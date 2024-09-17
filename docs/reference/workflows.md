# Workflows

## Blueprints

Kepler workflows combine a visual editor that modify configuration object that you commit to your repository.

A workflow is defined by a JSON object with the following structure:

| Field     | Type   | Description                                                   |
| --------- | ------ | ------------------------------------------------------------- |
| title     | string | The name of the workflow                                      |
| status    | string | The current status of the workflow (e.g., "PUBLISHED")        |
| createdAt | string | ISO 8601 timestamp of when the workflow was created           |
| id        | string | Unique identifier for the workflow                            |
| updatedAt | string | ISO 8601 timestamp of when the workflow was last updated      |
| trigger   | object | Defines the event that initiates the workflow                 |
| actions   | array  | List of actions to be executed when the workflow is triggered |

### Trigger

| Field   | Type   | Description                                                           |
| ------- | ------ | --------------------------------------------------------------------- |
| id      | string | Unique identifier for the trigger                                     |
| type    | string | The type of event that triggers the workflow (e.g., "BUTTON_CLICKED") |
| payload | object | Additional data for the trigger (can be empty)                        |

### Actions

Each action in the `actions` array is an object with the following structure:

| Field      | Type   | Description                                              |
| ---------- | ------ | -------------------------------------------------------- |
| id         | string | Unique identifier for the action                         |
| type       | string | The type of action to be performed (e.g., "CREATE_POST") |
| payload    | object | Data required for the action                             |
| variables  | object | Variables used in the action (can be empty)              |
| subActions | array  | List of actions to be executed after the main action     |

#### Payload (for CREATE_POST action)

| Field             | Type   | Description                                           |
| ----------------- | ------ | ----------------------------------------------------- |
| post              | string | The content of the post to be created                 |
| keplerReferenceId | string | Reference ID for the user or entity creating the post |

### SubActions

SubActions have a similar structure to main actions, with an additional field:

| Field          | Type   | Description             |
| -------------- | ------ | ----------------------- |
| parentActionId | string | ID of the parent action |

#### Payload (for SEND_MESSAGE_TO_CHANNEL action)

| Field             | Type   | Description                                             |
| ----------------- | ------ | ------------------------------------------------------- |
| channelId         | string | ID of the channel to send the message to                |
| message           | string | Content of the message, can include variables           |
| keplerReferenceId | string | Reference ID for the user or entity sending the message |

### Variables

Variables can be used to dynamically insert data into actions. They are defined in the `variables` object of an action:

```json
{
  "variables": {
    "message": {
      "twitterlink": {
        "refBlockId": "parentActionId",
        "path": "resultFieldName"
      }
    }
  }
}
```

- `refBlockId`: ID of the action to reference
- `path`: The field in the referenced action's result to use
