# AgentBuilder Test Suite

This directory contains comprehensive testing tools to validate the AgentBuilder's capabilities for creating complete Mastra projects.

## 🧪 Test Files

### `simple-test.js` - Quick Validation Runner

A simple JavaScript test runner for quick validation of AgentBuilder capabilities.

**Features:**

- Single prompt testing
- Basic file validation
- Production-ready project creation
- Manual validation guidance

### `test-agent-builder.ts` - Comprehensive Test Suite

A comprehensive TypeScript test suite with multiple scenarios.

**Features:**

- 3 predefined test scenarios (Weather Agent, E-commerce Chatbot, Data Analysis)
- Automated validation scoring
- Performance metrics
- Detailed reporting

## 🚀 Quick Start

### Prerequisites

1. **Build the AgentBuilder package:**

   ```bash
   cd packages/agent-builder
   pnpm build
   ```

2. **Install required dependencies:**

   ```bash
   pnpm install @ai-sdk/openai
   ```

3. **Set up OpenAI API key:**
   ```bash
   export OPENAI_API_KEY="your-openai-api-key-here"
   ```

### Running Tests

#### Simple Test (Recommended)

```bash
# Run default weather agent test
node simple-test.js

# Run with custom prompt
node simple-test.js "Create a todo app with Mastra and SQLite memory"

# Get help
node simple-test.js --help
```

#### Comprehensive Test Suite

```bash
# Set up test environment
npm install -g ts-node

# Run comprehensive tests
node --loader ts-node/esm test-agent-builder.ts
```

## 📊 What Gets Tested

### Core Capabilities

- **Project Creation**: Complete Mastra project structure
- **File Generation**: Package.json, TypeScript config, source files
- **Code Quality**: Production-ready code without TODOs
- **Documentation**: README, environment setup, API docs
- **Architecture**: Proper Mastra conventions and patterns

### Validation Criteria

- ✅ **File Structure** (40% of score): Expected files created
- ✅ **Feature Implementation** (30% of score): Required functionality present
- ✅ **Quality Standards** (30% of score): TypeScript, documentation, error handling

### Test Scenarios

#### 1. Weather Agent Project

Creates a complete weather application with:

- Real-time weather API integration
- SQLite memory for conversation history
- RESTful API server
- TypeScript + Zod validation
- Production deployment setup

#### 2. E-commerce Chatbot

Builds a customer service chatbot with:

- Product search functionality
- Order management tools
- Customer context memory
- Escalation workflows
- Multi-channel API support

#### 3. Data Analysis Agent

Develops a data processing system with:

- CSV file processing
- Statistical analysis
- Chart generation
- Report creation
- Caching mechanisms

## 📁 Output Structure

Tests create output directories with generated projects:

```
agent-builder-tests/
├── test-output/                 # Simple test output
├── weather-agent-project/       # Weather test scenario
├── e-commerce-chatbot/          # E-commerce test scenario
└── data-analysis-agent/         # Data analysis test scenario
```

Each generated project should include:

- `package.json` with dependencies
- `src/` directory with TypeScript source
- `README.md` with setup instructions
- `.env.example` for configuration
- Complete Mastra configuration

## 🎯 Validation Steps

### Automated Validation

The test suite automatically checks:

1. File existence and structure
2. Code content for required features
3. Configuration completeness
4. Documentation presence

### Manual Validation

For complete validation, manually verify:

1. **Install Dependencies:**

   ```bash
   cd test-output  # or specific test directory
   npm install
   ```

2. **TypeScript Compilation:**

   ```bash
   npm run build
   # Should compile without errors
   ```

3. **Server Startup:**

   ```bash
   npm run dev
   # Should start server successfully
   ```

4. **API Testing:**

   ```bash
   curl http://localhost:4200/health
   # Should return healthy status
   ```

5. **Code Quality Review:**
   - Check for production-ready patterns
   - Verify error handling implementation
   - Review TypeScript types and Zod schemas
   - Validate Mastra best practices

## 📈 Scoring System

### Simple Test

- **75%+**: SUCCESS - AgentBuilder working well
- **50-74%**: PARTIAL - Some issues identified
- **<50%**: NEEDS IMPROVEMENT - Major issues

### Comprehensive Test

- **85%+**: EXCELLENT - Production level performance
- **70-84%**: GOOD - Minor improvements needed
- **<70%**: NEEDS IMPROVEMENT - Review failed criteria

## 🐛 Troubleshooting

### Common Issues

1. **Dependency Error:**

   ```
   Cannot find module '@ai-sdk/openai'
   ```

   **Solution:** `pnpm install @ai-sdk/openai`

2. **Build Error:**

   ```
   AgentBuilder is not defined
   ```

   **Solution:** `pnpm build` in agent-builder directory

3. **API Key Error:**

   ```
   OpenAI API key not found
   ```

   **Solution:** `export OPENAI_API_KEY="your-key"`

4. **Permission Error:**
   ```
   Cannot create directory
   ```
   **Solution:** Check write permissions for test directories

### Debug Mode

For detailed debugging, modify test files:

```javascript
// Enable verbose logging
const agentBuilder = new AgentBuilder({
  // ... other options
  logger: console, // Add logging
});
```

## 🔧 Customization

### Custom Test Scenarios

Add new scenarios to `test-agent-builder.ts`:

```typescript
{
  name: "Your Custom Test",
  description: "Test description",
  prompt: "Your test prompt here...",
  validationCriteria: ["Criterion 1", "Criterion 2"],
  expectedFiles: ["file1.ts", "file2.json"],
  expectedFeatures: ["feature1", "feature2"]
}
```

### Custom Validation

Extend validation logic in the test files to check for specific patterns, APIs, or architectural requirements.

## 📚 Examples

### Example Custom Prompts

```bash
# Chat application
node simple-test.js "Create a real-time chat app with Mastra, WebSockets, and message history"

# Content management
node simple-test.js "Build a CMS with Mastra agents for content generation and moderation"

# Analytics dashboard
node simple-test.js "Create an analytics dashboard with data visualization and reporting"

# AI assistant
node simple-test.js "Build a personal AI assistant with calendar, email, and task management"
```

### Expected Output Quality

The AgentBuilder should generate:

- Complete, runnable projects
- Production-quality code
- Comprehensive documentation
- Proper error handling
- Security best practices
- Performance optimizations

## 🎉 Success Criteria

A successful test demonstrates that AgentBuilder can:

1. ✅ Create complete Mastra projects from natural language
2. ✅ Generate production-ready code without TODOs
3. ✅ Follow Mastra conventions and best practices
4. ✅ Include proper documentation and setup instructions
5. ✅ Build and run immediately after setup
6. ✅ Implement all requested features correctly
7. ✅ Handle errors gracefully
8. ✅ Use appropriate dependencies and configurations

---

**Happy Testing! 🚀**

If you encounter issues or have suggestions for improving the test suite, please refer to the troubleshooting section or modify the test files to suit your specific needs.
