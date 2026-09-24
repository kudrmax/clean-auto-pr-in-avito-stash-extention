(async () => {
  const settings = new AutoPrSettings(chrome.storage.sync);
  const pattern = await settings.loadPattern();
  const controller = new AutoPrController(window, AutoPrMatcher.isValidPattern(pattern) ? pattern : AutoPrSettings.DEFAULT_PATTERN);
  controller.start();
  settings.onPatternChanged((newPattern) => {
    if (AutoPrMatcher.isValidPattern(newPattern)) {
      controller.setPattern(newPattern);
    }
  });
})();
