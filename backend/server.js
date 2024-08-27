require('dotenv').config();
const multer = require('multer');

const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { createClient } = require("@deepgram/sdk");
const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const express = require('express');
const axios = require('axios');
const { listTranscriptsFromS3, getTranscriptFromS3, transcribeAndStore } = require('./transcriptManager');
const { PDFDocument } = require('pdf-lib');
const { createComment, updateComment, getAllCommentsForTranscript, deleteComment, handleSummarize } = require('./index');
const OpenAI = require('openai');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const port = 8000;

// Hard-coded configuration
const AWS_REGION = 'us-west-1';
const AWS_ACCESS_KEY_ID = 'AKIA4MI2JKWU5O4Z737I';
const AWS_SECRET_ACCESS_KEY = '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';
const DEEPGRAM_API_KEY = 'afd9f73947345deb9f583e238f7cd56011d82272';

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
  },
});

const dynamoClient = new DynamoDBClient({ 
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
  }
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const app = express();


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Define your file and S3 details
const localFilePath = 'temp_videos/temp_video.webm';
const bucketName = 'filesrilla';
const s3FileName = 'destination/video.webm';

// Ensure the directory exists
const uploadDirectory = path.join(__dirname, '.', 'temp_videos');
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

// Enable CORS for all routes
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Configure Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDirectory);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

// Serve static files from the temp_videos directory
app.use('/temp_videos', express.static(uploadDirectory));

// Define the uploadToS3 function
const uploadToS3 = async (localFilePath, bucketName, s3FileName) => {
  try {
    const fileContent = fs.readFileSync(localFilePath);

    const params = {
      Bucket: bucketName,
      Key: s3FileName,
      Body: fileContent,
    };

    await s3Client.send(new PutObjectCommand(params));
    console.log(`File uploaded to S3: ${s3FileName}`);
  } catch (error) {
    console.error("Error uploading file to S3:", error);
    throw error;
  }
};

// Function to add transcript to DynamoDB
async function addTranscriptToDynamoDB(transcript, fileName, fileType) {
  const params = {
    TableName: 'Transcripts',
    Item: {
      transcriptId: fileName,
      content: transcript,
      createdAt: new Date().toISOString(),
      fileType: fileType
    }
  };
  try {
    await docClient.send(new PutCommand(params));
    console.log(`Transcript ${fileName} added to DynamoDB successfully`);
  } catch (error) {
    console.error('Error adding transcript to DynamoDB:', error);
    throw error;
  }
}

// Function to read and save JSON file transcription
async function saveJsonTranscription(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const transcript = JSON.parse(fileContent);
    const fileName = path.basename(filePath);
    await addTranscriptToDynamoDB(transcript, fileName, true);
    console.log(`JSON transcription ${fileName} saved to DynamoDB`);
  } catch (error) {
    console.error('Error saving JSON transcription:', error);
  }
}

// Modify the upload route (keeping it for potential future use)
app.post('/upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  try {
    await uploadToS3(req.file.path, bucketName, `videos/${req.file.filename}`);
    await transcribeAndStore(req.file.path);
    res.send({ 
      filePath: `/temp_videos/${req.file.filename}`,
      transcriptKey: `transcripts/${req.file.filename}.json`,
      message: 'File uploaded, transcribed, and stored successfully'
    });
  } catch (error) {
    console.error('Error processing the video:', error);
    res.status(500).send('Error processing the video.');
  }
});

// Handle the error event when the port is already in use
app.on('error', (error) => {
  console.error('Server error:', error);
});

// Start the server
app.listen(port, async () => {
  console.log(`Server is running on http://localhost:${port}`);
  try {
    await uploadToS3(localFilePath, bucketName, s3FileName);
    await transcribeAndStore(localFilePath);
    await uploadDummyTranscriptToS3();
    console.log('Initial file upload, transcription, and dummy transcript upload completed.');
  } catch (error) {
    console.error('Error during initial file processing:', error);
  }
});

app.get('/api/transcripts', async (req, res) => {
  try {
    const transcriptKeys = await listTranscriptsFromS3();
    const transcripts = await Promise.all(transcriptKeys.map(async (key) => {
      const { content, fileType } = await getTranscriptFromS3(key);
      return { 
        transcriptId: key, 
        content: fileType === 'json' ? JSON.stringify(content) : content,
        fileType 
      };
    }));
    res.json(transcripts);
  } catch (error) {
    console.error('Error fetching transcripts:', error);
    res.status(500).json({ error: 'Failed to fetch transcripts' });
  }
});

// Helper function to convert stream to string
const streamToString = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });

// Save JSON transcription after server starts
const jsonFilePath = path.join(__dirname, 'transcripts.json');
saveJsonTranscription(jsonFilePath);

app.post('/upload-audio', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No audio file uploaded.');
  }

  try {
    await uploadToS3(req.file.path, bucketName, `audio/${req.file.filename}`);
    const transcriptionResult = await transcribeAndStore(req.file.path);
    res.send({ 
      filePath: `/temp_videos/${req.file.filename}`,
      transcriptKey: `transcripts/${req.file.filename}.json`,
      transcription: transcriptionResult,
      message: 'Audio file uploaded, transcribed, and stored successfully'
    });
  } catch (error) {
    console.error('Error processing the audio:', error);
    res.status(500).send('Error processing the audio: ' + error.message);
  }
});

// New route to handle transcript uploads
app.post('/upload-transcript', upload.single('transcript'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  try {
    const fileContent = fs.readFileSync(req.file.path);
    const fileName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    const s3Key = `transcripts/${fileName}${path.extname(req.file.originalname)}`;

    // Upload to S3
    await uploadTranscriptToS3(s3Key, fileContent, req.file.mimetype);

    // Add to DynamoDB
    if (path.extname(req.file.originalname).toLowerCase() === '.json') {
      await addTranscriptToDynamoDB(JSON.parse(fileContent.toString()), fileName, 'json');
    } else if (path.extname(req.file.originalname).toLowerCase() === '.pdf') {
      const pdfDoc = await PDFDocument.load(fileContent);
      const pages = pdfDoc.getPages();
      let text = '';
      for (const page of pages) {
        text += await page.getText();
      }
      await addTranscriptToDynamoDB(text, fileName, 'pdf');
    }

    res.send({ 
      message: 'Transcript uploaded and stored successfully',
      transcriptKey: s3Key
    });
  } catch (error) {
    console.error('Error processing the transcript:', error);
    res.status(500).send('Error processing the transcript: ' + error.message);
  } finally {
    // Clean up the temporary file
    fs.unlinkSync(req.file.path);
  }
});

// Helper function to upload transcript to S3
const uploadTranscriptToS3 = async (s3Key, fileContent, contentType) => {
  try {
    const params = {
      Bucket: bucketName,
      Key: s3Key,
      Body: fileContent,
      ContentType: contentType
    };

    await s3Client.send(new PutObjectCommand(params));
    console.log(`Transcript uploaded to S3: ${s3Key}`);
  } catch (error) {
    console.error("Error uploading transcript to S3:", error);
    throw error;
  }
};

async function uploadDummyTranscriptToS3() {
  try {
    const dummyTranscriptPath = path.join(__dirname, 'transcripts.json');
    const fileContent = fs.readFileSync(dummyTranscriptPath, 'utf8');
    const parsedContent = JSON.parse(fileContent);
    
    const simplifiedTranscript = parsedContent.transcript.map(item => item.text).join(' ');
    
    const s3Key = 'transcripts/simplified_dummy_transcript.txt';

    await uploadTranscriptToS3(s3Key, simplifiedTranscript, 'text/plain');
    console.log('Simplified dummy transcript uploaded to S3 successfully');
  } catch (error) {
    console.error('Error uploading simplified dummy transcript to S3:', error);
  }
}


app.post('/api/comment', upload.single('fileAttachment'), async (req, res) => {
  try {
    const commentData = {
      ...req.body,
      fileAttachment: req.file
    };
    const result = await createComment(commentData);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ message: 'Error creating comment', error: error.message });
  }
});

app.put('/api/comment', async (req, res) => {
  console.log('Received update comment request:', req.body);
  try {
    const result = await updateComment(req.body);
    console.log('Update result:', result);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ message: 'Error updating comment', error: error.message });
  }
});
app.get('/api/comment', async (req, res) => {
  const { transcriptId } = req.query;
  if (!transcriptId) {
    return res.status(400).json({ message: 'Missing transcriptId' });
  }
  try {
    const result = await getAllCommentsForTranscript(transcriptId);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Error fetching comments', error: error.message });
  }
});

app.delete('/api/comment', async (req, res) => {
  console.log('Received delete comment request:', req.body);
  try {
    const result = await deleteComment(req.body);
    console.log('Delete result:', result);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Error deleting comment', error: error.message });
  }
});


app.post('/api/summarize', async (req, res) => {
  try {
    const result = await handleSummarize(req.body, {
      status: (code) => ({
        statusCode: code,
        json: (body) => res.status(code).json(body)
      })
    });
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    console.error('Error in summarize:', error);
    res.status(500).json({ message: 'Error summarizing transcript', error: error.message });
  }
});

