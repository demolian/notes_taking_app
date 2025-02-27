   // src/setupProxy.js
   const { createProxyMiddleware } = require('http-proxy-middleware');

   module.exports = function(app) {
     app.use(
       '/gemini',
       createProxyMiddleware({
         target: 'https://api.google.com',
         changeOrigin: true,
         pathRewrite: {
           '^/gemini': '/gemini/v1/analyze',
         },
       })
     );
   };