import { Routes, Route, Navigate } from 'react-router-dom';
import { EventConfigProvider } from './lib/eventConfig';
import Home from './pages/Home';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <EventConfigProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/inscription" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </EventConfigProvider>
  );
}
