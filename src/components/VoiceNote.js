import React from 'react';
import { ReactMediaRecorder } from 'react-media-recorder';

const VoiceNote = ({ setVoiceBlob }) => {
  return (
    <ReactMediaRecorder
      audio
      render={({ status, startRecording, stopRecording, mediaBlobUrl }) => (
        <div>
          <p>{status}</p>
          <button onClick={startRecording}>Start Recording</button>
          <button onClick={stopRecording}>Stop Recording</button>
          {mediaBlobUrl && (
            <audio src={mediaBlobUrl} controls onEnded={() => setVoiceBlob(mediaBlobUrl)} />
          )}
        </div>
      )}
    />
  );
};

export default VoiceNote;
