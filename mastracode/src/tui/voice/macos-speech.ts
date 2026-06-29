import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { StreamingTranscriber, TranscriptEvent } from './transcriber.js';

const HELPER_SOURCE = String.raw`import Foundation
import Speech
import AVFoundation

let arguments = CommandLine.arguments.dropFirst()
let eventPath = arguments.count >= 1 ? String(arguments[arguments.startIndex]) : nil
let stopPath = arguments.count >= 2 ? String(arguments[arguments.index(arguments.startIndex, offsetBy: 1)]) : nil

func emit(_ fields: [String: String]) {
    let data = try! JSONSerialization.data(withJSONObject: fields, options: [])
    if let eventPath = eventPath {
        let line = String(data: data, encoding: .utf8)! + "\n"
        if let fileData = line.data(using: .utf8) {
            if !FileManager.default.fileExists(atPath: eventPath) {
                FileManager.default.createFile(atPath: eventPath, contents: nil)
            }
            let handle = try! FileHandle(forWritingTo: URL(fileURLWithPath: eventPath))
            handle.seekToEndOfFile()
            handle.write(fileData)
            try? handle.close()
        }
    } else {
        FileHandle.standardOutput.write(data)
        FileHandle.standardOutput.write("\n".data(using: .utf8)!)
    }
}

func fail(_ message: String) -> Never {
    emit(["type": "error", "message": message])
    exit(1)
}

let semaphore = DispatchSemaphore(value: 0)
SFSpeechRecognizer.requestAuthorization { status in
    if status != .authorized {
        fail("Speech recognition permission denied")
    }
    semaphore.signal()
}
semaphore.wait()

switch AVCaptureDevice.authorizationStatus(for: .audio) {
case .authorized:
    break
case .notDetermined:
    let micSemaphore = DispatchSemaphore(value: 0)
    AVCaptureDevice.requestAccess(for: .audio) { allowed in
        if !allowed {
            fail("Microphone permission denied")
        }
        micSemaphore.signal()
    }
    micSemaphore.wait()
default:
    fail("Microphone permission denied")
}

guard let recognizer = SFSpeechRecognizer(), recognizer.isAvailable else {
    fail("Speech recognizer is not available")
}

let audioEngine = AVAudioEngine()
let request = SFSpeechAudioBufferRecognitionRequest()
request.shouldReportPartialResults = true
if #available(macOS 13.0, *) {
    request.addsPunctuation = true
}

var requestedStop = false
var didFinish = false

func finish(_ code: Int32) -> Never {
    didFinish = true
    audioEngine.stop()
    audioEngine.inputNode.removeTap(onBus: 0)
    exit(code)
}

func requestFinalResult() {
    if requestedStop { return }
    requestedStop = true
    audioEngine.stop()
    audioEngine.inputNode.removeTap(onBus: 0)
    request.endAudio()
    DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
        if !didFinish {
            finish(0)
        }
    }
}

let task = recognizer.recognitionTask(with: request) { result, error in
    if let result = result {
        emit(["type": result.isFinal ? "final" : "partial", "text": result.bestTranscription.formattedString])
        if result.isFinal {
            finish(0)
        }
    }
    if let error = error {
        emit(["type": "error", "message": error.localizedDescription])
        finish(1)
    }
}

let inputNode = audioEngine.inputNode
let format = inputNode.outputFormat(forBus: 0)
inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
    request.append(buffer)
}

do {
    audioEngine.prepare()
    try audioEngine.start()
} catch {
    task.cancel()
    fail("Unable to start microphone: \(error.localizedDescription)")
}

if let stopPath = stopPath {
    let timer = DispatchSource.makeTimerSource(queue: DispatchQueue.main)
    timer.schedule(deadline: .now(), repeating: .milliseconds(100))
    timer.setEventHandler {
        if FileManager.default.fileExists(atPath: stopPath) {
            requestFinalResult()
            timer.cancel()
        }
    }
    timer.resume()
} else {
    DispatchQueue.global(qos: .background).async {
        while let line = readLine() {
            if line.trimmingCharacters(in: .whitespacesAndNewlines) == "stop" {
                DispatchQueue.main.async {
                    requestFinalResult()
                }
                break
            }
        }
    }
}

RunLoop.main.run()
`;

const HELPER_INFO_PLIST = String.raw`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>MastraCodeVoiceHelper</string>
  <key>CFBundleIdentifier</key>
  <string>ai.mastra.mastracode.voice-helper</string>
  <key>CFBundleName</key>
  <string>MastraCode Voice Helper</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>LSBackgroundOnly</key>
  <true/>
  <key>NSMicrophoneUsageDescription</key>
  <string>MastraCode uses the microphone to transcribe push-to-talk voice input into the chat composer.</string>
  <key>NSSpeechRecognitionUsageDescription</key>
  <string>MastraCode uses speech recognition to transcribe push-to-talk voice input into the chat composer.</string>
</dict>
</plist>
`;

export class MacOSSpeechTranscriber implements StreamingTranscriber {
  private child?: ReturnType<typeof spawn>;
  private stopPath?: string;

  async *start(): AsyncIterable<TranscriptEvent> {
    if (process.platform !== 'darwin') {
      yield { type: 'error', message: 'macOS Speech voice input is only available on macOS' };
      return;
    }

    const appPath = ensureHelperApp();
    const sessionDir = mkdtempSync(join(tmpdir(), 'mastracode-voice-session-'));
    const eventPath = join(sessionDir, 'events.jsonl');
    this.stopPath = join(sessionDir, 'stop');
    writeFileSync(eventPath, '');

    const child = spawn('open', ['-n', '-W', appPath, '--args', eventPath, this.stopPath], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    this.child = child;

    let stderr = '';
    child.stderr?.on('data', chunk => {
      stderr += chunk.toString();
    });

    let offset = 0;
    let buffered = '';
    let sawEvent = false;
    let closed = false;
    child.once('close', () => {
      closed = true;
    });

    while (!closed || statSync(eventPath).size > offset) {
      const size = statSync(eventPath).size;
      if (size > offset) {
        const chunk = readFileSync(eventPath, 'utf8').slice(offset);
        offset = size;
        buffered += chunk;
        const lines = buffered.split('\n');
        buffered = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed) as TranscriptEvent;
            if (event.type === 'partial' || event.type === 'final' || event.type === 'error') {
              sawEvent = true;
              yield event;
            }
          } catch {
            yield { type: 'error', message: `Invalid macOS Speech event: ${trimmed}` };
          }
        }
      }
      if (!closed) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    const exitCode = await new Promise<number | null>(resolve => {
      if (child.exitCode !== null) {
        resolve(child.exitCode);
        return;
      }
      child.once('close', code => resolve(code));
    });

    if (exitCode && exitCode !== 0) {
      yield { type: 'error', message: stderr.trim() || `macOS Speech helper exited with code ${exitCode}` };
    } else if (!sawEvent) {
      yield { type: 'error', message: stderr.trim() || 'macOS Speech helper exited without producing a transcript event' };
    }
  }

  stop(): void {
    const child = this.child;
    if (!child || child.exitCode !== null) {
      this.child = undefined;
      return;
    }

    if (this.stopPath) {
      writeFileSync(this.stopPath, 'stop');
    }

    setTimeout(() => {
      if (child.exitCode === null) {
        try {
          execFileSync('osascript', ['-e', 'tell application id "ai.mastra.mastracode.voice-helper" to quit'], {
            stdio: 'ignore',
          });
        } catch {
          child.kill('SIGTERM');
        }
      }
    }, 3_000).unref();
  }
}

function ensureHelperApp(): string {
  const hash = createHash('sha256').update(HELPER_SOURCE).update(HELPER_INFO_PLIST).digest('hex').slice(0, 12);
  const dir = join(tmpdir(), 'mastracode-voice');
  const appPath = join(dir, `MastraCodeVoiceHelper-${hash}.app`);
  const contentsPath = join(appPath, 'Contents');
  const macOSPath = join(contentsPath, 'MacOS');
  const sourcePath = join(dir, `macos-speech-${hash}.swift`);
  const plistPath = join(contentsPath, 'Info.plist');
  const binaryPath = join(macOSPath, 'MastraCodeVoiceHelper');

  if (existsSync(binaryPath)) {
    return appPath;
  }

  mkdirSync(macOSPath, { recursive: true });
  writeFileSync(sourcePath, HELPER_SOURCE);
  writeFileSync(plistPath, HELPER_INFO_PLIST);
  execFileSync('swiftc', [sourcePath, '-o', binaryPath, '-framework', 'Speech', '-framework', 'AVFoundation'], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  return appPath;
}
