// On-device speech-to-text for MastraCode push-to-talk voice input.
//
// Taps the default input device with AVAudioEngine and feeds it to
// SFSpeechRecognizer with on-device recognition (offline, low-latency). Emits
// newline-delimited JSON events:
//   {"type":"ready"}                      once recognition has started
//   {"type":"partial","text":"..."}      on each interim hypothesis
//   {"type":"final","text":"..."}        once, when stopping
//   {"type":"error","message":"..."}     on any fatal error
//
// IPC: this helper runs inside a .app bundle launched via LaunchServices
// (`open -n -W`), which is the ONLY way macOS shows the Speech Recognition /
// Microphone permission prompts. A LaunchServices-launched app has no usable
// stdin/stdout pipe back to the parent, so events are written to an event file
// and stopping is signalled by the existence of a stop file. Both paths are
// passed as arguments:
//   --events <path>   append JSONL events here (falls back to stdout if absent)
//   --stop <path>     poll for this file; when it appears, flush a final result
//
// Run with `--probe` to report permission/availability without recording (this
// mode writes to stdout and is launched directly, not via `open`):
//   {"type":"probe","speech":"authorized|denied|restricted|notDetermined",
//    "mic":"authorized|denied|restricted|notDetermined","available":true}

import AVFoundation
import Foundation
import Speech

// MARK: - Argument parsing

func argValue(_ flag: String) -> String? {
    let args = CommandLine.arguments
    guard let idx = args.firstIndex(of: flag), idx + 1 < args.count else { return nil }
    return args[idx + 1]
}

let eventPath = argValue("--events")
let stopPath = argValue("--stop")

// MARK: - JSON line output

func emit(_ obj: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: obj),
          let line = String(data: data, encoding: .utf8) else { return }
    let payload = Data((line + "\n").utf8)
    if let eventPath = eventPath {
        if !FileManager.default.fileExists(atPath: eventPath) {
            FileManager.default.createFile(atPath: eventPath, contents: nil)
        }
        if let handle = try? FileHandle(forWritingTo: URL(fileURLWithPath: eventPath)) {
            handle.seekToEndOfFile()
            handle.write(payload)
            try? handle.close()
        }
    } else {
        FileHandle.standardOutput.write(payload)
    }
}

func fail(_ message: String) -> Never {
    emit(["type": "error", "message": message])
    exit(1)
}

// MARK: - Recognizer

final class Recognizer {
    private let engine = AVAudioEngine()
    private let recognizer = SFSpeechRecognizer()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var lastText = ""
    private var finished = false

    func start() {
        guard let recognizer = recognizer, recognizer.isAvailable else {
            fail("Speech recognizer is not available for this locale.")
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }
        self.request = request

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.request?.append(buffer)
        }

        engine.prepare()
        do {
            try engine.start()
        } catch {
            fail("Could not start the audio engine: \(error.localizedDescription)")
        }

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self = self else { return }
            if let result = result {
                let text = result.bestTranscription.formattedString
                self.lastText = text
                if result.isFinal {
                    self.finish()
                } else {
                    emit(["type": "partial", "text": text])
                }
            }
            if error != nil {
                // End-of-audio also reports here; flush whatever we have.
                self.finish()
            }
        }

        emit(["type": "ready"])
    }

    func stop() {
        guard !finished else { return }
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        request?.endAudio()
        // Give the recognizer a brief moment to emit its final result; if it
        // does not, flush the last partial we saw.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            self?.finish()
        }
    }

    private func finish() {
        guard !finished else { return }
        finished = true
        emit(["type": "final", "text": lastText])
        exit(0)
    }
}

// MARK: - Permission helpers

func speechStatusName(_ status: SFSpeechRecognizerAuthorizationStatus) -> String {
    switch status {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .restricted: return "restricted"
    case .notDetermined: return "notDetermined"
    @unknown default: return "unknown"
    }
}

func micStatusName(_ status: AVAuthorizationStatus) -> String {
    switch status {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .restricted: return "restricted"
    case .notDetermined: return "notDetermined"
    @unknown default: return "unknown"
    }
}

// MARK: - Probe mode (report permission/availability, no recording)

if CommandLine.arguments.contains("--probe") {
    let speech = SFSpeechRecognizer.authorizationStatus()
    let mic = AVCaptureDevice.authorizationStatus(for: .audio)
    let available = SFSpeechRecognizer()?.isAvailable ?? false
    emit([
        "type": "probe",
        "speech": speechStatusName(speech),
        "mic": micStatusName(mic),
        "available": available,
    ])
    exit(0)
}

// MARK: - Permissions + lifecycle

let recognizer = Recognizer()

// Request microphone access, then speech access, then start. Both TCC prompts
// must be granted; we report a clear, specific message for whichever is missing.
func beginAfterAuthorization() {
    AVCaptureDevice.requestAccess(for: .audio) { micGranted in
        DispatchQueue.main.async {
            guard micGranted else {
                fail("Microphone permission was denied. Enable it in System Settings › Privacy & Security › Microphone, then try again.")
            }
            SFSpeechRecognizer.requestAuthorization { status in
                DispatchQueue.main.async {
                    switch status {
                    case .authorized:
                        recognizer.start()
                    case .denied:
                        fail("Speech Recognition permission was denied. Enable it in System Settings › Privacy & Security › Speech Recognition, then try again.")
                    case .restricted:
                        fail("Speech Recognition is restricted on this device.")
                    case .notDetermined:
                        fail("Speech Recognition permission was not granted.")
                    @unknown default:
                        fail("Speech Recognition permission is unavailable.")
                    }
                }
            }
        }
    }
}

// Stop on SIGTERM (parent asked us to wrap up).
let sigterm = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
sigterm.setEventHandler { recognizer.stop() }
sigterm.resume()
signal(SIGTERM, SIG_IGN)

// Stop when the parent creates the stop file. LaunchServices-launched apps have
// no stdin pipe, so a sentinel file is the control channel. Poll on the main
// queue every 100ms.
if let stopPath = stopPath {
    let timer = DispatchSource.makeTimerSource(queue: .main)
    timer.schedule(deadline: .now() + .milliseconds(100), repeating: .milliseconds(100))
    timer.setEventHandler {
        if FileManager.default.fileExists(atPath: stopPath) {
            timer.cancel()
            recognizer.stop()
        }
    }
    timer.resume()
}

beginAfterAuthorization()
RunLoop.main.run()
