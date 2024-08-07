import express from 'express';
import { v4 } from 'uuid';
import { createRateLimitMiddlewares, resetRateLimitStore } from './rateLimiter';
import * as fs from 'fs';

const app = express();
app.use(express.json());

const LOGFILE = '/usr/log/facebook.log';
let logStream = fs.createWriteStream(LOGFILE, { flags: 'a' });
process.on('exit', () => logStream.end());

async function writeLogToFile(log: string) {
  return logStream.write(log);
}

function loggingMw(req, res, next) {
  req.uuid = req.headers['x-tw-ramzor'] || 'n/a';
  let msg =
    `facebook ${new Date().toISOString()} [${req.uuid}] ${req.method} ${
      req.url
    } ${req.ip}\n` +
    JSON.stringify({
      body: req.body,
      params: req.params,
      headers: req.headers,
    }) +
    '\n';
  writeLogToFile(msg);
  next();
}

app.use(loggingMw);

app.use('/reset', (req, res) => {
  console.log('Reset server');
  resetRateLimitStore();
  if (logStream) {
    logStream.end();
  }
  fs.writeFileSync(LOGFILE, '');
  logStream = fs.createWriteStream(LOGFILE, { flags: 'a' });
  res.send('OK');
});

app.post('/healthcheck', (req, res) => {
  res.send('OK');
});

app.use(
  ...createRateLimitMiddlewares([
    { quota: 1, window: 1, params: ['body.accountId'] },
    { quota: 500, window: 30, params: ['ip'] },
  ])
);

app.post('/endpoint1', (req, res) => {
  res.send('OK');
});

app.post('/endpoint2', (req, res) => {
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
