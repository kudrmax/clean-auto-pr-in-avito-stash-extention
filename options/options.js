class OptionsPage {
  constructor(document, settings) {
    this.settings = settings;
    this.input = document.getElementById('pattern');
    this.status = document.getElementById('status');
    document.getElementById('save').addEventListener('click', () => this.save(this.input.value));
    document.getElementById('reset').addEventListener('click', () => this.save(AutoPrSettings.DEFAULT_PATTERN));
  }

  async init() {
    this.input.value = await this.settings.loadPattern();
  }

  async save(pattern) {
    if (!AutoPrMatcher.isValidPattern(pattern)) {
      this.showStatus('Некорректный regex', 'error');
      return;
    }
    await this.settings.savePattern(pattern);
    this.input.value = pattern;
    this.showStatus('Сохранено', 'ok');
  }

  showStatus(text, kind) {
    this.status.textContent = text;
    this.status.className = `status ${kind}`;
  }
}

new OptionsPage(document, new AutoPrSettings(chrome.storage.sync)).init();
