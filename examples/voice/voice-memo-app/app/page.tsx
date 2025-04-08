'use client';

import { useState, useRef } from 'react';

export default function Summary() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptions, setTranscriptions] = useState<string[]>([]);
  const [summary, setSummary] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = e => {
        chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob);

        try {
          const response = await fetch('/api/audio', {
            method: 'POST',
            body: formData,
          });
          const { text } = await response.json();
          setTranscriptions(prev => [...prev, text]);
        } catch (error) {
          console.error('Error sending audio:', error);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const handleSummarize = async () => {
    try {
      const response = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Please summarize these transcriptions:\n${transcriptions.join('\n')}`,
            },
          ],
        }),
      });

      const responseText = await response.text();

      try {
        const parsedResponse = JSON.parse(responseText);
        setSummary(parsedResponse.summary);
      } catch {
        setSummary(responseText);
      }
    } catch (fetchError) {
      console.error('Failed to summarize:', fetchError);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      <div className="flex-1 overflow-y-auto mb-24">
        <h2 className="text-xl font-bold mb-4">Notes</h2>
        {transcriptions.map((text, index) => (
          <div key={index} className="mb-4 p-4 bg-gray-100 dark:bg-zinc-800 rounded">
            {text}
          </div>
        ))}

        {summary && (
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Summary</h2>
            <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded">{summary}</div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 w-full max-w-md p-2 mb-8 flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`flex-1 p-2 rounded ${
              isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
            } text-white`}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
          <button
            type="button"
            onClick={handleSummarize}
            disabled={transcriptions.length === 0}
            className="flex-1 p-2 rounded bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white"
          >
            Summarize
          </button>
        </div>
      </div>
    </div>
  );
}
