// Unit tests for the Lost & Found item logic.
// Uses Node's built-in test runner — no external dependencies.
//   node --test app/tests/

import test from "node:test";
import assert from "node:assert/strict";

import {
  STATUS,
  filterItems,
  computeStats,
  validateReport,
  buildItem,
  escapeHtml,
} from "../src/items.js";

const sample = [
  { status: "lost", name: "Blue Water Bottle", location: "Library, 2nd Floor" },
  { status: "found", name: "Student ID Card", location: "Main Cafeteria" },
  { status: "lost", name: "Black Wired Earphones", location: "CS Lab, Row 3" },
  { status: "found", name: "Grey Umbrella", location: "Seminar Hall" },
];

test("filterItems returns everything when no filters are applied", () => {
  assert.equal(filterItems(sample).length, 4);
});

test("filterItems narrows by status", () => {
  assert.equal(filterItems(sample, { status: STATUS.LOST }).length, 2);
  assert.equal(filterItems(sample, { status: STATUS.FOUND }).length, 2);
});

test("filterItems matches item name, ignoring case", () => {
  const hits = filterItems(sample, { search: "UMBRELLA" });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].name, "Grey Umbrella");
});

test("filterItems matches location as well as name", () => {
  const hits = filterItems(sample, { search: "library" });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].name, "Blue Water Bottle");
});

test("filterItems combines search and status", () => {
  assert.equal(filterItems(sample, { search: "a", status: STATUS.FOUND }).length, 2);
  assert.equal(filterItems(sample, { search: "umbrella", status: STATUS.LOST }).length, 0);
});

test("filterItems ignores surrounding whitespace in the query", () => {
  assert.equal(filterItems(sample, { search: "   umbrella  " }).length, 1);
});

test("computeStats counts each status and the total", () => {
  assert.deepEqual(computeStats(sample), { lost: 2, found: 2, total: 4 });
});

test("computeStats handles an empty list", () => {
  assert.deepEqual(computeStats([]), { lost: 0, found: 0, total: 0 });
});

test("validateReport accepts a complete report", () => {
  const { valid, errors } = validateReport({
    status: "lost",
    name: "Calculator",
    location: "Exam Hall",
    contact: "me@example.com",
  });
  assert.equal(valid, true);
  assert.deepEqual(errors, {});
});

test("validateReport rejects missing required fields", () => {
  const { valid, errors } = validateReport({ status: "lost" });
  assert.equal(valid, false);
  assert.ok(errors.name);
  assert.ok(errors.location);
  assert.ok(errors.contact);
});

test("validateReport rejects whitespace-only input", () => {
  const { valid, errors } = validateReport({
    status: "found",
    name: "   ",
    location: "Lab",
    contact: "x@y.z",
  });
  assert.equal(valid, false);
  assert.ok(errors.name);
});

test("validateReport rejects an unknown status", () => {
  const { valid, errors } = validateReport({
    status: "misplaced",
    name: "Bag",
    location: "Gate",
    contact: "x@y.z",
  });
  assert.equal(valid, false);
  assert.ok(errors.status);
});

test("validateReport handles a non-object input", () => {
  assert.equal(validateReport(null).valid, false);
});

test("buildItem trims fields and defaults the description", () => {
  const item = buildItem({
    status: "lost",
    name: "  Notebook  ",
    location: " Room 12 ",
    contact: " a@b.c ",
  });
  assert.equal(item.name, "Notebook");
  assert.equal(item.location, "Room 12");
  assert.equal(item.contact, "a@b.c");
  assert.equal(item.desc, "");
  assert.equal(item.time, "just now");
});

test("escapeHtml neutralises injected markup", () => {
  assert.equal(
    escapeHtml('<script>alert("x")</script>'),
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
  );
});

test("escapeHtml handles null and undefined", () => {
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});
