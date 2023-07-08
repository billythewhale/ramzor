import express from 'express';
import { createRateLimitMiddlewares } from './rateLimiter';

const app = express();

app.get('/healthcheck', (req, res) => {
  res.send('OK');
});

app.use(
  ...createRateLimitMiddlewares([
    { quota: 1, window: 1, params: ['query.accountId'] },
    { quota: 50, window: 60, params: ['ip'] },
  ])
);

app.get('/endpoint1', (req, res) => {
  res.send('OK');
});

app.get('/endpoint2', (req, res) => {
  res.send('OK');
});

export function runServer() {
  const port = process.env.SERVER_PORT || 3002;
  console.log(`Starting Rate-Limited server on port ${port}`);
  const server = app.listen(port);
  return server;
}

if (require.main === module) {
  const server = runServer();
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received.');
    console.log('Closing http server.');
    server.close((err) => {
      if (err) {
        console.error('Error closing rate-limited server' + err.message);
      }
      console.log('Http server closed.');
      process.exit(err ? 1 : 0);
    });
  });
}
