import http from 'http';
import express from 'express';
import { createClient } from 'redis';
import { Stoplight } from './stoplight';
import { RateLimitsConfig } from '../types';

let server: http.Server;
let stoplight: Stoplight;

async function run() {
  await setupStoplight();
  const app = getApp();
  const port = process.env.SERVER_PORT || 3003;
  server = app.listen(port, () => {
    console.log(`Ramzor listening on port ${port}`);
  });
}

async function stop() {
  await stoplight.stop();
  server.close((err) => {
    if (err) {
      console.log('Error stopping server', err);
    }
    console.log('Server stopped');
    process.exit(err ? 1 : 0);
  });
}

async function setupStoplight() {
  stoplight = new Stoplight();
  await stoplight.init();
  await stoplight.dangerouslyResetRedis();
}

function getApp() {
  const app = express();
  app.use(express.json());

  app.post('/check', async (req, res) => {
    if (!stoplight) {
      res.sendStatus(500);
      return;
    }
    const { allowed, retryAfter } = await stoplight.checkRequests(
      req.body.permissions
    );
    if (allowed) {
      res.sendStatus(200);
    } else {
      res.header('retry-after', retryAfter);
      res.sendStatus(429);
    }
  });

  return app;
}

if (require.main === module) {
  try {
    run();
    process.on('SIGINT', () => {
      console.log('Stopping server');
      stop();
    });
  } catch (err) {
    console.log('Error starting server', err);
    if (server) {
      stop();
    } else {
      process.exit(1);
    }
  }
}
