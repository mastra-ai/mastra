import { Route, Routes } from "react-router-dom";
import { Landing } from "@/pages/landing";
import { Admin } from "@/pages/admin";

function App() {
  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/:caseId" element={<Admin />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
