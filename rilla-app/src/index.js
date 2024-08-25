const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: "us-west-1" }); 


exports.handler = async (event) => {
  const { httpMethod, path } = event;
  const body = JSON.parse(event.body);

  switch (httpMethod) {
    case 'POST':
      return await createComment(body);
    case 'GET':
      if (body.transcriptId && body.verify) {
        return await verifyTranscriptContents(body.transcriptId);
      } else if (body.transcriptId) {
        return await getAllCommentsForTranscript(body.transcriptId);
      } else if (body.commentId) {
        return await getComment(body);
      } else {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Missing transcriptId or commentId' })
        };
      }
    case 'PUT':
      return await updateComment(body);
    case 'DELETE':
      return await deleteComment(body);
    default:
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Unsupported HTTP method' })
      };
  }
};



async function createComment(body) {
  const { transcriptId, userId, content, timestamp, fileAttachment } = body;
  
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
    fileAttachment: fileKey
  };

  try {
    // Step 1: Get the current transcript
    const getParams = {
      TableName: 'Transcripts',
      Key: { transcriptId }
    };
    const currentTranscript = await docClient.send(new GetCommand(getParams));
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
    const updateResult = await docClient.send(new UpdateCommand(transcriptParams));
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

const openaiResponse = await sendTranscriptToOpenAI({
  transcript: verifyResult.Item.transcript,
  transcriptId,
  userId,
  comments: verifyResult.Item.comments,
  openaiAnalysis: openaiResponse.data.message 
});
console.log('OpenAI response:', openaiResponse);

async function sendTranscriptToOpenAI(data) {
  try {
    const response = await axios.post('api endpoint, whatever link the nextjs server is running on', data);  // Replace with your actual API endpoint
    return response;
  } catch (error) {
    console.error('Error sending transcript to OpenAI:', error);
    throw error;
  }
}


async function sendTranscriptToOpenAI(data) {
try {
const response = await axios.post('api endpoint, whatever link the nextjs server is running on', data);  // Replace with your actual API endpoint
return response;
} catch (error) {
console.error('Error sending transcript to OpenAI:', error);
throw error;
}
}




async function updateComment(body) {
  const { commentId, content, fileAttachment } = body;
  
  let updateExpression = 'set content = :c';
  let expressionAttributeValues = { ':c': content };

  if (fileAttachment) {
    const fileKey = `attachments/${commentId}_${fileAttachment.name}`;
    await uploadFileToS3(fileKey, fileAttachment.content);
    updateExpression += ', fileAttachment = :f';
    expressionAttributeValues[':f'] = fileKey;
  }

  const params = {
    TableName: 'comments',
    Key: { commentId },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'UPDATED_NEW'
  };
  
  try {
    const result = await docClient.send(new UpdateCommand(params));
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Comment updated successfully', updatedAttributes: result.Attributes })
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
  const { commentId } = body;
  
  const params = {
    TableName: 'comments',
    Key: { commentId },
    ReturnValues: 'ALL_OLD'
  };
  
  try {
    const result = await docClient.send(new DeleteCommand(params));
    if (result.Attributes && result.Attributes.fileAttachment) {
      await deleteFileFromS3(result.Attributes.fileAttachment);
    }
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

async function updateTranscriptWithComment(transcriptId, commentId) {
  const params = {
    TableName: 'Transcripts',
    Key: { transcriptId },
    UpdateExpression: 'SET comments = list_append(if_not_exists(comments, :empty_list), :newComment)',
    ExpressionAttributeValues: {
      ':newComment': [commentId],
      ':empty_list': []
    },
    ReturnValues: 'UPDATED_NEW'
  };
  
  try {
    const result = await docClient.send(new UpdateCommand(params));
    console.log('Transcript updated successfully:', result);
  } catch (error) {
    console.error('Error updating transcript with comment:', error);
    throw error;
  }
}

async function getCommentsForTranscript(transcriptId) {
  const params = {
    TableName: 'comments',
    IndexName: 'transcriptId-index',
    KeyConditionExpression: 'transcriptId = :tid',
    ExpressionAttributeValues: {
      ':tid': transcriptId
    }
  };
  
  try {
    const result = await docClient.send(new QueryCommand(params));
    return {
      statusCode: 200,
      body: JSON.stringify(result.Items)
    };
  } catch (error) {
    console.error('Error getting comments for transcript:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error getting comments', error: error.message })
    };
  }
}

// Add this function to your Lambda to get all comments for a transcript
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

async function getFileFromS3(key) {
  const params = {
    Bucket: "filesrilla", 
    Key: key
  };

  const { Body } = await s3Client.send(new GetObjectCommand(params));
  return Body.toString('base64');
}




async function deleteFileFromS3(key) {
  const params = {
    Bucket: "filesrilla", 
    Key: key
  };

  await s3Client.send(new DeleteObjectCommand(params));
}