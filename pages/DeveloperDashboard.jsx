import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout.jsx';
import { Card, Badge, Button, Input, Select } from '../components/UI.jsx';
import { ApiService } from '../services/api.js';
import { DEPARTMENTS, DIVISIONS } from '../constants.js';
import { 
  Server, Activity, Users, BarChart, Lock, UserPlus, Trash2, Database, TrendingUp
} from 'lucide-react';

export const DeveloperDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('METRICS');

  return (
    <Layout user={user} onLogout={onLogout} title="System Developer Console">
       <div className="dev-nav">
          <button onClick={() => setActiveTab('METRICS')} className={`dev-nav-item ${activeTab === 'METRICS' ? 'active' : ''}`}>
             <BarChart size={18} className="inline mr-2 mb-1" /> Metrics & Traffic
          </button>
          <button onClick={() => setActiveTab('USERS')} className={`dev-nav-item ${activeTab === 'USERS' ? 'active' : ''}`}>
             <Users size={18} className="inline mr-2 mb-1" /> User Management
          </button>
          <button onClick={() => setActiveTab('ONLINE')} className={`dev-nav-item ${activeTab === 'ONLINE' ? 'active' : ''}`}>
             <Activity size={18} className="inline mr-2 mb-1" /> Real-time Activity
          </button>
          <button onClick={() => setActiveTab('STORAGE')} className={`dev-nav-item ${activeTab === 'STORAGE' ? 'active' : ''}`}>
             <Database size={18} className="inline mr-2 mb-1" /> Storage Usage
          </button>
          <button onClick={() => setActiveTab('TOP_USERS')} className={`dev-nav-item ${activeTab === 'TOP_USERS' ? 'active' : ''}`}>
             <TrendingUp size={18} className="inline mr-2 mb-1" /> Top Users
          </button>
       </div>

       <div className="animate-fadeIn">
         {activeTab === 'METRICS' && <SystemMetrics />}
         {activeTab === 'USERS' && <DeveloperUserControl />}
         {activeTab === 'ONLINE' && <OnlineUsersMonitor />}
         {activeTab === 'STORAGE' && <StorageAnalysis />}
         {activeTab === 'TOP_USERS' && <TopUsersAnalytics />}
       </div>
    </Layout>
  );
};

const StorageAnalysis = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    ApiService.getStorageStats().then(setStats);
  }, []);

  if (!stats) return <div>Loading storage stats...</div>;

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getPercentage = (part) => ((part / stats.total) * 100).toFixed(1) + '%';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
       <Card title="Total Storage Consumption">
          <div className="flex items-center justify-center py-10">
             <div className="text-center">
                <div className="text-5xl font-bold text-indigo-600 mb-2">{formatBytes(stats.total)}</div>
                <div className="text-gray-500">Total Database Size (Approx)</div>
             </div>
          </div>
       </Card>

       <Card title="Storage Breakdown">
          <div className="space-y-4">
             {[
               { label: 'Chat History', value: stats.chats, color: 'bg-blue-500' },
               { label: 'User Data', value: stats.users, color: 'bg-green-500' },
               { label: 'Submissions & Files', value: stats.submissions, color: 'bg-yellow-500' },
               { label: 'Tests & Results', value: stats.testData, color: 'bg-red-500' },
             ].map((item, i) => (
               <div key={i}>
                  <div className="flex justify-between text-sm font-medium mb-1">
                     <span>{item.label}</span>
                     <span>{formatBytes(item.value)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                     <div className={`h-2.5 rounded-full ${item.color}`} style={{ width: getPercentage(item.value) }}></div>
                  </div>
               </div>
             ))}
          </div>
       </Card>
    </div>
  );
};

const TopUsersAnalytics = () => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    ApiService.getUserMetrics().then(setUsers);
  }, []);

  return (
    <Card title="Top Users (Highest API Usage)">
       <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
             <thead className="bg-gray-50 uppercase dark:text-black">
                <tr>
                   <th className="px-6 py-3">Rank</th>
                   <th className="px-6 py-3">User</th>
                   <th className="px-6 py-3">Role</th>
                   <th className="px-6 py-3">Requests (Month)</th>
                </tr>
             </thead>
             <tbody className="divide-y">
                {users.map((u, i) => (
                   <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-white dark:hover:text-black">
                      <td className="px-6 py-4 font-bold text-gray-500">#{i + 1}</td>
                      <td className="px-6 py-4">
                         <div className="font-bold">{u.fullName}</div>
                         <div className="text-xs text-gray-500">{u.username}</div>
                      </td>
                      <td className="px-6 py-4"><Badge>{u.role}</Badge></td>
                      <td className="px-6 py-4 font-mono font-bold text-indigo-600">{u.count}</td>
                   </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={4} className="text-center py-4">No data available.</td></tr>}
             </tbody>
          </table>
       </div>
    </Card>
  );
};

const SystemMetrics = () => {
  const [metrics, setMetrics] = useState({ totalMonth: 0, routes: [] });

  useEffect(() => {
    ApiService.getMetrics().then(setMetrics);
  }, []);

  const sortedRoutes = [...(metrics.routes || [])].sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0));

  return (
    <div className="space-y-6">
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="metric-box">
             <div className="metric-value">{metrics.totalMonth}</div>
             <div className="metric-label">API Requests (Month)</div>
          </div>
          <div className="metric-box">
             <div className="metric-value text-green-600">99.9%</div>
             <div className="metric-label">Uptime</div>
          </div>
          <div className="metric-box">
             <div className="metric-value text-blue-600">30ms</div>
             <div className="metric-label">Avg Latency</div>
          </div>
       </div>

       <Card title="Traffic by Route (Top Endpoints)">
          <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
               <thead className="bg-gray-50 text-gray-700 uppercase dark:text-black">
                 <tr>
                    <th className="px-6 py-3">Route</th>
                    <th className="px-6 py-3">Method</th>
                    <th className="px-6 py-3">Hits</th>
                 </tr>
               </thead>
               <tbody className="divide-y">
                 {sortedRoutes.map((m, i) => (
                   <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white dark:hover:text-black">
                      <td className="px-6 py-4 font-mono text-xs">{m.route}</td>
                      <td className="px-6 py-4"><Badge color={m.method === 'GET' ? 'blue' : 'green'}>{m.method}</Badge></td>
                      <td className="px-6 py-4 font-bold">{m.count}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
       </Card>
    </div>
  );
};

const DeveloperUserControl = () => {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({
    username: '', password: '123', fullName: '', role: 'STUDENT', department: DEPARTMENTS[0], division: DIVISIONS[0], prn: ''
  });
  const [filterRole, setFilterRole] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterDiv, setFilterDiv] = useState('');

  const refreshUsers = () => ApiService.getUsers().then(setUsers);

  useEffect(() => { refreshUsers(); }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    const user = {
      id: `u${Date.now()}`,
      ...newUser,
      prn: newUser.role === 'STUDENT' ? newUser.prn : undefined,
      division: newUser.role === 'STUDENT' ? newUser.division : undefined
    };
    await ApiService.register(user);
    refreshUsers();
    alert("User Created");
    setNewUser({ username: '', password: '123', fullName: '', role: 'STUDENT', department: DEPARTMENTS[0], division: DIVISIONS[0], prn: '' });
  };

  const handleDelete = async (id) => {
    if(!window.confirm("PERMANENTLY DELETE USER?")) return;
    await ApiService.deleteUser(id);
    refreshUsers();
  };

  const filteredUsers = users.filter(u => {
    if (filterRole && u.role !== filterRole) return false;
    if (filterDept && u.department !== filterDept) return false;
    if (filterRole === 'STUDENT' && filterDiv && u.division !== filterDiv) return false;
    return true;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
       <div className="lg:col-span-1">
          <Card title="Quick Register User">
             <form onSubmit={handleRegister} className="space-y-3">
               <Input label="Username" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} required />
               <Input label="Full Name" value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} required />
               <Select label="Role" options={['ADMIN','TEACHER','STUDENT'].map(r=>({value:r, label:r}))} value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} />
               <Select label="Department" options={DEPARTMENTS.map(d => ({value:d, label:d}))} value={newUser.department} onChange={e => setNewUser({...newUser, department: e.target.value})} />
               {newUser.role === 'STUDENT' && (
                 <>
                   <Select label="Division" options={DIVISIONS.map(d => ({value:d, label:d}))} value={newUser.division} onChange={e => setNewUser({...newUser, division: e.target.value})} />
                   <Input label="PRN" value={newUser.prn} onChange={e => setNewUser({...newUser, prn: e.target.value})} required />
                 </>
               )}
               <Button type="submit" className="w-full">Create User</Button>
             </form>
          </Card>
       </div>

       <div className="lg:col-span-2">
          <Card title={`All System Users (${filteredUsers.length})`}>
             <div className="flex gap-2 mb-4">
                <Select className="mb-0" label="Role" options={['ADMIN','TEACHER','STUDENT', 'DEVELOPER'].map(r=>({value:r, label:r}))} value={filterRole} onChange={e => setFilterRole(e.target.value)} />
                <Select className="mb-0" label="Dept" options={DEPARTMENTS.map(d=>({value:d, label:d}))} value={filterDept} onChange={e => setFilterDept(e.target.value)} />
                <Select className="mb-0" label="Div" options={DIVISIONS.map(d=>({value:d, label:d}))} value={filterDiv} onChange={e => setFilterDiv(e.target.value)} />
             </div>
             <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-sm text-left">
                   <thead className="bg-gray-50 uppercase sticky top-0 dark:text-black">
                      <tr>
                         <th className="px-4 py-2">Name</th>
                         <th className="px-4 py-2">Role</th>
                         <th className="px-4 py-2">Dept</th>
                         <th className="px-4 py-2">Div</th>
                         <th className="px-4 py-2">Action</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y">
                      {filteredUsers.map(u => (
                         <tr key={u.id}>
                            <td className="px-4 py-2">
                               <div className="font-bold">{u.fullName}</div>
                               <div className="text-xs text-gray-500">{u.username}</div>
                            </td>
                            <td className="px-4 py-2"><Badge>{u.role}</Badge></td>
                            <td className="px-4 py-2">{u.department}</td>
                            <td className="px-4 py-2">{u.division || '-'}</td>
                            <td className="px-4 py-2">
                               <button onClick={() => handleDelete(u.id)} className="text-red-600 hover:bg-red-50 p-2 rounded"><Trash2 size={16}/></button>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </Card>
       </div>
    </div>
  );
};

const OnlineUsersMonitor = () => {
  const [online, setOnline] = useState([]);

  useEffect(() => {
    const poll = () => ApiService.getOnlineUsers().then(setOnline);
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card title="Real-Time Active Users">
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {online.map(u => (
             <div key={u._id} className="p-4 border rounded-lg bg-white shadow-sm flex items-center justify-between">
                <div>
                   <div className="font-bold dark:text-black">{u.fullName}</div>
                   <div className="text-xs text-gray-500">{u.username} | {u.role}</div>
                </div>
                <div className="status-badge status-online">
                   <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                   Online
                </div>
             </div>
          ))}
          {online.length === 0 && <div className="col-span-3 text-center text-gray-400 py-10">No active users currently.</div>}
       </div>
    </Card>
  );
};
