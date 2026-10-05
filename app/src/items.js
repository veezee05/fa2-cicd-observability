// Pure logic for the Lost & Found portal.
// Extracted from the page so it can be unit tested in CI without a browser.

export const STATUS = Object.freeze({ LOST: "lost", FOUND: "found" });

/**
 * Filter items by free-text search and status.
 * Search matches item name or location, case-insensitively.
 */
export function filterItems(items, { search = "", status = "all" } = {}) {
  const q = search.trim().toLowerCase();

  return items.filter((item) => {
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q);

    const matchesStatus = status === "all" || item.status === status;

    return matchesSearch && matchesStatus;
  });
}

/** Counts shown in the stats bar. */
export function computeStats(items) {
  return {
    lost: items.filter((i) => i.status === STATUS.LOST).length,
    found: items.filter((i) => i.status === STATUS.FOUND).length,
    total: items.length,
  };
}

/**
 * Validate a submitted report.
 * Returns { valid, errors } — errors is a field->message map.
 */
export function validateReport(input) {
  const errors = {};

  if (!input || typeof input !== "object") {
    return { valid: false, errors: { form: "No data submitted" } };
  }

  if (!input.name || !input.name.trim()) {
    errors.name = "Item name is required";
  }
  if (!input.location || !input.location.trim()) {
    errors.location = "Location is required";
  }
  if (!input.contact || !input.contact.trim()) {
    errors.contact = "Contact info is required";
  }
  if (input.status !== STATUS.LOST && input.status !== STATUS.FOUND) {
    errors.status = "Status must be lost or found";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Normalise a validated report into a stored item. */
export function buildItem(input, now = "just now") {
  return {
    status: input.status,
    name: input.name.trim(),
    location: input.location.trim(),
    desc: (input.desc || "").trim(),
    contact: input.contact.trim(),
    time: now,
  };
}

/** Escape text before inserting into HTML. */
export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
