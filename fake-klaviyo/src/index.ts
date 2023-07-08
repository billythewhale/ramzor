import express from 'express';
import { createRateLimitMiddlewares } from './rateLimiter';

const app = express();

app.get('/healthcheck', (req, res) => {
  res.send('OK');
});

const router = express.Router();
router.use(express.json());

const rateLimitConfig = {
  quota: 1,
  window: 1,
  params: ['headers.x-tw-klaviyo-account'],
  match: ['query.additional-fields'],
};

router.use(
  ...createRateLimitMiddlewares('global', [
    { quota: 10, window: 1, params: ['headers.x-tw-klaviyo-account'] },
  ])
);

router.use(
  ...createRateLimitMiddlewares('additional-fields', [
    rateLimitConfig,
    { ...rateLimitConfig, quota: 10, window: 10 },
  ])
);

router.get('/profiles', (req, res) => {
  res.send('OK');
});

router.get('/accounts/:id/info', (req, res) => {
  res.send(req.params.id);
});

app.use('/api', router);

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
