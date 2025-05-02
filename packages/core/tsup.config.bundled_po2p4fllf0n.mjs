// tsup.config.ts
import babel from "@babel/core";
import { defineConfig } from "tsup";

// tools/treeshake-decorators.js
function treeshake_decorators_default(babel2) {
  const { types: t } = babel2;
  const collected = /* @__PURE__ */ new Map();
  return {
    name: "add-pure-to-decorators",
    visitor: {
      Program: {
        exit(path) {
          const body = path.node.body;
          for (const [key, nodes] of collected.entries()) {
            const lastIndex = body.findIndex((n) => n === nodes[nodes.length - 1]);
            if (lastIndex === -1) {
              continue;
            }
            const arrowFn = t.parenthesizedExpression(
              t.arrowFunctionExpression(
                [t.identifier("_")],
                t.blockStatement([...nodes.map((node) => t.cloneNode(node)), t.returnStatement(t.identifier(key))])
              )
            );
            arrowFn.leadingComments = [
              {
                type: "CommentBlock",
                value: "@__PURE__"
              }
            ];
            body.splice(
              lastIndex + 1,
              0,
              t.assignmentExpression("=", t.identifier(key), t.callExpression(arrowFn, [t.identifier(key)]))
            );
            body.splice(lastIndex - 2, 3);
          }
        }
      },
      ExpressionStatement(path) {
        const expression = path.node.expression;
        if (!t.isAssignmentExpression(expression) || !t.isCallExpression(expression.right) || !t.isIdentifier(expression.right.callee) || expression.right.callee.name !== "__decorateElement") {
          return;
        }
        const nodeIndex = path.container.findIndex((c) => c === path.node);
        const decoratorFns = [];
        for (let i = -1; i < 2; i++) {
          decoratorFns.push(path.container[nodeIndex + i]);
        }
        collected.set(expression.left.name, decoratorFns);
      }
    }
  };
}

// tsup.config.ts
var treeshakeDecorators = {
  name: "treeshake-decorators",
  renderChunk(code, info) {
    if (!code.includes("__decoratorStart")) {
      return null;
    }
    return new Promise((resolve, reject) => {
      babel.transform(
        code,
        {
          babelrc: false,
          configFile: false,
          filename: info.path,
          plugins: [treeshake_decorators_default]
        },
        (err, result) => {
          if (err) {
            return reject(err);
          }
          resolve({
            code: result.code,
            map: result.map
          });
        }
      );
    });
  }
};
var tsup_config_default = defineConfig({
  entry: [
    "src/index.ts",
    "src/base.ts",
    "src/utils.ts",
    "!src/action/index.ts",
    "src/*/index.ts",
    "src/workflows/vNext/index.ts",
    "src/storage/libsql/index.ts",
    "src/vector/libsql/index.ts",
    "src/vector/filter/index.ts",
    "src/telemetry/otel-vendor.ts"
  ],
  format: ["esm", "cjs"],
  clean: true,
  dts: true,
  splitting: true,
  treeshake: {
    preset: "smallest"
  },
  plugins: [treeshakeDecorators]
});
export {
  tsup_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidHN1cC5jb25maWcudHMiLCAidG9vbHMvdHJlZXNoYWtlLWRlY29yYXRvcnMuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL2RhbmllbGxldy9Eb2N1bWVudHMvTWFzdHJhL21hc3RyYS9wYWNrYWdlcy9jb3JlL3RzdXAuY29uZmlnLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy9kYW5pZWxsZXcvRG9jdW1lbnRzL01hc3RyYS9tYXN0cmEvcGFja2FnZXMvY29yZVwiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvZGFuaWVsbGV3L0RvY3VtZW50cy9NYXN0cmEvbWFzdHJhL3BhY2thZ2VzL2NvcmUvdHN1cC5jb25maWcudHNcIjtpbXBvcnQgYmFiZWwgZnJvbSAnQGJhYmVsL2NvcmUnO1xuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndHN1cCc7XG5pbXBvcnQgdHlwZSB7IE9wdGlvbnMgfSBmcm9tICd0c3VwJztcblxuaW1wb3J0IHRyZWVzaGFrZURlY29yYXRvcnNCYWJlbFBsdWdpbiBmcm9tICcuL3Rvb2xzL3RyZWVzaGFrZS1kZWNvcmF0b3JzJztcblxudHlwZSBQbHVnaW4gPSBOb25OdWxsYWJsZTxPcHRpb25zWydwbHVnaW5zJ10+W251bWJlcl07XG5cbmxldCB0cmVlc2hha2VEZWNvcmF0b3JzID0ge1xuICBuYW1lOiAndHJlZXNoYWtlLWRlY29yYXRvcnMnLFxuICByZW5kZXJDaHVuayhjb2RlLCBpbmZvKSB7XG4gICAgaWYgKCFjb2RlLmluY2x1ZGVzKCdfX2RlY29yYXRvclN0YXJ0JykpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBiYWJlbC50cmFuc2Zvcm0oXG4gICAgICAgIGNvZGUsXG4gICAgICAgIHtcbiAgICAgICAgICBiYWJlbHJjOiBmYWxzZSxcbiAgICAgICAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICAgICAgICBmaWxlbmFtZTogaW5mby5wYXRoLFxuICAgICAgICAgIHBsdWdpbnM6IFt0cmVlc2hha2VEZWNvcmF0b3JzQmFiZWxQbHVnaW5dLFxuICAgICAgICB9LFxuICAgICAgICAoZXJyLCByZXN1bHQpID0+IHtcbiAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmVzb2x2ZSh7XG4gICAgICAgICAgICBjb2RlOiByZXN1bHQhLmNvZGUhLFxuICAgICAgICAgICAgbWFwOiByZXN1bHQhLm1hcCEsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICApO1xuICAgIH0pO1xuICB9LFxufSBzYXRpc2ZpZXMgUGx1Z2luO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBlbnRyeTogW1xuICAgICdzcmMvaW5kZXgudHMnLFxuICAgICdzcmMvYmFzZS50cycsXG4gICAgJ3NyYy91dGlscy50cycsXG4gICAgJyFzcmMvYWN0aW9uL2luZGV4LnRzJyxcbiAgICAnc3JjLyovaW5kZXgudHMnLFxuICAgICdzcmMvd29ya2Zsb3dzL3ZOZXh0L2luZGV4LnRzJyxcbiAgICAnc3JjL3N0b3JhZ2UvbGlic3FsL2luZGV4LnRzJyxcbiAgICAnc3JjL3ZlY3Rvci9saWJzcWwvaW5kZXgudHMnLFxuICAgICdzcmMvdmVjdG9yL2ZpbHRlci9pbmRleC50cycsXG4gICAgJ3NyYy90ZWxlbWV0cnkvb3RlbC12ZW5kb3IudHMnLFxuICBdLFxuICBmb3JtYXQ6IFsnZXNtJywgJ2NqcyddLFxuICBjbGVhbjogdHJ1ZSxcbiAgZHRzOiB0cnVlLFxuICBzcGxpdHRpbmc6IHRydWUsXG4gIHRyZWVzaGFrZToge1xuICAgIHByZXNldDogJ3NtYWxsZXN0JyxcbiAgfSxcbiAgcGx1Z2luczogW3RyZWVzaGFrZURlY29yYXRvcnNdLFxufSk7XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvZGFuaWVsbGV3L0RvY3VtZW50cy9NYXN0cmEvbWFzdHJhL3BhY2thZ2VzL2NvcmUvdG9vbHMvdHJlZXNoYWtlLWRlY29yYXRvcnMuanNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL2RhbmllbGxldy9Eb2N1bWVudHMvTWFzdHJhL21hc3RyYS9wYWNrYWdlcy9jb3JlL3Rvb2xzXCI7Y29uc3QgX19pbmplY3RlZF9pbXBvcnRfbWV0YV91cmxfXyA9IFwiZmlsZTovLy9Vc2Vycy9kYW5pZWxsZXcvRG9jdW1lbnRzL01hc3RyYS9tYXN0cmEvcGFja2FnZXMvY29yZS90b29scy90cmVlc2hha2UtZGVjb3JhdG9ycy5qc1wiO2V4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChiYWJlbCkge1xuICBjb25zdCB7IHR5cGVzOiB0IH0gPSBiYWJlbDtcblxuICBjb25zdCBjb2xsZWN0ZWQgPSBuZXcgTWFwKCk7XG5cbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnYWRkLXB1cmUtdG8tZGVjb3JhdG9ycycsXG4gICAgdmlzaXRvcjoge1xuICAgICAgUHJvZ3JhbToge1xuICAgICAgICBleGl0KHBhdGgpIHtcbiAgICAgICAgICBjb25zdCBib2R5ID0gcGF0aC5ub2RlLmJvZHk7XG4gICAgICAgICAgZm9yIChjb25zdCBba2V5LCBub2Rlc10gb2YgY29sbGVjdGVkLmVudHJpZXMoKSkge1xuICAgICAgICAgICAgY29uc3QgbGFzdEluZGV4ID0gYm9keS5maW5kSW5kZXgobiA9PiBuID09PSBub2Rlc1tub2Rlcy5sZW5ndGggLSAxXSk7XG5cbiAgICAgICAgICAgIGlmIChsYXN0SW5kZXggPT09IC0xKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDcmVhdGUgdGhlIGFycm93IGZ1bmN0aW9uIGZpcnN0XG4gICAgICAgICAgICBjb25zdCBhcnJvd0ZuID0gdC5wYXJlbnRoZXNpemVkRXhwcmVzc2lvbihcbiAgICAgICAgICAgICAgdC5hcnJvd0Z1bmN0aW9uRXhwcmVzc2lvbihcbiAgICAgICAgICAgICAgICBbdC5pZGVudGlmaWVyKCdfJyldLFxuICAgICAgICAgICAgICAgIHQuYmxvY2tTdGF0ZW1lbnQoWy4uLm5vZGVzLm1hcChub2RlID0+IHQuY2xvbmVOb2RlKG5vZGUpKSwgdC5yZXR1cm5TdGF0ZW1lbnQodC5pZGVudGlmaWVyKGtleSkpXSksXG4gICAgICAgICAgICAgICksXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAvLyBBZGQgdGhlIGNvbW1lbnQgYXMgYSBDb21tZW50QmxvY2tcbiAgICAgICAgICAgIGFycm93Rm4ubGVhZGluZ0NvbW1lbnRzID0gW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ0NvbW1lbnRCbG9jaycsXG4gICAgICAgICAgICAgICAgdmFsdWU6ICdAX19QVVJFX18nLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXTtcblxuICAgICAgICAgICAgYm9keS5zcGxpY2UoXG4gICAgICAgICAgICAgIGxhc3RJbmRleCArIDEsXG4gICAgICAgICAgICAgIDAsXG4gICAgICAgICAgICAgIHQuYXNzaWdubWVudEV4cHJlc3Npb24oJz0nLCB0LmlkZW50aWZpZXIoa2V5KSwgdC5jYWxsRXhwcmVzc2lvbihhcnJvd0ZuLCBbdC5pZGVudGlmaWVyKGtleSldKSksXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBib2R5LnNwbGljZShsYXN0SW5kZXggLSAyLCAzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICB9LFxuXG4gICAgICBFeHByZXNzaW9uU3RhdGVtZW50KHBhdGgpIHtcbiAgICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IHBhdGgubm9kZS5leHByZXNzaW9uO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgIXQuaXNBc3NpZ25tZW50RXhwcmVzc2lvbihleHByZXNzaW9uKSB8fFxuICAgICAgICAgICF0LmlzQ2FsbEV4cHJlc3Npb24oZXhwcmVzc2lvbi5yaWdodCkgfHxcbiAgICAgICAgICAhdC5pc0lkZW50aWZpZXIoZXhwcmVzc2lvbi5yaWdodC5jYWxsZWUpIHx8XG4gICAgICAgICAgZXhwcmVzc2lvbi5yaWdodC5jYWxsZWUubmFtZSAhPT0gJ19fZGVjb3JhdGVFbGVtZW50J1xuICAgICAgICApIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBub2RlSW5kZXggPSBwYXRoLmNvbnRhaW5lci5maW5kSW5kZXgoYyA9PiBjID09PSBwYXRoLm5vZGUpO1xuICAgICAgICBjb25zdCBkZWNvcmF0b3JGbnMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IC0xOyBpIDwgMjsgaSsrKSB7XG4gICAgICAgICAgZGVjb3JhdG9yRm5zLnB1c2gocGF0aC5jb250YWluZXJbbm9kZUluZGV4ICsgaV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29sbGVjdGVkLnNldChleHByZXNzaW9uLmxlZnQubmFtZSwgZGVjb3JhdG9yRm5zKTtcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBZ1QsT0FBTyxXQUFXO0FBQ2xVLFNBQVMsb0JBQW9COzs7QUNEc1UsU0FBUiw2QkFBa0JBLFFBQU87QUFDbFgsUUFBTSxFQUFFLE9BQU8sRUFBRSxJQUFJQTtBQUVyQixRQUFNLFlBQVksb0JBQUksSUFBSTtBQUUxQixTQUFPO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixTQUFTO0FBQUEsTUFDUCxTQUFTO0FBQUEsUUFDUCxLQUFLLE1BQU07QUFDVCxnQkFBTSxPQUFPLEtBQUssS0FBSztBQUN2QixxQkFBVyxDQUFDLEtBQUssS0FBSyxLQUFLLFVBQVUsUUFBUSxHQUFHO0FBQzlDLGtCQUFNLFlBQVksS0FBSyxV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
