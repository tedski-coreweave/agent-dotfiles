#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
}

const guidePath = resolve(option("--guide", "SUITABLE_MODELS.md"));
const settingsPath = resolve(option("--settings", "pi/agent/settings.json"));
const modelsFile = option("--models-file", "");
const errors = [];

function marked(text, name) {
  const start = `<!-- ${name}:start -->`;
  const end = `<!-- ${name}:end -->`;
  const from = text.indexOf(start);
  const to = text.indexOf(end);
  if (from === -1 || to === -1 || to <= from) {
    errors.push(`${guidePath}: missing or invalid ${name} markers`);
    return "";
  }
  return text.slice(from + start.length, to);
}

function selectorProvider(selector) {
  return selector.slice(0, selector.indexOf("/"));
}

function readLiveModels() {
  if (modelsFile) return readFileSync(resolve(modelsFile), "utf8");
  const result = spawnSync("pi", ["--list-models"], { encoding: "utf8" });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || result.error?.message || "unknown error").trim();
    errors.push(`pi --list-models failed: ${detail}`);
    return "";
  }
  return result.stdout;
}

function parseLiveModels(text) {
  const models = new Map();
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const fields = line.trim().split(/\s{2,}/);
    if (fields.length < 6) {
      errors.push(`unparseable pi --list-models row: ${line}`);
      continue;
    }
    const selector = `${fields[0]}/${fields[1]}`;
    models.set(selector, {
      context: fields[2],
      maxOutput: fields[3],
      thinking: fields[4],
      images: fields[5],
    });
  }
  return models;
}

const guide = readFileSync(guidePath, "utf8");
const catalogRows = [];
for (const line of marked(guide, "model-catalog").split(/\r?\n/)) {
  const match = line.match(/^\| `([^`]+)` \| (routed|alias|parked) \| (.+) \|$/);
  if (match) catalogRows.push({ selector: match[1], status: match[2], home: match[3] });
}
const routingRows = [];
for (const line of marked(guide, "reviewer-routing").split(/\r?\n/)) {
  const match = line.match(/^\| `([^`]+)` \| `([^`]+)` \|$/);
  if (match) routingRows.push({ parent: match[1], reviewer: match[2] });
}

const liveModels = parseLiveModels(readLiveModels());
const liveSet = new Set(liveModels.keys());
const coverage = new Map();
for (const row of catalogRows) {
  const rows = coverage.get(row.selector) ?? [];
  rows.push(row);
  coverage.set(row.selector, rows);
}
for (const selector of liveSet) {
  const rows = coverage.get(selector) ?? [];
  if (rows.length === 0) errors.push(`missing matrix home: ${selector}`);
  if (rows.length > 1) errors.push(`duplicate matrix home: ${selector}`);
}
for (const selector of coverage.keys()) {
  if (!liveSet.has(selector)) errors.push(`stale matrix selector: ${selector}`);
}
for (const row of catalogRows.filter((entry) => entry.status === "alias")) {
  const target = row.home.match(/`([^`]+)`/)?.[1];
  if (!target || !liveSet.has(target)) {
    errors.push(`alias target is not live: ${row.selector} -> ${target ?? row.home}`);
    continue;
  }
  const model = liveModels.get(row.selector);
  const canonical = liveModels.get(target);
  if (JSON.stringify(model) !== JSON.stringify(canonical)) {
    errors.push(`alias capabilities differ: ${row.selector} -> ${target}`);
  }
}

const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
const subagents = settings.subagents ?? {};
const allowed = subagents.modelScope?.agents?.reviewer?.allow ?? [];
if (subagents.modelScope?.enforce !== true || subagents.modelScope?.strict !== true) {
  errors.push("reviewer model scope must set enforce and strict true");
}
if (subagents.defaultModel) {
  errors.push("subagents.defaultModel bypasses exact model-to-model reviewer routing");
}
if (subagents.agentOverrides?.reviewer?.model) {
  errors.push("static reviewer model bypasses exact model-to-model routing");
}
for (const [provider, overrides] of Object.entries(subagents.agentOverridesByProvider ?? {})) {
  if (overrides?.reviewer?.model) errors.push(`provider reviewer override bypasses exact routing: ${provider}`);
}

const routing = new Map();
for (const row of routingRows) {
  if (routing.has(row.parent)) errors.push(`duplicate reviewer route for parent model: ${row.parent}`);
  routing.set(row.parent, row.reviewer);
  if (!liveSet.has(row.parent)) errors.push(`stale reviewer parent selector: ${row.parent}`);
  if (!liveSet.has(row.reviewer)) errors.push(`reviewer target is not live: ${row.reviewer}`);
  if (selectorProvider(row.reviewer) === selectorProvider(row.parent)) {
    errors.push(`reviewer route is not provider-complementary: ${row.parent} -> ${row.reviewer}`);
  }
  if (!allowed.includes(row.reviewer)) errors.push(`reviewer route is outside reviewer scope: ${row.reviewer}`);
}
for (const selector of liveSet) {
  if (!routing.has(selector)) errors.push(`missing reviewer route for parent model: ${selector}`);
}
for (const selector of allowed) {
  const row = coverage.get(selector)?.[0];
  if (!row || row.status !== "routed" || !/review/.test(row.home)) {
    errors.push(`allowed reviewer model is not routed to review in matrix: ${selector}`);
  }
}

for (const error of errors) console.error(`ERROR ${error}`);
const providers = new Set([...liveSet].map(selectorProvider));
console.log(`check-model-matrix: ${liveSet.size} models, ${providers.size} providers, ${errors.length} error(s)`);
process.exit(errors.length ? 1 : 0);
