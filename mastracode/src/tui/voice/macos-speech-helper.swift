import Foundation
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
