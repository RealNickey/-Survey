/**
 * ETLab Survey Autofiller – content.js
 * Runs on *://*.etlab.in/survey/*
 */

(function () {
  "use strict";

  // ─── Constants ────────────────────────────────────────────────────────────
  const PANEL_ID = "etlab-autofiller-panel";
  const STORAGE_KEY_MODE = "etlab_mode";
  const STORAGE_KEY_AUTOSUBMIT = "etlab_autosubmit";

  const MODES = {
    ALL_POSITIVE: "All Positive",
    ALL_NEGATIVE: "All Negative",
    RANDOM: "Random",
    MOSTLY_POSITIVE: "Mostly Positive",
    MOSTLY_NEGATIVE: "Mostly Negative",
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Returns a Map<name, HTMLInputElement[]> of all radio groups on the page.
   * Only groups with ≥ 2 radios are considered survey questions.
   */
  function getQuestionGroups() {
    const radios = Array.from(
      document.querySelectorAll('input[type="radio"]')
    );
    const groups = new Map();
    radios.forEach((r) => {
      const n = r.name;
      if (!n) return;
      if (!groups.has(n)) groups.set(n, []);
      groups.get(n).push(r);
    });
    // Keep only groups with at least 2 options
    for (const [key, val] of groups) {
      if (val.length < 2) groups.delete(key);
    }
    return groups;
  }

  /**
   * Selects a radio button and dispatches the necessary events so
   * the host page's JS handlers respond correctly.
   */
  function selectRadio(radio) {
    radio.checked = true;
    radio.dispatchEvent(new Event("input", { bubbles: true }));
    radio.dispatchEvent(new Event("change", { bubbles: true }));
    // Some frameworks also listen to a click event
    radio.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  /**
   * Chooses the right radio from a group array (DOM order) based on mode.
   * Radios are assumed to be in DOM order: index 0 = first option.
   * Positive = last option (highest index), Negative = first option (index 0).
   */
  function fillQuestionGroup(group, mode) {
    const len = group.length;
    let chosen;

    switch (mode) {
      case MODES.ALL_POSITIVE:
        // Highest index = most positive (e.g. "Excellent" / "Strongly Agree")
        chosen = group[len - 1];
        break;

      case MODES.ALL_NEGATIVE:
        // Lowest index = most negative (e.g. "Poor" / "Strongly Disagree")
        chosen = group[0];
        break;

      case MODES.RANDOM:
        chosen = group[Math.floor(Math.random() * len)];
        break;

      case MODES.MOSTLY_POSITIVE: {
        // ~85 % chance of picking one of the top-2 positive options
        const topCount = Math.min(2, len);
        const topStart = len - topCount;
        if (Math.random() < 0.85) {
          const idx = topStart + Math.floor(Math.random() * topCount);
          chosen = group[idx];
        } else {
          chosen = group[Math.floor(Math.random() * len)];
        }
        break;
      }

      case MODES.MOSTLY_NEGATIVE: {
        // ~85 % chance of picking one of the bottom-2 negative options
        const botCount = Math.min(2, len);
        if (Math.random() < 0.85) {
          const idx = Math.floor(Math.random() * botCount);
          chosen = group[idx];
        } else {
          chosen = group[Math.floor(Math.random() * len)];
        }
        break;
      }

      default:
        chosen = group[len - 1];
    }

    selectRadio(chosen);
  }

  /**
   * Fills every question group using the given mode.
   * Returns the number of questions filled.
   */
  function applyModeToAllQuestions(mode) {
    const groups = getQuestionGroups();
    groups.forEach((group) => fillQuestionGroup(group, mode));
    return groups.size;
  }

  /**
   * Waits `ms` milliseconds then clicks the page's submit button.
   */
  function autoSubmitIfEnabled(ms) {
    setTimeout(() => {
      // Try <button type="submit"> first
      let btn = document.querySelector('button[type="submit"]');
      if (!btn) {
        // Fall back to any button / input whose text contains "submit"
        const candidates = Array.from(
          document.querySelectorAll(
            'button, input[type="button"], input[type="submit"]'
          )
        );
        btn = candidates.find(
          (el) =>
            (el.textContent || el.value || "")
              .toLowerCase()
              .includes("submit")
        );
      }
      if (btn) {
        btn.click();
      } else {
        console.warn("[ETLab Autofiller] Submit button not found.");
      }
    }, ms);
  }

  // ─── Detect survey ────────────────────────────────────────────────────────

  function isSurveyPage() {
    return getQuestionGroups().size > 0;
  }

  // ─── Floating Panel UI ────────────────────────────────────────────────────

  function createPanel(savedMode, savedAutoSubmit) {
    if (document.getElementById(PANEL_ID)) return; // already injected

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div id="etlab-header">
        <span>📋 ETLab Survey Autofiller</span>
        <button id="etlab-close" title="Close">×</button>
      </div>
      <div id="etlab-body">
        <label for="etlab-mode-select">Mode:</label>
        <select id="etlab-mode-select">
          <option value="${MODES.ALL_POSITIVE}">All Positive</option>
          <option value="${MODES.ALL_NEGATIVE}">All Negative</option>
          <option value="${MODES.RANDOM}">Random</option>
          <option value="${MODES.MOSTLY_POSITIVE}">Mostly Positive</option>
          <option value="${MODES.MOSTLY_NEGATIVE}">Mostly Negative</option>
        </select>
        <label id="etlab-autosubmit-label">
          <input type="checkbox" id="etlab-autosubmit-check" />
          Auto-submit after filling
        </label>
        <button id="etlab-fill-btn">Fill now</button>
        <div id="etlab-status"></div>
      </div>
    `;
    document.body.appendChild(panel);

    // Restore saved preferences
    const modeSelect = document.getElementById("etlab-mode-select");
    const autoSubmitCheck = document.getElementById("etlab-autosubmit-check");

    if (savedMode && Object.values(MODES).includes(savedMode)) {
      modeSelect.value = savedMode;
    }
    autoSubmitCheck.checked = !!savedAutoSubmit;

    // Persist preferences on change
    modeSelect.addEventListener("change", () => {
      chrome.storage.sync.set({ [STORAGE_KEY_MODE]: modeSelect.value });
    });
    autoSubmitCheck.addEventListener("change", () => {
      chrome.storage.sync.set({
        [STORAGE_KEY_AUTOSUBMIT]: autoSubmitCheck.checked,
      });
    });

    // Close button
    document.getElementById("etlab-close").addEventListener("click", () => {
      panel.remove();
    });

    // Fill button
    document.getElementById("etlab-fill-btn").addEventListener("click", () => {
      const mode = modeSelect.value;
      const shouldSubmit = autoSubmitCheck.checked;
      const status = document.getElementById("etlab-status");

      const filled = applyModeToAllQuestions(mode);
      status.textContent = `✅ Filled ${filled} question(s).`;

      if (shouldSubmit) {
        status.textContent += " Submitting…";
        autoSubmitIfEnabled(750);
      }
    });
  }

  // ─── Initialize ───────────────────────────────────────────────────────────

  function init() {
    if (!isSurveyPage()) return;

    chrome.storage.sync.get(
      [STORAGE_KEY_MODE, STORAGE_KEY_AUTOSUBMIT],
      (result) => {
        createPanel(result[STORAGE_KEY_MODE], result[STORAGE_KEY_AUTOSUBMIT]);
      }
    );
  }

  // Run after DOM is ready (content script is set to document_idle, but guard
  // for any dynamic SPA navigation that may re-inject the script).
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
