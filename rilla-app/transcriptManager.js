const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const fs = require('fs');
const path = require('path');
const { createClient } = require("@deepgram/sdk");

// Set up DynamoDB client
const dynamoClient = new DynamoDBClient({ region: 'us-west-1' }); // Replace with your AWS region
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Function to add newly generated transcript to DynamoDB
async function addNewTranscriptToDynamoDB(transcript, fileName) {
  const params = {
    TableName: 'Transcripts', // Replace with your actual table name
    Item: {
      transcriptId: fileName, // Using fileName as the unique identifier
      content: transcript,
      createdAt: new Date().toISOString()
    }
  };
  try {
    await docClient.send(new PutCommand(params));
    console.log(`Transcript ${fileName} added to DynamoDB successfully`);
  } catch (error) {
    console.error('Error adding transcript to DynamoDB:', error);
  }
}

// Function to add existing JSON transcript to DynamoDB
async function addExistingTranscriptToDynamoDB(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const transcript = JSON.parse(fileContent);
    
    const params = {
      TableName: 'Transcripts', // Replace with your actual table name
      Item: {
        transcriptId: path.basename(filePath, 'transcript.json'), // Using filename without extension as ID
        content: transcript,
        createdAt: new Date().toISOString()
      }
    };
    await docClient.send(new PutCommand(params));
    console.log(`Existing transcript ${filePath} added to DynamoDB successfully`);
  } catch (error) {
    console.error('Error adding existing transcript to DynamoDB:', error);
  }
}

// Function to transcribe file and add to DynamoDB
async function transcribeAndStore(filePath) {
  const deepgram = createClient('afd9f73947345deb9f583e238f7cd56011d82272');
  try {
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      fs.readFileSync(filePath),
      {
        model: "nova-2",
        smart_format: true,
        mimetype: 'video/quicktime'
      }
    );
    if (error) throw error;
    console.dir(result, { depth: null });
    
    // Add the new transcript to DynamoDB
    await addNewTranscriptToDynamoDB(result, path.basename(filePath));
  } catch (error) {
    console.error('Error transcribing file:', error);
  }
}

module.exports = {
  addNewTranscriptToDynamoDB,
  addExistingTranscriptToDynamoDB,
  transcribeAndStore
};