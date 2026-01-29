# Spec Drift Guard

Minimal policy: Each acceptance criteria ID from the PR body must appear in the PR diff (code/tests/analytics).

AC IDs are discovered using a regex (default `AC-[0-9]+`).

Example AC list:
- AC-1
- AC-2
- AC-3

If the PR does not include those IDs in code changes, the action fails.
