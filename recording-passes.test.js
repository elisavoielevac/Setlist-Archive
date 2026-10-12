const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

// Exercise the existing plain-script detector without booting the desktop UI.
const source = fs.readFileSync(`${__dirname}/app.js`, "utf8");
const context = vm.createContext({});
const tolerance = source.match(/^const SET_BOUNDARY_SYNC_TOLERANCE_SECONDS = .*;$/m);
assert.ok(tolerance);
const start = source.indexOf("function clusterRecordingTimestamps(");
const end = source.indexOf("function levenshtein(", start);
assert.ok(start >= 0 && end > start);
vm.runInContext(`${tolerance[0]}\n${source.slice(start, end)}`, context);
const detect = (items) => JSON.parse(JSON.stringify(context.detectRecordingPasses(items)));

function recording(start, end, trackCount = 20) {
  return Array.from({ length: trackCount }, (_, index) => ({
    position: start, length: end - start, track: index + 1,
  }));
}
const mtc = { position: 0, length: 14404.2387063035, track: 0 };

function expectPasses(items, expected) {
  const passes = detect(items);
  assert.equal(passes.length, expected.length);
  passes.forEach((pass, index) => {
    const [start, end] = expected[index];
    assert.ok(Math.abs(pass.start - start) < 1e-8);
    assert.ok(Math.abs(pass.end - end) < 1e-8);
    assert.ok(Math.abs(pass.duration - (end - start)) < 1e-8);
  });
  return passes;
}

test("Bradford timings produce two sets and exclude the break and MTC tail", () => {
  const secondStart = 3233.1601458333334;
  const secondEnd = secondStart + 3141.292;
  const passes = expectPasses([
    mtc, ...recording(0, 3214.796), ...recording(secondStart, secondEnd),
  ], [[0, 3214.796], [secondStart, secondEnd]]);
  assert.ok(Math.abs(passes.reduce((sum, pass) => sum + pass.duration, 0) - 6356.088) < 1e-8);
});

test("a single set ignores an isolated long-running track", () => {
  expectPasses([mtc, ...recording(0, 3000)], [[0, 3000]]);
});

test("back-to-back sets still split", () => {
  expectPasses([mtc, ...recording(0, 3000), ...recording(3000, 6000)], [[0, 3000], [3000, 6000]]);
});

test("three sets exclude each recording break", () => {
  expectPasses([mtc, ...recording(0, 1000), ...recording(1300, 2300), ...recording(2600, 3600)],
    [[0, 1000], [1300, 2300], [2600, 3600]]);
});

test("a split on one track does not split the show", () => {
  const items = recording(0, 6000);
  items.shift();
  expectPasses([mtc, ...items,
    { position: 0, length: 3000, track: 1 },
    { position: 3100, length: 2900, track: 1 },
  ], [[0, 6000]]);
});

test("a shared stop requires a supported restart", () => {
  expectPasses([mtc, ...recording(0, 6000), ...recording(0, 3000, 11),
    { position: 3100, length: 2900, track: 1 },
  ], [[0, 6000]]);
});

test("small timing differences still identify a common boundary", () => {
  const first = recording(0, 3000).map((item, index) => ({ ...item, length: item.length + index * 0.01 }));
  const second = recording(3000.3, 6000);
  const boundary = (first.reduce((sum, item) => sum + item.length, 0) + 20 * 3000.3) / 40;
  expectPasses([mtc, ...first, ...second], [[0, boundary], [boundary, 6000]]);
});

test("empty and unusable recordings have no sets", () => {
  expectPasses([], []);
  expectPasses([{ position: 0, length: 0, track: 1 }, { position: NaN, length: 10, track: 2 }], []);
});
