// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');
// const cors = require('cors');
// const { createClient } = require("@deepgram/sdk");
// const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
// const express = require('express');


// require('dotenv').config();

// // S3 client setup
// const port = 8000;

// // S3 client setup

// const s3Client = new S3Client({
//   region: "us-west-1", // Replace with your AWS region
//   credentials: {
//     accessKeyId: "AKIA4MI2JKWU5O4Z737I", // Replace with your AWS access key ID
//     secretAccessKey: "pBMknkUZBrA6hksEznwS3I5fPjPwP+FUyRQkTMc/", // Replace with your AWS secret access key
//   },
// });
  
//   const app = express();
// // Define your file and S3 details
// const localFilePath = 'temp_videos/temp_video.webm';
// const bucketName = 'filesrilla';
// const s3FileName = 'destination/video.webm';

// // Define the uploadToS3 function
// const uploadToS3 = async (localFilePath, bucketName, s3FileName) => {
//   try {
//     const fileContent = fs.readFileSync(localFilePath);

//     const params = {
//       Bucket: "filesrilla",
//       Key: s3FileName,
//       Body: fileContent,
//     };

//     await s3Client.send(new PutObjectCommand(params));
//     console.log(`File uploaded to S3: ${s3FileName}`);
//   } catch (error) {
//     console.error("Error uploading file to S3:", error);
//     throw error;
//   }
// };

// // Upload the file
// uploadToS3(localFilePath, bucketName, s3FileName);

// // Ensure the directory exists
// const uploadDirectory = path.join(__dirname, '.', 'temp_videos');
// if (!fs.existsSync(uploadDirectory)) {
//   fs.mkdirSync(uploadDirectory, { recursive: true });
// }

// // Enable CORS for all routes
// app.use(cors());

// // Configure Multer
// const storage = multer.diskStorage({
//   destination: (_, cb) => {
//     cb(null, uploadDirectory);
//   },
//   filename: (file, cb) => {
//     cb(null, `${Date.now()}_${file.originalname}`);
//   },
// });

// const upload = multer({ storage });

// // Serve static files from the temp_videos directory
// app.use('/temp_videos', express.static(uploadDirectory));

// // Transcribe and upload to S3
// const transcribeAndUploadToS3 = async (filePath, fileName) => {
//   const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

//   try {
//     const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
//       fs.readFileSync(filePath),
//       {
//         model: "nova-2",
//         smart_format: true,
//       }
//     );

//     if (error) throw error;

//     // Upload transcript to S3
//     const params = {
//       Bucket: "filesrilla", // Replace with your S3 bucket name
//       Key: `transcripts/${fileName}.json`,
//       Body: JSON.stringify(result),
//       ContentType: "application/json"
//     };

//     await s3Client.send(new PutObjectCommand(params));
//     console.log(`Transcript uploaded to S3: transcripts/${fileName}.json`);

//     return result;
//   } catch (error) {
//     console.error("Error in transcription or S3 upload:", error);
//     throw error;
//   }
// };

// // Modify the upload route
// app.post('/upload', upload.single('video'), async (req, res) => {
//   if (!req.file) {
//     return res.status(400).send('No file uploaded.');
//   }

//   try {
//     await transcribeAndUploadToS3(req.file.path, req.file.filename);
//     res.send({ 
//       filePath: `/temp_videos/${req.file.filename}`,
//       transcriptKey: `transcripts/${req.file.filename}.json`
//     });
//   } catch (error) {
//     res.status(500).send('Error processing the video.');
//   }
// });

// // Handle the error event when the port is already in use
// app.on('error', (error) => {
//   console.error('Server error:', error);
// });

// // Start the server
// app.listen(port, () => {
//   console.log(`Server is running on http://localhost:${port}`);
// });

// // Call the transcription function separately if needed
// const transcribeFile = async () => {
//   const deepgram = createClient('afd9f73947345deb9f583e238f7cd56011d82272');

//   const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
//     fs.readFileSync(localFilePath),
//     {
//       model: "nova-2",
//       smart_format: true,
//     }
//   );

//   if (error) throw error;

//   if (!error) console.dir(result, { depth: null });
// };

// transcribeFile();
// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');
// const cors = require('cors');
// const { createClient } = require("@deepgram/sdk");
// const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
// const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
// const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
// const express = require('express');

// const port = 8000;

// // AWS Configuration with hardcoded credentials
// const awsConfig = {
//   region: "us-west-1",
//   credentials: {
//     accessKeyId: "AKIA4MI2JKWU5O4Z737I",
//     secretAccessKey: "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"
//   }
// };

// S3 and DynamoDB client setup
// const s3Client = new S3Client(awsConfig);
// const dynamoClient = new DynamoDBClient(awsConfig);
// const docClient = DynamoDBDocumentClient.from(dynamoClient);

// const app = express();

// // Define your file and S3 details
// const localFilePath = 'temp_videos/temp_video.webm';
// const bucketName = 'filesrilla';
// const s3FileName = 'destination/video.webm';

// // Ensure the directory exists
// const uploadDirectory = path.join(__dirname, '.', 'temp_videos');
// if (!fs.existsSync(uploadDirectory)) {
//   fs.mkdirSync(uploadDirectory, { recursive: true });
// }

// // Enable CORS for all routes
// app.use(cors());

// // Configure Multer
// const storage = multer.diskStorage({
//   destination: (_, cb) => {
//     cb(null, uploadDirectory);
//   },
//   filename: (_, file, cb) => {
//     cb(null, `${Date.now()}_${file.originalname}`);
//   },
// });

// const upload = multer({ storage });

// // Serve static files from the temp_videos directory
// app.use('/temp_videos', express.static(uploadDirectory));

// // Define the uploadToS3 function
// const uploadToS3 = async (localFilePath, bucketName, s3FileName) => {
//   try {
//     const fileContent = fs.readFileSync(localFilePath);

//     const params = {
//       Bucket: bucketName,
//       Key: s3FileName,
//       Body: fileContent,
//     };

//     await s3Client.send(new PutObjectCommand(params));
//     console.log(`File uploaded to S3: ${s3FileName}`);
//   } catch (error) {
//     console.error("Error uploading file to S3:", error);
//     throw error;
//   }
// };

// // Function to add transcript to DynamoDB
// async function addTranscriptToDynamoDB(transcript, fileName) {
//   const params = {
//     TableName: 'Transcripts',
//     Item: {
//       transcriptId: fileName,
//       content: transcript,
//       createdAt: new Date().toISOString()
//     }
//   };
//   try {
//     await docClient.send(new PutCommand(params));
//     console.log(`Transcript ${fileName} added to DynamoDB successfully`);
//   } catch (error) {
//     console.error('Error adding transcript to DynamoDB:', error);
//     throw error;
//   }
// }

// // Transcribe and upload to S3 and DynamoDB
// const transcribeAndStore = async (filePath, fileName) => {
//   const deepgram = createClient('afd9f73947345deb9f583e238f7cd56011d82272');

//   try {
//     const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
//       fs.readFileSync(filePath),
//       {
//         model: "nova-2",
//         smart_format: true,
//       }
//     );

//     if (error) throw error;

//     // Upload transcript to S3
//     const s3Params = {
//       Bucket: bucketName,
//       Key: `transcripts/${fileName}.json`,
//       Body: JSON.stringify(result),
//       ContentType: "application/json"
//     };

//     await s3Client.send(new PutObjectCommand(s3Params));
//     console.log(`Transcript uploaded to S3: transcripts/${fileName}.json`);

//     // Store transcript in DynamoDB
//     await addTranscriptToDynamoDB(result, fileName);

//     return result;
//   } catch (error) {
//     console.error("Error in transcription or storage:", error);
//     throw error;
//   }
// };

// // Upload the file to S3
// uploadToS3(localFilePath, bucketName, s3FileName);

// // Transcribe and store the file
// transcribeAndStore(localFilePath, path.basename(localFilePath));

// // Modify the upload route (keeping it for potential future use)
// app.post('/upload', upload.single('video'), async (req, res) => {
//   if (!req.file) {
//     return res.status(400).send('No file uploaded.');
//   }

//   try {
//     await uploadToS3(req.file.path, bucketName, `videos/${req.file.filename}`);
//     await transcribeAndStore(req.file.path, req.file.filename);
//     res.send({ 
//       filePath: `/temp_videos/${req.file.filename}`,
//       transcriptKey: `transcripts/${req.file.filename}.json`,
//       message: 'File uploaded, transcribed, and stored successfully'
//     });
//   } catch (error) {
//     console.error('Error processing the video:', error);
//     res.status(500).send('Error processing the video.');
//   }
// });

// // Handle the error event when the port is already in use
// app.on('error', (error) => {
//   console.error('Server error:', error);
// });

// // Start the server
// app.listen(port, () => {
//   console.log(`Server is running on http://localhost:${port}`);
// });



const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { createClient } = require("@deepgram/sdk");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const express = require('express');

const port = 8000;

// AWS Configuration with hardcoded credentials
const awsConfig = {
  region: "us-west-1",
  credentials: {
    accessKeyId: "AKIA4MI2JKWU5O4Z737I",
    secretAccessKey: "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"
  }
};

// S3 and DynamoDB client setup
const s3Client = new S3Client(awsConfig);
const dynamoClient = new DynamoDBClient(awsConfig);
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const app = express();

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
app.use(cors());

// Configure Multer
const storage = multer.diskStorage({
  destination: (_, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (_, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});

const upload = multer({ storage });

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
async function addTranscriptToDynamoDB(transcript, fileName, isJsonFile = false) {
  const params = {
    TableName: 'Transcripts',
    Item: {
      transcriptId: fileName,
      content: transcript,
      createdAt: new Date().toISOString(),
      isJsonFile: isJsonFile
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

// Transcribe and upload to S3 and DynamoDB
const transcribeAndStore = async (filePath, fileName) => {
  const deepgram = createClient('afd9f73947345deb9f583e238f7cd56011d82272');

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
    const s3Params = {
      Bucket: bucketName,
      Key: `transcripts/${fileName}.json`,
      Body: JSON.stringify(result),
      ContentType: "application/json"
    };

    await s3Client.send(new PutObjectCommand(s3Params));
    console.log(`Transcript uploaded to S3: transcripts/${fileName}.json`);

    // Store transcript in DynamoDB
    await addTranscriptToDynamoDB(result, fileName);

    return result;
  } catch (error) {
    console.error("Error in transcription or storage:", error);
    throw error;
  }
};

// Upload the file to S3
uploadToS3(localFilePath, bucketName, s3FileName);

// Transcribe and store the file
transcribeAndStore(localFilePath, path.basename(localFilePath));

// Modify the upload route (keeping it for potential future use)
app.post('/upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  try {
    await uploadToS3(req.file.path, bucketName, `videos/${req.file.filename}`);
    await transcribeAndStore(req.file.path, req.file.filename);
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
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// Save JSON transcription after server starts
const jsonFilePath = path.join(__dirname, 'transcripts.json');
saveJsonTranscription(jsonFilePath);