import ffmpeg from 'fluent-ffmpeg';

export const getFfprobePath = () => {
  var os = require('os');
  var path = require('path');

  var platform = os.platform();
  if (platform !== 'darwin' && platform !== 'linux' && platform !== 'win32') {
    console.error('Unsupported platform.');
    process.exit(1);
  }

  var arch = os.arch();
  if (platform === 'darwin' && arch !== 'x64' && arch !== 'arm64') {
    console.error('Unsupported architecture.');
    process.exit(1);
  }

  return path.join('bin', platform, arch, platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
};

export const concatAudio = async (fileListPath: string, outputFilePath: string) => {
  ffmpeg.setFfmpegPath('./node_modules/ffmpeg-static/ffmpeg');
  ffmpeg.setFfprobePath(`./node_modules/ffprobe-static/${getFfprobePath()}`);
  console.log('Concatenating audio files...');

  // merge the files
  const ffmpegOutput = await new Promise<{ output: string; fileList: string }>((resolve, reject) => {
    ffmpeg()
      .input(fileListPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .audioChannels(2) // force stereo output
      .outputOptions('-c:a', 'libmp3lame')
      .output(outputFilePath)
      .on('end', async function () {
        console.log('files have been merged succesfully');

        resolve({ output: outputFilePath, fileList: fileListPath });
      })
      .on('error', function (err) {
        console.log('an error happened: ' + err.message);
        reject(err);
      })
      .run();
  });

  return ffmpegOutput;
};
