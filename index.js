const { program } = require('commander');
const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');

program
  .requiredOption('-h, --host <address>', 'Адреса сервера')
  .requiredOption('-p, --port <number>', 'Порт сервера')
  .requiredOption('-c, --cache <path>', 'Шлях до директорії кешу');

program.parse(process.argv);
const { host, port, cache } = program.opts();

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

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, cachePath),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

let inventory = [];
let idCounter = 1;

app.route('/RegisterForm.html')
  .get((req, res) => res.sendFile(path.join(__dirname, 'RegisterForm.html')))
  .all((req, res) => res.sendStatus(405));

app.route('/SearchForm.html')
  .get((req, res) => res.sendFile(path.join(__dirname, 'SearchForm.html')))
  .all((req, res) => res.sendStatus(405));

app.route('/register')
  .post(upload.single('photo'), (req, res) => {
    const { inventory_name, description } = req.body;

    if (!inventory_name) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).send('Bad Request: inventory_name is required');
    }

    const newItem = {
      id: idCounter++,
      inventory_name: inventory_name,
      description: description || '',
      photo: req.file ? req.file.filename : null
    };

    inventory.push(newItem);
    res.status(201).json(newItem);
  })
  .all((req, res) => res.sendStatus(405));

app.route('/inventory')
  .get((req, res) => {
    const result = inventory.map(item => ({
      ...item,
      photoUrl: item.photo ? `/inventory/${item.id}/photo` : null
    }));
    res.status(200).json(result);
  })
  .all((req, res) => res.sendStatus(405));

app.route('/inventory/:id')
  .get((req, res) => {
    const item = inventory.find(i => i.id === parseInt(req.params.id));
    if (!item) return res.status(404).send('Not found');

    res.status(200).json({
      ...item,
      photoUrl: item.photo ? `/inventory/${item.id}/photo` : null
    });
  })
  .put((req, res) => {
    const item = inventory.find(i => i.id === parseInt(req.params.id));
    if (!item) return res.status(404).send('Not found');

    if (req.body.inventory_name) item.inventory_name = req.body.inventory_name;
    else if (req.body.name) item.inventory_name = req.body.name;

    if (req.body.description) item.description = req.body.description;

    res.status(200).json(item);
  })
  .delete((req, res) => {
    const idx = inventory.findIndex(i => i.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).send('Not found');

    const item = inventory[idx];
    if (item.photo) {
      const p = path.join(cachePath, item.photo);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    inventory.splice(idx, 1);
    res.status(200).send('Deleted');
  })
  .all((req, res) => res.sendStatus(405));

app.route('/inventory/:id/photo')
  .get((req, res) => {
    const item = inventory.find(i => i.id === parseInt(req.params.id));
    if (!item || !item.photo) return res.status(404).send('Photo not found');

    const p = path.join(cachePath, item.photo);
    if (fs.existsSync(p)) {
      res.set('Content-Type', 'image/jpeg');
      res.sendFile(p);
    } else {
      res.status(404).send('File missing on disk');
    }
  })
  .put(upload.single('photo'), (req, res) => {
    const item = inventory.find(i => i.id === parseInt(req.params.id));
    if (!item) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).send('Item not found');
    }

    if (!req.file) return res.status(400).send('No file uploaded');

    if (item.photo) {
      const oldP = path.join(cachePath, item.photo);
      if (fs.existsSync(oldP)) fs.unlinkSync(oldP);
    }

    item.photo = req.file.filename;
    res.status(200).send('Photo updated');
  })
  .all((req, res) => res.sendStatus(405));

app.route('/search')
  .post((req, res) => {
    const id = parseInt(req.body.id);
    const hasPhoto = req.body.has_photo === 'true' || req.body.has_photo === 'on';
    performSearch(res, id, hasPhoto);
  })
  .get((req, res) => {
    const id = parseInt(req.query.id);
    const hasPhoto = req.query.includePhoto === 'on' || req.query.includePhoto === 'true';
    performSearch(res, id, hasPhoto);
  })
  .all((req, res) => res.sendStatus(405));

function performSearch(res, id, hasPhoto) {
  if (!id) return res.status(400).send('ID is required');

  const item = inventory.find(i => i.id === id);

  if (!item) return res.status(404).send('Not Found');

  const responseData = {
    id: item.id,
    inventory_name: item.inventory_name,
    description: item.description
  };

  if (hasPhoto && item.photo) {
    responseData.photoUrl = `/inventory/${item.id}/photo`;
  }

  res.status(200).json(responseData);
}

app.use((req, res) => res.status(404).send('Not Found'));

const server = http.createServer(app);

server.listen(port, host, () => {
  console.log(`Server is running at http://${host}:${port}`);
});