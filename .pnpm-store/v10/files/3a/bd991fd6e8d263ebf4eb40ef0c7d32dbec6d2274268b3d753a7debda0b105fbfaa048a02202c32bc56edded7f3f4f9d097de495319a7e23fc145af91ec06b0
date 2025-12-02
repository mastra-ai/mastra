/**
 * Tool type enum for enhanced tools
 */
export var ToolType;
(function (ToolType) {
    ToolType["Function"] = "function";
})(ToolType || (ToolType = {}));
/**
 * Type guard to check if a tool has an execute function
 */
export function hasExecuteFunction(tool) {
    return "execute" in tool.function && typeof tool.function.execute === "function";
}
/**
 * Type guard to check if a tool uses a generator (has eventSchema)
 */
export function isGeneratorTool(tool) {
    return "eventSchema" in tool.function;
}
/**
 * Type guard to check if a tool is a regular execution tool (not generator)
 */
export function isRegularExecuteTool(tool) {
    return hasExecuteFunction(tool) && !isGeneratorTool(tool);
}
/**
 * Type guard to check if an event is a tool preliminary result event
 */
export function isToolPreliminaryResultEvent(event) {
    return event.type === "tool.preliminary_result";
}
//# sourceMappingURL=tool-types.js.map