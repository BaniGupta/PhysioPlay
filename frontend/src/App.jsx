import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Login from "./screens/Login";
import PlanSetup from "./screens/PlanSetup";
import Home from "./screens/Home";
import Play from "./screens/Play";
import Progress from "./screens/Progress";

function Guard({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Landing() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to="/home" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/plans/new" element={<Guard><PlanSetup /></Guard>} />
      <Route path="/home" element={<Guard><Home /></Guard>} />
      <Route path="/play/:courseId/:exerciseId" element={<Guard><Play /></Guard>} />
      <Route path="/progress" element={<Guard><Progress /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
