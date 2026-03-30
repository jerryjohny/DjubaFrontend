import Layout from '../components/Layout';
import Auth from '../components/Auth';
import CustomerHome from '../components/CustomerHome';
import Queue from '../components/Queue';
import Profile from '../components/Profile';
import ShopPage from './ShopPage';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../authContext';

export default function HomePage() {
    const { accessToken, loading } = useAuth();

    if (loading) return null;

    return (
        <Routes>
            <Route element={<Layout />}>
                {/* Landing shows Auth; after login you go to /home */}
                <Route index element={accessToken ? <Navigate to="/home" replace /> : <Auth />} />
                <Route path="home" element={accessToken ? <CustomerHome /> : <Navigate to="/" replace />} />
                <Route path="shop/:shopId" element={accessToken ? <ShopPage /> : <Navigate to="/" replace />} />
                <Route path="queue" element={accessToken ? <Queue /> : <Navigate to="/" replace />} />
                <Route path="profile" element={accessToken ? <Profile /> : <Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
}
