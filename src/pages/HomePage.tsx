import Layout from '../components/Layout';
import Auth from '../components/Auth';
import CustomerHome from '../components/CustomerHome';
import Queue from '../components/Queue';
import Profile from '../components/Profile';
import ShopPage from './ShopPage';
import { Routes, Route, Navigate } from 'react-router-dom';

export default function HomePage() {
    return (
        <Routes>
            <Route element={<Layout />}>
                {/* Landing shows Auth; after login you could navigate to /home */}
                <Route index element={<Auth />} />
                <Route path="home" element={<CustomerHome />} />
                <Route path="shop/:shopId" element={<ShopPage />} />
                <Route path="queue" element={<Queue />} />
                <Route path="profile" element={<Profile />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
}
