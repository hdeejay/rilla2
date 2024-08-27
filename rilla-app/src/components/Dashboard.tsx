import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';
import FloatingNoteBox from './FloatingNoteBox';


interface Utterance {
  speaker: string;
  text: string;
}

interface Transcript {
  transcriptId: string;
  content: string;
  fileType: string;
}

interface DashboardProps {
  onAudioRecordingStart: () => void;
  onAudioRecordingStop: () => Promise<Blob | null>;
}

interface UpdatedComment {
  commentId: string;
  content: string;
  type: string;
  fileAttachment?: string;
  startIndex?: number;
  endIndex?: number;
}

interface CommentResponse {
  comment: UpdatedComment;
  updatedAttributes: UpdatedComment;
}

interface APIComment {
  commentId: string;
  content: string;
  type: string;
  fileAttachment?: string;
  startIndex: string | number;
  endIndex: string | number;
}

const extractTextContent = (content: Utterance[] | string): string => {
  if (Array.isArray(content)) {
    return content.map(utterance => utterance.text).join(' ');
  } else if (typeof content === 'string') {
    try {
      const parsedContent = JSON.parse(content);
      if (parsedContent.results && parsedContent.results.channels) {
        return parsedContent.results.channels[0].alternatives[0].transcript;
      }
    } catch (error) {
      // If parsing fails, return the original string
    }
    return content;
  }
  return 'No content available';
};

const Dashboard: React.FC<DashboardProps> = ({ onAudioRecordingStart, onAudioRecordingStop }) => {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState<Transcript | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedText, setSelectedText] = useState({ start: 0, end: 0, text: '' });
  const [comments, setComments] = useState<Array<{
    commentId: string;
    content: string;
    type: string;
    fileAttachment?: string;
    startIndex?: number;
    endIndex?: number;
  }>>([]);
  const [commentType, setCommentType] = useState('positive');
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [commentContent, setCommentContent] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [hoveredNote, setHoveredNote] = useState<{ content: string; position: { x: number; y: number } } | null>(null);
  const [pinnedNote, setPinnedNote] = useState<{ content: string; position: { x: number; y: number } } | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('transcript', selectedFile);

    try {
      const response = await axios.post('http://localhost:8000/upload-transcript', formData);
      console.log('Transcript uploaded successfully:', response.data);
      setSelectedFile(null);
      fetchTranscripts(); // Refresh the transcript list
    } catch (error) {
      console.error('Error uploading transcript:', error);
      if (axios.isAxiosError(error) && error.response) {
        setError(`Failed to upload transcript: ${error.response.data.message || error.message}`);
      } else {
        setError('Failed to upload transcript. Please try again.');
      }
    }
  };

  useEffect(() => {
    fetchTranscripts();
  }, []);

  const fetchTranscripts = async () => {
    try {
      setLoading(true);
      const response = await axios.get<Transcript[]>('http://localhost:8000/api/transcripts');
      const formattedTranscripts = response.data.map((transcript, index) => {
        const extractedContent = extractTextContent(transcript.content);
        return {
          transcriptId: `Transcript ${index + 1}`,
          content: extractedContent,
          fileType: transcript.fileType
        };
      });
      setTranscripts(formattedTranscripts);
      setError(null);
    } catch (error) {
      console.error('Error fetching transcripts:', error);
      setError('Failed to fetch transcripts. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordButtonClick = async () => {
    if (isRecording) {
      const audioBlob = await onAudioRecordingStop();
      setIsRecording(false);
      if (audioBlob) {
        await uploadAudio(audioBlob);
      }
    } else {
      onAudioRecordingStart();
      setIsRecording(true);
    }
  };

  const uploadAudio = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recorded_audio.wav');
    try {
      const response = await axios.post('http://localhost:8000/upload-audio', formData);
      console.log('Audio uploaded and transcribed successfully:', response.data);
      fetchTranscripts(); // Refresh the transcript list
    } catch (error) {
      console.error('Error uploading and transcribing audio:', error);
      if (axios.isAxiosError(error) && error.response) {
        setError(`Failed to upload and transcribe audio: ${error.response.data.message || error.message}`);
      } else {
        setError('Failed to upload and transcribe audio. Please try again.');
      }
    }
  };

  const handleTranscriptClick = (transcript: Transcript) => {
    setSelectedTranscript(transcript);
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && selectedTranscript) {
      const range = selection.getRangeAt(0);
      const preSelectionRange = range.cloneRange();
      const parentElement = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : range.commonAncestorContainer;
      
      if (parentElement) {
        preSelectionRange.selectNodeContents(parentElement);
        preSelectionRange.setEnd(range.startContainer, range.startOffset);
        const start = preSelectionRange.toString().length;
        const end = start + range.toString().length;
        const text = selection.toString();
        if (text.length > 0) {
          setSelectedText({ start: Number(start), end: Number(end), text });
        }
      }
    }
  };

  const highlightText = (content: string, comments: Array<UpdatedComment>) => {
    const highlights = comments.flatMap(comment => [
      { index: comment.startIndex || 0, type: 'start', commentId: comment.commentId, commentType: comment.type },
      { index: comment.endIndex || 0, type: 'end', commentId: comment.commentId, commentType: comment.type }
    ]).sort((a, b) => a.index - b.index || (a.type === 'start' ? -1 : 1));

    let result = [];
    let lastIndex = 0;
    let activeHighlights: { [key: string]: string } = {};

    for (let i = 0; i < highlights.length; i++) {
      const highlight = highlights[i];
      
      if (highlight.index > lastIndex) {
        result.push(content.slice(lastIndex, highlight.index));
      }

      if (highlight.type === 'start') {
        activeHighlights[highlight.commentId] = highlight.commentType;
      } else {
        delete activeHighlights[highlight.commentId];
      }

      const backgroundColor = Object.values(activeHighlights).reduce((color, type) => {
        if (type === 'negative') return 'lightcoral';
        if (type === 'positive') return color === 'lightcoral' ? 'lightyellow' : 'lightgreen';
        return 'lightyellow';
      }, 'transparent');

      if (Object.keys(activeHighlights).length > 0) {
        const nextIndex = highlights[i + 1]?.index || content.length;
        result.push(
          <span
            key={`highlight-${i}`}
            style={{ backgroundColor, color: 'black', position: 'relative' }}
            data-comment-id={Object.keys(activeHighlights).join(',')}
            data-comment-content={Object.values(activeHighlights).map(id => comments.find(c => c.commentId === id)?.content).join(' | ')}
            data-comment-type={Object.values(activeHighlights).map(id => comments.find(c => c.commentId === id)?.type).join(',')}
            onMouseEnter={handleHighlightHover}
            onMouseLeave={handleHighlightLeave}
          >
            {content.slice(highlight.index, nextIndex)}
          </span>
        );
        lastIndex = nextIndex;
      } else {
        lastIndex = highlight.index;
      }
    }

    if (lastIndex < content.length) {
      result.push(content.slice(lastIndex));
    }

    return result;
  };

  const addOrUpdateComment = async () => {
    if (!selectedTranscript || !commentContent || !selectedText.text) return;

    const formData = new FormData();
    formData.append('transcriptId', selectedTranscript.transcriptId);
    formData.append('userId', 'currentUserId'); // Replace with actual user ID
    formData.append('content', commentContent);
    formData.append('timestamp', new Date().toISOString());
    formData.append('startIndex', selectedText.start.toString());
    formData.append('endIndex', selectedText.end.toString());
    formData.append('type', commentType);
    if (commentFile) {
      formData.append('fileAttachment', commentFile);
    }

    try {
      let response: CommentResponse;
      if (editingCommentId) {
        const { data } = await axios.put<CommentResponse>(`http://localhost:8000/api/comment`, 
          { ...Object.fromEntries(formData), commentId: editingCommentId },
          { headers: { 'Content-Type': 'application/json' } }
        );
        response = data;
        setComments(prevComments => prevComments.map(comment => 
          comment.commentId === editingCommentId ? response.updatedAttributes : comment
        ));
      } else {
        const { data } = await axios.post<CommentResponse>('http://localhost:8000/api/comment', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        response = data;
        setComments(prevComments => [...prevComments, response.comment]);
      }
      
      setCommentContent('');
      setCommentFile(null);
      setSelectedText({ start: 0, end: 0, text: '' });
      setEditingCommentId(null);
    } catch (error) {
      console.error('Error adding/updating comment:', error);
      setError('Failed to add/update comment. Please try again.');
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!selectedTranscript) return;
    try {
      await axios.delete(`http://localhost:8000/api/comment`, {
        data: { transcriptId: selectedTranscript.transcriptId, commentId }
      });
      setComments(prevComments => prevComments.filter(comment => comment.commentId !== commentId));
    } catch (error) {
      console.error('Error deleting comment:', error);
      setError('Failed to delete comment. Please try again.');
    }
  };

  useEffect(() => {
    if (selectedTranscript) {
      fetchCommentsForTranscript(selectedTranscript.transcriptId);
    }
  }, [selectedTranscript]);

  const fetchCommentsForTranscript = async (transcriptId: string) => {
    try {
      const response = await axios.get<APIComment[]>(`http://localhost:8000/api/comment?transcriptId=${transcriptId}`);
      setComments(response.data.map((comment: APIComment) => ({
        ...comment,
        startIndex: Number(comment.startIndex),
        endIndex: Number(comment.endIndex)
      })));
    } catch (error) {
      console.error('Error fetching comments:', error);
      setError('Failed to fetch comments. Please try again.');
    }
  };

  const handleHighlightHover = (event: React.MouseEvent<HTMLSpanElement>) => {
    const target = event.target as HTMLSpanElement;
    if (target.dataset.commentId) {
      const rect = target.getBoundingClientRect();
      setHoveredNote({
        content: target.dataset.commentContent || '',
        position: { x: event.clientX, y: rect.bottom },
      });
    }
  };

  const handleHighlightLeave = () => {
    setHoveredNote(null);
  };

  const handleHighlightClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    const target = event.target as HTMLSpanElement;
    if (target.dataset.commentId) {
      const rect = target.getBoundingClientRect();
      setPinnedNote({
        content: target.dataset.commentContent || '',
        position: { x: rect.left, y: rect.top },
      });
    } else {
      setPinnedNote(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pinnedNote && !(event.target as HTMLElement).closest('[data-comment-id]')) {
        setPinnedNote(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [pinnedNote]);

  const handleSummarize = async () => {
    if (!selectedTranscript) return;
    try {
      console.log('Sending summarize request:', selectedTranscript.content);
      const response = await axios.post('http://localhost:8000/api/summarize', {
        transcript: selectedTranscript.content
      });
      console.log('Received summary response:', response.data);
      setSummary(response.data.summary);
    } catch (error) {
      console.error('Error summarizing transcript:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Error response:', error.response.data);
        setError(`Failed to summarize transcript: ${error.response.data.message || error.response.statusText}`);
      } else {
        setError('Failed to summarize transcript. Please try again.');
      }
    }
  };

  return (
    <div className="dashboard">
      <h1>Transcripts Dashboard</h1>
      <div className="button-group">
        <button onClick={handleRecordButtonClick}>
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
        <div className="file-upload">
          <input 
            type="file" 
            id="file-upload" 
            onChange={(e) => {
              handleFileChange(e);
              const fileName = e.target.files && e.target.files[0] ? e.target.files[0].name : 'No file chosen';
              document.querySelector('label[for="file-upload"]')?.setAttribute('data-file-name', fileName);
            }} 
            accept=".txt,.json,.pdf" 
          />
          <label htmlFor="file-upload" data-file-name="No file chosen">Choose File</label>
        </div>
        <button onClick={handleFileUpload} disabled={!selectedFile}>
          Upload Transcript
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {loading ? (
        <p>Loading transcripts...</p>
      ) : (
        <div className="transcript-list">
          {transcripts.map((transcript) => (
            <div
              key={transcript.transcriptId}
              className="transcript-item"
              onClick={() => handleTranscriptClick(transcript)}
            >
              <h3>{transcript.transcriptId}</h3>
            </div>
          ))}
        </div>
      )}
      {selectedTranscript && (
        <div className="modal">
          <div className="modal-content" style={{ display: 'flex', maxWidth: '90%', maxHeight: '90%', position: 'relative', backgroundColor: 'white' }}>
            <button className="close-button" onClick={() => setSelectedTranscript(null)}>Close</button>
            <div className="transcript-text" style={{ flex: '1', marginRight: '20px', overflowY: 'auto', color: 'black' }}>
              <h2 style={{ color: 'black' }}>{selectedTranscript.transcriptId}</h2>
              <div 
                onMouseUp={handleTextSelection}
                onMouseOver={handleHighlightHover}
                onMouseOut={handleHighlightLeave}
                style={{ color: 'black' }}
              >
                {highlightText(selectedTranscript.content, comments)}
              </div>
            </div>
            <div className="comment-controls" style={{ width: '300px', overflowY: 'auto' }}>
              <textarea
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                placeholder="Enter your comment"
                style={{ width: '100%', minHeight: '100px', marginBottom: '10px' }}
              />
              <select 
                value={commentType} 
                onChange={(e) => setCommentType(e.target.value)}
                style={{ width: '100%', marginBottom: '10px' }}
              >
                <option value="positive">Positive</option>
                <option value="negative">Negative</option>
                <option value="suggestion">Suggestion</option>
              </select>
              <input 
                type="file" 
                onChange={(e) => e.target.files && setCommentFile(e.target.files[0])} 
                style={{ marginBottom: '10px' }}
              />
              <button 
                onClick={addOrUpdateComment}
                className="comment-button"
                style={{ backgroundColor: '#4CAF50', color: 'white', width: '100%' }}
              >
                {editingCommentId ? 'Update Comment' : 'Add Comment'}
              </button>
              {editingCommentId && (
                <button 
                  onClick={() => {
                    setEditingCommentId(null);
                    setCommentContent('');
                    setCommentType('positive');
                    setCommentFile(null);
                  }}
                  className="comment-button"
                  style={{ backgroundColor: '#f44336', color: 'white', width: '100%' }}
                >
                  Cancel Edit
                </button>
              )}
              <button 
                onClick={handleSummarize}
                className="comment-button"
                style={{ backgroundColor: '#007bff', color: 'white', width: '100%', marginBottom: '10px' }}
              >
                Summarize and Score
              </button>
              {summary && (
                <div className="summary-box" style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}>
                  <h3>Summary and Score:</h3>
                  <p>{summary}</p>
                </div>
              )}
              <div>
                {comments.map(comment => (
                  <div 
                    key={comment.commentId} 
                    className="comment-box" 
                    data-comment-id={comment.commentId}
                    style={{
                      borderLeft: `5px solid ${comment.type === 'negative' ? 'lightcoral' : comment.type === 'positive' ? 'lightgreen' : 'lightyellow'}`,
                      color: 'black'
                    }}
                  >
                    <p><strong>Selected text:</strong> {selectedTranscript.content.slice(comment.startIndex, comment.endIndex)}</p>
                    <p><strong>Comment:</strong> {comment.content}</p>
                    <p><strong>Type:</strong> {comment.type}</p>
                    {comment.fileAttachment && <p><strong>Attachment:</strong> <a href={comment.fileAttachment}>View File</a></p>}
                    <div className="comment-buttons">
                      <button className="comment-button delete-button" onClick={() => deleteComment(comment.commentId)}>Delete</button>
                      <button className="comment-button edit-button" onClick={() => {
                        setEditingCommentId(comment.commentId);
                        setCommentContent(comment.content);
                        setCommentType(comment.type);
                        setSelectedText({
                          start: comment.startIndex || 0,
                          end: comment.endIndex || 0,
                          text: selectedTranscript.content.slice(comment.startIndex, comment.endIndex)
                        });
                      }}>Edit</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {hoveredNote && (
        <FloatingNoteBox
          content={hoveredNote.content}
          position={hoveredNote.position}
        />
      )}
      {pinnedNote && (
        <FloatingNoteBox
          content={pinnedNote.content}
          position={pinnedNote.position}
        />
      )}
    </div>
  );
};

export default Dashboard;