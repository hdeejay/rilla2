require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const fs = require('fs');
const path = require('path');
const { createClient } = require("@deepgram/sdk");
const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");

const { fromEnv } = require("@aws-sdk/credential-provider-env");

// Hard-coded configuration
const AWS_REGION = 'us-west-1';
const AWS_ACCESS_KEY_ID = 'AKIA4MI2JKWU5O4Z737I';
const AWS_SECRET_ACCESS_KEY = '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';
const DEEPGRAM_API_KEY = 'afd9f73947345deb9f583e238f7cd56011d82272';

// Set up DynamoDB client
const dynamoClient = new DynamoDBClient({ 
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
  }
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Set up S3 client
const s3Client = new S3Client({ 
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
  }
});

const bucketName = 'filesrilla'; // Replace with your actual bucket name

// Function to list all transcripts from S3
async function listTranscriptsFromS3() {
  const params = {
    Bucket: bucketName,
    Prefix: 'transcripts/'
  };

  try {
    const data = await s3Client.send(new ListObjectsV2Command(params));
    console.log('S3 Contents:', data.Contents);
    return data.Contents.map(item => item.Key);
  } catch (error) {
    console.error('Error listing transcripts from S3:', error);
    throw error;
  }
}

// Function to get a specific transcript from S3
async function getTranscriptFromS3(key) {
  const params = {
    Bucket: bucketName,
    Key: key,
  };

  try {
    const { Body } = await s3Client.send(new GetObjectCommand(params));
    const content = await streamToString(Body);

    const fileExtension = path.extname(key).toLowerCase();
    
    if (fileExtension === '.json') {
      try {
        const parsedContent = JSON.parse(content);
        return { content: parsedContent, fileType: 'json' };
      } catch (parseError) {
        console.error(`Error parsing JSON for key ${key}:`, parseError);
        return { content: content, fileType: 'text' };
      }
    } else if (fileExtension === '.pdf') {
      return { content: 'PDF content (binary data)', fileType: 'pdf' };
    } else {
      return { content, fileType: fileExtension.slice(1) };
    }
  } catch (error) {
    console.error(`Error getting transcript from S3 for key ${key}:`, error);
    throw error;
  }
}


// Helper function to convert stream to string
function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

// Function to transcribe file and add to S3
async function transcribeAndStore(filePath) {
  const deepgram = createClient(DEEPGRAM_API_KEY);
  try {
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      fs.readFileSync(filePath),
      {
        model: "nova-2",
        smart_format: true,
        mimetype: 'audio/wav'
      }
    );
    if (error) throw error;
    console.dir(result, { depth: null });

    // Add the new transcript to S3
    const fileName = path.basename(filePath, '.wav');
    const s3Key = `transcripts/${fileName}.json`;
    await uploadTranscriptToS3(s3Key, JSON.stringify(result), 'application/json');
    return result;
  } catch (error) {
    console.error('Error transcribing file:', error);
    throw error;
  }
}

// Function to upload transcript to S3
async function uploadTranscriptToS3(key, content, contentType) {
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: content,
    ContentType: contentType
  };

  try {
    await s3Client.send(new PutObjectCommand(params));
    console.log(`Transcript uploaded to S3: ${key}`);
  } catch (error) {
    console.error('Error uploading transcript to S3:', error);
    throw error;
  }
}

module.exports = {
  listTranscriptsFromS3,
  getTranscriptFromS3,
  transcribeAndStore
};