# @mastra/auth-firebase

A Firebase authentication integration package for Mastra applications. This package provides seamless integration with Firebase Authentication and Firestore for user authentication and authorization.

## Installation

```bash
npm install @mastra/auth-firebase
# or
yarn add @mastra/auth-firebase
# or
pnpm add @mastra/auth-firebase
```

## Features

- Firebase Authentication integration
- Firestore-based user authorization
- Support for service account credentials
- Automatic token verification
- User access control through Firestore

## Usage

```typescript
import { Mastra } from '@mastra/core';
import { MastraAuthFirebase } from '@mastra/auth-firebase';

// Initialize with default configuration
const auth = new MastraAuthFirebase();

// Or with custom options
const auth = new MastraAuthFirebase({
  serviceAccount: 'path/to/service-account.json',
  databaseId: 'your-database-id',
});

// Enable auth in Mastra
const mastra = new Mastra({
  ...
  server: {
    experimental_auth: auth,
  },
});
```

## Configuration

The package can be configured through constructor options or environment variables:

### Constructor Options

- `serviceAccount`: Path to Firebase service account JSON file
- `databaseId`: Firestore database ID

### Environment Variables

- `FIREBASE_SERVICE_ACCOUNT`: Path to Firebase service account JSON file
- `FIRESTORE_DATABASE_ID` or `FIREBASE_DATABASE_ID`: Firestore database ID

## User Authorization

The package uses Firestore to manage user access. It expects a collection named `user_access` with documents keyed by user UIDs. The presence of a document in this collection determines whether a user is authorized.
