

require('dotenv').config();
console.log('Environment variables:', Object.keys(process.env));
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const axios = require('axios');


// Hard-coded configuration
const AWS_REGION = 'us-west-1';
const AWS_ACCESS_KEY_ID = 'AKIA4MI2JKWU5O4Z737I';
const AWS_SECRET_ACCESS_KEY = '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';

const dynamoClient = new DynamoDBClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
  }
});
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true
  }
});
const s3Client = new S3Client({ 
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
  }
}); 

async function main(event) {
  const { httpMethod, body, path } = event;
  const parsedBody = JSON.parse(body);

  switch (httpMethod) {
    case 'POST':
      if (path === '/api/summarize') {
        return await handleSummarize(parsedBody, {
          status: (code) => ({ statusCode: code, json: (body) => ({ statusCode: code, body: JSON.stringify(body) }) })
        });
      } else {
        return await createComment(parsedBody);
      }
    case 'GET':
      if (parsedBody.transcriptId && parsedBody.verify) {
        return await verifyTranscriptContents(parsedBody.transcriptId);
      } else if (parsedBody.transcriptId) {
        return await getAllCommentsForTranscript(parsedBody.transcriptId);
      } else if (parsedBody.commentId) {
        return await getComment(parsedBody);
      } else {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Missing transcriptId or commentId' })
        };
      }
    case 'PUT':
      return await updateComment(parsedBody);
    case 'DELETE':
      return await deleteComment(parsedBody);
    default:
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Unsupported HTTP method' })
      };
  }
}

exports.handler = async (event) => {
  return await main(event);
};

async function createComment(body) {
  const { transcriptId, userId, content, timestamp, fileAttachment, startIndex, endIndex, type } = body;
  
  const commentId = Date.now().toString();
  let fileKey;

  if (fileAttachment) {
    fileKey = `attachments/${commentId}_${fileAttachment.name}`;
    await uploadFileToS3(fileKey, fileAttachment.content);
  }

  const newComment = {
    commentId,
    userId,
    content,
    timestamp,
    type
  };

  // Only add these properties if they are defined
  if (fileKey) newComment.fileAttachment = fileKey;
  if (startIndex !== undefined) newComment.startIndex = startIndex;
  if (endIndex !== undefined) newComment.endIndex = endIndex;

  try {
    // Step 1: Get the current transcript
    const getParams = {
      TableName: 'Transcripts',
      Key: { transcriptId }
    };
    const getCommand = new GetCommand(getParams);
    const currentTranscript = await docClient.send(getCommand);
    let currentComments = currentTranscript.Item?.comments || '[]';

    // Parse the comments string to an array
    let commentsArray;
    try {
      commentsArray = JSON.parse(currentComments);
    } catch (error) {
      console.error('Error parsing comments:', error);
      commentsArray = [];
    }

    // Add the new comment
    commentsArray.push(newComment);

    // Convert the array back to a string
    const updatedCommentsString = JSON.stringify(commentsArray);

    // Step 2: Update the transcript with the new comments string
    const transcriptParams = {
      TableName: 'Transcripts',
      Key: { transcriptId },
      UpdateExpression: 'SET comments = :newComments',
      ExpressionAttributeValues: {
        ':newComments': updatedCommentsString
      },
      ReturnValues: 'UPDATED_NEW'
    };

    console.log('Updating transcript with params:', JSON.stringify(transcriptParams));
    const updateCommand = new UpdateCommand(transcriptParams);
    const updateResult = await docClient.send(updateCommand);
    console.log('Transcript updated successfully. Result:', JSON.stringify(updateResult));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Comment created and linked successfully', comment: newComment })
    };
  } catch (error) {
    console.error('Error in createComment:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error creating comment', error: error.message })
    };
  }
}

async function updateComment(body) {
  const { transcriptId, commentId, content, fileAttachment, type, startIndex, endIndex } = body;
  
  try {
    // First, get the current transcript
    const getParams = {
      TableName: 'Transcripts',
      Key: { transcriptId }
    };
    const getCommand = new GetCommand(getParams);
    const currentTranscript = await docClient.send(getCommand);
    
    if (!currentTranscript.Item || !currentTranscript.Item.comments) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Transcript or comments not found' })
      };
    }

    // Parse the comments, update the specific comment, and stringify again
    let comments = JSON.parse(currentTranscript.Item.comments);
    const commentIndex = comments.findIndex(comment => comment.commentId === commentId);
    
    if (commentIndex === -1) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Comment not found' })
      };
    }

    comments[commentIndex] = {
      ...comments[commentIndex],
      content,
      type,
      startIndex,
      endIndex,
      fileAttachment: fileAttachment ? `attachments/${commentId}_${fileAttachment.name}` : comments[commentIndex].fileAttachment
    };

    const updatedCommentsString = JSON.stringify(comments);

    // Update the transcript with the new comments array
    const updateParams = {
      TableName: 'Transcripts',
      Key: { transcriptId },
      UpdateExpression: 'SET comments = :newComments',
      ExpressionAttributeValues: {
        ':newComments': updatedCommentsString
      },
      ReturnValues: 'UPDATED_NEW'
    };

    const updateCommand = new UpdateCommand(updateParams);
    const result = await docClient.send(updateCommand);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Comment updated successfully', 
        updatedAttributes: comments[commentIndex]
      })
    };
  } catch (error) {
    console.error('Error updating comment:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error updating comment', error: error.message })
    };
  }
}

async function deleteComment(body) {
  const { transcriptId, commentId } = body;
  
  try {
    // First, get the current transcript
    const getParams = {
      TableName: 'Transcripts',
      Key: { transcriptId }
    };
    const getCommand = new GetCommand(getParams);
    const currentTranscript = await docClient.send(getCommand);
    
    if (!currentTranscript.Item || !currentTranscript.Item.comments) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Transcript or comments not found' })
      };
    }

    // Parse the comments, filter out the one to be deleted, and stringify again
    let comments = JSON.parse(currentTranscript.Item.comments);
    comments = comments.filter(comment => comment.commentId !== commentId);
    const updatedCommentsString = JSON.stringify(comments);

    // Update the transcript with the new comments array
    const updateParams = {
      TableName: 'Transcripts',
      Key: { transcriptId },
      UpdateExpression: 'SET comments = :newComments',
      ExpressionAttributeValues: {
        ':newComments': updatedCommentsString
      },
      ReturnValues: 'UPDATED_NEW'
    };

    const updateCommand = new UpdateCommand(updateParams);
    await docClient.send(updateCommand);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Comment deleted successfully' })
    };
  } catch (error) {
    console.error('Error deleting comment:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error deleting comment', error: error.message })
    };
  }
}

async function verifyTranscriptContents(transcriptId) {
  const params = {
    TableName: 'Transcripts',
    Key: { transcriptId }
  };

  try {
    const result = await docClient.send(new GetCommand(params));
    console.log('Transcript contents:', JSON.stringify(result.Item, null, 2));
    
    if (result.Item && result.Item.comments) {
      console.log('Comments type:', typeof result.Item.comments);
      let commentsArray;
      try {
        commentsArray = JSON.parse(result.Item.comments);
        console.log('Parsed comments is array:', Array.isArray(commentsArray));
        console.log('Parsed comments length:', commentsArray.length);
        console.log('First 5 comments:', commentsArray.slice(0, 5));
      } catch (error) {
        console.error('Error parsing comments:', error);
        console.log('Raw comments value:', result.Item.comments);
      }
    } else {
      console.log('No comments found or comments is not a string');
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result.Item)
    };
  } catch (error) {
    console.error('Error verifying transcript contents:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error verifying transcript', error: error.message })
    };
  }
}

async function getAllCommentsForTranscript(transcriptId) {
  try {
    const params = {
      TableName: 'Transcripts',
      Key: { transcriptId }
    };
    const result = await docClient.send(new GetCommand(params));
    
    let comments = [];
    if (result.Item && result.Item.comments) {
      try {
        comments = JSON.parse(result.Item.comments);
      } catch (error) {
        console.error('Error parsing comments:', error);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify(comments)
    };
  } catch (error) {
    console.error('Error getting comments for transcript:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error getting comments', error: error.message })
    };
  }
}

async function uploadFileToS3(key, content) {
  const params = {
    Bucket: "filesrilla",
    Key: key,
    Body: Buffer.from(content, 'base64'),
    ContentType: "application/octet-stream"
  };

  await s3Client.send(new PutObjectCommand(params));
}

async function deleteFileFromS3(key) {
  const params = {
    Bucket: "filesrilla", 
    Key: key
  };

  await s3Client.send(new DeleteObjectCommand(params));
}

async function getComment(body) {
  const { transcriptId, commentId } = body;
  try {
    const params = {
      TableName: 'Transcripts',
      Key: { transcriptId }
    };
    const result = await docClient.send(new GetCommand(params));
    
    if (result.Item && result.Item.comments) {
      const comments = JSON.parse(result.Item.comments);
      const comment = comments.find(c => c.commentId === commentId);
      if (comment) {
        return {
          statusCode: 200,
          body: JSON.stringify(comment)
        };
      }
    }
    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'Comment not found' })
    };
  } catch (error) {
    console.error('Error getting comment:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error getting comment', error: error.message })
    };
  }
}

async function sendTranscriptToOpenAI(data) {
  if (!process.env.OPENAI_API_ENDPOINT || !process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API endpoint or key is not set');
  }
  try {
    const response = await axios.post(process.env.OPENAI_API_ENDPOINT, {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant that summarizes transcripts." },
        { role: "user", content: `Please summarize the following transcript: ${data.transcript}` }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error sending transcript to OpenAI:', error);
    throw error;
  }
}

async function handleSummarize(body, res) {
  const { transcript } = body;
  try {
    const summary = await sendTranscriptToOpenAI({ transcript });
    return {
      statusCode: 200,
      body: JSON.stringify({ summary })
    };
  } catch (error) {
    console.error('Error in summarize:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error summarizing transcript', error: error.message })
    };
  }
}

module.exports = {
  handler: async (event) => await main(event),
  createComment,
  updateComment,
  deleteComment,
  getAllCommentsForTranscript,
  verifyTranscriptContents,
  getComment,
  sendTranscriptToOpenAI,
  handleSummarize
};