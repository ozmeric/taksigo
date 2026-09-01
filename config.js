// ── Per-customer config ──
// This is the ONLY file that should differ between customer deployments.
// The actual app code (app.js) is identical for everyone and hosted once —
// see APP-OVERVIEW.md for the deployment architecture.
window.TAKSIGO_CONFIG = {
  apiUrl: "https://taksigo.weblinallc.workers.dev/"
};
