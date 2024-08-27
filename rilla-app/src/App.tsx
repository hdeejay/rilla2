import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import './App.css';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);

  const [audioRecording, setAudioRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | undefined>(undefined);

  const handleDataAvailable = useCallback(({ data }: BlobEvent) => {
    if (data.size > 0) {
      setRecordedChunks((prev) => prev.concat(data));
    }
  }, []);

  const handleStartCaptureClick = useCallback(() => {
    if (webcamRef.current && webcamRef.current.stream) {
      setRecording(true);
      mediaRecorderRef.current = new MediaRecorder(webcamRef.current.stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current.addEventListener('dataavailable', handleDataAvailable);
      mediaRecorderRef.current.start();
    }
  }, [handleDataAvailable]);

  const handleStopCaptureClick = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (recordedChunks.length) {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const formData = new FormData();
      formData.append('video', blob, 'recorded_video.webm');
      
      try {
        const response = await axios.post('http://localhost:8000/upload', formData);
        console.log('Video uploaded successfully:', response.data);
        setRecordedChunks([]);
      } catch (error) {
        console.error('Error uploading video:', error);
      }
    }
  }, [recordedChunks]);

  const handleStartAudioRecording = useCallback(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        mediaRecorderRef.current = new MediaRecorder(stream);
        mediaRecorderRef.current.start();
        setAudioRecording(true);

        const audioChunks: Blob[] = [];
        mediaRecorderRef.current.addEventListener("dataavailable", event => {
          audioChunks.push(event.data);
        });

        mediaRecorderRef.current.addEventListener("stop", () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          setAudioBlob(audioBlob);
        });
      });
  }, []);

  const handleStopAudioRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setAudioRecording(false);
        mediaRecorderRef.current.addEventListener("stop", () => {
          resolve(audioBlob || null);
        });
      } else {
        resolve(null);
      }
    });
  }, [audioBlob]);

  const handleAudioUpload = useCallback(async () => {
    if (audioBlob) {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recorded_audio.wav');
      
      try {
        const response = await axios.post('http://localhost:8000/upload-audio', formData);
        console.log('Audio uploaded and transcribed successfully:', response.data);
        setAudioBlob(undefined);
      } catch (error) {
        console.error('Error uploading and transcribing audio:', error);
      }
    }
  }, [audioBlob]);

  return (
    <div className="App">
      <h1>RILLA</h1>
      <Webcam 
        audio={true}
        videoConstraints={{
          width: 1280,
          height: 720,
          facingMode: "user"
        }}
        ref={webcamRef}
      />
      <div className="button-group">
        <button onClick={recording ? handleStopCaptureClick : handleStartCaptureClick}>
          {recording ? 'Stop Video Recording' : 'Start Video Recording'}
        </button>
        <button onClick={audioRecording ? handleStopAudioRecording : handleStartAudioRecording}>
          {audioRecording ? 'Stop Audio Recording' : 'Start Audio Recording'}
        </button>
        {recordedChunks.length > 0 && (
          <button onClick={handleUpload}>Upload Video</button>
        )}
        {audioBlob && (
          <button onClick={handleAudioUpload}>Upload Audio</button>
        )}
      </div>
      <Dashboard onAudioRecordingStart={handleStartAudioRecording} onAudioRecordingStop={handleStopAudioRecording} />
    </div>
  );
};

export default App;