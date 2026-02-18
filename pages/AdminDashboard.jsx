import React, { useState, useEffect, useRef } from 'react';
import { Layout } from '../components/Layout.jsx';
import { TimetableManager, TestManager } from './TeacherDashboard.jsx';
import { Button, Input, Select, Card, Badge } from '../components/UI.jsx';
import { ApiService } from '../services/api.js';
import { DEPARTMENTS, DIVISIONS, YEARS, getSemestersForYear } from '../constants.js';
import { 
  PlusCircle, Users, BookOpen, ClipboardList, 
  CheckCircle, FileText, UserCheck, Award, Trash2, Download, Link, Send, MessageCircle, Paperclip, CalendarDays
} from 'lucide-react';

const classroomChatCacheKey = (groupId) => `classroom_chat_cache_${groupId}`;
const classroomChatSyncKey = (groupId) => `classroom_chat_sync_${groupId}`;
const classroomSeenKey = (userId, groupId) => `admin_classroom_seen_${userId}_${groupId}`;
const mergeChatsById = (existing, incoming) => {
  const map = new Map(existing.map(c => [c.id, c]));
  incoming.forEach(c => map.set(c.id, c));
  return Array.from(map.values()).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};
const latestTimestamp = (items) => {
  if (!items || items.length === 0) return '';
  return items[items.length - 1].timestamp || '';
};
const SEMESTERS = ['1', '2', '3', '4', '5', '6', '7', '8'];
export const AdminDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('ADD_PROJECT');
  const [successMsg, setSuccessMsg] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [projects, setProjects] = useState([]);
  const [groups, setGroups] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  
  const loadData = async () => {
    try {
      const [p, g, users, a] = await Promise.all([
        ApiService.getProjects(),
        ApiService.getGroups(),
        ApiService.getUsers(),
        ApiService.getAssignments()
      ]);
      setProjects(p);
      setGroups(g);
      setTeachers(users.filter(u => u.role === 'TEACHER'));
      setAssignments(a);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
    loadData();
    setRefreshKey((prev) => prev + 1);
  };

  const tabs = [
    { id: 'TEST', label: 'Test', icon: ClipboardList },
    { id: 'ADD_PROJECT', label: 'Add Proj', icon: PlusCircle },
    { id: 'ASSIGN_PROJECT', label: 'Assign', icon: UserCheck },
    { id: 'CREATE_GROUP', label: 'Group', icon: Users },
    { id: 'VIEW_GUIDE', label: 'Guides', icon: BookOpen },
    { id: 'VIEW_ASSIGNMENTS', label: 'Assigns', icon: ClipboardList },
    { id: 'SUBMITTED_PROJECTS', label: 'Subs', icon: CheckCircle },
    { id: 'TIMETABLE', label: 'Timetable', icon: CalendarDays },
    { id: 'CLASSROOM', label: 'Classroom', icon: Users },
    { id: 'USERS', label: 'Users', icon: Users },
    { id: 'MARKS', label: 'Marks', icon: Award }
  ];

  return (
    <Layout user={user} onLogout={onLogout} title="Admin Dashboard">
      <div className="admin-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`admin-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          >
            <tab.icon size={18} />
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {successMsg && (
        <div className="success-msg animate-fadeIn">
          <CheckCircle size={20} />
          {successMsg}
        </div>
      )}

      <div className="animate-fadeIn">
        {activeTab === 'TEST' && <TestManager user={user} />}
        {activeTab === 'ADD_PROJECT' && <AddProjectForm onSuccess={showSuccess} adminId={user.id} />}
        {activeTab === 'ASSIGN_PROJECT' && <AssignProjectForm projects={projects} groups={groups} teachers={teachers} assignments={assignments} adminId={user.id} onSuccess={showSuccess} />}
        {activeTab === 'CREATE_GROUP' && <CreateGroupForm onSuccess={showSuccess} />}
        {activeTab === 'VIEW_GUIDE' && <ViewGuidesTable assignments={assignments} groups={groups} projects={projects} teachers={teachers} />}
        {activeTab === 'VIEW_ASSIGNMENTS' && <ViewAssignmentsList assignments={assignments} groups={groups} projects={projects} onSuccess={showSuccess} />}
        {activeTab === 'SUBMITTED_PROJECTS' && <SubmittedProjectsList assignments={assignments} groups={groups} projects={projects} />}
        {activeTab === 'TIMETABLE' && <TimetableManager user={user} />}
        {activeTab === 'CLASSROOM' && <AdminClassroomManager user={user} />}
        {activeTab === 'USERS' && <UsersManagement onSuccess={showSuccess} />}
        {activeTab === 'MARKS' && <MarksManager onSuccess={showSuccess} refreshKey={refreshKey} />}
      </div>
    </Layout>
  );
};

const AdminClassroomManager = ({ user }) => {
  const [groups, setGroups] = useState([]);
  const [mode, setMode] = useState('GROUPS');
  const [newGroupName, setNewGroupName] = useState('');
  const [joinKey, setJoinKey] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [message, setMessage] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [activeMessages, setActiveMessages] = useState([]);
  const [unreadMap, setUnreadMap] = useState({});
  const pollRef = useRef(0);
  const bottomRef = useRef(null);
  const forceAutoScrollRef = useRef(false);

  useEffect(() => {
    fetchGroups();
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchGroups();
    }, 12000);
    return () => clearInterval(interval);
  }, [selectedGroup?.id]);

  useEffect(() => {
    if (!activeMessages.length) return;
    if (forceAutoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      forceAutoScrollRef.current = false;
    }
  }, [activeMessages]);

  const fetchGroups = async () => {
    const all = await ApiService.getClassroomGroups();
    const mine = all.filter(g => g.teacherId === user.id || g.studentIds.includes(user.id));
    const getLatestForGroup = (g) => {
      const apiLatest = latestTimestamp(g.messages || []);
      const localLatest = localStorage.getItem(classroomChatSyncKey(g.id)) || '';
      if (!apiLatest) return localLatest;
      if (!localLatest) return apiLatest;
      return new Date(apiLatest) > new Date(localLatest) ? apiLatest : localLatest;
    };
    const sorted = [...mine].sort((a, b) => {
      const aTs = getLatestForGroup(a);
      const bTs = getLatestForGroup(b);
      if (!aTs && !bTs) return 0;
      if (!aTs) return 1;
      if (!bTs) return -1;
      return new Date(bTs) - new Date(aTs);
    });
    const unread = {};
    sorted.forEach(g => {
      const latest = getLatestForGroup(g);
      const seen = localStorage.getItem(classroomSeenKey(user.id, g.id)) || '';
      unread[g.id] = !!latest && (!seen || new Date(latest) > new Date(seen)) && selectedGroup?.id !== g.id;
    });
    setUnreadMap(unread);
    setGroups(sorted);
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    const key = Math.random().toString(36).substring(2, 8).toUpperCase();
    await ApiService.addClassroomGroup({
      id: `cg${Date.now()}`,
      name: newGroupName.trim(),
      joinKey: key,
      teacherId: user.id,
      teacherName: user.fullName,
      studentIds: [],
      messages: []
    });
    setNewGroupName('');
    fetchGroups();
    alert(`Group Created! Key: ${key}`);
    setMode('KEYS');
  };

  const deleteGroup = async (g) => {
    if(!window.confirm("Delete group? This will remove it for all members.")) return;
    await ApiService.deleteClassroomGroup(g.id);
    fetchGroups();
    setSelectedGroup(null);
    setMode('GROUPS');
  };

  const joinGroup = async () => {
    const all = await ApiService.getClassroomGroups();
    const group = all.find(g => g.joinKey === joinKey.toUpperCase());
    if (!group) return alert("Invalid Key");
    if (group.teacherId === user.id) return alert("You created this group.");
    if (group.studentIds.includes(user.id)) return alert("Already joined.");
    await ApiService.updateClassroomGroup(group.id, {
      ...group,
      studentIds: [...group.studentIds, user.id]
    });
    alert("Joined Group!");
    setJoinKey('');
    fetchGroups();
    setMode('GROUPS');
  };

  const syncMessages = async (groupId, forceFull = false) => {
    const cacheKey = classroomChatCacheKey(groupId);
    const syncKey = classroomChatSyncKey(groupId);
    const since = forceFull ? '' : (localStorage.getItem(syncKey) || '');
    const fresh = await ApiService.getClassroomGroupMessages(groupId, { since: since || undefined });
    setActiveMessages(prev => {
      const next = forceFull ? fresh : mergeChatsById(prev, fresh);
      localStorage.setItem(cacheKey, JSON.stringify(next));
      const ts = latestTimestamp(next);
      if (ts) localStorage.setItem(syncKey, ts);
      localStorage.setItem(classroomSeenKey(user.id, groupId), ts || '');
      return next;
    });
    setUnreadMap(prev => ({ ...prev, [groupId]: false }));
  };

  const openChat = async (group) => {
    setSelectedGroup(group);
    setMode('CHAT');
    forceAutoScrollRef.current = true;
    pollRef.current = 0;
    const cacheKey = classroomChatCacheKey(group.id);
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
      setActiveMessages(Array.isArray(cached) ? cached : []);
    } catch (_) {
      setActiveMessages([]);
    }
    await syncMessages(group.id, false);
  };

  useEffect(() => {
    if (mode !== 'CHAT' || !selectedGroup?.id) return;
    const interval = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      pollRef.current += 1;
      await syncMessages(selectedGroup.id, pollRef.current % 12 === 0);
    }, 4000);
    return () => clearInterval(interval);
  }, [mode, selectedGroup?.id]);

  const sendMessage = async () => {
    if ((!message.trim() && !pendingFile) || !selectedGroup) return;
    const msgData = {
      id: `cm${Date.now()}`,
      senderId: user.id,
      senderName: user.fullName,
      role: 'ADMIN',
      message: message.trim(),
      fileName: pendingFile?.fileName || '',
      fileType: pendingFile?.fileType || '',
      fileData: pendingFile?.fileData || '',
      timestamp: new Date().toISOString()
    };
    await ApiService.addClassroomGroupMessage(selectedGroup.id, msgData);
    const cacheKey = classroomChatCacheKey(selectedGroup.id);
    const syncKey = classroomChatSyncKey(selectedGroup.id);
    setActiveMessages(prev => {
      const next = mergeChatsById(prev, [msgData]);
      localStorage.setItem(cacheKey, JSON.stringify(next));
      const ts = latestTimestamp(next);
      if (ts) localStorage.setItem(syncKey, ts);
      localStorage.setItem(classroomSeenKey(user.id, selectedGroup.id), ts || '');
      return next;
    });
    setMessage('');
    setPendingFile(null);
    forceAutoScrollRef.current = true;
    fetchGroups();
  };

  const deleteMessage = async (messageId) => {
    if (!selectedGroup?.id) return;
    await ApiService.deleteClassroomGroupMessage(selectedGroup.id, messageId, user.id);
    const cacheKey = classroomChatCacheKey(selectedGroup.id);
    const syncKey = classroomChatSyncKey(selectedGroup.id);
    setActiveMessages(prev => {
      const next = prev.filter(m => m.id !== messageId);
      localStorage.setItem(cacheKey, JSON.stringify(next));
      const ts = latestTimestamp(next);
      if (ts) localStorage.setItem(syncKey, ts);
      return next;
    });
    fetchGroups();
  };

  const handleAttachment = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(ppt|pptx|doc|docx|xls|xlsx)$/i.test(file.name)) {
      alert('Only PPT, Word, and Excel files are allowed.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPendingFile({
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileData: reader.result
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <Card title="Classroom Groups">
       <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <Button variant={mode === 'GROUPS' ? 'primary' : 'outline'} size="sm" onClick={() => setMode('GROUPS')}>My Groups</Button>
          <Button variant={mode === 'CREATE' ? 'primary' : 'outline'} size="sm" onClick={() => setMode('CREATE')}>Create</Button>
          <Button variant={mode === 'KEYS' ? 'primary' : 'outline'} size="sm" onClick={() => setMode('KEYS')}>Group Keys</Button>
          <Button variant={mode === 'JOIN' ? 'primary' : 'outline'} size="sm" onClick={() => setMode('JOIN')}>Join Group</Button>
       </div>

       {mode === 'GROUPS' && (
         <div className="grid gap-3">
            {groups.map(g => (
              <div key={g.id} className="p-3 border rounded bg-white hover:shadow-md cursor-pointer flex justify-between items-center" onClick={() => openChat(g)}>
                 <div>
                    <div className="font-bold flex items-center gap-2">
                      <span className="text-black">{g.name}</span>
                      {unreadMap[g.id] && <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>}
                    </div>
                    <div className="text-xs text-gray-500">{g.teacherId === user.id ? 'Created by Me' : `Teacher: ${g.teacherName}`}</div>
                 </div>
                 <div className="flex items-center gap-2">
                   {g.teacherId === user.id && (
                     <button onClick={(e) => { e.stopPropagation(); deleteGroup(g); }} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
                   )}
                   <MessageCircle size={20} className="text-indigo-600"/>
                 </div>
              </div>
            ))}
            {groups.length === 0 && <p className="text-gray-400 text-center py-4">No groups yet.</p>}
         </div>
       )}

       {mode === 'CREATE' && (
         <div className="max-w-sm mx-auto py-4 space-y-3">
            <Input label="Group Name" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
            <Button onClick={createGroup} className="w-full">Generate Key & Create</Button>
         </div>
       )}

       {mode === 'KEYS' && (
         <div className="space-y-2">
            {groups.filter(g => g.teacherId === user.id).map(g => (
               <div key={g.id} className="p-3 bg-indigo-50 border border-indigo-100 rounded flex justify-between">
                  <span className="font-semibold text-black">{g.name}</span>
                  <span className="font-mono bg-white px-2 rounded border text-black">{g.joinKey}</span>
               </div>
            ))}
            {groups.filter(g => g.teacherId === user.id).length === 0 && <p className="text-center text-gray-400">You haven't created any groups.</p>}
         </div>
       )}

       {mode === 'JOIN' && (
         <div className="max-w-sm mx-auto py-4 space-y-3">
            <Input label="Enter Group Key" value={joinKey} onChange={e => setJoinKey(e.target.value)} />
            <Button onClick={joinGroup} className="w-full">Join Group</Button>
         </div>
       )}

       {mode === 'CHAT' && selectedGroup && (
          <div className="h-[500px] flex flex-col">
             <div className="border-b pb-2 mb-2 flex justify-between items-center">
                <h3 className="font-bold">{selectedGroup.name}</h3>
                <Button size="sm" variant="outline" onClick={() => setMode('GROUPS')}>Back</Button>
             </div>
             <div className="h-[420px] overflow-y-auto bg-gray-50 p-4 rounded mb-4 space-y-3 chat-scroll-mini group-chat-scrollbar">
                {activeMessages.map((m) => (
                   <div key={m.id || m.timestamp} className={`p-2 rounded max-w-[80%] group text-black ${m.senderId === user.id ? 'ml-auto bg-indigo-100' : 'bg-white border'}`}>
                      <div className="flex justify-between items-baseline gap-2">
                         <span className="font-bold text-xs text-black">{m.senderName}</span>
                         <div className="flex items-center gap-2">
                           <span className="text-[10px] text-black/60">{new Date(m.timestamp).toLocaleTimeString()}</span>
                           {m.senderId === user.id && (
                             <button onClick={() => deleteMessage(m.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                               <Trash2 size={12} />
                             </button>
                           )}
                         </div>
                      </div>
                      {m.message && <p className="text-sm text-black">{m.message}</p>}
                      {m.fileData && m.fileName && (
                        <a
                          href={m.fileData}
                          download={m.fileName}
                          className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-700 underline break-all"
                        >
                          <FileText size={12} /> {m.fileName}
                        </a>
                      )}
                   </div>
                ))}
                <div ref={bottomRef} />
             </div>
             <>
               {pendingFile && (
                 <div className="text-xs text-indigo-700 mb-2 px-1 flex items-center justify-between">
                   <span className="truncate">Attachment: {pendingFile.fileName}</span>
                   <button className="text-red-600" onClick={() => setPendingFile(null)}>Remove</button>
                 </div>
               )}
               <div className="flex gap-2">
                  <Input placeholder="Message..." value={message} onChange={e => setMessage(e.target.value)} className="mb-0 flex-1" />
                  <label htmlFor="admin_chat_attachment" className="inline-flex items-center justify-center px-3 border rounded-lg cursor-pointer hover:bg-gray-50" title="Attach PPT/Word/Excel">
                    <Paperclip size={16} />
                    <input id="admin_chat_attachment" name="admin_chat_attachment" type="file" className="hidden" accept=".ppt,.pptx,.doc,.docx,.xls,.xlsx" onChange={handleAttachment} />
                  </label>
                  <Button onClick={sendMessage}><Send size={18}/></Button>
               </div>
             </>
          </div>
       )}
    </Card>
  );
};

const CreateGroupForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    groupLeader: '', department: '', collegeYear: '1', semester: '1', division: ''
  });
  const [groupSize, setGroupSize] = useState(3);
  const [members, setMembers] = useState(['', '']);
  const [groups, setGroups] = useState([]);
  const [filters, setFilters] = useState({ department: '', collegeYear: '', semester: '', division: '' });
  const formSemesterOptions = getSemestersForYear(formData.collegeYear);
  const filterSemesterOptions = getSemestersForYear(filters.collegeYear);

  const loadGroups = async () => {
    const all = await ApiService.getGroups();
    setGroups(all || []);
  };

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    const valid = getSemestersForYear(formData.collegeYear);
    if (!valid.includes(String(formData.semester))) {
      setFormData(prev => ({ ...prev, semester: valid[0] || '' }));
    }
  }, [formData.collegeYear]);

  useEffect(() => {
    if (!filters.collegeYear) return;
    const valid = getSemestersForYear(filters.collegeYear);
    if (!valid.includes(String(filters.semester))) {
      setFilters(prev => ({ ...prev, semester: '' }));
    }
  }, [filters.collegeYear]);

  useEffect(() => {
    setMembers(prev => {
      const needed = Math.max(0, groupSize - 1);
      if (prev.length === needed) return prev;
      if (prev.length < needed) return [...prev, ...Array(needed - prev.length).fill('')];
      return prev.slice(0, needed);
    });
  }, [groupSize]);

  const updateMember = (index, val) => {
    const newMembers = [...members];
    newMembers[index] = val;
    setMembers(newMembers);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newGroup = {
      id: `g${Date.now()}`,
      groupLeader: formData.groupLeader,
      department: formData.department,
      collegeYear: parseInt(formData.collegeYear, 10),
      semester: parseInt(formData.semester, 10),
      division: formData.division,
      groupSize: parseInt(groupSize, 10),
      members: [formData.groupLeader, ...members.filter(m => m.trim() !== '')]
    };
    await ApiService.addGroup(newGroup);
    setFormData({ groupLeader: '', department: '', collegeYear: '1', semester: '1', division: '' });
    setMembers(Array(Math.max(0, groupSize - 1)).fill(''));
    await loadGroups();
    onSuccess('Student group created successfully!');
  };

  const filteredGroups = groups.filter(g => {
    if (filters.department && g.department !== filters.department) return false;
    if (filters.collegeYear && String(g.collegeYear || '') !== String(filters.collegeYear)) return false;
    if (filters.semester && String(g.semester || '') !== String(filters.semester)) return false;
    if (filters.division && g.division !== filters.division) return false;
    return true;
  });

  const deleteGroup = async (id) => {
    if (!window.confirm('Delete this group?')) return;
    await ApiService.deleteGroup(id);
    await loadGroups();
    onSuccess('Group deleted.');
  };

  const deleteFiltered = async () => {
    if (filteredGroups.length === 0) return;
    if (!window.confirm(`Delete all ${filteredGroups.length} filtered groups?`)) return;
    await Promise.all(filteredGroups.map(g => ApiService.deleteGroup(g.id)));
    await loadGroups();
    onSuccess('Filtered groups deleted.');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Card title="Create Student Group">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Group Leader (Username)"
              value={formData.groupLeader}
              onChange={e => setFormData({...formData, groupLeader: e.target.value})}
              required
              placeholder="e.g. student1"
            />
            <Select
              label="Department"
              options={DEPARTMENTS.map(d => ({ value: d, label: d }))}
              value={formData.department}
              onChange={e => setFormData({...formData, department: e.target.value})}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select label="Year" options={YEARS.map(y => ({ value: y, label: `${y} Year` }))} value={formData.collegeYear} onChange={e => setFormData({...formData, collegeYear: e.target.value})} required />
            <Select label="Semester" options={formSemesterOptions.map(s => ({ value: s, label: `Sem ${s}` }))} value={formData.semester} onChange={e => setFormData({...formData, semester: e.target.value})} required />
            <Select label="Division" options={DIVISIONS.map(d => ({ value: d, label: d }))} value={formData.division} onChange={e => setFormData({...formData, division: e.target.value})} required />
            <Input label="Group Size (Min 1)" type="number" min="1" max="10" value={groupSize} onChange={e => setGroupSize(Math.max(1, parseInt(e.target.value || '1', 10)))} required />
          </div>

          {members.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <div className="ui-label">Group Members</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {members.map((m, i) => (
                  <Input key={i} placeholder={`Member ${i + 2} Username`} value={m} onChange={e => updateMember(i, e.target.value)} required />
                ))}
              </div>
            </div>
          )}

          <Button type="submit" className="w-full">Create Group</Button>
        </form>
      </Card>

      <Card title="Created Groups">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <Select label="Department" options={DEPARTMENTS.map(d => ({ value: d, label: d }))} value={filters.department} onChange={e => setFilters(prev => ({ ...prev, department: e.target.value }))} />
          <Select label="Year" options={YEARS.map(y => ({ value: y, label: `${y} Year` }))} value={filters.collegeYear} onChange={e => setFilters(prev => ({ ...prev, collegeYear: e.target.value }))} />
          <Select label="Semester" options={filterSemesterOptions.map(s => ({ value: s, label: `Sem ${s}` }))} value={filters.semester} onChange={e => setFilters(prev => ({ ...prev, semester: e.target.value }))} />
          <Select label="Division" options={DIVISIONS.map(d => ({ value: d, label: d }))} value={filters.division} onChange={e => setFilters(prev => ({ ...prev, division: e.target.value }))} />
        </div>
        <div className="flex justify-end mb-3">
          <Button variant="danger" onClick={deleteFiltered} disabled={filteredGroups.length === 0}>Delete Filtered Groups</Button>
        </div>
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Group No</th>
                <th>Leader</th>
                <th>Department</th>
                <th>Year</th>
                <th>Semester</th>
                <th>Division</th>
                <th>Size</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.length > 0 ? filteredGroups.map(g => (
                <tr key={g.id}>
                  <td>{g.groupNo ?? '-'}</td>
                  <td>{g.groupLeader}</td>
                  <td>{g.department}</td>
                  <td>{g.collegeYear || '-'}</td>
                  <td>{g.semester || '-'}</td>
                  <td>{g.division}</td>
                  <td>{g.groupSize}</td>
                  <td>
                    <button onClick={() => deleteGroup(g.id)} className="text-red-600 hover:bg-red-50 p-2 rounded">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="text-center">No groups found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const MarksManager = ({ onSuccess, refreshKey }) => {
  const [filterDept, setFilterDept] = useState('');
  const [filterDiv, setFilterDiv] = useState('');
  const [data, setData] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const [marks, assignments, submissions, groups, projects, users] = await Promise.all([
         ApiService.getMarks({ force: true }),
         ApiService.getAssignments({ force: true }),
         ApiService.getSubmissions({ force: true }),
         ApiService.getGroups({ force: true }),
         ApiService.getProjects({ force: true }),
         ApiService.getUsers({ force: true })
      ]);
      setAllUsers(users || []);

      const assignmentByPair = new Map((assignments || []).map((a) => [`${a.groupId}::${a.projectId}`, a]));
      const groupById = new Map((groups || []).map((g) => [g.id, g]));
      const projectById = new Map((projects || []).map((p) => [p.id, p]));
      const teacherIds = new Set((users || []).filter((u) => u.role === 'TEACHER').map((u) => u.id));

      const isMarkValid = (m) => {
        const group = groupById.get(m.groupId);
        const assignment = assignmentByPair.get(`${m.groupId}::${m.projectId}`);
        const project = projectById.get(m.projectId);
        const guideId = project?.guideId;
        return !!group && !!assignment && !!project && !!guideId && teacherIds.has(guideId);
      };

      const staleMarks = (marks || []).filter((m) => !isMarkValid(m));
      if (staleMarks.length > 0) {
        await Promise.allSettled(staleMarks.map((m) => ApiService.deleteMark(m.id)));
      }

      const latestMarks = staleMarks.length > 0 ? await ApiService.getMarks({ force: true }) : (marks || []);
      const validMarks = latestMarks.filter(isMarkValid);

      const combined = validMarks.map(m => {
        const assignment = assignments.find(a => a.projectId === m.projectId && a.groupId === m.groupId);
        const group = groups.find(g => g.id === m.groupId);
        const project = projects.find(p => p.id === m.projectId);
        const submission = submissions.find(s => s.assignmentId === assignment?.id);
        const guide = (users || []).find(u => u.id === project?.guideId);
    
        return {
           ...m,
           groupMembers: group?.members || [],
           groupLeader: group?.groupLeader,
           groupNo: group?.groupNo,
           assignedProjectTitle: project?.title,
           studentProjectName: submission?.topicName || '',
           division: group?.division,
           department: group?.department,
           studentLink: submission?.link || '',
           studentFile: submission?.fileName || '',
           guideTeacherName: guide?.fullName || '-'
        };
      });
      setData(combined);
    };
    fetchData();
  }, [refreshKey]);

  const filteredData = data.filter(d => {
     if(filterDept && d.department !== filterDept) return false;
     if(filterDiv && d.division !== filterDiv) return false;
     return true;
  });

  const handleUpdate = async (id, updates) => {
    const mark = data.find(m => m.id === id);
    if(mark) {
       await ApiService.saveMark({ ...mark, ...updates });
       setData(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
       onSuccess("Updates saved");
    }
  };

  const exportData = () => {
     if(filteredData.length === 0) return alert("No data to export");
     
     const usersByUsername = new Map(allUsers.map(u => [u.username, u]));
     const headers = ["PRN", "Student Name", "Department", "Division", "Group No", "Assigned Project Title", "Student Project Name", "Teacher Marks", "Admin Marks", "Rubrics", "Guide Teacher"];
     const rows = [];
     filteredData.forEach(d => {
       const members = Array.isArray(d.groupMembers) && d.groupMembers.length > 0 ? d.groupMembers : [d.groupLeader];
       members.forEach(username => {
         const u = usersByUsername.get(username);
         rows.push([
           u?.prn || '',
           u?.fullName || username || '',
           d.department || '',
           d.division || '',
           d.groupNo ?? '',
           d.assignedProjectTitle || '',
           d.studentProjectName || '',
           d.teacherMarks ?? '',
           d.adminMarks ?? '',
           `"${d.rubrics || ''}"`,
           d.guideTeacherName || '-'
         ]);
       });
     });

     const csvContent = [
       headers.join(','),
       ...rows.map(r => r.join(','))
     ].join('\n');

     const blob = new Blob([csvContent], { type: 'text/csv' });
     const url = window.URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `marks_export_${new Date().toISOString().split('T')[0]}.csv`;
     a.click();
  };

  return (
    <Card title="Finalize Marks & Rubrics">
      <div className="flex gap-4 mb-4 items-end">
         <div className="w-1/3">
           <Select 
             label="Filter by Department"
             options={DEPARTMENTS.map(d => ({ value: d, label: d }))}
             value={filterDept}
             onChange={e => setFilterDept(e.target.value)}
           />
         </div>
         <div className="w-1/3">
           <Select 
             label="Filter by Division"
             options={DIVISIONS.map(d => ({ value: d, label: d }))}
             value={filterDiv}
             onChange={e => setFilterDiv(e.target.value)}
           />
         </div>
         <div className="pb-3">
            <Button variant="secondary" onClick={exportData}>
               <Download size={16}/> Export CSV
            </Button>
         </div>
      </div>

      <div className="table-wrapper">
        <table className="admin-table">
           <thead>
             <tr>
               <th>Group Leader</th>
               <th>Group No</th>
               <th>Assigned Project</th>
               <th>Student Project Name</th>
               <th>Link</th>
               <th>Guide Teacher</th>
               <th>Teacher Marks</th>
               <th>Rubrics/Comments</th>
               <th>Admin Marks</th>
               <th>Status</th>
             </tr>
           </thead>
           <tbody>
             {filteredData.map((row) => (
               <tr key={row.id}>
                 <td className="font-medium">{row.groupLeader}</td>
                 <td className="text-center">{row.groupNo ?? '-'}</td>
                 <td>{row.assignedProjectTitle}</td>
                 <td>{row.studentProjectName || '-'}</td>
                 <td className="min-w-[150px]">
                    {row.studentLink ? (
                      <a href={row.studentLink} target="_blank" className="text-xs text-indigo-600 underline break-all">{row.studentLink}</a>
                    ) : (
                      <span className="text-xs text-gray-400">{row.studentFile || '-'}</span>
                    )}
                 </td>
                 <td>{row.guideTeacherName}</td>
                 <td className="text-indigo-600 font-bold text-center">{row.teacherMarks || '-'}</td>
                 <td className="text-xs">{row.rubrics || 'No rubrics'}</td>
                 <td>
                   <input 
                      type="text"
                      id={`admin_mark_${row.id}`}
                      name={`admin_mark_${row.id}`}
                      className="ui-input w-28 text-center font-bold"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      defaultValue={row.adminMarks}
                      onWheel={(e) => e.currentTarget.blur()}
                      onPaste={(e) => e.preventDefault()}
                      onDrop={(e) => e.preventDefault()}
                      onKeyDown={(e) => {
                        const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
                        if (allowed.includes(e.key)) return;
                        if (/^[0-9]$/.test(e.key)) return;
                        e.preventDefault();
                      }}
                      onChange={(e) => {
                        e.target.value = e.target.value.replace(/[^0-9]/g, '');
                      }}
                      onBlur={(e) => handleUpdate(row.id, { adminMarks: parseInt(e.target.value, 10) })}
                   />
                 </td>
                 <td>
                   {row.isSubmittedToAdmin ? <Badge color="green">Submitted</Badge> : <Badge color="yellow">Pending</Badge>}
                 </td>
               </tr>
             ))}
           </tbody>
        </table>
        {filteredData.length === 0 && <div className="text-center py-8 text-gray-500">No marks submitted by teachers yet.</div>}
      </div>
    </Card>
  );
};

// ... Include AddProjectForm, AssignProjectForm, ViewGuidesTable, ViewAssignmentsList, SubmittedProjectsList, UsersManagement, ChatMonitor from before (unchanged or minor tweaks) ...
const AddProjectForm = ({ onSuccess, adminId }) => {
  const [formData, setFormData] = useState({
    title: '', description: '', department: '', dueDate: '', totalMarks: ''
  });
  const [rubrics, setRubrics] = useState([]);
  const [showRubricModal, setShowRubricModal] = useState(false);
  const [rubricDraft, setRubricDraft] = useState({ title: '', maxMarks: '' });

  const rubricTotal = rubrics.reduce((sum, r) => sum + (parseInt(r.maxMarks, 10) || 0), 0);

  const addRubric = () => {
    const title = rubricDraft.title.trim();
    const maxMarks = parseInt(rubricDraft.maxMarks, 10);
    const totalMarks = parseInt(formData.totalMarks, 10);
    if (!Number.isFinite(totalMarks) || totalMarks <= 0) return alert('Enter Total Marks before adding rubrics.');
    if (!title) return alert('Rubric title is required.');
    if (!Number.isFinite(maxMarks) || maxMarks <= 0) return alert('Rubric marks must be greater than 0.');
    if ((rubricTotal + maxMarks) > totalMarks) return alert(`Rubric sum cannot exceed total marks (${totalMarks}).`);
    setRubrics(prev => [...prev, { id: `rb${Date.now()}${Math.random().toString(36).slice(2, 6)}`, title, maxMarks }]);
    setRubricDraft({ title: '', maxMarks: '' });
  };

  const removeRubric = (id) => {
    setRubrics(prev => prev.filter(r => r.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const totalMarks = parseInt(formData.totalMarks, 10);
    if (!Number.isFinite(totalMarks) || totalMarks <= 0) return alert('Total marks must be greater than 0.');
    if (rubrics.length === 0) return alert('Please add at least one rubric.');
    if (rubricTotal !== totalMarks) return alert(`Rubric marks total (${rubricTotal}) must equal total marks (${totalMarks}).`);
    const newProject = {
      id: `p${Date.now()}`,
      ...formData,
      totalMarks,
      rubrics: rubrics.map(r => ({ ...r, maxMarks: parseInt(r.maxMarks, 10) })),
      createdBy: adminId
    };
    await ApiService.addProject(newProject);
    setFormData({ title: '', description: '', department: '', dueDate: '', totalMarks: '' });
    setRubrics([]);
    setRubricDraft({ title: '', maxMarks: '' });
    onSuccess('Project added successfully!');
  };

  return (
    <Card title="Add New Project" className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input 
          label="Project Title" 
          value={formData.title} 
          onChange={e => setFormData({...formData, title: e.target.value})} 
          required 
        />
        <div className="w-full">
          <label className="ui-label" htmlFor="project_description">Description</label>
          <textarea 
            id="project_description"
            name="project_description"
            className="ui-input"
            rows={3}
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
            required
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select 
            label="Department"
            options={DEPARTMENTS.map(d => ({ value: d, label: d }))}
            value={formData.department}
            onChange={e => setFormData({...formData, department: e.target.value})}
            required
          />
        </div>
        <Input 
          label="Due Date" 
          type="date"
          value={formData.dueDate}
          onChange={e => setFormData({...formData, dueDate: e.target.value})}
          required
        />
        <Input
          label="Total Marks"
          type="number"
          min="1"
          value={formData.totalMarks}
          onChange={e => setFormData({...formData, totalMarks: e.target.value})}
          required
        />

        <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-semibold text-indigo-700">Rubrics</div>
              <div className="text-xs text-gray-600">
                Added: {rubrics.length} | Assigned Total: {rubricTotal} / {formData.totalMarks || 0}
              </div>
            </div>
            <Button type="button" variant="outline" onClick={() => setShowRubricModal(true)}>Configure Rubrics</Button>
          </div>
        </div>
        <Button type="submit" className="w-full">Save Project</Button>
      </form>

      {showRubricModal && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-lg">Project Rubrics</h4>
              <Button size="sm" variant="outline" onClick={() => setShowRubricModal(false)}>Close</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
              <Input
                label="Rubric Title"
                placeholder="e.g. Problem Understanding"
                value={rubricDraft.title}
                onChange={e => setRubricDraft({ ...rubricDraft, title: e.target.value })}
              />
              <Input
                label="Marks"
                type="number"
                min="1"
                value={rubricDraft.maxMarks}
                onChange={e => setRubricDraft({ ...rubricDraft, maxMarks: e.target.value })}
              />
              <div className="flex items-end">
                <Button type="button" className="w-full" onClick={addRubric}>Add Rubric</Button>
              </div>
            </div>

            <div className="space-y-2">
              {rubrics.map(r => (
                <div key={r.id} className="p-3 border rounded flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{r.title}</div>
                    <div className="text-xs text-gray-500">Max: {r.maxMarks}</div>
                  </div>
                  <button type="button" onClick={() => removeRubric(r.id)} className="text-red-600 hover:bg-red-50 p-2 rounded">
                    <Trash2 size={16}/>
                  </button>
                </div>
              ))}
              {rubrics.length === 0 && <div className="text-center text-gray-500 py-4">No rubrics added yet.</div>}
            </div>

            <div className="mt-4 text-sm font-semibold">
              Total Assigned: {rubricTotal} / {formData.totalMarks || 0}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

const AssignProjectForm = ({ projects, groups, teachers, assignments, adminId, onSuccess }) => {
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedGuide, setSelectedGuide] = useState('');
  const [filters, setFilters] = useState({ department: '', division: '', semester: '' });

  const assignedGroupIdsForProject = new Set(
    (assignments || []).filter(a => a.projectId === selectedProject).map(a => a.groupId)
  );
  const selectableGroups = groups.filter(g => {
    if (filters.department && g.department !== filters.department) return false;
    if (filters.division && g.division !== filters.division) return false;
    if (filters.semester && String(g.semester || '') !== String(filters.semester)) return false;
    if (selectedProject && assignedGroupIdsForProject.has(g.id)) return false;
    return true;
  });
  const selectableProjects = projects.filter(p => !filters.department || p.department === filters.department);
  const groupDetails = groups.find(g => g.id === selectedGroup);

  useEffect(() => {
    if (selectedGroup && !selectableGroups.some(g => g.id === selectedGroup)) setSelectedGroup('');
  }, [selectedGroup, selectableGroups]);

  useEffect(() => {
    if (selectedProject && !selectableProjects.some(p => p.id === selectedProject)) setSelectedProject('');
  }, [selectedProject, selectableProjects]);

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!selectedProject || !selectedGroup || !selectedGuide) return;

    const existing = (assignments || []).find(a => a.projectId === selectedProject && a.groupId === selectedGroup);
    if (existing) return alert('This project is already assigned to this group.');

    const selectedProjectData = projects.find(p => p.id === selectedProject);
    if (!selectedProjectData) return alert('Selected project not found.');
    await ApiService.updateProject(selectedProject, { ...selectedProjectData, guideId: selectedGuide });

    await ApiService.assignProject({
      id: `a${Date.now()}`,
      projectId: selectedProject,
      groupId: selectedGroup,
      assignedBy: adminId,
      status: 'ASSIGNED',
      assignedDate: new Date().toISOString()
    });
    setSelectedGroup('');
    onSuccess('Project assigned to group successfully!');
  };

  return (
    <Card title="Assign Project to Group" className="max-w-3xl mx-auto">
      <form onSubmit={handleAssign} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select label="Department" options={DEPARTMENTS.map(d => ({ value: d, label: d }))} value={filters.department} onChange={e => setFilters(prev => ({ ...prev, department: e.target.value }))} />
          <Select label="Division" options={DIVISIONS.map(d => ({ value: d, label: d }))} value={filters.division} onChange={e => setFilters(prev => ({ ...prev, division: e.target.value }))} />
          <Select label="Semester" options={SEMESTERS.map(s => ({ value: s, label: `Sem ${s}` }))} value={filters.semester} onChange={e => setFilters(prev => ({ ...prev, semester: e.target.value }))} />
        </div>

        <Select
          label="Select Project"
          options={selectableProjects.map(p => ({ value: p.id, label: `${p.title} (${p.department})` }))}
          value={selectedProject}
          onChange={e => setSelectedProject(e.target.value)}
          required
        />

        <Select
          label="Select Student Group"
          options={selectableGroups.map(g => ({ value: g.id, label: `Group ${g.groupNo ?? '-'} | Leader: ${g.groupLeader} | ${g.department} | Sem ${g.semester || '-'} | Div ${g.division}` }))}
          value={selectedGroup}
          onChange={e => setSelectedGroup(e.target.value)}
          required
        />

        <Select
          label="Select Guide (Teacher)"
          options={teachers.map(t => ({ value: t.id, label: `${t.fullName} (${t.department})` }))}
          value={selectedGuide}
          onChange={e => setSelectedGuide(e.target.value)}
          required
        />

        {groupDetails && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800">
            <h4 className="text-sm font-semibold text-indigo-800 dark:text-indigo-300 mb-2">Selected Group Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-800 dark:text-gray-300">
              <p><strong>Group No:</strong> {groupDetails.groupNo ?? '-'}</p>
              <p><strong>Leader:</strong> {groupDetails.groupLeader}</p>
              <p><strong>Department:</strong> {groupDetails.department}</p>
              <p><strong>Division:</strong> {groupDetails.division}</p>
              <p><strong>Semester:</strong> {groupDetails.semester || '-'}</p>
              <p><strong>Year:</strong> {groupDetails.collegeYear || '-'}</p>
              <p><strong>Size:</strong> {groupDetails.groupSize} Students</p>
            </div>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={!selectedProject || !selectedGroup || !selectedGuide}>
          Assign Project
        </Button>
      </form>
    </Card>
  );
};

const ViewGuidesTable = ({ assignments, groups, projects, teachers }) => {
  const [filters, setFilters] = useState({ guideId: '', department: '', division: '', semester: '', projectId: '' });
  const data = assignments.map((a) => {
    const group = groups.find((g) => g.id === a.groupId);
    const project = projects.find((p) => p.id === a.projectId);
    const guide = teachers.find((t) => t.id === project?.guideId);
    return {
      id: a.id,
      groupNo: group?.groupNo,
      leader: group?.groupLeader || 'Unknown',
      guideId: guide?.id || '',
      guideName: guide?.fullName || 'Unassigned',
      projectId: project?.id || '',
      projectTitle: project?.title || 'Unknown',
      dept: group?.department || project?.department || '-',
      division: group?.division || '-',
      semester: group?.semester || '-'
    };
  }).filter(item => {
    if (filters.guideId && item.guideId !== filters.guideId) return false;
    if (filters.department && item.dept !== filters.department) return false;
    if (filters.division && item.division !== filters.division) return false;
    if (filters.semester && String(item.semester) !== String(filters.semester)) return false;
    if (filters.projectId && item.projectId !== filters.projectId) return false;
    return true;
  });

  return (
    <Card title="View Guides Allocation">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
        <Select label="Guide" options={teachers.map(t => ({ value: t.id, label: t.fullName }))} value={filters.guideId} onChange={e => setFilters(prev => ({ ...prev, guideId: e.target.value }))} />
        <Select label="Department" options={DEPARTMENTS.map(d => ({ value: d, label: d }))} value={filters.department} onChange={e => setFilters(prev => ({ ...prev, department: e.target.value }))} />
        <Select label="Division" options={DIVISIONS.map(d => ({ value: d, label: d }))} value={filters.division} onChange={e => setFilters(prev => ({ ...prev, division: e.target.value }))} />
        <Select label="Semester" options={SEMESTERS.map(s => ({ value: s, label: `Sem ${s}` }))} value={filters.semester} onChange={e => setFilters(prev => ({ ...prev, semester: e.target.value }))} />
        <Select label="Project" options={projects.map(p => ({ value: p.id, label: p.title }))} value={filters.projectId} onChange={e => setFilters(prev => ({ ...prev, projectId: e.target.value }))} />
      </div>
      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Group No</th>
              <th>Group Leader</th>
              <th>Department</th>
              <th>Division</th>
              <th>Semester</th>
              <th>Project</th>
              <th>Assigned Guide</th>
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? data.map((item) => (
              <tr key={item.id}>
                <td>{item.groupNo ?? '-'}</td>
                <td className="font-medium text-black">{item.leader}</td>
                <td>{item.dept}</td>
                <td>{item.division}</td>
                <td>{item.semester}</td>
                <td>{item.projectTitle}</td>
                <td className="text-indigo-700 font-medium">{item.guideName}</td>
              </tr>
            )) : (
              <tr><td colSpan={7} className="text-center">No assignments found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

const ViewAssignmentsList = ({ assignments, groups, projects, onSuccess }) => {
  const [filters, setFilters] = useState({ department: '', division: '', semester: '', projectId: '' });
  const data = assignments.map((a) => {
    const group = groups.find((g) => g.id === a.groupId);
    const project = projects.find((p) => p.id === a.projectId);
    return {
      id: a.id,
      projectId: project?.id || '',
      projectTitle: project?.title || 'Unknown',
      department: group?.department || project?.department || '-',
      division: group?.division || '-',
      semester: group?.semester || '-',
      groupNo: group?.groupNo,
      group: group ? `Group ${group.groupNo ?? '-'} | Leader: ${group.groupLeader} (Div ${group.division})` : 'Unknown Group',
      status: a.status,
      dueDate: project?.dueDate
    };
  }).filter(item => {
    if (filters.department && item.department !== filters.department) return false;
    if (filters.division && item.division !== filters.division) return false;
    if (filters.semester && String(item.semester) !== String(filters.semester)) return false;
    if (filters.projectId && item.projectId !== filters.projectId) return false;
    return true;
  });

  const deleteAssigned = async (id) => {
    if (!window.confirm('Delete this assignment?')) return;
    await ApiService.deleteAssignment(id);
    onSuccess?.('Assignment deleted successfully.');
  };

  return (
    <Card title="All Project Assignments">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <Select label="Department" options={DEPARTMENTS.map(d => ({ value: d, label: d }))} value={filters.department} onChange={e => setFilters(prev => ({ ...prev, department: e.target.value }))} />
        <Select label="Division" options={DIVISIONS.map(d => ({ value: d, label: d }))} value={filters.division} onChange={e => setFilters(prev => ({ ...prev, division: e.target.value }))} />
        <Select label="Semester" options={SEMESTERS.map(s => ({ value: s, label: `Sem ${s}` }))} value={filters.semester} onChange={e => setFilters(prev => ({ ...prev, semester: e.target.value }))} />
        <Select label="Project" options={projects.map(p => ({ value: p.id, label: p.title }))} value={filters.projectId} onChange={e => setFilters(prev => ({ ...prev, projectId: e.target.value }))} />
      </div>
       <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Project Title</th>
              <th>Department</th>
              <th>Division</th>
              <th>Semester</th>
              <th>Group No</th>
              <th>Assigned Group</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
             {data.length > 0 ? data.map((item) => (
              <tr key={item.id}>
                <td className="font-medium">{item.projectTitle}</td>
                <td>{item.department}</td>
                <td>{item.division}</td>
                <td>{item.semester}</td>
                <td>{item.groupNo ?? '-'}</td>
                <td>{item.group}</td>
                <td>{item.dueDate}</td>
                <td>
                  <Badge color={item.status === 'SUBMITTED' ? 'green' : 'yellow'}>{item.status}</Badge>
                </td>
                <td>
                  <button onClick={() => deleteAssigned(item.id)} className="text-red-600 hover:bg-red-50 p-2 rounded">
                    <Trash2 size={16}/>
                  </button>
                </td>
              </tr>
            )) : (
               <tr><td colSpan={9} className="text-center">No active assignments.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

const SubmittedProjectsList = ({ assignments, groups, projects }) => {
  const [submissions, setSubmissions] = useState([]);
  const [filters, setFilters] = useState({ status: 'SUBMITTED', department: '', semester: '', division: '' });

  useEffect(() => {
    ApiService.getSubmissions().then(setSubmissions);
  }, [assignments]);
  
  const data = assignments.map((assignment) => {
    const sub = submissions.find(s => s.assignmentId === assignment.id);
    const project = projects.find((p) => p.id === assignment?.projectId);
    const group = groups.find((g) => g.id === assignment?.groupId);
    return {
      id: assignment.id,
      project: project?.title || 'Unknown Project',
      groupNo: group?.groupNo,
      groupLeader: group?.groupLeader || 'Unknown',
      department: group?.department || project?.department || '-',
      semester: group?.semester || '-',
      division: group?.division || '-',
      date: sub?.submissionDate || '',
      file: sub?.fileName || 'No File',
      link: sub?.link || '',
      grade: sub?.grade || 'Pending',
      status: sub ? 'SUBMITTED' : 'NOT_SUBMITTED'
    };
  }).filter(item => {
    if (filters.status && item.status !== filters.status) return false;
    if (filters.department && item.department !== filters.department) return false;
    if (filters.semester && String(item.semester) !== String(filters.semester)) return false;
    if (filters.division && item.division !== filters.division) return false;
    return true;
  });

  return (
    <Card title="Project Submission Status">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <Select label="Status" options={[{ value: 'SUBMITTED', label: 'Submitted' }, { value: 'NOT_SUBMITTED', label: 'Not Submitted' }]} value={filters.status} onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))} />
        <Select label="Department" options={DEPARTMENTS.map(d => ({ value: d, label: d }))} value={filters.department} onChange={e => setFilters(prev => ({ ...prev, department: e.target.value }))} />
        <Select label="Semester" options={SEMESTERS.map(s => ({ value: s, label: `Sem ${s}` }))} value={filters.semester} onChange={e => setFilters(prev => ({ ...prev, semester: e.target.value }))} />
        <Select label="Division" options={DIVISIONS.map(d => ({ value: d, label: d }))} value={filters.division} onChange={e => setFilters(prev => ({ ...prev, division: e.target.value }))} />
      </div>
       <div className="grid gap-4">
         {data.length > 0 ? data.map((item) => (
           <div key={item.id} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
             <div className="flex justify-between items-start">
               <div>
                 <h4 className="font-semibold text-lg text-indigo-600 dark:text-indigo-400">{item.project}</h4>
                 <p className="text-sm text-gray-600 dark:text-gray-400">Group {item.groupNo ?? '-'} | Leader: <span className="font-medium">{item.groupLeader}</span> | {item.department} | Sem {item.semester} | Div {item.division}</p>
               </div>
               <Badge color={item.status === 'SUBMITTED' ? 'green' : 'yellow'}>{item.status === 'SUBMITTED' ? item.grade : 'Not Submitted'}</Badge>
             </div>
             {item.status === 'SUBMITTED' ? (
               <div className="mt-3 flex flex-col gap-2 text-sm text-gray-500">
                 {item.file !== 'No File' && <span className="flex items-center gap-1"><FileText size={16}/> {item.file}</span>}
                 {item.link && <a href={item.link} target="_blank" className="flex items-center gap-1 text-indigo-500 hover:underline"><CheckCircle size={16}/> {item.link}</a>}
                 {item.date && <span className="flex items-center gap-1 text-xs text-gray-400">{new Date(item.date).toLocaleDateString()}</span>}
               </div>
             ) : (
               <div className="mt-3 text-sm text-gray-500">No submission uploaded yet.</div>
             )}
           </div>
         )) : (
            <div className="text-center py-10 text-gray-500">No records found.</div>
         )}
       </div>
    </Card>
  );
};

const UsersManagement = ({ onSuccess }) => {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({
    username: '', password: '123', fullName: '', role: 'STUDENT', department: DEPARTMENTS[0], division: DIVISIONS[0], prn: ''
  });
  const [filterRole, setFilterRole] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterDiv, setFilterDiv] = useState('');

  useEffect(() => {
    ApiService.getUsers().then(u => {
      // Admin sees everyone EXCEPT developers
      setUsers(u.filter(user => user.role !== 'DEVELOPER'));
    });
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    const user = {
      id: `u${Date.now()}`,
      ...newUser,
      prn: newUser.role === 'STUDENT' ? newUser.prn : undefined,
      division: newUser.role === 'STUDENT' ? newUser.division : undefined
    };
    await ApiService.register(user);
    // Refresh list
    const u = await ApiService.getUsers();
    setUsers(u.filter(user => user.role !== 'DEVELOPER'));
    onSuccess("User registered successfully");
    setNewUser({ username: '', password: '123', fullName: '', role: 'STUDENT', department: DEPARTMENTS[0], division: DIVISIONS[0], prn: '' });
  };

  const filteredUsers = users.filter(u => {
    if (filterRole && u.role !== filterRole) return false;
    if (filterDept && u.department !== filterDept) return false;
    if (filterRole === 'STUDENT' && filterDiv && u.division !== filterDiv) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <Card title="All Users">
        <div className="filter-row">
           <Select className="filter-item" label="Filter Role" options={['ADMIN','TEACHER','STUDENT'].map(r=>({value:r, label:r}))} value={filterRole} onChange={e => setFilterRole(e.target.value)} />
           <Select className="filter-item" label="Filter Dept" options={DEPARTMENTS.map(d=>({value:d, label:d}))} value={filterDept} onChange={e => setFilterDept(e.target.value)} />
           {filterRole === 'STUDENT' && (
             <Select className="filter-item" label="Filter Div" options={DIVISIONS.map(d=>({value:d, label:d}))} value={filterDiv} onChange={e => setFilterDiv(e.target.value)} />
           )}
        </div>

        <div className="table-wrapper max-h-96">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Dept</th>
                <th>Div/PRN</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id}>
                  <td className="font-medium">{u.fullName}</td>
                  <td>{u.role}</td>
                  <td>{u.department}</td>
                  <td>{u.role === 'STUDENT' ? `${u.division} / ${u.prn}` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const ChatMonitor = ({ teachers, adminUser }) => {
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [chats, setChats] = useState([]);
  const [groups, setGroups] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    if(selectedTeacher) {
       ApiService.getAssignmentsForTeacher(selectedTeacher).then(async (assignments) => {
          const allGroups = await ApiService.getGroups();
          const allProjects = await ApiService.getProjects();
          
          const mappedGroups = assignments.map(a => {
             const grp = allGroups.find(g => g.id === a.groupId);
             const proj = allProjects.find(p => p.id === a.projectId);
             return { ...grp, projectName: proj?.title };
          }).filter(Boolean);
          setGroups(mappedGroups);
       });
    }
  }, [selectedTeacher]);

  useEffect(() => {
    if(selectedGroup) {
      const fetchChats = async () => {
         const allChats = await ApiService.getChats();
         setChats(allChats.filter(c => c.targetId === selectedGroup && c.targetType === 'GROUP'));
      };
      fetchChats();
      const interval = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        fetchChats();
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [selectedGroup]);

  // Only scroll when new messages are added, not on every refresh
  const prevChatCountRef = useRef(0);
  useEffect(() => {
    if (chats.length !== prevChatCountRef.current) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 0);
      prevChatCountRef.current = chats.length;
    }
  }, [chats]);

  const deleteMessage = async (id) => {
    await ApiService.deleteChat(id);
    setChats(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px]">
      <Card title="1. Select Teacher" className="h-full overflow-y-auto">
        <div className="space-y-2">
          {teachers.map(t => (
            <button key={t.id} onClick={() => { setSelectedTeacher(t.id); setSelectedGroup(''); }} className={`w-full text-left p-3 rounded-lg ${selectedTeacher === t.id ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-50'}`}>
              <div className="font-semibold">{t.fullName}</div>
              <div className="text-xs text-gray-500">{t.department}</div>
            </button>
          ))}
        </div>
      </Card>
      
      <Card title="2. Select Group" className="h-full overflow-y-auto">
        {selectedTeacher ? (
          <div className="space-y-2">
             {groups.map((g) => (
               <button key={g.id} onClick={() => setSelectedGroup(g.id)} className={`w-full text-left p-3 rounded-lg ${selectedGroup === g.id ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-50'}`}>
                 <div className="font-semibold">{g.groupLeader}</div>
                 <div className="text-xs text-gray-500">{g.projectName}</div>
               </button>
             ))}
             {groups.length === 0 && <div className="text-gray-400 text-center py-4">No groups assigned.</div>}
          </div>
        ) : (
          <div className="text-gray-400 text-center py-10">Select a teacher first</div>
        )}
      </Card>

      <Card title="3. Chat History" className="h-full flex flex-col">
        {selectedGroup ? (
          <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
             {chats.length > 0 ? chats.map(c => (
               <div key={c.id} className={`p-3 rounded-lg max-w-[80%] group relative ${c.senderId === selectedTeacher ? 'bg-indigo-100 text-black ml-auto' : 'bg-white text-black mr-auto'}`}>
                  <div className="flex justify-between items-center gap-2">
                    <div className="text-xs font-bold text-gray-700 mb-1">{c.senderName}</div>
                    <button onClick={() => deleteMessage(c.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="text-sm text-black">{c.message}</div>
                  <div className="text-[10px] text-gray-500 text-right mt-1">{new Date(c.timestamp).toLocaleString()}</div>
               </div>
             )) : <div className="text-center text-gray-400 mt-10">No messages yet.</div>}
             <div ref={bottomRef} />
          </div>
        ) : (
          <div className="text-gray-400 text-center py-10">Select a group to view chats</div>
        )}
      </Card>
    </div>
  );
};





