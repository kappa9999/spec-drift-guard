const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const github = require('@actions/github');

function toBool(input, fallback) {
  if (input === undefined || input === null || input === '') return fallback;
  return String(input).toLowerCase() === 'true';
}

function uniq(items) {
  return Array.from(new Set(items));
}

function extractAcIds(text, regexSource) {
  if (!text) return [];
  const regex = new RegExp(regexSource, 'g');
  const matches = text.match(regex);
  return matches ? uniq(matches) : [];
}

function readEventPayload() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return null;
  const raw = fs.readFileSync(eventPath, 'utf8');
  return JSON.parse(raw);
}

function getPrInfo(payload) {
  if (!payload || !payload.pull_request) return null;
  return {
    number: payload.pull_request.number,
    body: payload.pull_request.body || '',
    baseSha: payload.pull_request.base && payload.pull_request.base.sha,
    headSha: payload.pull_request.head && payload.pull_request.head.sha
  };
}

function fileMatchesAc(file, acId) {
  if (!file) return false;
  if (file.filename && file.filename.includes(acId)) return true;
  if (file.patch && file.patch.includes(acId)) return true;
  return false;
}

async function listAllPrFiles(octokit, owner, repo, pullNumber) {
  return await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100
  });
}

async function main() {
  try {
    const token = core.getInput('token', { required: true });
    const acRegex = core.getInput('ac_regex') || 'AC-[0-9]+';
    const requireAc = toBool(core.getInput('require_ac'), false);
    const failOnMissing = toBool(core.getInput('fail_on_missing'), true);
    const writeSummary = toBool(core.getInput('summary'), true);

    const payload = readEventPayload();
    const prInfo = getPrInfo(payload);
    if (!prInfo) {
      core.warning('Spec Drift Guard: not a pull_request event. Skipping.');
      return;
    }

    const { owner, repo } = github.context.repo;
    const octokit = github.getOctokit(token);

    const acIds = extractAcIds(prInfo.body, acRegex);

    if (acIds.length === 0) {
      const msg = 'No acceptance criteria IDs found in PR description.';
      if (requireAc) {
        core.setFailed(msg);
      } else {
        core.notice(msg);
      }
      if (writeSummary) {
        await core.summary
          .addHeading('Spec Drift Guard')
          .addRaw(msg)
          .write();
      }
      return;
    }

    const files = await listAllPrFiles(octokit, owner, repo, prInfo.number);
    const missing = [];

    for (const acId of acIds) {
      const covered = files.some((file) => fileMatchesAc(file, acId));
      if (!covered) missing.push(acId);
    }

    if (writeSummary) {
      const summary = core.summary.addHeading('Spec Drift Guard');
      summary.addRaw(`AC IDs found: ${acIds.join(', ')}\n\n`);
      if (missing.length === 0) {
        summary.addRaw('All AC IDs appear in PR file diffs or filenames.');
      } else {
        summary.addRaw(`Missing coverage: ${missing.join(', ')}\n`);
        summary.addRaw('Add the AC IDs to code, tests, or analytics changes.');
      }
      await summary.write();
    }

    if (missing.length > 0) {
      const message = `Spec drift detected. Missing AC IDs in changes: ${missing.join(', ')}`;
      if (failOnMissing) {
        core.setFailed(message);
      } else {
        core.warning(message);
      }
    } else {
      core.notice('Spec Drift Guard: all AC IDs covered.');
    }
  } catch (err) {
    core.setFailed(err && err.message ? err.message : String(err));
  }
}

main();
