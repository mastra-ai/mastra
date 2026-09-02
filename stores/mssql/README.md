# @mastra/mssql

Microsoft SQL Server implementation for Mastra, providing general storage capabilities with connection pooling and transaction support.

## Installation

```bash
npm install @mastra/mssql
```

## Usage

### Storage

#### Basic Configuration

MSSQLStore supports multiple connection methods:

**1. Connection String (Recommended)**

```typescript
import { MSSQLStore } from '@mastra/mssql';

const store = new MSSQLStore({
  id: 'mssql-storage',
  connectionString:
    'Server=localhost,1433;Database=mastra;User Id=sa;Password=yourPassword;Encrypt=true;TrustServerCertificate=true',
});
```

## Documentation

- [Microsoft SQL Server integration guide](https://mastra.ai/integrations/databases/mssql)
- [Storage reference](https://mastra.ai/reference/storage/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/mssql/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
