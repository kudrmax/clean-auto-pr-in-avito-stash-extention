class AutoPrMatcher {
  constructor(pattern) {
    this.regex = new RegExp(pattern, 'i');
  }

  static isValidPattern(pattern) {
    try {
      new RegExp(pattern, 'i');
      return true;
    } catch {
      return false;
    }
  }

  matches(title) {
    return this.regex.test(title);
  }
}

globalThis.AutoPrMatcher = AutoPrMatcher;
