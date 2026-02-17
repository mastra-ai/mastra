import chalk from "chalk"

const GRADIENT_WIDTH = 30
const BASE_COLOR: [number, number, number] = [124, 58, 237]
const MIN_BRIGHTNESS = 0.45
const IDLE_BRIGHTNESS = 0.8

function hexToRgb(hex: string): [number, number, number] {
    const h = hex.replace("#", "")
    return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
    ]
}

export function applyGradientSweep(
    text: string,
    offset: number,
    color?: string,
    fadeProgress = 0,
): string {
    const chars = [...text]
    const totalChars = chars.length
    if (totalChars === 0) return text
    const baseColor = color ? hexToRgb(color) : BASE_COLOR
    const gradientCenter = (offset % 1) * 100

    return chars
        .map((char, i) => {
            if (char === " ") return " "
            const charPosition = (i / totalChars) * 100
            let distance = Math.abs(charPosition - gradientCenter)
            if (distance > 50) distance = 100 - distance
            const normalizedDistance = Math.min(distance / (GRADIENT_WIDTH / 2), 1)
            const animBrightness =
                MIN_BRIGHTNESS + (1 - MIN_BRIGHTNESS) * (1 - normalizedDistance)
            const brightness =
                animBrightness + (IDLE_BRIGHTNESS - animBrightness) * fadeProgress

            const r = Math.floor(baseColor[0] * brightness)
            const g = Math.floor(baseColor[1] * brightness)
            const b = Math.floor(baseColor[2] * brightness)
            return chalk.rgb(r, g, b)(char)
        })
        .join("")
}

export class GradientAnimator {
    private offset = 0
    private intervalId: ReturnType<typeof setInterval> | null = null
    private onTick: () => void
    private isFadingOutState = false
    private isFadingInState = false
    private fadeProgress = 0

    constructor(onTick: () => void) {
        this.onTick = onTick
    }

    start(): void {
        if (this.intervalId && !this.isFadingOutState) return
        if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = null
        }
        this.isFadingOutState = false
        this.isFadingInState = true
        this.fadeProgress = 1
        this.offset = 0
        this.intervalId = setInterval(() => {
            this.offset += 0.03
            if (this.isFadingInState) {
                this.fadeProgress -= 0.06
                if (this.fadeProgress <= 0) {
                    this.fadeProgress = 0
                    this.isFadingInState = false
                }
            }
            this.onTick()
        }, 80)
    }

    fadeOut(): void {
        if (!this.intervalId || this.isFadingOutState) return
        this.isFadingOutState = true
        this.fadeProgress = 0
        clearInterval(this.intervalId)
        this.intervalId = setInterval(() => {
            this.fadeProgress += 0.08
            if (this.fadeProgress >= 1) {
                this.fadeProgress = 1
                this.stop()
            }
            this.onTick()
        }, 40)
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = null
        }
        this.isFadingOutState = false
        this.fadeProgress = 0
        this.offset = 0
    }

    getOffset(): number {
        return this.offset
    }

    getFadeProgress(): number {
        return this.fadeProgress
    }

    isRunning(): boolean {
        return this.intervalId !== null
    }
}

