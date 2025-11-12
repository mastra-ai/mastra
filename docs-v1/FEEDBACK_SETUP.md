# Docs Feedback Form - Airtable Setup Guide

## Overview

The feedback form is now implemented with Airtable integration. Follow these steps to set up data collection.

## Required Environment Variables

Add these to your `.env.local` file:

```bash
# Required: Your Airtable Personal Access Token
AIRTABLE_API_KEY=patXXXXXXXXXXXXXX

# Required: Your Airtable Base ID (starts with 'app')
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX

# Optional: Table name (defaults to "Feedback")
# Use the exact table name from Airtable - spaces are OK
AIRTABLE_TABLE_NAME=Docs Feedback
```

## Airtable Setup Steps

### 1. Create an Airtable Base

1. Go to [Airtable](https://airtable.com) and create a new base
2. Name it something like "Docs Feedback"

### 2. Create the Feedback Table

Create a table named "Feedback" (or "Docs Feedback" - either works) with these columns:

| Column Name       | Field Type       | Description                           |
| ----------------- | ---------------- | ------------------------------------- |
| **Feedback ID**   | Single line text | Unique identifier                     |
| **Feedback Text** | Long text        | The actual feedback content           |
| **Rating**        | Number           | Star rating (1-5)                     |
| **Email**         | Email            | User's email (optional)               |
| **Page URL**      | URL              | Which docs page the feedback is about |
| **User Agent**    | Long text        | Browser/device info                   |
| **Client IP**     | Single line text | User's IP address                     |
| **Timestamp**     | Date & time      | When feedback was submitted           |
| **Source**        | Single line text | Always "docs"                         |
| **Status**        | Single select    | New, In Review, Responded, Closed     |
| **Created Date**  | Date             | Date only (YYYY-MM-DD)                |

### 3. Get Your API Credentials

#### Get API Key:

1. Go to https://airtable.com/create/tokens
2. Create a new personal access token
3. Give it a name like "Docs Feedback"
4. Add these scopes:
   - `data.records:read`
   - `data.records:write`
5. Add access to your feedback base
6. Copy the token (starts with `pat`)

#### Get Base ID:

1. Go to https://airtable.com/api
2. Select your feedback base
3. Your base ID is shown in the URL and docs (starts with `app`)

### 4. Configure Environment

Create or update your `.env.local` file:

```bash
AIRTABLE_API_KEY=your_token_here
AIRTABLE_BASE_ID=your_base_id_here
AIRTABLE_TABLE_NAME=Feedback
```

### 5. Test the Integration

1. Start your development server: `npm run dev`
2. Go to any docs page
3. Click "Question? Give us feedback" at the bottom
4. Submit test feedback
5. Check your Airtable base to see the data

## Features

### What Gets Stored:

- ✅ User feedback text
- ✅ Star rating (1-5)
- ✅ User email (optional)
- ✅ Page URL where feedback was given
- ✅ Browser/device information
- ✅ Timestamp
- ✅ Unique feedback ID
- ✅ Status for tracking

### Error Handling:

- If Airtable fails, feedback is logged to console (fallback)
- Users still get success message
- Detailed error logging for debugging

### UI Features:

- Drawer-style form (slides from right)
- Star rating component
- Form validation
- Loading states
- Success/error feedback
- Mobile responsive

## Troubleshooting

### Common Issues:

1. **"Airtable configuration missing"**
   - Check your `.env.local` file exists
   - Verify `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID` are set
   - Restart your development server after adding env vars

2. **"422 Unprocessable Entity"**
   - Column names in Airtable don't match the API call
   - Verify all columns exist and have correct field types

3. **"401 Unauthorized"**
   - API key is incorrect or expired
   - Token doesn't have access to the base
   - Check token scopes include read/write permissions

4. **"403 Forbidden - Invalid permissions or model not found"**
   - API token doesn't have access to the base
   - Table name doesn't exist or is misspelled
   - Token scopes are insufficient
   - **Most common:** Check your `AIRTABLE_TABLE_NAME` matches exactly (case-sensitive)

5. **"404 Not Found"**
   - Base ID is incorrect
   - Table name doesn't match (check `AIRTABLE_TABLE_NAME`)

### Debug Mode:

Check the server console for detailed logs:

- 🚀 Request being sent to Airtable
- ✅ Successful storage
- ❌ Error details

## Production Deployment

For production, make sure to:

1. Set environment variables in your hosting platform
2. Use a production Airtable base (separate from development)
3. Consider rate limiting for the API endpoint
4. Set up monitoring for failed submissions

## Alternative Storage Options

The API is designed to be extensible. You can easily add:

- Database storage (PostgreSQL, MongoDB)
- Email notifications
- Webhook integrations
- Multiple storage backends

Just modify the `sendToAirtable` function or add additional storage functions in the API route.
