const { createProxyMiddleware } = require('http-proxy-middleware');

// Explicit proxy to the Django backend during development.
// This avoids CORS issues by letting the CRA dev server forward API calls.
module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://127.0.0.1:8000',
      changeOrigin: true,
      logLevel: 'warn',
    })
  );
};
