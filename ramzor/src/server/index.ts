import http from 'http';
import express from 'express';
import { createClient } from 'redis';
import config from '../config';
import { Stoplight } from './stoplight';
import { RateLimitsConfig } from '../types';

let server: http.Server;
let stoplight: Stoplight;

async function run() {
  await setupStoplight();
  const app = getApp();
  console.log('Found ' + config.length + ' zones');
  console.log(stoplight.zoneKeys);
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
  await stoplight.init(config);
}

function getApp() {
  const app = express();

  app.get('/:zoneId', async (req, res) => {
    if (!stoplight) {
      res.sendStatus(500);
      return;
    }
    if (await stoplight.checkRequest(req.params.zoneId)) {
      res.sendStatus(200);
      console.log(req.params.zoneId, 'allowed');
    } else {
      res.sendStatus(429);
      console.log(req.params.zoneId, 'not allowed');
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
