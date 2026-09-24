class AutoPrSettings {
  static DEFAULT_PATTERN = '^\\s*\\[AutoPR\\]|AUTOPR-\\d+';
  static STORAGE_KEY = 'autoPrPattern';

  constructor(storageArea) {
    this.storageArea = storageArea;
  }

  async loadPattern() {
    if (!this.storageArea) {
      return AutoPrSettings.DEFAULT_PATTERN;
    }
    const stored = await this.storageArea.get(AutoPrSettings.STORAGE_KEY);
    return stored[AutoPrSettings.STORAGE_KEY] || AutoPrSettings.DEFAULT_PATTERN;
  }

  async savePattern(pattern) {
    await this.storageArea.set({ [AutoPrSettings.STORAGE_KEY]: pattern });
  }

  onPatternChanged(callback) {
    if (!globalThis.chrome?.storage?.onChanged) {
      return;
    }
    chrome.storage.onChanged.addListener((changes) => {
      const change = changes[AutoPrSettings.STORAGE_KEY];
      if (change) {
        callback(change.newValue || AutoPrSettings.DEFAULT_PATTERN);
      }
    });
  }
}

globalThis.AutoPrSettings = AutoPrSettings;
