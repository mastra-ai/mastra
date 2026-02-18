/**
 * General settings component.
 * Uses pi-tui's SettingsList for a clean overlay with
 * notifications, YOLO mode, and thinking level configuration.
 *
 * Changes apply immediately — Esc closes the panel.
 */

import {
	Box,
	type Focusable,
	SelectList,
	type SelectItem,
	type SettingItem,
	SettingsList,
	Spacer,
	Text,
	type TUI,
} from "@mariozechner/pi-tui"
import {
	fg,
	bg,
	bold,
	getSettingsListTheme,
	getSelectListTheme,
} from "../theme.js"
import type { NotificationMode } from "../notify.js"

// =============================================================================
// Types
// =============================================================================
export interface SettingsConfig {
	notifications: NotificationMode
	yolo: boolean
	thinkingLevel: string
	escapeAsCancel: boolean
}

export interface SettingsCallbacks {
	onNotificationsChange: (mode: NotificationMode) => void
	onYoloChange: (enabled: boolean) => void
	onThinkingLevelChange: (level: string) => void
	onEscapeAsCancelChange: (enabled: boolean) => void
	onClose: () => void
}

// =============================================================================
// Select Submenu (reusable for any enum-style setting)
// =============================================================================

class SelectSubmenu extends SelectList {
	constructor(
		items: SelectItem[],
		currentValue: string,
		onSelect: (value: string) => void,
		onBack: () => void,
	) {
		super(items, Math.min(items.length, 8), getSelectListTheme())

		const currentIndex = items.findIndex((i) => i.value === currentValue)
		if (currentIndex !== -1) {
			this.setSelectedIndex(currentIndex)
		}

		this.onSelect = (item: SelectItem) => {
			onSelect(item.value)
		}
		this.onCancel = onBack
	}
}

// =============================================================================
// Settings Component
// =============================================================================

export class SettingsComponent extends Box implements Focusable {
	private settingsList: SettingsList
	private _focused = false

	get focused(): boolean {
		return this._focused
	}
	set focused(value: boolean) {
		this._focused = value
	}

	constructor(config: SettingsConfig, callbacks: SettingsCallbacks) {
		super(2, 1, (text: string) => bg("overlayBg", text))

		// Title
		this.addChild(new Text(bold(fg("accent", "Settings")), 0, 0))
		this.addChild(new Spacer(1))

		// Build settings items
		const notificationModes: {
			value: NotificationMode
			label: string
			desc: string
		}[] = [
			{ value: "off", label: "Off", desc: "No notifications" },
			{ value: "bell", label: "Bell", desc: "Terminal bell (\\x07)" },
			{ value: "system", label: "System", desc: "Native OS notification" },
			{ value: "both", label: "Both", desc: "Bell + system notification" },
		]

		const thinkingLevels: { value: string; label: string; desc: string }[] = [
			{ value: "off", label: "Off", desc: "No extended thinking" },
			{ value: "minimal", label: "Minimal", desc: "~1k budget tokens" },
			{ value: "low", label: "Low", desc: "~4k budget tokens" },
			{ value: "medium", label: "Medium", desc: "~10k budget tokens" },
			{ value: "high", label: "High", desc: "~32k budget tokens" },
		]

		const getNotifLabel = (mode: NotificationMode) =>
			notificationModes.find((m) => m.value === mode)?.label ?? mode

		const getThinkingLabel = (level: string) =>
			thinkingLevels.find((l) => l.value === level)?.label ?? level

		const items: SettingItem[] = [
			{
				id: "notifications",
				label: "Notifications",
				description: "How to alert when the agent needs attention",
				currentValue: getNotifLabel(config.notifications),
				submenu: (_currentValue, done) =>
					new SelectSubmenu(
						notificationModes.map((m) => ({
							value: m.value,
							label: `  ${m.label}`,
							description: m.desc,
						})),
						config.notifications,
						(value) => {
							config.notifications = value as NotificationMode
							callbacks.onNotificationsChange(config.notifications)
							done(getNotifLabel(config.notifications))
						},
						() => done(),
					),
			},
			{
				id: "yolo",
				label: "YOLO mode",
				description: "Auto-approve all tool calls without confirmation",
				currentValue: config.yolo ? "On" : "Off",
				submenu: (_currentValue, done) =>
					new SelectSubmenu(
						[
							{
								value: "on",
								label: "  On",
								description: "Auto-approve all tools",
							},
							{
								value: "off",
								label: "  Off",
								description: "Require approval for tools",
							},
						],
						config.yolo ? "on" : "off",
						(value) => {
							config.yolo = value === "on"
							callbacks.onYoloChange(config.yolo)
							done(config.yolo ? "On" : "Off")
						},
						() => done(),
					),
			},
			{
				id: "thinking",
				label: "Thinking level",
				description:
					"Extended thinking budget for Anthropic models (currently disabled)",
				currentValue: getThinkingLabel(config.thinkingLevel),
				submenu: (_currentValue, done) =>
					new SelectSubmenu(
						thinkingLevels.map((l) => ({
							value: l.value,
							label: `  ${l.label}`,
							description: l.desc,
						})),
						config.thinkingLevel,
						(value) => {
							config.thinkingLevel = value
							callbacks.onThinkingLevelChange(value)
							done(getThinkingLabel(value))
						},
						() => done(),
					),
			},
			{
				id: "escapeAsCancel",
				label: "Escape cancels",
				description:
					"Use Escape to cancel/clear (Ctrl+C always works). Ctrl+Z undoes a clear.",
				currentValue: config.escapeAsCancel ? "On" : "Off",
				submenu: (_currentValue, done) =>
					new SelectSubmenu(
						[
							{
								value: "on",
								label: "  On",
								description: "Escape clears input / aborts",
							},
							{
								value: "off",
								label: "  Off",
								description: "Only Ctrl+C clears / aborts",
							},
						],
						config.escapeAsCancel ? "on" : "off",
						(value) => {
							config.escapeAsCancel = value === "on"
							callbacks.onEscapeAsCancelChange(config.escapeAsCancel)
							done(config.escapeAsCancel ? "On" : "Off")
						},
						() => done(),
					),
			},
		]

		this.settingsList = new SettingsList(
			items,
			10,
			getSettingsListTheme(),
			(_id, _newValue) => {
				// All changes handled via submenu callbacks
			},
			callbacks.onClose,
		)

		this.addChild(this.settingsList)
	}

	handleInput(data: string): void {
		this.settingsList.handleInput(data)
	}
}
