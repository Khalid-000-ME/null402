// Polyfill for global in browser environment
if (typeof window !== "undefined") {
  // @ts-ignore
  window.global = window;
}

// Also set up globalThis.global for compatibility
if (typeof globalThis !== "undefined") {
  // @ts-ignore
  globalThis.global = globalThis;
}
