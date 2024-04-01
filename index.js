const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());

// Storage configuration for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const session_id = req.params.session_id;
    const dir = `./uploads/${session_id}`;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, `${uuidv4()}.txt`);
  }
});

const upload = multer({ storage: storage });

// Session data structure to hold uploaded files and results
const sessions = {};

// Routes
app.post('/api/v1/create-session', (req, res) => {
  const session_id = uuidv4();
  sessions[session_id] = { files: [], result: 0 };
  res.json({ session_id });
});

app.post('/api/v1/upload-file/:session_id', upload.single('equation_file'), (req, res) => {
  const session_id = req.params.session_id;
  const equation = fs.readFileSync(req.file.path, 'utf8');
  const result = eval(equation);

  // Update session data
  const session = sessions[session_id];
  session.files.push({ filename: req.file.filename, equation, result });
  session.result += result;

  // Drop the first file if number of files exceeds 15
  if (session.files.length > 15) {
    const deletedFile = session.files.shift();
    session.result -= deletedFile.result;
    fs.unlinkSync(`./uploads/${session_id}/${deletedFile.filename}`);
  }

  res.json({ result: session.result });
});

app.delete('/api/v1/delete-session/:session_id', (req, res) => {
  const session_id = req.params.session_id;
  if (sessions[session_id]) {
    // Delete uploaded files and session
    fs.rmdirSync(`./uploads/${session_id}`, { recursive: true });
    delete sessions[session_id];
    res.send('Session deleted successfully.');
  } else {
    res.status(404).send('Session not found.');
  }
});

app.delete('/api/v1/delete-file/:session_id/:filename', (req, res) => {
  const session_id = req.params.session_id;
  const filename = req.params.filename;

  if (sessions[session_id]) {
    const session = sessions[session_id];
    const fileIndex = session.files.findIndex(file => file.filename === filename);
    if (fileIndex !== -1) {
      const deletedFile = session.files.splice(fileIndex, 1)[0];
      session.result -= deletedFile.result;
      fs.unlinkSync(`./uploads/${session_id}/${filename}`);
      res.json({ result: session.result });
    } else {
      res.status(404).send('File not found in session.');
    }
  } else {
    res.status(404).send('Session not found.');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
