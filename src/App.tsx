import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './authContext';
import HomePage from './pages/HomePage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/*" element={<HomePage />} />
        {/* <Route path="*" element={<Navigate to="/" replace />} /> */}
      </Routes>
    </AuthProvider>
  );
}
