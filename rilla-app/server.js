const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { createClient } = require("@deepgram/sdk");
require('dotenv').config();
const app = express();
const port = 3001;

// Ensure the directory exists
const uploadDirectory = path.join(__dirname, '.', 'temp_videos');
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}


// Enable CORS for all routes
app.use(cors());

// Configure Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});

const upload = multer({ storage });


// Serve static files from the temp_videos directory
app.use('/temp_videos', express.static(uploadDirectory));

// Upload route
app.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  res.send({ filePath: `/temp_videos/${req.file.filename}` });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

const DEEPGRAM_API_KEY = 'afd9f73947345deb9f583e238f7cd56011d82272';
const transcribeFile = async () => {
  
  const deepgram = createClient(DEEPGRAM_API_KEY);

  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    fs.readFileSync("/Users/tarikamraoui/Desktop/Interview-v2/temp_videos/1720550206093_temp_video.webm"),
    {
      model: "nova-2",
      smart_format: true,
    }
  );

  if (error) throw error;

  if (!error) console.dir(result, { depth: null });
};

transcribeFile();


