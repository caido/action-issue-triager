# GitHub Issue Triager Action

An AI-powered GitHub Action that automatically triages issues using Mastra and OpenAI. This action analyzes issue content and recommends appropriate labels based on your custom system prompt.

## Features

- 🤖 AI-powered issue analysis using OpenAI GPT models
- 🏷️ Automatic label recommendations based on issue content
- 📝 Customizable system prompts for project-specific triaging
- 🔧 Easy integration with existing GitHub workflows
- 📊 Detailed logging and output for transparency
- 🏗️ Modular architecture with separate prompt and agent management

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `openai-key` | OpenAI API key for the AI model | ✅ | - |
| `system-prompt-file` | Path to the system prompt file | ✅ | - |
| `github-token` | GitHub token for API access | ❌ | `${{ github.token }}` |
| `issue-number` | Issue number to triage | ❌ | Current issue from context |
| `repository` | Repository in format `owner/repo` | ❌ | Current repository |

## Outputs

| Output | Description |
|--------|-------------|
| `labels` | JSON array of recommended labels with reasons |
| `issue-number` | The issue number that was triaged |
| `repository` | The repository where the issue was triaged |

## Usage

### Basic Usage (Current Issue)

```yaml
name: Triage Issue
on:
  issues:
    types: [opened, edited]

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - name: Triage Issue
        uses: your-username/action-issue-triager@v1
        with:
          openai-key: ${{ secrets.OPENAI_API_KEY }}
          system-prompt-file: './prompts/triage-prompt.txt'
```

### Advanced Usage (Specific Issue)

```yaml
name: Triage Specific Issue
on:
  workflow_dispatch:
    inputs:
      issue-number:
        description: 'Issue number to triage'
        required: true
        type: string
      repository:
        description: 'Repository (owner/repo)'
        required: true
        type: string

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Triage Issue
        uses: your-username/action-issue-triager@v1
        with:
          openai-key: ${{ secrets.OPENAI_API_KEY }}
          system-prompt-file: './prompts/triage-prompt.txt'
          issue-number: ${{ github.event.inputs.issue-number }}
          repository: ${{ github.event.inputs.repository }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Using Outputs

```yaml
- name: Triage Issue
  id: triage
  uses: your-username/action-issue-triager@v1
  with:
    openai-key: ${{ secrets.OPENAI_API_KEY }}
    system-prompt-file: './prompts/triage-prompt.txt'

- name: Display Results
  run: |
    echo "Recommended labels: ${{ steps.triage.outputs.labels }}"
    echo "Issue: ${{ steps.triage.outputs.issue-number }}"
    echo "Repository: ${{ steps.triage.outputs.repository }}"
```

## System Prompt File

Create a text file with your custom system prompt. This will be used to instruct the AI on how to triage issues for your specific project.

### Example System Prompt (`prompts/triage-prompt.txt`)

```
ROLE DEFINITION
- You are a GitHub issue triaging assistant for the MyProject repository.
- Your key responsibility is to assign appropriate labels and categorize issues.
- Primary stakeholders are the development team seeking organized issue management.

CORE CAPABILITIES
- Analyze issue content, titles, and descriptions to understand the nature of the issue.
- Categorize issues by component (frontend, backend, docs), priority (high, medium, low), and type (bug, feature, enhancement).

BEHAVIORAL GUIDELINES
- Maintain a systematic and consistent approach to issue categorization.
- Be thorough in analyzing issue content before making decisions.
- Follow established project conventions and labeling standards.
- Always use existing labels, do not suggest new ones.

LABELING RULES
- Use "bug" for issues that describe unexpected behavior
- Use "enhancement" for feature requests
- Use "documentation" for issues related to docs
- Use "priority:high" for critical issues affecting production
- Use "priority:medium" for important but not critical issues
- Use "priority:low" for nice-to-have improvements

CONSTRAINTS & BOUNDARIES
- Only work with GitHub issues and related metadata.
- Do not make assumptions about project-specific conventions without context.
- Never override existing assigned labels.

SUCCESS CRITERIA
- Deliver accurate and consistent issue categorization.
- Achieve high accuracy in label assignments.
```

## Setup

1. **Create your system prompt file** in your repository
2. **Add your OpenAI API key** as a repository secret named `OPENAI_API_KEY`
3. **Create a workflow file** (`.github/workflows/triage.yml`) using the examples above
4. **Test the action** by creating or editing an issue

## Development

### Building the Action

```bash
# Install dependencies
npm install

# Build the action
npm run build
```

### Local Testing

```bash
# Run the Mastra development server
npm run dev
```

## Requirements

- Node.js >= 20.9.0
- OpenAI API key
- GitHub repository with issues enabled

## License

ISC

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions, please open an issue in the repository.
