import { Routes, Route, Navigate } from 'react-router-dom';
import { RoleProvider } from './roleContext';
import HomePage from './pages/HomePage';

export default function App() {
  return (
    <RoleProvider>
      <Routes>
        <Route path="/*" element={<HomePage />} />
        {/* <Route path="*" element={<Navigate to="/" replace />} /> */}
      </Routes>
    </RoleProvider>
  );
}
