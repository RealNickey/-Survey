/**
 * ETLab Survey Autofiller – popup.js
 * Manages the extension popup for setting default preferences.
 */

const STORAGE_KEY_MODE = "etlab_mode";
const STORAGE_KEY_AUTOSUBMIT = "etlab_autosubmit";

const modeSelect = document.getElementById("popup-mode");
const autoSubmitCheck = document.getElementById("popup-autosubmit");
const saveBtn = document.getElementById("popup-save");
const savedMsg = document.getElementById("popup-saved-msg");

// Load saved preferences
chrome.storage.sync.get([STORAGE_KEY_MODE, STORAGE_KEY_AUTOSUBMIT], (result) => {
  if (result[STORAGE_KEY_MODE]) {
    modeSelect.value = result[STORAGE_KEY_MODE];
  }
  autoSubmitCheck.checked = !!result[STORAGE_KEY_AUTOSUBMIT];
});

// Save on button click
saveBtn.addEventListener("click", () => {
  chrome.storage.sync.set(
    {
      [STORAGE_KEY_MODE]: modeSelect.value,
      [STORAGE_KEY_AUTOSUBMIT]: autoSubmitCheck.checked,
    },
    () => {
      savedMsg.textContent = "✅ Preferences saved!";
      setTimeout(() => {
        savedMsg.textContent = "";
      }, 2000);
    }
  );
});
