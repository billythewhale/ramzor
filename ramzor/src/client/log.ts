import * as fs from 'fs';

const LOGFILE = '/Users/billy/ramzor/ramzor/runlogs/client.log';

const stream = fs.createWriteStream(LOGFILE, { flags: 'a' });
process.on('beforeExit', () => {
  stream.end();
});

export function clearClientLog() {
  fs.writeFileSync(LOGFILE, '');
}

export function log(req: any) {
  const uuid = req.body.requestId || 'n/a';
  let msg =
    `${new Date().toISOString()} [${uuid}] ${req.method} ${req.url} ${
      req.ip
    }\n` +
    JSON.stringify({
      body: req.body,
      query: req.query,
      params: req.params,
      headers: req.headers,
    }) +
    '\n';
  stream.write(msg);
}
