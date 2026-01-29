# Spec Drift Guard

A lightweight GitHub Action that checks whether PR acceptance criteria (AC IDs) are actually referenced in code/test/analytics changes.

## Why
Specs drift. PRs merge without tests or instrumentation linked to the acceptance criteria. This action blocks that drift.

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
      - uses: ./
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

## Demo PR (for CI)
This repo includes a demo PR branch that exercises the action:
- AC-1 is referenced in `docs/DEMO_PR_BODY.md`
- AC-2 is referenced in `src/demo.js`

## Limitations
- GitHub API `patch` content can be truncated for large diffs.
- If an AC is covered but not explicitly referenced in diffs, the action will still fail.

## Roadmap
- Per-path rules (tests vs analytics)
- Optional deep content scan
- PR comment with actionable fixes

