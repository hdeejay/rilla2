import express from 'express';
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { createClient } = require("@deepgram/sdk");
require('dotenv').config();
const app = express();
const port = 3001;



// S3 client setup
const s3Client = new s3Client({ region: "us-east-1" }); // Replace with your AWS region

// ... (keep existing Multer and other configurations)

// Transcribe and upload to S3
const transcribeAndUploadToS3 = async (filePath, fileName) => {
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

  try {
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      fs.readFileSync(filePath),
      {
        model: "nova-2",
        smart_format: true,
      }
    );

    if (error) throw error;

    // Upload transcript to S3
    const params = {
      Bucket: "your-s3-bucket-name", // Replace with your S3 bucket name
      Key: `transcripts/${fileName}.json`,
      Body: JSON.stringify(result),
      ContentType: "application/json"
    };

    await s3Client.send(new PutObjectCommand(params));
    console.log(`Transcript uploaded to S3: transcripts/${fileName}.json`);

    return result;
  } catch (error) {
    console.error("Error in transcription or S3 upload:", error);
    throw error;
  }
};

// Modify the upload route
app.post('/upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  try {
    await transcribeAndUploadToS3(req.file.path, req.file.filename);
    res.send({ 
      filePath: `/temp_videos/${req.file.filename}`,
      transcriptKey: `transcripts/${req.file.filename}.json`
    });
  } catch (error) {
    res.status(500).send('Error processing the video.');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});


// Ensure the directory exists
const uploadDirectory = path.join(__dirname, '.', 'temp_videos');
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

// Enable CORS for all routes
app.use(cors());

// Configure Multer
const storage = multer.diskStorage({
  destination: (file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (file, cb) => {
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


