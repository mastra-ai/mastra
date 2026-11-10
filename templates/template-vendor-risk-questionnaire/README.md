# Vendor Risk Questionnaire

Upload an XLSX or DOCX vendor risk questionnaire, review answers drafted from your organization's approved evidence, and download the completed questionnaire in its original format. In the web demo, you can check citations, see where evidence is missing, and decide what information to share. Nothing is exported until you approve it.

## Why we built this

Each customer brings a different vendor risk questionnaire, often asking similar questions about security, compliance or business operations. Answering means finding policies and records across teams, checking that they are current, and deciding what can be shared. Copying an old answer can repeat an outdated claim or describe controls the company hasn't implemented.

This template brings approved evidence and cited drafts into one review flow. It flags answers that lack support so reviewers can correct them, leave them unanswered or withhold them. Mastra workflows coordinate intake, drafting, approval and export; your team decides what to share.

## Demo

<video controls width="640" height="360" src="https://res.cloudinary.com/mastra-assets/video/upload/v1791907234/Vendor-Risk-Questionnaire_oabldy.mp4"></video>

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` in `.env`. The default model is `openai/gpt-6.1-sol`. Optionally set `VRQ_MODEL` to another OpenAI model that supports Responses, structured output and medium reasoning.
- **Local access token**: set `MASTRA_STUDIO_TOKEN` to a private random value. Generate one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and paste it into `.env`. Enter the same token when the web demo asks you to sign in.
- Sample questionnaires and evidence are included in the demo setup. No external storage or database account is needed.

## Quickstart 🚀

1. **Create the project**
   - Run `npx create-mastra@latest --template vendor-risk-questionnaire` and choose `vendor-risk-questionnaire` as the project directory.
   - Run `cd vendor-risk-questionnaire`, then `npm install` to install both the backend and web dependencies.
2. **Add your API key**
   - Run `cp .env.example .env` and fill in your key as described under Prerequisites.
3. **Prepare the demo**
   - Run `npm run demo` to generate sample questionnaires, evidence and profile. Existing data and configuration are preserved.
4. **Start the web demo**
   - Run `npm run dev` to start Mastra and the web interface together.
   - Follow [Try it out](#try-it-out) to upload the sample and review its draft answers.

## Try it out

1. **Upload a questionnaire**
   - Open [the web demo](http://127.0.0.1:5173). In **Upload**, select `.runtime/demo/questionnaire.xlsx`, then select **Submit**.
   - The questionnaire appears under **Questionnaires**. Answer any mapping prompts and wait for processing to finish; drafts, citations and evidence gaps will appear for review.
2. **Review each answer**
   - Read the draft and its citations, then choose how to handle each answer: release it if the evidence supports it, make a correction based on the evidence, or mark it as `unknown` or `withheld`.
   - The sample includes missing and conflicting evidence. Keep those limitations visible, and approve sharing for any sources that require your permission.
3. **Check all answers together**
   - Select **Review** to validate your choices. Resolve any reported issues, then review all the proposed responses together. Your approval is still required before export.
   - To try resuming a review, reload the page after validation and reopen the questionnaire under **Questionnaires**. Your submitted choices remain available.
4. **Approve and download**
   - Select **APPROVE** and confirm in the dialog. When export finishes, **Download** becomes available.
   - Download the completed XLSX file. It preserves the questionnaire's format and includes your approved responses, with unknown or withheld answers clearly marked.
5. **Inspect the run**
   - Open **Review metrics** for the questionnaire to see answer outcomes, model usage and review activity.

To try Word, repeat the same steps with `.runtime/demo/questionnaire.docx`. You'll receive a completed DOCX file.

## Customization

- Open the project in your coding agent: “Configure our approved evidence sources and map our customer questionnaire fields. Explore the code and propose a plan before making changes.”
- Replace the demo evidence with your organization's approved sources using the [evidence configuration guide](https://github.com/mastra-ai/mastra/blob/main/templates/template-vendor-risk-questionnaire/docs/local-operation.md#configure-your-organizations-evidence).

## Guides by task

| Task                                                 | Guide                                                                                                                                                                      |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configure evidence files and `.runtime/profile.json` | [Evidence setup](https://github.com/mastra-ai/mastra/blob/main/templates/template-vendor-risk-questionnaire/docs/local-operation.md#configure-your-organizations-evidence) |
| Map your questionnaire's rows and answer fields      | [Formats and field mapping](https://github.com/mastra-ai/mastra/blob/main/templates/template-vendor-risk-questionnaire/docs/intake.md)                                     |
| Understand drafting and adjust execution limits      | [Evidence retrieval and drafting](https://github.com/mastra-ai/mastra/blob/main/templates/template-vendor-risk-questionnaire/docs/drafting.md)                             |
| Adapt the interface, integrate the API or deploy     | [Web UI and HTTP API](https://github.com/mastra-ai/mastra/blob/main/templates/template-vendor-risk-questionnaire/docs/ui.md)                                               |
| Use the terminal or run development checks           | [Local operation and development](https://github.com/mastra-ai/mastra/blob/main/templates/template-vendor-risk-questionnaire/docs/local-operation.md)                      |
| Approve answers, recover a run or clean up its data  | [Review and approval](https://github.com/mastra-ai/mastra/blob/main/templates/template-vendor-risk-questionnaire/docs/review.md)                                           |
| Run evaluations and interpret metrics                | [Evaluation and metrics](https://github.com/mastra-ai/mastra/blob/main/templates/template-vendor-risk-questionnaire/docs/evaluation.md)                                    |

## Evidence formats and integrations

Evidence currently comes from local XLSX, PDF, CSV, JSON and Markdown files. DOCX is supported for questionnaires, but not as evidence; scanned PDFs and OCR are not supported. The [input guide](https://github.com/mastra-ai/mastra/blob/main/templates/template-vendor-risk-questionnaire/docs/intake.md) describes layout restrictions.

To work with additional data sources, explore [Organization Intelligence](https://mastra.ai/templates/organization-intelligence) for Google Drive and S3, [Chat with PDF](https://mastra.ai/templates/chat-with-pdf) for retrieval over PDFs, and [Chat with Database](https://mastra.ai/templates/text-to-sql) for SQL access. Use these as starting points to add APIs, databases or external systems to your evidence pipeline, preserving source approval, citations and disclosure rules. Those integrations require customization and are not included here.

## About Mastra templates

This is an official Mastra template. Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synchronized to standalone repositories.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md)
