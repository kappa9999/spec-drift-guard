const fs = require('fs');
const https = require('https');
const path = require('path');

function getInput(name, options) {
  const key = `INPUT_${String(name).replace(/ /g, '_').toUpperCase()}`;
  const value = process.env[key];
  if ((value === undefined || value === '') && options && options.required) {
    throw new Error(`Missing required input: ${name}`);
  }
  if ((value === undefined || value === '') && options && options.defaultValue !== undefined) {
    return options.defaultValue;
  }
  return value;
}

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
    body: payload.pull_request.body || ''
  };
}

function fileMatchesAc(file, acId) {
  if (!file) return false;
  if (file.filename && file.filename.includes(acId)) return true;
  if (file.patch && file.patch.includes(acId)) return true;
  return false;
}

function requestJson(options) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 300) {
          return reject(new Error(`GitHub API error ${res.statusCode}: ${data}`));
        }
        resolve({
          json: data ? JSON.parse(data) : null,
          headers: res.headers
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function listAllPrFiles(token, owner, repo, pullNumber) {
  const files = [];
  let page = 1;
  while (true) {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/pulls/${pullNumber}/files?per_page=100&page=${page}`,
      headers: {
        'User-Agent': 'spec-drift-guard',
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      }
    };
    const result = await requestJson(options);
    const batch = Array.isArray(result.json) ? result.json : [];
    files.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return files;
}

function writeSummary(text) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  fs.appendFileSync(summaryPath, text + '\n');
}

function notice(msg) {
  process.stdout.write(`::notice::${msg}\n`);
}

function warning(msg) {
  process.stdout.write(`::warning::${msg}\n`);
}

function fail(msg) {
  process.stdout.write(`::error::${msg}\n`);
  process.exitCode = 1;
}

async function main() {
  try {
    const token = getInput('token', { required: true });
    const acRegex = getInput('ac_regex', { defaultValue: 'AC-[0-9]+' }) || 'AC-[0-9]+';
    const requireAc = toBool(getInput('require_ac', { defaultValue: 'false' }), false);
    const failOnMissing = toBool(getInput('fail_on_missing', { defaultValue: 'true' }), true);
    const writeSummaryFlag = toBool(getInput('summary', { defaultValue: 'true' }), true);

    const payload = readEventPayload();
    const prInfo = getPrInfo(payload);
    if (!prInfo) {
      warning('Spec Drift Guard: not a pull_request event. Skipping.');
      return;
    }

    const repoFull = process.env.GITHUB_REPOSITORY || '';
    const parts = repoFull.split('/');
    const owner = parts[0];
    const repo = parts[1];

    if (!owner || !repo) {
      throw new Error('GITHUB_REPOSITORY is not set');
    }

    const acIds = extractAcIds(prInfo.body, acRegex);

    if (acIds.length === 0) {
      const msg = 'No acceptance criteria IDs found in PR description.';
      if (requireAc) {
        fail(msg);
      } else {
        notice(msg);
      }
      if (writeSummaryFlag) {
        writeSummary('## Spec Drift Guard\n');
        writeSummary(msg);
      }
      return;
    }

    const files = await listAllPrFiles(token, owner, repo, prInfo.number);
    const missing = [];

    for (const acId of acIds) {
      const covered = files.some((file) => fileMatchesAc(file, acId));
      if (!covered) missing.push(acId);
    }

    if (writeSummaryFlag) {
      writeSummary('## Spec Drift Guard\n');
      writeSummary(`AC IDs found: ${acIds.join(', ')}\n`);
      if (missing.length === 0) {
        writeSummary('All AC IDs appear in PR file diffs or filenames.');
      } else {
        writeSummary(`Missing coverage: ${missing.join(', ')}`);
        writeSummary('Add the AC IDs to code, tests, or analytics changes.');
      }
    }

    if (missing.length > 0) {
      const message = `Spec drift detected. Missing AC IDs in changes: ${missing.join(', ')}`;
      if (failOnMissing) {
        fail(message);
      } else {
        warning(message);
      }
    } else {
      notice('Spec Drift Guard: all AC IDs covered.');
    }
  } catch (err) {
    fail(err && err.message ? err.message : String(err));
  }
}

main();
