const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: "us-west-1" }); // Replace with your AWS region

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

  const commentParams = {
    TableName: 'comments',
    Item: {
      commentId,
      transcriptId,
      userId,
      content,
      timestamp,
      fileAttachment: fileKey
    }
  };

  try {
    // Step 1: Create the comment
    console.log('Creating comment with params:', JSON.stringify(commentParams));
    await docClient.send(new PutCommand(commentParams));
    console.log('Comment created successfully');

    // Step 2: Update the transcript
    const transcriptParams = {
      TableName: 'Transcripts',
      Key: { transcriptId },
      UpdateExpression: 'SET comments = list_append(if_not_exists(comments, :empty_list), :newComment)',
      ExpressionAttributeValues: {
        ':newComment': [commentId],
        ':empty_list': []
      },
      ReturnValues: 'UPDATED_NEW'
    };

    console.log('Updating transcript with params:', JSON.stringify(transcriptParams));
    const updateResult = await docClient.send(new UpdateCommand(transcriptParams));
    console.log('Transcript updated successfully. Result:', JSON.stringify(updateResult));

    // Step 3: Verify the update
    const verifyParams = {
      TableName: 'Transcripts',
      Key: { transcriptId }
    };
    const verifyResult = await docClient.send(new GetCommand(verifyParams));
    console.log('Verified transcript contents:', JSON.stringify(verifyResult.Item));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Comment created and linked successfully', commentId, transcriptContents: verifyResult.Item })
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
      console.log('Comments length:', result.Item.comments.length);
      console.log('First comment:', result.Item.comments[0]);
    } else {
      console.log('No comments found or comments is not an array');
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
async function uploadFileToS3(key, content) {
  const params = {
    Bucket: "filesrilla", // Replace with your S3 bucket name
    Key: key,
    Body: Buffer.from(content, 'base64'),
    ContentType: "application/octet-stream"
  };

  await s3Client.send(new PutObjectCommand(params));
}

async function getFileFromS3(key) {
  const params = {
    Bucket: "filesrilla", // Replace with your S3 bucket name
    Key: key
  };

  const { Body } = await s3Client.send(new GetObjectCommand(params));
  return Body.toString('base64');
}




async function deleteFileFromS3(key) {
  const params = {
    Bucket: "filesrilla", // Replace with your S3 bucket name
    Key: key
  };

  await s3Client.send(new DeleteObjectCommand(params));
}