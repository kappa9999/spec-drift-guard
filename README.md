# Spec Drift Guard

<p align="center">
  <img src="assets/logo.svg" width="160" alt="Spec Drift Guard logo" />
</p>

<p align="center">
  <b>Keep acceptance criteria aligned with code.</b><br>
  Lightweight GitHub Action to prevent spec drift in PRs.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-GitHub%20Actions-111111" />
  <img src="https://img.shields.io/badge/language-Node.js-111111" />
  <img src="https://img.shields.io/badge/purpose-PR%20Guard-111111" />
</p>

## What it does
Spec Drift Guard checks your PR description for acceptance criteria (AC IDs) and verifies that each AC appears in the actual code/test/analytics changes. If any AC ID is missing from the diff, the action fails.

This keeps requirements tied to implementation and prevents ?spec drift.?

## Quick start

1) Add a PR template with AC IDs:

```md
## Acceptance Criteria
- [ ] AC-1: User can reset password
- [ ] AC-2: Email is sent within 60 seconds
```

2) Add the workflow:

```yaml
name: Spec Drift Guard
on:
  pull_request:
    types: [opened, edited, synchronize]

jobs:
  spec-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./spec-drift-guard
        with:
          token: ${{ github.token }}
          ac_regex: "AC-[0-9]+"
          require_ac: "false"
          fail_on_missing: "true"
```

## How it works
- Parses the PR body using `ac_regex` (default `AC-[0-9]+`).
- Collects all files changed in the PR.
- Marks an AC as covered if it appears in a file name or in the diff patch.
- Fails the PR if any AC IDs are missing (configurable).

## Inputs
- `token` (required): GitHub token.
- `ac_regex`: Regex to find AC IDs in PR body.
- `require_ac`: Fail if no AC IDs are found.
- `fail_on_missing`: Fail if any AC IDs are missing from changes.
- `summary`: Write a summary to the Actions summary.

## Example policy
See `docs/POLICY.md`.

## Limitations
- GitHub API `patch` content can be truncated for large diffs.
- If an AC is covered but not explicitly referenced in diffs, the action will still fail.

## Roadmap
- Per-path rules (tests vs analytics)
- Optional deep content scan
- PR comment with actionable fixes

