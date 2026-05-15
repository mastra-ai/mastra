export async function recordMicrophoneToFile(onFinish: (file: File) => void) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);

  let chunks: BlobPart[] = [];

  mediaRecorder.ondataavailable = e => {
    chunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const file = new File([blob], `recording-${Date.now()}.webm`, {
      type: 'audio/webm',
      lastModified: Date.now(),
    });

    stream.getTracks().forEach(track => track.stop());
    onFinish(file);
  };

  return mediaRecorder;
}
