const FILE_EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'video/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

const FALLBACK_MIME_TYPE = 'audio/webm';

function containerType(mimeType: string): string {
  const [base = ''] = mimeType.split(';');
  return base.trim().toLowerCase();
}

function releaseMicrophone(stream: MediaStream) {
  stream.getTracks().forEach(track => track.stop());
}

export async function recordMicrophoneToFile(onFinish: (file: File) => void) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  let mediaRecorder: MediaRecorder;
  try {
    mediaRecorder = new MediaRecorder(stream);
  } catch (error) {
    releaseMicrophone(stream);
    throw error;
  }

  const chunks: Blob[] = [];

  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    const type = containerType(mediaRecorder.mimeType || chunks[0]?.type || '') || FALLBACK_MIME_TYPE;
    const file = new File(chunks, `recording-${Date.now()}.${FILE_EXTENSIONS[type] ?? 'webm'}`, {
      type,
      lastModified: Date.now(),
    });

    releaseMicrophone(stream);
    onFinish(file);
  };

  return mediaRecorder;
}
