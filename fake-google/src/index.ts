import express from 'express';
import { v4 } from 'uuid';
import { createRateLimitMiddlewares, resetRateLimitStore } from './rateLimiter';
import { promises as fs } from 'fs';

const app = express();
app.use(express.json());

let buffer = '';
let logLines = 0;

async function flushLog() {
  if (!buffer.length) return;
  const lines = buffer;
  buffer = '';
  logLines = 0;
  await writeLogToFile(lines);
}

setInterval(() => flushLog(), 1000 * 5);
process.on('SIGTERM', () => flushLog());

const LOGFILE = '/usr/log/google.log';

async function writeLogToFile(log: string) {
  try {
    return await fs.appendFile(LOGFILE, log);
  } catch (err) {
    console.error('Error writing log to file:', err);
    await writeLogToFile(log);
  }
}

function loggingMw(req, res, next) {
  req.uuid = req.body.requestId || 'n/a';
  buffer += `google ${new Date().toISOString()} [${req.uuid}] ${req.method} ${
    req.url
  } ${req.ip}\n`;
  JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
    headers: req.headers,
  }) + '\n';
  if (++logLines === 100) {
    flushLog();
  }
  next();
}

app.use(loggingMw);

app.use('/reset', (req, res) => {
  resetRateLimitStore();
  fs.writeFile(LOGFILE, '');
  res.send('OK');
});

app.post('/healthcheck', (req, res) => {
  res.send('OK');
});

app.use(
  ...createRateLimitMiddlewares([
    { quota: 1, window: 1, params: ['body.accountId'] },
    { quota: 500, window: 60, params: ['ip'] },
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
