import React, { useEffect, useState, useRef } from 'react';
import { Layout } from '../components/Layout.jsx';
import { Card, Button, Input, Badge, Select } from '../components/UI.jsx';
import { ApiService } from '../services/api.js';
import { YEARS, getSemestersForYear } from '../constants.js';
import { CheckCircle, MessageSquare, Trash2, ChevronLeft, ChevronRight, AlertTriangle, Clock, LogOut, Link, FileText, Save, CalendarDays } from 'lucide-react';

const groupChatCacheKey = (groupId) => `group_chat_cache_${groupId}`;
const groupChatSyncKey = (groupId) => `group_chat_sync_${groupId}`;
const classroomChatCacheKey = (groupId) => `classroom_chat_cache_${groupId}`;
const classroomChatSyncKey = (groupId) => `classroom_chat_sync_${groupId}`;
const classroomSeenKey = (userId, groupId) => `student_group_seen_${userId}_${groupId}`;
const studentTimetableCacheKey = (userId) => `student_timetable_cache_${userId}`;
const studentGroupsCacheKey = (userId) => `student_groups_cache_${userId}`;
const studentProjectCacheKey = (userId) => `student_project_cache_${userId}`;
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
const TIMETABLE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIMETABLE_SLOT_HOURS = [9, 10, 11, 12, 13, 14, 15, 16];
const formatHour12 = (hour24) => {
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:00 ${period}`;
};
const TIMETABLE_SLOTS = TIMETABLE_SLOT_HOURS.map(h => `${formatHour12(h)} - ${formatHour12(h + 1)}`);
const keyForSlot = (day, slotIndex) => `${day}|${slotIndex}`;
const createSlotGrid = (entries = []) => {
  const grid = {};
  entries.forEach(entry => {
    for (let i = 0; i < (entry.duration || 1); i++) {
      grid[keyForSlot(entry.day, entry.slotIndex + i)] = { ...entry, isContinuation: i > 0 };
    }
  });
  return grid;
};

export const StudentDashboard = ({ user, onLogout, onUserUpdate }) => {
  const [activeTab, setActiveTab] = useState('PROJECT');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState({ collegeYear: '', semester: '' });
  const semesterOptions = getSemestersForYear(profileData.collegeYear);

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

  useEffect(() => {
    if (!profileData.collegeYear) return;
    const valid = getSemestersForYear(profileData.collegeYear);
    if (!valid.includes(String(profileData.semester))) {
      setProfileData(prev => ({ ...prev, semester: valid[0] || '' }));
    }
  }, [profileData.collegeYear]);

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
        {['PROJECT', 'GROUPS', 'TEST', 'TIMETABLE'].map(tab => (
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
        {activeTab === 'TIMETABLE' && <StudentTimetableTab user={user} />}
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
                    options={YEARS.map(y => ({value:y, label: `${y} Year`}))}
                    value={profileData.collegeYear}
                    onChange={e => setProfileData({...profileData, collegeYear: e.target.value})}
                 />
                 <Select 
                    label="Semester"
                    options={semesterOptions.map(s => ({value:s, label: `Semester ${s}`}))}
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
  const semesterOptions = getSemestersForYear(profileData.collegeYear);
  return (
    <Card title="Profile">
      <div className="max-w-md space-y-4">
        <p className="text-sm text-gray-500">Update your academic details.</p>
        <Select
          label="College Year"
          options={YEARS.map(y => ({ value: y, label: `${y} Year` }))}
          value={profileData.collegeYear}
          onChange={e => setProfileData({ ...profileData, collegeYear: e.target.value })}
        />
        <Select
          label="Semester"
          options={semesterOptions.map(s => ({ value: s, label: `Semester ${s}` }))}
          value={profileData.semester}
          onChange={e => setProfileData({ ...profileData, semester: e.target.value })}
        />
        <Button onClick={onSave}>Save Profile</Button>
      </div>
    </Card>
  );
};

const StudentTimetableTab = ({ user }) => {
  const [allTimetables, setAllTimetables] = useState([]);

  useEffect(() => {
    const cacheKey = studentTimetableCacheKey(user.id);
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || '{}');
      if (Array.isArray(cached.rows)) setAllTimetables(cached.rows);
    } catch (_) {}

    const load = async () => {
      const rows = await ApiService.getTimetables();
      const nextRows = rows || [];
      setAllTimetables(nextRows);
      localStorage.setItem(cacheKey, JSON.stringify({ rows: nextRows, fetchedAt: new Date().toISOString() }));
    };

    // Single sync on mount; avoid aggressive polling.
    load();
  }, [user.id]);

  const timetable = allTimetables.find(tt => (
    tt.department === user.department &&
    String(tt.collegeYear) === String(user.collegeYear || '') &&
    String(tt.semester) === String(user.semester || '') &&
    tt.division === user.division
  ));
  const grid = createSlotGrid(timetable?.entries || []);
  const lunchSlot = Number.isInteger(timetable?.lunchSlotIndex) ? timetable.lunchSlotIndex : 3;

  return (
    <Card title="Timetable">
      <div className="flex items-center gap-2 text-sm text-indigo-700 mb-3">
        <CalendarDays size={16} />
        Showing your class only: {user.department || 'N/A'} | Year {user.collegeYear || '-'} | Sem {user.semester || '-'} | Div {user.division || '-'}
      </div>

      {timetable ? (
        <div className="table-wrapper timetable-table-wrap">
          <table className="w-full timetable-table">
            <thead>
              <tr>
                <th>Time</th>
                {TIMETABLE_DAYS.map(day => <th key={day}>{day}</th>)}
              </tr>
            </thead>
            <tbody>
              {TIMETABLE_SLOTS.map((slot, slotIndex) => (
                <tr key={slot}>
                  <td className="time-col">{slot}</td>
                  {TIMETABLE_DAYS.map(day => {
                    const cell = grid[keyForSlot(day, slotIndex)];
                  return (
                      <td key={`${day}_${slotIndex}`} className="timetable-cell">
                        {slotIndex === lunchSlot ? (
                          <div className="tt-lunch-label">Lunch Break</div>
                        ) : cell ? (
                          <div className="tt-block" style={{ backgroundColor: cell.color || '#e2e8f0' }}>
                            <div className="tt-title">{cell.subjectName}{cell.isContinuation ? ' (cont.)' : ''}</div>
                            {!cell.isContinuation && <div className="tt-meta">{cell.teacherName} | {cell.type}</div>}
                          </div>
                        ) : (
                          <span className="tt-empty">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-sm text-gray-500">No timetable assigned for your class yet.</div>
      )}
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
  const [topicName, setTopicName] = useState('');
  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaRecord, setIdeaRecord] = useState(null);
  const [groupInfo, setGroupInfo] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isMarksSubmitted, setIsMarksSubmitted] = useState(false);
  const [daysLeft, setDaysLeft] = useState(null);
  const bottomRef = useRef(null);
  const chatContainerRef = useRef(null);
  const forceAutoScrollRef = useRef(true);
  const prevChatCountRef = useRef(0);
  const assignmentRef = useRef(null);
  const resetProjectState = (projectCacheKey) => {
    const previousGroupId = assignmentRef.current?.groupId;
    setMyAssignment(null);
    assignmentRef.current = null;
    setProject(null);
    setChats([]);
    setMsg('');
    setSubmission(null);
    setFileUrl('');
    setFileName('');
    setTopicName('');
    setIdeaTitle('');
    setIdeaRecord(null);
    setGroupInfo(null);
    setProgress(0);
    setIsMarksSubmitted(false);
    setDaysLeft(null);
    localStorage.removeItem(projectCacheKey);
    if (previousGroupId) {
      localStorage.removeItem(groupChatCacheKey(previousGroupId));
      localStorage.removeItem(groupChatSyncKey(previousGroupId));
    }
  };

  useEffect(() => {
    const projectCacheKey = studentProjectCacheKey(user.id);
    try {
      const cached = JSON.parse(localStorage.getItem(projectCacheKey) || '{}');
      if (cached.myAssignment) {
        setMyAssignment(cached.myAssignment);
        assignmentRef.current = cached.myAssignment;
      }
      if (cached.project) setProject(cached.project);
      if (cached.submission) {
        setSubmission(cached.submission);
        setTopicName(cached.submission.topicName || '');
      }
      if (cached.ideaRecord) {
        setIdeaRecord(cached.ideaRecord);
        setIdeaTitle(cached.ideaRecord.ideaTitle || '');
      }
      if (cached.groupInfo) setGroupInfo(cached.groupInfo);
      if (typeof cached.progress === 'number') setProgress(cached.progress);
      if (typeof cached.isMarksSubmitted === 'boolean') setIsMarksSubmitted(cached.isMarksSubmitted);
      if (typeof cached.daysLeft === 'number') setDaysLeft(cached.daysLeft);
    } catch (_) {}

    const fetchData = async () => {
      const assign = await ApiService.getAssignmentForStudent(user.username, { force: true });
      if (!assign) {
        resetProjectState(projectCacheKey);
        return;
      }

      const proj = await ApiService.getProjectById(assign.projectId);
      if (!proj || !proj.guideId) {
        resetProjectState(projectCacheKey);
        return;
      }

      setMyAssignment(assign);
      assignmentRef.current = assign;
      setProject(proj);
      setProgress(assign.progress || 0);

      let computedDays = null;
      if (proj.dueDate) {
        const due = new Date(proj.dueDate);
        const diff = due - new Date();
        computedDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
      }
      setDaysLeft(computedDays);

      const [subs, marks, groups, ideas] = await Promise.all([
        ApiService.getSubmissions({ force: true }),
        ApiService.getMarks({ force: true }),
        ApiService.getGroups({ force: true }),
        ApiService.getProjectIdeas({ force: true })
      ]);
      const sub = subs.find(s => s.assignmentId === assign.id);
      setSubmission(sub || null);
      setTopicName(sub?.topicName || '');

      const idea = ideas.find(i => i.assignmentId === assign.id);
      setIdeaRecord(idea || null);
      setIdeaTitle(idea?.ideaTitle || '');

      const group = groups.find(g => g.id === assign.groupId);
      setGroupInfo(group || null);

      const markEntry = marks.find(m => m.projectId === proj.id && m.groupId === assign.groupId);
      const submittedToAdmin = !!(markEntry && markEntry.isSubmittedToAdmin);
      setIsMarksSubmitted(submittedToAdmin);

      localStorage.setItem(projectCacheKey, JSON.stringify({
        myAssignment: assign,
        project: proj,
        submission: sub || null,
        ideaRecord: idea || null,
        groupInfo: group || null,
        progress: assign.progress || 0,
        isMarksSubmitted: submittedToAdmin,
        daysLeft: typeof computedDays === 'number' ? computedDays : null,
        fetchedAt: new Date().toISOString()
      }));
    };
    fetchData();
  }, [user.id, user.username]);

  useEffect(() => {
    if(!myAssignment) {
      setChats([]);
      return;
    }
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
       const since = localStorage.getItem(syncKey) || '';
       const freshChats = await ApiService.getChats({
         since: since || undefined,
         targetId: myAssignment.groupId,
         targetType: 'GROUP'
       });
       setChats(prev => {
         const next = mergeChatsById(prev, freshChats);
         localStorage.setItem(cacheKey, JSON.stringify(next));
         const ts = latestTimestamp(next);
         if (ts) localStorage.setItem(syncKey, ts);
         return next;
       });
    };
    refresh();
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

  const submitIdea = async (e) => {
    e.preventDefault();
    if (!myAssignment) return;
    if (!ideaTitle.trim()) return alert("Please enter a project idea/title.");
    const payload = {
      id: ideaRecord?.id || `pi${Date.now()}`,
      assignmentId: myAssignment.id,
      groupId: myAssignment.groupId,
      submittedBy: user.username,
      ideaTitle: ideaTitle.trim(),
      submittedAt: ideaRecord?.submittedAt || new Date().toISOString(),
      status: 'PENDING'
    };
    if (ideaRecord?.id) {
      const updated = await ApiService.updateProjectIdea(ideaRecord.id, { ...ideaRecord, ...payload });
      setIdeaRecord(updated || payload);
    } else {
      const created = await ApiService.addProjectIdea(payload);
      setIdeaRecord(created || payload);
    }
    alert("Idea submitted for review.");
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
      if (!topicName.trim()) return alert("Please enter your project/topic name.");
      
      await ApiService.addSubmission({
        id: `s${Date.now()}`,
        assignmentId: myAssignment.id,
        submittedBy: user.username,
        submissionDate: new Date().toISOString(),
        topicName: topicName.trim(),
        link: fileUrl,
        fileName: fileName
      });
      setSubmission({ id: `s${Date.now()}`, submissionDate: new Date().toISOString(), topicName: topicName.trim(), link: fileUrl, fileName }); 
      alert("Submitted!");
    }
  };

  const updateTopic = async () => {
    if (!submission) return;
    if (!topicName.trim()) return alert('Topic name required.');
    const updated = await ApiService.updateSubmission(submission.id, { ...submission, topicName: topicName.trim() });
    setSubmission(updated || { ...submission, topicName: topicName.trim() });
    alert('Topic updated.');
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
          <div className="text-sm text-gray-700 mb-4">
            Group No: {groupInfo?.groupNo ?? '-'}
          </div>
          
           <div className="border-t pt-4">
             <label className="font-semibold block mb-2 text-black" htmlFor="project_progress">Update Project Status</label>
             <div className="flex items-center gap-2 mb-2">
                <input id="project_progress" name="project_progress" type="range" min="0" max="100" value={progress} onChange={e => setProgress(e.target.value)} className="flex-1"/>
                <span className="font-mono w-10 text-right text-black">{progress}%</span>
             </div>
             <Button size="sm" variant="outline" onClick={updateProgress}><Save size={14}/> Save Status</Button>
          </div>
        </Card>

        <Card title="Idea Submission">
          <form onSubmit={submitIdea} className="space-y-3">
            {ideaRecord && (
              <div className="flex items-center gap-2 text-sm">
                <Badge color={ideaRecord.status === 'APPROVED' ? 'green' : ideaRecord.status === 'CHANGES_REQUESTED' ? 'red' : 'yellow'}>
                  {ideaRecord.status || 'PENDING'}
                </Badge>
                <span className="text-gray-500">Submitted: {new Date(ideaRecord.submittedAt).toLocaleDateString()}</span>
              </div>
            )}
            <Input
              label="Project Idea / Title"
              placeholder="Enter your idea/title for guide review"
              value={ideaTitle}
              onChange={e => setIdeaTitle(e.target.value)}
            />
            <Button type="submit" variant="secondary" className="text-black">Submit Idea</Button>
            <div className="text-xs text-gray-500">Your guide can review this before final project submission.</div>
          </form>
        </Card>

        <Card title="Submission">
          {submission ? (
             <div>
                <div className="text-green-600 flex items-center gap-2 mb-4"><CheckCircle /> Submitted on {new Date(submission.submissionDate).toLocaleDateString()}</div>
                <div className="mb-3">
                  <div className="flex gap-2">
                    <Input label="Project / Topic Name" value={topicName} onChange={e => setTopicName(e.target.value)} className="mb-0 flex-1" />
                    {!isMarksSubmitted && <Button size="sm" variant="outline" onClick={updateTopic}>Save Topic</Button>}
                  </div>
                </div>
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
                     <Input label="Project / Topic Name" placeholder="Enter selected project name/topic" value={topicName} onChange={e => setTopicName(e.target.value)} />
                   </div>
                   <div>
                     <div className="flex items-center gap-2">
                       <Link size={16} className="text-gray-400"/>
                       <Input label="Project Link" placeholder="https://..." value={fileUrl} onChange={e => setFileUrl(e.target.value)} className="mb-0" />
                     </div>
                   </div>
                   
                   <div className="text-center text-sm text-gray-400">- OR -</div>

                   <div>
                     <label className="ui-label" htmlFor="project_submission_file">Upload File</label>
                     <div className="flex items-center gap-2">
                       <FileText size={16} className="text-gray-400"/>
                       <input id="project_submission_file" name="project_submission_file" type="file" onChange={handleFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                     </div>
                   </div>

                   <Button type="submit" className="w-full mt-2">Submit Project</Button>
                 </>
               )}
            </form>
          )}
        </Card>
      </div>

      <Card title="Guide Chat">
        <div ref={chatContainerRef} className="space-y-2 h-[240px] overflow-y-auto rounded border p-2 bg-gray-50 chat-scroll-mini">
          {chats.map((c) => (
            <div
              key={c.id}
              className={`max-w-[82%] p-2 rounded border group ${c.senderId === user.id ? 'ml-auto bg-indigo-100 border-indigo-200 text-black' : 'mr-auto bg-white border-gray-200 text-black'}`}
            >
              <div className="flex justify-between items-center mb-1 gap-3">
                <span className="font-bold text-black text-xs">{c.senderName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-black/70">{new Date(c.timestamp).toLocaleString()}</span>
                  {c.senderId === user.id && (
                    <button
                      onClick={() => deleteMessage(c.id)}
                      className="text-gray-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete message"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
              <div className="text-sm">{c.message}</div>
            </div>
          ))}
          {chats.length === 0 && <div className="text-center text-gray-500 py-6">No messages yet.</div>}
          <div ref={bottomRef} />
        </div>
        <div className="flex gap-2 mt-2">
          <Input placeholder="Ask your guide..." value={msg} onChange={e => setMsg(e.target.value)} className="mb-0 flex-1" />
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
  const [groupMessage, setGroupMessage] = useState('');
  const [unreadMap, setUnreadMap] = useState({});
  const bottomRef = useRef(null);
  const chatContainerRef = useRef(null);
  const forceAutoScrollRef = useRef(true);
  const prevMessageCountRef = useRef(0);

  useEffect(() => {
    const cacheKey = studentGroupsCacheKey(user.id);
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
      if (Array.isArray(cached)) setJoinedGroups(cached);
    } catch (_) {}
    fetchMyGroups();
  }, [user.id]);

  useEffect(() => {
    if (!activeGroup?.id) return;
    let tick = 0;
    const t = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      tick += 1;
      await syncActiveGroupMessages(activeGroup.id, true);
      if (tick % 3 === 0) await fetchMyGroups();
    }, 4000);
    return () => clearInterval(t);
  }, [activeGroup?.id]);

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
    localStorage.setItem(studentGroupsCacheKey(user.id), JSON.stringify(orderedGroups));
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
    const cacheKey = classroomChatCacheKey(g.id);
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
      if (Array.isArray(cached)) setActiveMessages(cached);
    } catch (_) {
      setActiveMessages([]);
    }
    await syncActiveGroupMessages(g.id, true);
  };

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

  const sendGroupMessage = async () => {
    const text = groupMessage.trim();
    if (!activeGroup?.id || !text) return;

    const msgData = {
      id: `cm${Date.now()}`,
      senderId: user.id,
      senderName: user.fullName,
      role: 'STUDENT',
      message: text,
      fileName: '',
      fileType: '',
      fileData: '',
      timestamp: new Date().toISOString()
    };

    await ApiService.addClassroomGroupMessage(activeGroup.id, msgData);
    const cacheKey = classroomChatCacheKey(activeGroup.id);
    const syncKey = classroomChatSyncKey(activeGroup.id);
    setActiveMessages(prev => {
      const next = mergeChatsById(prev, [msgData]);
      localStorage.setItem(cacheKey, JSON.stringify(next));
      const ts = latestTimestamp(next);
      if (ts) localStorage.setItem(syncKey, ts);
      localStorage.setItem(classroomSeenKey(user.id, activeGroup.id), ts || '');
      return next;
    });
    setGroupMessage('');
    forceAutoScrollRef.current = true;
    fetchMyGroups();
  };

  const deleteGroupMessage = async (messageId) => {
    if (!activeGroup?.id) return;
    await ApiService.deleteClassroomGroupMessage(activeGroup.id, messageId, user.id);
    const cacheKey = classroomChatCacheKey(activeGroup.id);
    const syncKey = classroomChatSyncKey(activeGroup.id);
    setActiveMessages(prev => {
      const next = prev.filter(m => m.id !== messageId);
      localStorage.setItem(cacheKey, JSON.stringify(next));
      const ts = latestTimestamp(next);
      if (ts) localStorage.setItem(syncKey, ts);
      else localStorage.removeItem(syncKey);
      localStorage.setItem(classroomSeenKey(user.id, activeGroup.id), ts || '');
      return next;
    });
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
               className="group p-3 border rounded cursor-pointer transition-colors hover:bg-gray-50 text-black"
               onClick={() => openGroup(g)}
             >
                <div className="font-bold flex items-center justify-between">
                  <span className="text-black">{g.name}</span>
                  {unreadMap[g.id] && <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>}
                </div>
                <div className="text-xs text-gray-600">Teacher: {g.teacherName}</div>
             </div>
           ))}
         </div>
      </Card>

      <div className="lg:col-span-2">
        {activeGroup ? (
           <Card title={activeGroup.name}>
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                 <span className="text-black">Group Chat</span>
                 <Button variant="danger" size="sm" onClick={() => leaveGroup(activeGroup)}><LogOut size={16}/> Leave</Button>
              </div>
              <div ref={chatContainerRef} className="space-y-2 h-[240px] overflow-y-auto rounded border p-2 bg-gray-50 chat-scroll-mini">
                 {activeMessages.length > 0 ? activeMessages.map((m) => (
                   <div key={m.id || m.timestamp} className={`max-w-[82%] p-2 rounded border group ${m.senderId === user.id ? 'ml-auto bg-indigo-100 border-indigo-200 text-black' : 'mr-auto bg-white border-gray-200 text-black'}`}>
                      <div className="flex justify-between items-center mb-1 gap-3">
                        <span className="font-bold text-black text-xs">{m.senderName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-black/70">{new Date(m.timestamp).toLocaleString()}</span>
                          {m.senderId === user.id && (
                            <button
                              onClick={() => deleteGroupMessage(m.id)}
                              className="text-gray-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete message"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      {m.message && <div className="text-sm">{m.message}</div>}
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
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Message this group..."
                  value={groupMessage}
                  onChange={e => setGroupMessage(e.target.value)}
                  className="mb-0 flex-1"
                />
                <Button onClick={sendGroupMessage}><MessageSquare size={18} /></Button>
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
  const [testView, setTestView] = useState('AVAILABLE');

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
      const int = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        load();
      }, 12000);
      load();
      return () => clearInterval(int);
    }
  }, [user.division, user.department, user.collegeYear, user.semester]);

  const initiateTest = async (q) => {
    const existingResult = allResults.find(r => r.quizId === q.id && r.studentId === user.id);
    if(existingResult) {
       openAnalysisFromResult(existingResult);
       return;
    }
    setConfirmingQuiz(q);
  };

  const getMyResult = (quizId) => allResults.find(r => r.quizId === quizId && r.studentId === user.id);

  const getQuizStatsByQuizId = (quizId) => {
    const quizResults = allResults.filter(r => r.quizId === quizId);
    if (quizResults.length === 0) {
      return {
        appeared: 0,
        average: 0,
        median: 0,
        highest: 0,
        lowest: 0
      };
    }
    const sortedScores = quizResults.map(r => Number(r.score) || 0).sort((a, b) => a - b);
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

  const openAnalysisFromResult = (myResult) => {
    if (!myResult?.quizId) return;
    const quiz = availableTests.find((item) => item.id === myResult.quizId);
    setAnalysisQuiz({
      quizId: myResult.quizId,
      title: myResult.quizTitle || quiz?.title || 'Test',
      myResult,
      stats: getQuizStatsByQuizId(myResult.quizId)
    });
  };

  const openAnalysis = (quiz) => {
    const myResult = getMyResult(quiz.id);
    if (!myResult) return;
    openAnalysisFromResult(myResult);
  };

  const myAnalyses = allResults
    .filter((r) => r.studentId === user.id)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const removeMyAnalysis = async (resultId) => {
    await ApiService.deleteQuizResult(resultId);
    setAllResults((prev) => prev.filter((row) => row.id !== resultId));
    if (analysisQuiz?.myResult?.id === resultId) setAnalysisQuiz(null);
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
      <Card title="Tests">
        <div className="flex border-b mb-4 overflow-x-auto">
          {['AVAILABLE', 'ALL_TEST_ANALYSIS'].map((view) => (
            <button
              key={view}
              onClick={() => setTestView(view)}
              className={`flex-1 py-2 px-4 text-sm font-semibold ${testView === view ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-600'}`}
            >
              {view === 'AVAILABLE' ? 'Available Tests' : 'All Test Analysis'}
            </button>
          ))}
        </div>

        {testView === 'AVAILABLE' && (
          availableTests.length > 0 ? (
            <div className="grid gap-4">
              {availableTests.map(q => (
                <div
                  key={q.id}
                  className="group flex justify-between items-center p-4 border rounded-lg transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white dark:hover:text-black"
                >
                  <div>
                    <h4 className="font-bold text-black dark:group-hover:text-black">{q.title}</h4>
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
          ) : <div className="text-center text-gray-400 py-10">No active tests available for your class.</div>
        )}

        {testView === 'ALL_TEST_ANALYSIS' && (
          myAnalyses.length > 0 ? (
            <div className="space-y-2">
              {myAnalyses.map((result) => (
                <div key={result.id} className="p-3 border rounded flex justify-between items-center text-black bg-white">
                  <div>
                    <div className="font-semibold">{result.quizTitle || 'Untitled Test'}</div>
                    <div className="text-xs text-gray-500">
                      Score: {result.score}/{result.totalQuestions} | {result.date ? new Date(result.date).toLocaleString() : '-'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openAnalysisFromResult(result)}>Open</Button>
                    <button className="text-red-600" onClick={() => removeMyAnalysis(result.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="text-center text-gray-400 py-10">No saved test analysis yet.</div>
        )}
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
                <h3 className="text-xl font-bold">{analysisQuiz.title} - Test Analysis</h3>
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
  const [isSidebarOpen, setSidebarOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 768 : true));
  const [timerPos, setTimerPos] = useState({ x: 16, y: 16 });
  const [isMobileView, setIsMobileView] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  const [violationCount, setViolationCount] = useState(0);
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [warningText, setWarningText] = useState('');
  const [violationTrackingEnabled, setViolationTrackingEnabled] = useState(true);
  const submittedRef = useRef(false);
  const warningTimeoutRef = useRef(null);
  const secretArmTimeoutRef = useRef(null);
  const secretInputArmedRef = useRef(false);
  const secretInputBufferRef = useRef('');
  const mobileClockTapRef = useRef(0);
  const mobileClockLastTapRef = useRef(0);
  const draggingTimerRef = useRef(false);
  const dragOffsetRef = useRef({ dx: 0, dy: 0 });
  const timerPanelRef = useRef(null);

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
      teacherId: quiz.createdBy,
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

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const defaultX = isMobile ? Math.max(0, window.innerWidth - 150) : Math.max(8, window.innerWidth - 190);
    const defaultY = 8;
    setTimerPos({ x: defaultX, y: defaultY });
    setSidebarOpen(!isMobile);
    setIsMobileView(isMobile);
  }, []);

  useEffect(() => {
    const placeTimerTopRight = () => {
      const panelRect = timerPanelRef.current?.getBoundingClientRect();
      const panelW = panelRect?.width || (isMobileView ? 148 : 180);
      const edgePadding = isMobileView ? 0 : 8;
      setTimerPos({
        x: Math.max(edgePadding, window.innerWidth - panelW - edgePadding),
        y: 8
      });
    };
    const raf = window.requestAnimationFrame(placeTimerTopRight);
    return () => window.cancelAnimationFrame(raf);
  }, [isMobileView]);

  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const clampTimerPos = (x, y) => {
    const panelRect = timerPanelRef.current?.getBoundingClientRect();
    const panelW = panelRect?.width || 180;
    const panelH = panelRect?.height || 78;
    const edgePadding = isMobileView ? 0 : 8;
    const maxX = Math.max(edgePadding, window.innerWidth - panelW - edgePadding);
    const maxY = Math.max(edgePadding, window.innerHeight - panelH - edgePadding);
    return {
      x: Math.max(edgePadding, Math.min(maxX, x)),
      y: Math.max(edgePadding, Math.min(maxY, y))
    };
  };

  const startTimerDrag = (clientX, clientY) => {
    draggingTimerRef.current = true;
    dragOffsetRef.current = { dx: clientX - timerPos.x, dy: clientY - timerPos.y };
  };

  const handleMobileClockTap = (e) => {
    e.stopPropagation();
    if (!isMobileView || submittedRef.current) return;
    const now = Date.now();
    const gap = now - mobileClockLastTapRef.current;
    if (gap > 5000) {
      mobileClockTapRef.current = 1;
    } else {
      mobileClockTapRef.current += 1;
    }
    mobileClockLastTapRef.current = now;
    if (mobileClockTapRef.current >= 10) {
      setViolationTrackingEnabled(false);
      setShowViolationWarning(false);
      mobileClockTapRef.current = 0;
      mobileClockLastTapRef.current = 0;
      alert('Mobile violation checks disabled.');
    }
  };

  const handleExamInteraction = () => {
    if (submittedRef.current) return;
    if (!document.fullscreenElement) {
      requestExamFullscreen();
    }
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!draggingTimerRef.current) return;
      const clientX = e.touches?.[0]?.clientX ?? e.clientX;
      const clientY = e.touches?.[0]?.clientY ?? e.clientY;
      const next = clampTimerPos(clientX - dragOffsetRef.current.dx, clientY - dragOffsetRef.current.dy);
      setTimerPos(next);
    };
    const onEnd = () => { draggingTimerRef.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [timerPos]);

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
    <div
      className="quiz-container"
      onClick={handleExamInteraction}
      onTouchStart={handleExamInteraction}
    >
       {showViolationWarning && (
         <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-black px-6 py-3 rounded-full shadow-lg z-[110] flex items-center gap-3 animate-bounce">
            <AlertTriangle size={24} />
            <div>
              <div className="font-bold">{warningText}</div>
              <div className="text-xs">Further violations will auto-submit the exam.</div>
            </div>
         </div>
       )}

       {/* Fixed timer panel (always visible, not minimizable) */}
       <div
         ref={timerPanelRef}
         onClick={armHiddenBypassInput}
         className={`quiz-timer-panel fixed z-[105] bg-white border border-indigo-200 shadow-lg rounded-xl cursor-pointer select-none ${isMobileView ? 'px-3 py-2 min-w-[132px]' : 'px-4 py-3 min-w-[160px]'}`}
         style={{ left: `${timerPos.x}px`, top: `${timerPos.y}px` }}
         onMouseDown={(e) => startTimerDrag(e.clientX, e.clientY)}
         onTouchStart={(e) => {
           if (!e.touches?.[0]) return;
           startTimerDrag(e.touches[0].clientX, e.touches[0].clientY);
         }}
       >
         <div className={`uppercase text-gray-500 font-semibold ${isMobileView ? 'text-[10px]' : 'text-xs'}`}>Time Left</div>
         <div className={`flex items-center gap-2 font-mono font-bold text-indigo-700 ${isMobileView ? 'text-lg' : 'text-xl'}`}>
            <Clock onClick={handleMobileClockTap} size={isMobileView ? 15 : 18} className={timeLeft < 60 ? "text-red-500" : "text-indigo-700"} />
            {formatTime(timeLeft)}
         </div>
         <div className={`${isMobileView ? 'text-[10px]' : 'text-xs'} text-gray-500 mt-1`}>Violations: {violationCount}/{MAX_VIOLATIONS}</div>
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
          <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col justify-center pt-12 md:pt-24">
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
