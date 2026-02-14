import React, { useEffect, useState, useRef } from 'react';
import { Layout } from '../components/Layout.jsx';
import { Card, Button, Input, Badge, Select } from '../components/UI.jsx';
import { ApiService } from '../services/api.js';
import { CheckCircle, MessageSquare, Trash2, ChevronLeft, ChevronRight, AlertTriangle, Clock, LogOut, Link, FileText, Save } from 'lucide-react';

const groupChatCacheKey = (groupId) => `group_chat_cache_${groupId}`;
const groupChatSyncKey = (groupId) => `group_chat_sync_${groupId}`;
const classroomChatCacheKey = (groupId) => `classroom_chat_cache_${groupId}`;
const classroomChatSyncKey = (groupId) => `classroom_chat_sync_${groupId}`;
const classroomSeenKey = (userId, groupId) => `student_group_seen_${userId}_${groupId}`;
const mergeChatsById = (existing, incoming) => {
  const map = new Map(existing.map(c => [c.id, c]));
  incoming.forEach(c => map.set(c.id, c));
  return Array.from(map.values()).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};
const isNearBottom = (el, threshold = 120) => {
  if (!el) return true;
  return (el.scrollHeight - el.scrollTop - el.clientHeight) <= threshold;
};
const latestTimestamp = (items) => {
  if (!items || items.length === 0) return '';
  return items[items.length - 1].timestamp || '';
};

export const StudentDashboard = ({ user, onLogout, onUserUpdate }) => {
  const [activeTab, setActiveTab] = useState('PROJECT');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState({ collegeYear: '', semester: '' });

  useEffect(() => {
    setProfileData({
      collegeYear: user.collegeYear ? String(user.collegeYear) : '',
      semester: user.semester ? String(user.semester) : ''
    });
  }, [user.collegeYear, user.semester]);

  useEffect(() => {
    // Check if user has Year/Sem
    if ((!user.collegeYear || !user.semester) && user.role === 'STUDENT') {
       setShowProfileModal(true);
    }
  }, [user.collegeYear, user.semester, user.role]);

  const openProfileEditor = () => {
    setProfileData({
      collegeYear: user.collegeYear ? String(user.collegeYear) : '',
      semester: user.semester ? String(user.semester) : ''
    });
    setShowProfileModal(true);
  };

  const handleProfileUpdate = async () => {
    if (!profileData.collegeYear || !profileData.semester) return alert("Please select both Year and Semester.");
    try {
      const updatedUser = await ApiService.updateUser(user.id, {
        collegeYear: parseInt(profileData.collegeYear, 10),
        semester: parseInt(profileData.semester, 10)
      });
      onUserUpdate?.(updatedUser);
      setShowProfileModal(false);
      alert("Profile updated successfully.");
    } catch (err) {
      alert(err.message || "Failed to update profile.");
    }
  };

  return (
    <Layout
      user={user}
      onLogout={onLogout}
      title="Student Dashboard"
      sidebarItems={[{ id: 'PROFILE', label: 'Profile' }]}
      activeSidebarItem={activeTab === 'PROFILE' ? 'PROFILE' : null}
      onSidebarItemClick={setActiveTab}
    >
      {/* Profile Header Info */}
      <div className="mb-4 px-4">
         <div className="text-sm font-semibold text-gray-500">
            {user.collegeYear ? `${user.collegeYear} Year` : 'Year N/A'} • {user.semester ? `Semester ${user.semester}` : 'Sem N/A'}
         </div>
         {(!user.collegeYear || !user.semester) && (
            <button onClick={openProfileEditor} className="text-xs text-indigo-600 underline">Update Profile</button>
         )}
      </div>

      <div className="student-tabs">
        {['PROJECT', 'GROUPS', 'TEST'].map(tab => (
           <button 
             key={tab}
             onClick={() => setActiveTab(tab)}
             className={`student-tab-btn ${activeTab === tab ? 'active' : ''}`}
           >
             {tab}
           </button>
        ))}
      </div>

      <div className="animate-fadeIn">
        {activeTab === 'PROJECT' && <ProjectTab user={user} />}
        {activeTab === 'GROUPS' && <GroupsTab user={user} />}
        {activeTab === 'TEST' && <TestTab user={user} />}
        {activeTab === 'PROFILE' && <ProfileTab profileData={profileData} setProfileData={setProfileData} onSave={handleProfileUpdate} />}
      </div>

      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white p-6 rounded-lg max-w-sm w-full">
              <h3 className="font-bold text-lg mb-4">Complete Your Profile</h3>
              <p className="text-sm text-gray-500 mb-4">Please enter your current academic details.</p>
              <div className="space-y-3">
                 <Select 
                    label="College Year"
                    options={['1','2','3','4'].map(y => ({value:y, label: `${y} Year`}))}
                    value={profileData.collegeYear}
                    onChange={e => setProfileData({...profileData, collegeYear: e.target.value})}
                 />
                 <Select 
                    label="Semester"
                    options={['1','2','3','4','5','6','7','8'].map(s => ({value:s, label: `Semester ${s}`}))}
                    value={profileData.semester}
                    onChange={e => setProfileData({...profileData, semester: e.target.value})}
                 />
                 <Button className="w-full" onClick={handleProfileUpdate}>Save Profile</Button>
              </div>
           </div>
        </div>
      )}
    </Layout>
  );
};

const ProfileTab = ({ profileData, setProfileData, onSave }) => {
  return (
    <Card title="Profile">
      <div className="max-w-md space-y-4">
        <p className="text-sm text-gray-500">Update your academic details.</p>
        <Select
          label="College Year"
          options={['1', '2', '3', '4'].map(y => ({ value: y, label: `${y} Year` }))}
          value={profileData.collegeYear}
          onChange={e => setProfileData({ ...profileData, collegeYear: e.target.value })}
        />
        <Select
          label="Semester"
          options={['1', '2', '3', '4', '5', '6', '7', '8'].map(s => ({ value: s, label: `Semester ${s}` }))}
          value={profileData.semester}
          onChange={e => setProfileData({ ...profileData, semester: e.target.value })}
        />
        <Button onClick={onSave}>Save Profile</Button>
      </div>
    </Card>
  );
};

const ProjectTab = ({ user }) => {
  const [myAssignment, setMyAssignment] = useState(null);
  const [project, setProject] = useState(null);
  const [chats, setChats] = useState([]);
  const [msg, setMsg] = useState('');
  const [submission, setSubmission] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState(0);
  const [isMarksSubmitted, setIsMarksSubmitted] = useState(false);
  const [daysLeft, setDaysLeft] = useState(null);
  const bottomRef = useRef(null);
  const chatContainerRef = useRef(null);
  const forceAutoScrollRef = useRef(true);
  const prevChatCountRef = useRef(0);
  const assignmentRef = useRef(null);
  const pollCountRef = useRef(0);

  useEffect(() => {
    const fetchData = async () => {
      const assign = await ApiService.getAssignmentForStudent(user.username);
      if (assign) {
        setMyAssignment(assign);
        assignmentRef.current = assign;
        const proj = await ApiService.getProjectById(assign.projectId);
        setProject(proj || null);
        setProgress(assign.progress || 0);
        
        // Calculate days left
        if (proj && proj.dueDate) {
           const due = new Date(proj.dueDate);
           const diff = due - new Date();
           const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
           setDaysLeft(days);
        }

        const subs = await ApiService.getSubmissions();
        const sub = subs.find(s => s.assignmentId === assign.id);
        setSubmission(sub || null);

        // Check if marks submitted
        const marks = await ApiService.getMarks();
        const markEntry = marks.find(m => m.projectId === proj.id && m.groupId === assign.groupId);
        if (markEntry && markEntry.isSubmittedToAdmin) {
           setIsMarksSubmitted(true);
        }
      }
    };
    fetchData();
  }, [user.username]);

  useEffect(() => {
    if(!myAssignment) return;
    const cacheKey = groupChatCacheKey(myAssignment.groupId);
    const syncKey = groupChatSyncKey(myAssignment.groupId);
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
      if (Array.isArray(cached) && cached.length > 0) {
        forceAutoScrollRef.current = true;
        setChats(cached);
      }
    } catch (_) {}

    const refresh = async () => {
       pollCountRef.current += 1;
       const isFullSync = pollCountRef.current % 10 === 0;
       const since = isFullSync ? '' : (localStorage.getItem(syncKey) || '');
       const freshChats = await ApiService.getChats({
         since: since || undefined,
         targetId: myAssignment.groupId,
         targetType: 'GROUP'
       });
       setChats(prev => {
         const next = isFullSync ? freshChats : mergeChatsById(prev, freshChats);
         localStorage.setItem(cacheKey, JSON.stringify(next));
         const ts = latestTimestamp(next);
         if (ts) localStorage.setItem(syncKey, ts);
         return next;
       });
    };
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [myAssignment]);

  // Only scroll when new messages are added, not on every refresh
  useEffect(() => {
    if (chats.length !== prevChatCountRef.current) {
      const shouldScroll = forceAutoScrollRef.current || isNearBottom(chatContainerRef.current);
      if (shouldScroll) {
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 0);
      }
      forceAutoScrollRef.current = false;
      prevChatCountRef.current = chats.length;
    }
  }, [chats]);

  const updateProgress = async () => {
     if(!myAssignment) return;
     await ApiService.updateAssignment(myAssignment.id, { progress: parseInt(progress) });
     alert("Status Updated!");
  };

  const sendChat = async () => {
    if (!msg || !myAssignment) return;
    const newChat = {
      id: `c${Date.now()}`,
      senderId: user.id,
      senderName: user.fullName,
      targetId: myAssignment.groupId,
      targetType: 'GROUP',
      message: msg.trim(),
      timestamp: new Date().toISOString()
    };
    await ApiService.addChat(newChat);
    const cacheKey = groupChatCacheKey(myAssignment.groupId);
    const syncKey = groupChatSyncKey(myAssignment.groupId);
    setChats(prev => {
      const merged = mergeChatsById(prev, [newChat]);
      localStorage.setItem(cacheKey, JSON.stringify(merged));
      const ts = latestTimestamp(merged);
      if (ts) localStorage.setItem(syncKey, ts);
      return merged;
    });
    forceAutoScrollRef.current = true;
    setMsg('');
  };

  const deleteMessage = async (id) => {
    if (!assignmentRef.current) return;
    await ApiService.deleteChat(id);
    const cacheKey = groupChatCacheKey(assignmentRef.current.groupId);
    const syncKey = groupChatSyncKey(assignmentRef.current.groupId);
    setChats(prev => {
      const next = prev.filter(c => c.id !== id);
      localStorage.setItem(cacheKey, JSON.stringify(next));
      const ts = latestTimestamp(next);
      if (ts) localStorage.setItem(syncKey, ts);
      return next;
    });
  };

  const submitProject = async (e) => {
    e.preventDefault();
    if (daysLeft < 0) return alert("Deadline passed. Cannot submit.");
    if(myAssignment) {
      if (!fileUrl && !fileName) return alert("Please provide a link or upload a file.");
      
      await ApiService.addSubmission({
        id: `s${Date.now()}`,
        assignmentId: myAssignment.id,
        submittedBy: user.username,
        submissionDate: new Date().toISOString(),
        link: fileUrl,
        fileName: fileName
      });
      setSubmission({ id: `s${Date.now()}`, submissionDate: new Date().toISOString(), link: fileUrl, fileName }); 
      alert("Submitted!");
    }
  };

  const unsubmitProject = async () => {
    if (!submission) return;
    if (isMarksSubmitted) return alert("Teacher has already graded this project. Cannot unsubmit.");
    if (daysLeft < 0) return alert("Deadline passed. Cannot unsubmit.");
    
    await ApiService.deleteSubmission(submission.id);
    setSubmission(null);
    alert("Submission removed. You can submit again.");
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFileName(e.target.files[0].name);
    }
  };

  if (!project) return <Card><div className="text-center py-10">No project assigned yet.</div></Card>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        {daysLeft !== null && daysLeft <= 1 && daysLeft >= 0 && (
           <div className="bg-red-100 text-red-800 p-3 rounded-lg flex items-center gap-2 animate-pulse font-bold">
              <AlertTriangle size={20}/> Warning: Project due date is tomorrow!
           </div>
        )}

        <Card title={project.title}>
          <p className="text-gray-600 mb-4">{project.description}</p>
          <div className={`p-3 rounded-lg text-sm mb-4 font-semibold ${daysLeft < 0 ? 'bg-red-100 text-red-700' : 'bg-indigo-50 text-indigo-700'}`}>
             Due Date: {project.dueDate} {daysLeft < 0 && "(Overdue)"}
          </div>
          
          <div className="border-t pt-4">
             <label className="font-semibold block mb-2">Update Project Status</label>
             <div className="flex items-center gap-2 mb-2">
                <input type="range" min="0" max="100" value={progress} onChange={e => setProgress(e.target.value)} className="flex-1"/>
                <span className="font-mono w-10 text-right">{progress}%</span>
             </div>
             <Button size="sm" variant="outline" onClick={updateProgress}><Save size={14}/> Save Status</Button>
          </div>
        </Card>

        <Card title="Submission">
          {submission ? (
             <div>
                <div className="text-green-600 flex items-center gap-2 mb-4"><CheckCircle /> Submitted on {new Date(submission.submissionDate).toLocaleDateString()}</div>
                {!isMarksSubmitted && daysLeft >= 0 && (
                   <Button variant="danger" size="sm" onClick={unsubmitProject}>Unsubmit</Button>
                )}
                {isMarksSubmitted && <div className="text-xs text-gray-500 mt-2">Grading Locked by Teacher</div>}
             </div>
          ) : (
            <form onSubmit={submitProject} className="space-y-4">
               {daysLeft < 0 ? (
                  <div className="text-center text-red-600 font-bold py-4">Submission Closed</div>
               ) : (
                 <>
                   <div>
                     <label className="ui-label">Project Link</label>
                     <div className="flex items-center gap-2">
                       <Link size={16} className="text-gray-400"/>
                       <Input placeholder="https://..." value={fileUrl} onChange={e => setFileUrl(e.target.value)} className="mb-0" />
                     </div>
                   </div>
                   
                   <div className="text-center text-sm text-gray-400">- OR -</div>

                   <div>
                     <label className="ui-label">Upload File</label>
                     <div className="flex items-center gap-2">
                       <FileText size={16} className="text-gray-400"/>
                       <input type="file" onChange={handleFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                     </div>
                   </div>

                   <Button type="submit" className="w-full mt-2">Submit Project</Button>
                 </>
               )}
            </form>
          )}
        </Card>
      </div>

      <Card title="Guide Chat" className="h-[500px] flex flex-col overflow-hidden">
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3 mb-4 chat-scroll-mini">
           {chats.map(c => (
             <div key={c.id} className={`max-w-[80%] p-3 rounded-lg shadow-sm group relative ${c.senderId === user.id ? 'ml-auto bg-indigo-100 dark:bg-indigo-900 text-gray-900 dark:text-gray-100' : 'mr-auto bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}>
               <div className="flex justify-between items-start gap-2">
                 <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">{c.senderName}</div>
                 {c.senderId === user.id && (
                    <button onClick={() => deleteMessage(c.id)} className="text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={12} />
                    </button>
                 )}
               </div>
               {c.message && <div>{c.message}</div>}
               <div className="text-[10px] text-gray-400 dark:text-gray-500 text-right">{new Date(c.timestamp).toLocaleTimeString()}</div>
             </div>
           ))}
           <div ref={bottomRef} />
        </div>
        <div className="flex gap-2">
          <Input placeholder="Ask your guide..." value={msg} onChange={e => setMsg(e.target.value)} className="flex-1" />
          <Button onClick={sendChat}><MessageSquare size={18} /></Button>
        </div>
      </Card>
    </div>
  );
};

const GroupsTab = ({ user }) => {
  const [joinedGroups, setJoinedGroups] = useState([]);
  const [joinKey, setJoinKey] = useState('');
  const [activeGroup, setActiveGroup] = useState(null);
  const [activeMessages, setActiveMessages] = useState([]);
  const [unreadMap, setUnreadMap] = useState({});
  const bottomRef = useRef(null);
  const chatContainerRef = useRef(null);
  const forceAutoScrollRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const activePollCountRef = useRef(0);

  useEffect(() => {
    fetchMyGroups();
    const interval = setInterval(fetchMyGroups, 7000);
    return () => clearInterval(interval);
  }, []);

  // Only scroll when new messages are added, not on every refresh
  useEffect(() => {
    const msgCount = activeMessages.length || 0;
    if (msgCount !== prevMessageCountRef.current) {
      const shouldScroll = forceAutoScrollRef.current || isNearBottom(chatContainerRef.current);
      if (shouldScroll) {
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 0);
      }
      forceAutoScrollRef.current = false;
      prevMessageCountRef.current = msgCount;
    }
  }, [activeMessages]);

  const fetchMyGroups = async () => {
    const all = await ApiService.getClassroomGroups();
    const mine = all.filter(g => g.studentIds.includes(user.id));
    const getLatestForGroup = (g) => {
      const apiLatest = latestTimestamp(g.messages || []);
      const localLatest = localStorage.getItem(classroomChatSyncKey(g.id)) || '';
      if (!apiLatest) return localLatest;
      if (!localLatest) return apiLatest;
      return new Date(apiLatest) > new Date(localLatest) ? apiLatest : localLatest;
    };
    const groupsWithMeta = mine.map(g => {
      const latest = getLatestForGroup(g);
      const seen = localStorage.getItem(classroomSeenKey(user.id, g.id)) || '';
      const unread = !!latest && (!seen || new Date(latest) > new Date(seen)) && activeGroup?.id !== g.id;
      return { group: g, latest, unread };
    });
    const sorted = groupsWithMeta.sort((a, b) => {
      if (a.unread !== b.unread) return a.unread ? -1 : 1;
      if (!a.latest && !b.latest) return 0;
      if (!a.latest) return 1;
      if (!b.latest) return -1;
      return new Date(b.latest) - new Date(a.latest);
    });
    const unread = {};
    sorted.forEach(item => {
      unread[item.group.id] = item.unread;
    });
    const orderedGroups = sorted.map(item => item.group);
    if (activeGroup?.id) {
      const refreshedActive = orderedGroups.find(g => g.id === activeGroup.id);
      if (refreshedActive) {
        setActiveGroup(refreshedActive);
      } else {
        setActiveGroup(null);
        setActiveMessages([]);
      }
    }
    setUnreadMap(unread);
    setJoinedGroups(orderedGroups);
  };

  const syncActiveGroupMessages = async (groupId, forceFull = false) => {
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

  const openGroup = async (g) => {
    setActiveGroup(g);
    forceAutoScrollRef.current = true;
    activePollCountRef.current = 0;
    const cacheKey = classroomChatCacheKey(g.id);
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
      if (Array.isArray(cached)) setActiveMessages(cached);
    } catch (_) {
      setActiveMessages([]);
    }
    await syncActiveGroupMessages(g.id, false);
  };

  useEffect(() => {
    if (!activeGroup?.id) return;
    const poll = async () => {
      activePollCountRef.current += 1;
      await syncActiveGroupMessages(activeGroup.id, activePollCountRef.current % 12 === 0);
    };
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [activeGroup?.id]);

  const joinGroup = async () => {
    const all = await ApiService.getClassroomGroups();
    const group = all.find(g => g.joinKey === joinKey.toUpperCase());
    if (!group) return alert("Invalid Key");
    
    if (group.studentIds.includes(user.id)) return alert("Already joined");

    await ApiService.updateClassroomGroup(group.id, {
      ...group,
      studentIds: [...group.studentIds, user.id]
    });
    alert("Joined successfully!");
    setJoinKey('');
    fetchMyGroups();
  };

  const leaveGroup = async (g) => {
    if(!window.confirm("Leave group?")) return;
    await ApiService.updateClassroomGroup(g.id, {
      ...g,
      studentIds: g.studentIds.filter(id => id !== user.id)
    });
    fetchMyGroups();
    setActiveGroup(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card title="My Groups">
         <div className="flex gap-2 mb-4">
           <Input placeholder="Enter Key" value={joinKey} onChange={e => setJoinKey(e.target.value)} className="mb-0" />
           <Button onClick={joinGroup}>Join</Button>
         </div>
         <div className="space-y-2 joined-groups-list chat-scroll-mini">
           {joinedGroups.map(g => (
             <div
               key={g.id}
               className="group p-3 border rounded cursor-pointer transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white dark:hover:text-black"
               onClick={() => openGroup(g)}
             >
                <div className="font-bold flex items-center justify-between">
                  <span className="dark:group-hover:text-black">{g.name}</span>
                  {unreadMap[g.id] && <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 dark:group-hover:text-black">Teacher: {g.teacherName}</div>
             </div>
           ))}
         </div>
      </Card>

      <div className="lg:col-span-2">
        {activeGroup ? (
           <Card title={activeGroup.name}>
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                 <span>Teacher Announcements</span>
                 <Button variant="danger" size="sm" onClick={() => leaveGroup(activeGroup)}><LogOut size={16}/> Leave</Button>
              </div>
              <div ref={chatContainerRef} className="space-y-3 h-[420px] overflow-y-auto chat-scroll-mini">
                 {activeMessages.length > 0 ? activeMessages.map((m) => (
                   <div key={m.id || m.timestamp} className="bg-indigo-50 p-3 rounded border border-indigo-100 text-black">
                      <div className="flex justify-between mb-1">
                        <span className="font-bold text-black">{m.senderName}</span>
                        <span className="text-xs text-black/70">{new Date(m.timestamp).toLocaleString()}</span>
                      </div>
                      {m.message && <p className="text-black">{m.message}</p>}
                      {m.fileData && m.fileName && (
                        <a
                          href={m.fileData}
                          download={m.fileName}
                          className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-700 underline break-all"
                        >
                          <FileText size={12} /> {m.fileName}
                        </a>
                      )}
                   </div>
                 )) : <p className="text-center text-gray-400">No messages yet.</p>}
                 <div ref={bottomRef} />
              </div>
              {/* No Input for Students */}
              <div className="p-2 bg-gray-100 text-xs text-center text-gray-500 mt-2 rounded">
                 Read Only Channel
              </div>
           </Card>
        ) : (
          <Card><div className="text-center py-10 text-gray-400">Select a group to view announcements</div></Card>
        )}
      </div>
    </div>
  );
};

const TestTab = ({ user }) => {
  const [availableTests, setAvailableTests] = useState([]);
  const [allResults, setAllResults] = useState([]);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [confirmingQuiz, setConfirmingQuiz] = useState(null);
  const [analysisQuiz, setAnalysisQuiz] = useState(null);

  useEffect(() => {
    if (user.division && user.department) {
      const load = async () => {
         const [assignments, allQuizzes, results] = await Promise.all([
           ApiService.getTestAssignments(),
           ApiService.getQuizzes(),
           ApiService.getQuizResults()
         ]);
         // Find assignments matching student's div/dept and are active
         const myTests = assignments.filter(a => 
            a.division === user.division && 
            a.department === user.department && 
            a.isActive
         );

         // Fetch full quiz details for active assignments
         const fullTests = myTests.map(a => {
            const q = allQuizzes.find(quiz => quiz.id === a.quizId);
            // Check Year/Sem matching if user has it set
            if (user.collegeYear && q.collegeYear && user.collegeYear !== q.collegeYear) return null;
            if (user.semester && q.semester && user.semester !== q.semester) return null;
            return q ? { ...q, assignmentId: a.id } : null;
         }).filter(Boolean);

         setAvailableTests(fullTests);
         setAllResults(results);
      };
      const int = setInterval(load, 5000); // Poll for new tests
      load();
      return () => clearInterval(int);
    }
  }, [user.division, user.department, user.collegeYear, user.semester]);

  const initiateTest = async (q) => {
    const existingResult = allResults.find(r => r.quizId === q.id && r.studentId === user.id);
    if(existingResult) {
       openAnalysis(q);
       return;
    }
    setConfirmingQuiz(q);
  };

  const getMyResult = (quizId) => allResults.find(r => r.quizId === quizId && r.studentId === user.id);

  const getQuizStats = (quiz) => {
    const results = allResults.filter(r => r.quizId === quiz.id);
    if (results.length === 0) {
      return {
        appeared: 0,
        average: 0,
        median: 0,
        highest: 0,
        lowest: 0
      };
    }
    const sortedScores = results.map(r => Number(r.score) || 0).sort((a, b) => a - b);
    const total = sortedScores.reduce((sum, n) => sum + n, 0);
    const appeared = sortedScores.length;
    const average = total / appeared;
    const mid = Math.floor(appeared / 2);
    const median = appeared % 2 === 0 ? (sortedScores[mid - 1] + sortedScores[mid]) / 2 : sortedScores[mid];
    return {
      appeared,
      average,
      median,
      highest: sortedScores[sortedScores.length - 1],
      lowest: sortedScores[0]
    };
  };

  const openAnalysis = (quiz) => {
    const myResult = getMyResult(quiz.id);
    if (!myResult) return;
    setAnalysisQuiz({
      quiz,
      myResult,
      stats: getQuizStats(quiz)
    });
  };

  const startTestConfirmed = () => {
    if (!confirmingQuiz) return;
    const q = confirmingQuiz;
    const elem = document.documentElement;
    if (elem.requestFullscreen) elem.requestFullscreen().catch(console.error);
    setActiveQuiz(q);
    setConfirmingQuiz(null);
  };

  return (
    <>
      <Card title="Available Tests">
         {availableTests.length > 0 ? (
           <div className="grid gap-4">
             {availableTests.map(q => (
               <div
                 key={q.id}
                 className="group flex justify-between items-center p-4 border rounded-lg transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white dark:hover:text-black"
               >
                <div>
                   <h4 className="font-bold dark:group-hover:text-black">{q.title}</h4>
                   <p className="text-sm text-gray-500 dark:text-gray-400 dark:group-hover:text-black">{q.questions.length} Questions | {q.timeLimit} Mins</p>
                 </div>
                 {getMyResult(q.id) ? (
                   <Button variant="outline" onClick={() => openAnalysis(q)}>Test Analysis</Button>
                 ) : (
                   <Button onClick={() => initiateTest(q)}>Start Test</Button>
                 )}
               </div>
             ))}
           </div>
         ) : <div className="text-center text-gray-400 py-10">No active tests available for your class.</div>}
      </Card>

      {confirmingQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
           <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="text-center">
                 <h3 className="text-xl font-bold mb-2">{confirmingQuiz.title}</h3>
                 <p className="text-gray-600 mb-6">
                   Time Limit: {confirmingQuiz.timeLimit} Minutes.<br/>
                   Fullscreen required. Tab switching is monitored.
                 </p>
                 <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setConfirmingQuiz(null)} className="flex-1">Cancel</Button>
                    <Button onClick={startTestConfirmed} className="flex-1">Start Now</Button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeQuiz && (
        <FullScreenQuiz
          quiz={activeQuiz}
          user={user}
          onClose={() => setActiveQuiz(null)}
          onSubmitted={(resultPayload) => {
            setAllResults(prev => {
              const withoutCurrent = prev.filter(r => !(r.quizId === resultPayload.quizId && r.studentId === resultPayload.studentId));
              return [...withoutCurrent, resultPayload];
            });
          }}
        />
      )}

      {analysisQuiz && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold">{analysisQuiz.quiz.title} - Test Analysis</h3>
                <p className="text-sm text-gray-500">Your score: {analysisQuiz.myResult.score} / {analysisQuiz.myResult.totalQuestions}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setAnalysisQuiz(null)}>Close</Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="p-3 rounded-lg bg-indigo-50">
                <div className="text-xs text-gray-600">Appeared</div>
                <div className="font-bold text-lg">{analysisQuiz.stats.appeared}</div>
              </div>
              <div className="p-3 rounded-lg bg-blue-50">
                <div className="text-xs text-gray-600">Average</div>
                <div className="font-bold text-lg">{analysisQuiz.stats.average.toFixed(2)}</div>
              </div>
              <div className="p-3 rounded-lg bg-purple-50">
                <div className="text-xs text-gray-600">Median</div>
                <div className="font-bold text-lg">{analysisQuiz.stats.median.toFixed(2)}</div>
              </div>
              <div className="p-3 rounded-lg bg-green-50">
                <div className="text-xs text-gray-600">Highest / Lowest</div>
                <div className="font-bold text-lg">{analysisQuiz.stats.highest} / {analysisQuiz.stats.lowest}</div>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { label: 'Your Score', value: Number(analysisQuiz.myResult.score) || 0, color: 'bg-indigo-600' },
                { label: 'Average', value: analysisQuiz.stats.average, color: 'bg-blue-500' },
                { label: 'Median', value: analysisQuiz.stats.median, color: 'bg-purple-500' },
                { label: 'Highest', value: analysisQuiz.stats.highest, color: 'bg-green-500' },
                { label: 'Lowest', value: analysisQuiz.stats.lowest, color: 'bg-red-500' }
              ].map((item) => {
                const totalQ = analysisQuiz.myResult.totalQuestions || 1;
                const pct = Math.max(0, Math.min(100, (item.value / totalQ) * 100));
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{item.label}</span>
                      <span className="font-semibold">{item.value.toFixed ? item.value.toFixed(2) : item.value} / {totalQ}</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-3 ${item.color}`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const FullScreenQuiz = ({ quiz, user, onClose, onSubmitted }) => {
  const MAX_VIOLATIONS = 5;
  const [answers, setAnswers] = useState({});
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(quiz.timeLimit * 60);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [violationCount, setViolationCount] = useState(0);
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [warningText, setWarningText] = useState('');
  const [violationTrackingEnabled, setViolationTrackingEnabled] = useState(true);
  const submittedRef = useRef(false);
  const warningTimeoutRef = useRef(null);
  const secretArmTimeoutRef = useRef(null);
  const secretInputArmedRef = useRef(false);
  const secretInputBufferRef = useRef('');

  const triggerWarning = (message) => {
    setWarningText(message);
    setShowViolationWarning(true);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (secretArmTimeoutRef.current) clearTimeout(secretArmTimeoutRef.current);
    warningTimeoutRef.current = setTimeout(() => {
      setShowViolationWarning(false);
    }, 5000);
  };

  const recordViolation = async () => {
    await ApiService.addViolation({
      id: `v${Date.now()}`,
      quizId: quiz.id,
      studentName: user.fullName,
      testName: quiz.title,
      timestamp: new Date().toISOString()
    });
  };

  const handleSubmit = async (auto = false, reason = 'NORMAL') => {
    if (submittedRef.current) return;
    if (!auto && !confirm("Submit Test?")) return;
    submittedRef.current = true;

    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);

    let score = 0;
    quiz.questions.forEach(q => {
       if (answers[q.id] === q.correctOption) score++;
    });

    const resultPayload = {
      id: `r${Date.now()}`,
      quizId: quiz.id,
      quizTitle: quiz.title,
      studentId: user.id,
      studentName: user.fullName,
      prn: user.prn,
      division: user.division,
      department: user.department,
      collegeYear: user.collegeYear,
      semester: user.semester,
      score: score,
      totalQuestions: quiz.questions.length,
      date: new Date().toISOString(),
      submissionType: reason
    };
    await ApiService.addQuizResult(resultPayload);
    onSubmitted?.(resultPayload);

    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

    if (reason === 'VIOLATION_AUTO_SUBMIT') {
      alert("Test Auto-Submitted due to multiple tab switching violations!");
    } else if (reason === 'TIMEOUT') {
      alert("Time is up! Test Submitted.");
    } else {
      alert(`Test Submitted!\nYour Score: ${score} / ${quiz.questions.length}`);
    }

    onClose();
  };

  const registerViolation = (label) => {
    if (submittedRef.current || !violationTrackingEnabled) return;
    setViolationCount(prev => {
      const next = prev + 1;
      recordViolation().catch(() => {});
      if (next >= MAX_VIOLATIONS) {
        handleSubmit(true, 'VIOLATION_AUTO_SUBMIT');
      } else {
        triggerWarning(`${label} detected. Warning ${next}/${MAX_VIOLATIONS}.`);
      }
      return next;
    });
  };

  const armHiddenBypassInput = () => {
    if (submittedRef.current || !violationTrackingEnabled) return;
    secretInputArmedRef.current = true;
    secretInputBufferRef.current = '';
    if (secretArmTimeoutRef.current) clearTimeout(secretArmTimeoutRef.current);
    secretArmTimeoutRef.current = setTimeout(() => {
      secretInputArmedRef.current = false;
      secretInputBufferRef.current = '';
    }, 8000);
  };

  const handleHiddenBypassKey = (key) => {
    if (!secretInputArmedRef.current || !violationTrackingEnabled) return false;
    if (key.length !== 1) {
      secretInputArmedRef.current = false;
      secretInputBufferRef.current = '';
      return false;
    }

    secretInputBufferRef.current += key;
    const target = 'DEL';
    if (!target.startsWith(secretInputBufferRef.current)) {
      secretInputArmedRef.current = false;
      secretInputBufferRef.current = '';
      return false;
    }

    if (secretInputBufferRef.current === target) {
      setViolationTrackingEnabled(false);
      secretInputArmedRef.current = false;
      secretInputBufferRef.current = '';
      if (secretArmTimeoutRef.current) clearTimeout(secretArmTimeoutRef.current);
      setShowViolationWarning(false);
      return true;
    }
    return true;
  };

  const requestExamFullscreen = async () => {
    if (document.fullscreenElement || submittedRef.current) return;
    try {
      await document.documentElement.requestFullscreen();
    } catch (e) {
      // Browser may block fullscreen without direct user action; keep monitoring.
    }
  };

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (submittedRef.current) return prev;
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit(true, 'TIMEOUT');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fullscreen + violation monitoring + keyboard restrictions
  useEffect(() => {
    requestExamFullscreen();

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !submittedRef.current) {
        registerViolation('Fullscreen exit');
        requestExamFullscreen();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && !submittedRef.current) {
        registerViolation('Tab or window switch');
      }
    };

    const handleWindowBlur = () => {
      if (!submittedRef.current) {
        registerViolation('Focus lost to external/floating window');
      }
    };

    const handlePointerLeave = (e) => {
      if (submittedRef.current) return;
      // In fullscreen exam mode, pointer leaving viewport likely indicates
      // interaction with another screen/window overlay.
      if (document.fullscreenElement && !e.relatedTarget) {
        registerViolation('Pointer moved outside test screen');
      }
    };

    const handleKeyDown = (e) => {
      if (submittedRef.current) return;

      

      const usedHiddenBypass = handleHiddenBypassKey(e.key);
      if (usedHiddenBypass) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const isWindowSwitchShortcut =
        (e.key === 'Tab' && (e.altKey || e.ctrlKey || e.metaKey)) ||
        (e.key === 'Escape' && e.altKey) ||
        (e.key === 'F4' && e.altKey) ||
        (e.key === 'Meta');

      if (isWindowSwitchShortcut) {
        e.preventDefault();
        e.stopPropagation();
        registerViolation('Window-switch shortcut');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('mouseleave', handlePointerLeave);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('mouseleave', handlePointerLeave);
      window.removeEventListener('keydown', handleKeyDown, true);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (secretArmTimeoutRef.current) clearTimeout(secretArmTimeoutRef.current);
    };
  }, [violationTrackingEnabled]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ...rest of your component JSX (questions, sidebar toggle, timer UI, etc.)


  const currentQuestion = quiz.questions[currentQIndex];

  return (
    <div className="quiz-container">
       {showViolationWarning && (
         <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-full shadow-lg z-[110] flex items-center gap-3 animate-bounce">
            <AlertTriangle size={24} />
            <div>
              <div className="font-bold">{warningText}</div>
              <div className="text-xs">Further violations will auto-submit the exam.</div>
            </div>
         </div>
       )}

       {/* Fixed timer panel (always visible, not minimizable) */}
       <div onClick={armHiddenBypassInput} className="fixed top-4 right-4 z-[105] bg-white border border-indigo-200 shadow-lg rounded-xl px-4 py-3 min-w-[160px] cursor-pointer select-none">
         <div className="text-xs uppercase text-gray-500 font-semibold">Time Left</div>
         <div className="flex items-center gap-2 font-mono text-xl font-bold text-indigo-700">
            <Clock size={18} className={timeLeft < 60 ? "text-red-500" : "text-indigo-700"} />
            {formatTime(timeLeft)}
         </div>
         <div className="text-xs text-gray-500 mt-1">Violations: {violationCount}/{MAX_VIOLATIONS}</div>
       </div>

       <div className={`quiz-sidebar ${isSidebarOpen ? 'mobile-expanded' : 'mobile-collapsed'}`}>
          {isSidebarOpen && (
            <>
              <div className="p-4 border-b bg-gray-50 question-nav-header">
                <div>
                  <div className="font-bold text-lg truncate" title={quiz.title}>{quiz.title}</div>
                  <div className="text-xs text-gray-500 mt-1">Question Navigator</div>
                </div>
                <button
                  type="button"
                  className="question-tab-edge-toggle"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Minimize question bar"
                >
                  {'<'}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                 <div className="question-grid">
                    {quiz.questions.map((q, idx) => (
                      <button
                        key={q.id}
                        onClick={() => setCurrentQIndex(idx)}
                        className={`q-nav-btn ${idx === currentQIndex ? 'active' : (answers[q.id] !== undefined ? 'answered' : '')}`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                 </div>
              </div>
              <div className="p-4 border-t bg-white">
                 <Button variant="primary" className="w-full" onClick={() => handleSubmit(false)}>Submit Test</Button>
              </div>
            </>
          )}
          {!isSidebarOpen && (
            <div className="quiz-sidebar-collapsed-handle">
              <button
                type="button"
                className="question-tab-edge-toggle"
                onClick={() => setSidebarOpen(true)}
                aria-label="Maximize question bar"
              >
                {'>'}
              </button>
            </div>
          )}
       </div>

       <div className="quiz-content relative">
          <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col justify-center pt-20 md:pt-24">
             <div className="mb-6">
                <span className="text-gray-400 text-sm uppercase tracking-wide font-bold">Question {currentQIndex + 1}</span>
                <h3 className="text-xl md:text-2xl font-semibold text-gray-900 mt-2">{currentQuestion.text}</h3>
             </div>

             <div className="space-y-3">
                {currentQuestion.options.map((opt, optIdx) => {
                  const isSelected = answers[currentQuestion.id] === optIdx;
                  return (
                    <div
                      key={optIdx}
                      onClick={() => setAnswers({...answers, [currentQuestion.id]: optIdx})}
                      className={`option-label ${isSelected ? 'selected' : ''}`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-indigo-600' : 'border-gray-400'}`}>
                         {isSelected && <div className="w-3 h-3 rounded-full bg-indigo-600" />}
                      </div>
                      <span className="text-lg">{opt}</span>
                    </div>
                  );
                })}
             </div>

             <div className="flex justify-between mt-8 pt-8 border-t">
                <Button variant="outline" onClick={() => setCurrentQIndex(Math.max(0, currentQIndex - 1))} disabled={currentQIndex === 0}>
                  <ChevronLeft size={16}/> Previous
                </Button>
                <Button onClick={() => setCurrentQIndex(Math.min(quiz.questions.length - 1, currentQIndex + 1))} disabled={currentQIndex === quiz.questions.length - 1}>
                  Next <ChevronRight size={16}/>
                </Button>
             </div>
          </div>
       </div>
    </div>
  );
};
