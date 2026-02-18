import React, { Suspense, lazy, useEffect, useState } from 'react';
import { ApiService } from './services/api.js';

const AuthPage = lazy(() => import('./pages/AuthPage.jsx').then((m) => ({ default: m.AuthPage })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx').then((m) => ({ default: m.AdminDashboard })));
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard.jsx').then((m) => ({ default: m.TeacherDashboard })));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard.jsx').then((m) => ({ default: m.StudentDashboard })));
const DeveloperDashboard = lazy(() => import('./pages/DeveloperDashboard.jsx').then((m) => ({ default: m.DeveloperDashboard })));

export default function App() {
  const [user, setUser] = useState(null);

  // Load user from localStorage on app mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser && parsedUser.token) {
          setUser(parsedUser);
        } else {
          localStorage.removeItem('user');
        }
      } catch (err) {
        console.error('Failed to parse saved user:', err);
        localStorage.removeItem('user');
      }
    }
  }, []);
  
  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const handleUserUpdate = (updatedUser) => {
    const mergedUser = {
      ...(user || {}),
      ...updatedUser,
      token: updatedUser.token || user?.token || ''
    };
    setUser(mergedUser);
    localStorage.setItem('user', JSON.stringify(mergedUser));
  };

  useEffect(() => {
    if (!user?.role) return;
    ApiService.prefetchForRole(user.role).catch(() => {});
  }, [user?.id, user?.role]);

  if (!user) {
    return (
      <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading...</div>}>
        <AuthPage onLogin={handleLogin} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading dashboard...</div>}>
      {user.role === 'ADMIN' && <AdminDashboard user={user} onLogout={handleLogout} />}
      {user.role === 'TEACHER' && <TeacherDashboard user={user} onLogout={handleLogout} />}
      {user.role === 'STUDENT' && (
        <StudentDashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
      )}
      {user.role === 'DEVELOPER' && <DeveloperDashboard user={user} onLogout={handleLogout} />}
    </Suspense>
  );
}
