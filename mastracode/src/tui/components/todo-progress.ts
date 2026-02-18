/**
 * Todo progress component for the TUI.
 * Shows a persistent, compact display of the current task list.
 * Hidden when no todos exist OR when all todos are completed.
 * Renders between status and editor.
 */
import { Container, Text, Spacer } from "@mariozechner/pi-tui"
import chalk from "chalk"
import { fg, bold, mastra } from "../theme.js"

export interface TodoItem {
	content: string
	status: "pending" | "in_progress" | "completed"
	activeForm: string
}

export class TodoProgressComponent extends Container {
	private todos: TodoItem[] = []

	constructor() {
		super()
	}

	/**
	 * Replace the entire todo list and re-render.
	 */
	updateTodos(todos: TodoItem[]): void {
		this.todos = todos
		this.rebuildDisplay()
	}

	/**
	 * Get the current todo list (read-only copy).
	 */
	getTodos(): TodoItem[] {
		return [...this.todos]
	}

	private rebuildDisplay(): void {
		this.clear()

		// No todos = no render (component takes zero vertical space)
		if (this.todos.length === 0) return

		// Progress header
		const completed = this.todos.filter((t) => t.status === "completed").length
		const total = this.todos.length

		// Hide the component when all todos are completed
		if (completed === total) return
		const headerText =
			"  " +
			bold(fg("accent", "Tasks")) +
			fg("dim", ` [${completed}/${total} completed]`)

		this.addChild(new Spacer(1))
		this.addChild(new Text(headerText, 0, 0))

		// Render each todo
		for (const todo of this.todos) {
			this.addChild(new Text(this.formatTodoLine(todo), 0, 0))
		}
	}

	private formatTodoLine(todo: TodoItem): string {
		const indent = "    "

		switch (todo.status) {
			case "completed": {
				const icon = chalk.green("\u2713")
				const text = chalk.green.strikethrough(todo.content)
				return `${indent}${icon} ${text}`
			}
			case "in_progress": {
				const icon = chalk.yellow("\u25B6")
				const text = chalk.yellow.bold(todo.activeForm)
				return `${indent}${icon} ${text}`
			}
			case "pending": {
				const icon = chalk.dim("\u25CB")
				const text = chalk.dim(todo.content)
				return `${indent}${icon} ${text}`
			}
		}
	}
}
