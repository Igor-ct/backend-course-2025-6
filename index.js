const { program } = require('commander');
const http = require('http');
const fs = require('fs');
const path = require('path');

program
  .requiredOption('-h, --host <address>', 'Адреса сервера')
  .requiredOption('-p, --port <number>', 'Порт сервера')
  .requiredOption('-c, --cache <path>', 'Шлях до директорії кешу');

program.parse(process.argv);

const options = program.opts();
const { host, port, cache } = options;


const cachePath = path.resolve(cache); 

try {
  if (!fs.existsSync(cachePath)) {
    fs.mkdirSync(cachePath, { recursive: true });
    console.log(`[Info] Директорію кешу створено: ${cachePath}`);
  } else {
    console.log(`[Info] Використовується існуюча директорія кешу: ${cachePath}`);
  }
} catch (err) {
  console.error(`[Error] Не вдалося створити директорію кешу: ${err.message}`);
  process.exit(1);
}


const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Server works!');
});

server.listen(port, host, () => {
  console.log(`Server is running at http://${host}:${port}`);
});