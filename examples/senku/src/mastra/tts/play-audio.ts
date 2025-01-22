import player from 'play-sound';

const audioPlayer = player({});

export async function playAudio(outputPath: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      // Play the audio file and wait for completion
      audioPlayer.play(outputPath, err => {
        if (err) {
          console.error('Error playing audio:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}
