import { MultiStepProgressComponent, type MultiStepProgressItem } from "./multi-step-progress"

export interface TodoItem {
    id: string
    content: string
    status: "pending" | "in_progress" | "completed" | "cancelled"
}

export class TodoProgressComponent extends MultiStepProgressComponent {
    constructor() {
        super([])
    }

    updateTodos(todos: TodoItem[]): void {
        const items: MultiStepProgressItem[] = todos.map((todo) => ({
            id: todo.id,
            label: todo.content,
            status: todo.status,
        }))
        this.setItems(items)
    }
}

