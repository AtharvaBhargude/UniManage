const API_URL = 'http://localhost:5000/api';

const fetchJson = async (endpoint, options = {}) => {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const err = await res.json();
    const error = new Error(err.error || 'API Error');
    error.data = err;
    throw error;
  }
  return res.json();
};

export const ApiService = {
  // Auth
  login: (data) => fetchJson('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data) => fetchJson('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  
  // Metrics & Stats
  getMetrics: () => fetchJson('/metrics'),
  getStorageStats: () => fetchJson('/storage'),
  getUserMetrics: () => fetchJson('/metrics/users'),
  
  // Users
  getUsers: () => fetchJson('/users'),
  updateUser: (id, data) => fetchJson(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id) => fetchJson(`/users/${id}`, { method: 'DELETE' }),
  getOnlineUsers: () => fetchJson('/users/online'),
  
  // Projects
  getProjects: () => fetchJson('/projects'),
  addProject: (data) => fetchJson('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id, data) => fetchJson(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  
  // Groups (Project Groups)
  getGroups: () => fetchJson('/groups'),
  addGroup: (data) => fetchJson('/groups', { method: 'POST', body: JSON.stringify(data) }),
  getGroupById: async (id) => {
      const groups = await ApiService.getGroups();
      return groups.find(g => g.id === id);
  },

  // Classroom Groups
  getClassroomGroups: () => fetchJson('/classroom-groups'),
  addClassroomGroup: (data) => fetchJson('/classroom-groups', { method: 'POST', body: JSON.stringify(data) }),
  updateClassroomGroup: (id, data) => fetchJson(`/classroom-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteClassroomGroup: (id) => fetchJson(`/classroom-groups/${id}`, { method: 'DELETE' }),
  getClassroomGroupMessages: (groupId, { since } = {}) => {
    const params = new URLSearchParams();
    if (since) params.append('since', since);
    const query = params.toString();
    return fetchJson(`/classroom-groups/${groupId}/messages${query ? `?${query}` : ''}`);
  },
  addClassroomGroupMessage: (groupId, data) => fetchJson(`/classroom-groups/${groupId}/messages`, { method: 'POST', body: JSON.stringify(data) }),
  deleteClassroomGroupMessage: (groupId, messageId, requesterId) => fetchJson(`/classroom-groups/${groupId}/messages/${messageId}?requesterId=${encodeURIComponent(requesterId)}`, { method: 'DELETE' }),

  // Assignments
  getAssignments: () => fetchJson('/assignments'),
  assignProject: (data) => fetchJson('/assignments', { method: 'POST', body: JSON.stringify(data) }),
  updateAssignment: (id, data) => fetchJson(`/assignments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAssignment: (id) => fetchJson(`/assignments/${id}`, { method: 'DELETE' }),

  // Submissions
  getSubmissions: () => fetchJson('/submissions'),
  addSubmission: (data) => fetchJson('/submissions', { method: 'POST', body: JSON.stringify(data) }),
  deleteSubmission: (id) => fetchJson(`/submissions/${id}`, { method: 'DELETE' }),
  
  // Chats
  getChats: ({ since, targetId, targetType } = {}) => {
    const params = new URLSearchParams();
    if (since) params.append('since', since);
    if (targetId) params.append('targetId', targetId);
    if (targetType) params.append('targetType', targetType);
    const query = params.toString();
    return fetchJson(`/chats${query ? `?${query}` : ''}`);
  },
  addChat: (data) => fetchJson('/chats', { method: 'POST', body: JSON.stringify(data) }),
  deleteChat: (id) => fetchJson(`/chats/${id}`, { method: 'DELETE' }),

  // Quizzes
  getQuizzes: () => fetchJson('/quizzes'),
  addQuiz: (data) => fetchJson('/quizzes', { method: 'POST', body: JSON.stringify(data) }),
  updateQuiz: (id, data) => fetchJson(`/quizzes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteQuiz: (id) => fetchJson(`/quizzes/${id}`, { method: 'DELETE' }),
  
  // Test Assignments (New)
  getTestAssignments: () => fetchJson('/test-assignments'),
  assignTest: (data) => fetchJson('/test-assignments', { method: 'POST', body: JSON.stringify(data) }),
  updateTestAssignment: (id, data) => fetchJson(`/test-assignments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTestAssignment: (id) => fetchJson(`/test-assignments/${id}`, { method: 'DELETE' }),

  // Results
  getQuizResults: () => fetchJson('/results'),
  addQuizResult: (data) => fetchJson('/results', { method: 'POST', body: JSON.stringify(data) }),
  pruneResults: (months) => fetchJson('/results/prune', { method: 'DELETE', body: JSON.stringify({ months }) }),
  
  // Violations
  getViolations: () => fetchJson('/violations'),
  addViolation: (data) => fetchJson('/violations', { method: 'POST', body: JSON.stringify(data) }),
  deleteViolation: (id) => fetchJson(`/violations/${id}`, { method: 'DELETE' }),
  deleteAllViolations: () => fetchJson('/violations', { method: 'DELETE' }),
  
  // Marks
  getMarks: () => fetchJson('/marks'),
  saveMark: async (data) => {
      const marks = await ApiService.getMarks();
      const existing = marks.find(m => m.id === data.id);
      if (existing) {
          return fetchJson(`/marks/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
      } else {
          return fetchJson('/marks', { method: 'POST', body: JSON.stringify(data) });
      }
  },

  // Helpers
  getProjectById: async (id) => {
      const projects = await ApiService.getProjects();
      return projects.find(p => p.id === id);
  },

  getAssignmentsForTeacher: async (teacherId) => {
      const [projects, assignments] = await Promise.all([ApiService.getProjects(), ApiService.getAssignments()]);
      const myProjectIds = projects.filter(p => p.guideId === teacherId).map(p => p.id);
      return assignments.filter(a => myProjectIds.includes(a.projectId));
  },
  
  getAssignmentForStudent: async (username) => {
      const [groups, assignments] = await Promise.all([ApiService.getGroups(), ApiService.getAssignments()]);
      const group = groups.find(g => g.groupLeader === username || g.members.includes(username));
      if (!group) return null;
      return assignments.find(a => a.groupId === group.id) || null;
  }
};
