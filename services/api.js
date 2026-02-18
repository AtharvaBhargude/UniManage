const rawApiUrl = import.meta.env.VITE_API_URL || '/api';
const API_URL = rawApiUrl === '/api' ? '/api' : rawApiUrl.replace(/\/$/, '');
const CACHE_PREFIX = 'api_cache_v1';
const DEFAULT_TTL_MS = 5 * 60 * 1000;

const cacheStore = new Map();
const inflightRequests = new Map();

const CACHE_KEYS = {
  metrics: 'metrics',
  storage: 'storage',
  userMetrics: 'metrics_users',
  users: 'users',
  onlineUsers: 'users_online',
  projects: 'projects',
  groups: 'groups',
  classroomGroups: 'classroom_groups',
  assignments: 'assignments',
  submissions: 'submissions',
  projectIdeas: 'project_ideas',
  chats: 'chats',
  quizzes: 'quizzes',
  testAssignments: 'test_assignments',
  results: 'results',
  violations: 'violations',
  marks: 'marks',
  timetables: 'timetables',
  reports: 'reports'
};

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const getAuthToken = () => getCurrentUser()?.token || '';
const getCacheScope = () => getCurrentUser()?.id || 'anon';
const scopedCacheKey = (key) => `${CACHE_PREFIX}:${getCacheScope()}:${key}`;

const readStorageCache = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const readCacheRecord = (key) => {
  if (cacheStore.has(key)) return cacheStore.get(key);
  const fromStorage = readStorageCache(key);
  if (fromStorage) {
    cacheStore.set(key, fromStorage);
    return fromStorage;
  }
  return null;
};

const writeCacheRecord = (key, data) => {
  const record = { data, fetchedAt: Date.now() };
  cacheStore.set(key, record);
  try {
    localStorage.setItem(key, JSON.stringify(record));
  } catch (_) {}
  return data;
};

const invalidateCacheByPrefixes = (prefixes = []) => {
  if (!Array.isArray(prefixes) || prefixes.length === 0) return;

  const normalized = prefixes.filter(Boolean);
  if (normalized.length === 0) return;

  for (const key of Array.from(cacheStore.keys())) {
    if (normalized.some((prefix) => key.includes(`:${prefix}`))) {
      cacheStore.delete(key);
    }
  }

  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(`${CACHE_PREFIX}:`)) continue;
      if (normalized.some((prefix) => key.includes(`:${prefix}`))) {
        localStorage.removeItem(key);
      }
    }
  } catch (_) {}
};

const fetchJson = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  const requestHeaders = {
    'Content-Type': 'application/json',
    ...authHeader,
    ...(options.headers || {})
  };

  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: requestHeaders,
    ...options
  });

  if (!res.ok) {
    let err = { error: 'API Error' };
    try {
      err = await res.json();
    } catch (_) {}
    const error = new Error(err.error || 'API Error');
    error.data = err;
    throw error;
  }
  return res.json();
};

const cachedGet = async (endpoint, cacheKey, { maxAgeMs = DEFAULT_TTL_MS, force = false } = {}) => {
  const scoped = scopedCacheKey(cacheKey);
  const existing = readCacheRecord(scoped);
  const isFresh = !!existing && (Date.now() - Number(existing.fetchedAt || 0) <= maxAgeMs);

  if (!force && isFresh) return existing.data;

  if (inflightRequests.has(scoped)) {
    return inflightRequests.get(scoped);
  }

  const request = (async () => {
    try {
      const data = await fetchJson(endpoint);
      return writeCacheRecord(scoped, data);
    } catch (error) {
      if (existing?.data) return existing.data;
      throw error;
    } finally {
      inflightRequests.delete(scoped);
    }
  })();

  inflightRequests.set(scoped, request);
  return request;
};

const withInvalidation = async (requestPromise, prefixes = []) => {
  const data = await requestPromise;
  invalidateCacheByPrefixes(prefixes);
  return data;
};

export const ApiService = {
  invalidateCache: (...prefixes) => invalidateCacheByPrefixes(prefixes),
  invalidateAllCache: () => invalidateCacheByPrefixes(Object.values(CACHE_KEYS)),

  prefetchForRole: async (role) => {
    const common = [ApiService.getUsers(), ApiService.getProjects(), ApiService.getGroups()];
    if (role === 'DEVELOPER') {
      await Promise.allSettled([ApiService.getMetrics(), ApiService.getStorageStats(), ApiService.getUserMetrics(), ...common]);
      return;
    }
    if (role === 'ADMIN') {
      await Promise.allSettled([ApiService.getAssignments(), ApiService.getSubmissions(), ApiService.getTimetables(), ...common]);
      return;
    }
    if (role === 'TEACHER') {
      await Promise.allSettled([ApiService.getAssignments(), ApiService.getQuizzes(), ApiService.getTestAssignments(), ApiService.getTimetables(), ...common]);
      return;
    }
    await Promise.allSettled([ApiService.getAssignments(), ApiService.getTestAssignments(), ApiService.getQuizzes(), ApiService.getTimetables(), ...common]);
  },

  // Auth
  login: async (data) => {
    const response = await fetchJson('/auth/login', { method: 'POST', body: JSON.stringify(data) });
    ApiService.invalidateAllCache();
    return response;
  },
  register: async (data) => {
    const response = await fetchJson('/auth/register', { method: 'POST', body: JSON.stringify(data) });
    invalidateCacheByPrefixes([CACHE_KEYS.users]);
    return response;
  },

  // Metrics & Stats
  getMetrics: (options = {}) => cachedGet('/metrics', CACHE_KEYS.metrics, { maxAgeMs: 60 * 1000, force: options.force }),
  getStorageStats: (options = {}) => cachedGet('/storage', CACHE_KEYS.storage, { maxAgeMs: 2 * 60 * 1000, force: options.force }),
  getUserMetrics: (options = {}) => cachedGet('/metrics/users', CACHE_KEYS.userMetrics, { maxAgeMs: 2 * 60 * 1000, force: options.force }),

  // Users
  getUsers: (options = {}) => cachedGet('/users', CACHE_KEYS.users, { maxAgeMs: 5 * 60 * 1000, force: options.force }),
  updateUser: (id, data) => withInvalidation(fetchJson(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }), [CACHE_KEYS.users, CACHE_KEYS.onlineUsers]),
  deleteUser: (id) => withInvalidation(fetchJson(`/users/${id}`, { method: 'DELETE' }), [CACHE_KEYS.users, CACHE_KEYS.onlineUsers, CACHE_KEYS.userMetrics]),
  getOnlineUsers: (options = {}) => cachedGet('/users/online', CACHE_KEYS.onlineUsers, { maxAgeMs: 20 * 1000, force: options.force }),

  // Projects
  getProjects: (options = {}) => cachedGet('/projects', CACHE_KEYS.projects, { maxAgeMs: 5 * 60 * 1000, force: options.force }),
  addProject: (data) => withInvalidation(fetchJson('/projects', { method: 'POST', body: JSON.stringify(data) }), [CACHE_KEYS.projects, CACHE_KEYS.assignments]),
  updateProject: (id, data) => withInvalidation(fetchJson(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }), [CACHE_KEYS.projects, CACHE_KEYS.assignments]),

  // Groups (Project Groups)
  getGroups: (options = {}) => cachedGet('/groups', CACHE_KEYS.groups, { maxAgeMs: 5 * 60 * 1000, force: options.force }),
  addGroup: (data) => withInvalidation(fetchJson('/groups', { method: 'POST', body: JSON.stringify(data) }), [CACHE_KEYS.groups, CACHE_KEYS.assignments]),
  deleteGroup: (id) => withInvalidation(fetchJson(`/groups/${id}`, { method: 'DELETE' }), [CACHE_KEYS.groups, CACHE_KEYS.assignments]),
  getGroupById: async (id) => {
    const groups = await ApiService.getGroups();
    return groups.find((g) => g.id === id);
  },

  // Classroom Groups
  getClassroomGroups: (options = {}) => cachedGet('/classroom-groups', CACHE_KEYS.classroomGroups, { maxAgeMs: 20 * 1000, force: options.force }),
  addClassroomGroup: (data) => withInvalidation(fetchJson('/classroom-groups', { method: 'POST', body: JSON.stringify(data) }), [CACHE_KEYS.classroomGroups]),
  updateClassroomGroup: (id, data) => withInvalidation(fetchJson(`/classroom-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }), [CACHE_KEYS.classroomGroups, `${CACHE_KEYS.classroomGroups}_messages_${id}`]),
  deleteClassroomGroup: (id) => withInvalidation(fetchJson(`/classroom-groups/${id}`, { method: 'DELETE' }), [CACHE_KEYS.classroomGroups, `${CACHE_KEYS.classroomGroups}_messages_${id}`]),
  getClassroomGroupMessages: (groupId, { since, force } = {}) => {
    const params = new URLSearchParams();
    if (since) params.append('since', since);
    const query = params.toString();
    const endpoint = `/classroom-groups/${groupId}/messages${query ? `?${query}` : ''}`;
    if (since) return fetchJson(endpoint);
    return cachedGet(endpoint, `${CACHE_KEYS.classroomGroups}_messages_${groupId}`, { maxAgeMs: 10 * 1000, force });
  },
  addClassroomGroupMessage: (groupId, data) => withInvalidation(fetchJson(`/classroom-groups/${groupId}/messages`, { method: 'POST', body: JSON.stringify(data) }), [CACHE_KEYS.classroomGroups, `${CACHE_KEYS.classroomGroups}_messages_${groupId}`, CACHE_KEYS.storage]),
  deleteClassroomGroupMessage: (groupId, messageId, requesterId) => withInvalidation(fetchJson(`/classroom-groups/${groupId}/messages/${messageId}?requesterId=${encodeURIComponent(requesterId)}`, { method: 'DELETE' }), [CACHE_KEYS.classroomGroups, `${CACHE_KEYS.classroomGroups}_messages_${groupId}`, CACHE_KEYS.storage]),

  // Assignments
  getAssignments: (options = {}) => cachedGet('/assignments', CACHE_KEYS.assignments, { maxAgeMs: 5 * 60 * 1000, force: options.force }),
  assignProject: (data) => withInvalidation(fetchJson('/assignments', { method: 'POST', body: JSON.stringify(data) }), [CACHE_KEYS.assignments, CACHE_KEYS.submissions, CACHE_KEYS.projects]),
  updateAssignment: (id, data) => withInvalidation(fetchJson(`/assignments/${id}`, { method: 'PUT', body: JSON.stringify(data) }), [CACHE_KEYS.assignments, CACHE_KEYS.submissions]),
  deleteAssignment: (id) => withInvalidation(fetchJson(`/assignments/${id}`, { method: 'DELETE' }), [CACHE_KEYS.assignments, CACHE_KEYS.submissions]),

  // Submissions
  getSubmissions: (options = {}) => cachedGet('/submissions', CACHE_KEYS.submissions, { maxAgeMs: 3 * 60 * 1000, force: options.force }),
  addSubmission: (data) => withInvalidation(fetchJson('/submissions', { method: 'POST', body: JSON.stringify(data) }), [CACHE_KEYS.submissions, CACHE_KEYS.assignments, CACHE_KEYS.storage]),
  updateSubmission: (id, data) => withInvalidation(fetchJson(`/submissions/${id}`, { method: 'PUT', body: JSON.stringify(data) }), [CACHE_KEYS.submissions, CACHE_KEYS.assignments, CACHE_KEYS.storage]),
  deleteSubmission: (id) => withInvalidation(fetchJson(`/submissions/${id}`, { method: 'DELETE' }), [CACHE_KEYS.submissions, CACHE_KEYS.assignments, CACHE_KEYS.storage]),

  // Project Ideas
  getProjectIdeas: (options = {}) => cachedGet('/project-ideas', CACHE_KEYS.projectIdeas, { maxAgeMs: 3 * 60 * 1000, force: options.force }),
  addProjectIdea: (data) => withInvalidation(fetchJson('/project-ideas', { method: 'POST', body: JSON.stringify(data) }), [CACHE_KEYS.projectIdeas]),
  updateProjectIdea: (id, data) => withInvalidation(fetchJson(`/project-ideas/${id}`, { method: 'PUT', body: JSON.stringify(data) }), [CACHE_KEYS.projectIdeas]),
  deleteProjectIdea: (id) => withInvalidation(fetchJson(`/project-ideas/${id}`, { method: 'DELETE' }), [CACHE_KEYS.projectIdeas]),

  // Chats
  getChats: ({ since, targetId, targetType, force } = {}) => {
    const params = new URLSearchParams();
    if (since) params.append('since', since);
    if (targetId) params.append('targetId', targetId);
    if (targetType) params.append('targetType', targetType);
    const query = params.toString();
    const endpoint = `/chats${query ? `?${query}` : ''}`;
    if (since || targetId || targetType) return fetchJson(endpoint);
    return cachedGet(endpoint, CACHE_KEYS.chats, { maxAgeMs: 10 * 1000, force });
  },
  addChat: (data) => withInvalidation(fetchJson('/chats', { method: 'POST', body: JSON.stringify(data) }), [CACHE_KEYS.chats, CACHE_KEYS.storage]),
  deleteChat: (id) => withInvalidation(fetchJson(`/chats/${id}`, { method: 'DELETE' }), [CACHE_KEYS.chats, CACHE_KEYS.storage]),

  // Quizzes
  getQuizzes: (options = {}) => cachedGet('/quizzes', CACHE_KEYS.quizzes, { maxAgeMs: 2 * 60 * 1000, force: options.force }),
  addQuiz: (data) => withInvalidation(fetchJson('/quizzes', { method: 'POST', body: JSON.stringify(data) }), [CACHE_KEYS.quizzes, CACHE_KEYS.testAssignments]),
  updateQuiz: (id, data) => withInvalidation(fetchJson(`/quizzes/${id}`, { method: 'PUT', body: JSON.stringify(data) }), [CACHE_KEYS.quizzes, CACHE_KEYS.testAssignments]),
  deleteQuiz: (id) => withInvalidation(fetchJson(`/quizzes/${id}`, { method: 'DELETE' }), [CACHE_KEYS.quizzes, CACHE_KEYS.testAssignments, CACHE_KEYS.results, CACHE_KEYS.violations]),

  // Test Assignments
  getTestAssignments: (options = {}) => cachedGet('/test-assignments', CACHE_KEYS.testAssignments, { maxAgeMs: 30 * 1000, force: options.force }),
  assignTest: (data) => withInvalidation(fetchJson('/test-assignments', { method: 'POST', body: JSON.stringify(data) }), [CACHE_KEYS.testAssignments, CACHE_KEYS.quizzes]),
  updateTestAssignment: (id, data) => withInvalidation(fetchJson(`/test-assignments/${id}`, { method: 'PUT', body: JSON.stringify(data) }), [CACHE_KEYS.testAssignments]),
  deleteTestAssignment: (id) => withInvalidation(fetchJson(`/test-assignments/${id}`, { method: 'DELETE' }), [CACHE_KEYS.testAssignments, CACHE_KEYS.results]),

  // Results
  getQuizResults: (options = {}) => cachedGet('/results', CACHE_KEYS.results, { maxAgeMs: 30 * 1000, force: options.force }),
  addQuizResult: (data) => withInvalidation(fetchJson('/results', { method: 'POST', body: JSON.stringify(data) }), [CACHE_KEYS.results, CACHE_KEYS.metrics, CACHE_KEYS.userMetrics]),
  deleteQuizResult: (id) => withInvalidation(fetchJson(`/results/${id}`, { method: 'DELETE' }), [CACHE_KEYS.results]),
  deleteQuizResultsBulk: (data) => withInvalidation(fetchJson('/results/bulk-delete', { method: 'DELETE', body: JSON.stringify(data) }), [CACHE_KEYS.results]),
  pruneResults: (months) => withInvalidation(fetchJson('/results/prune', { method: 'DELETE', body: JSON.stringify({ months }) }), [CACHE_KEYS.results]),

  // Violations
  getViolations: (options = {}) => cachedGet('/violations', CACHE_KEYS.violations, { maxAgeMs: 30 * 1000, force: options.force }),
  addViolation: (data) => withInvalidation(fetchJson('/violations', { method: 'POST', body: JSON.stringify(data) }), [CACHE_KEYS.violations]),
  deleteViolation: (id) => withInvalidation(fetchJson(`/violations/${id}`, { method: 'DELETE' }), [CACHE_KEYS.violations]),
  deleteAllViolations: () => withInvalidation(fetchJson('/violations', { method: 'DELETE' }), [CACHE_KEYS.violations]),

  // Marks
  getMarks: (options = {}) => cachedGet('/marks', CACHE_KEYS.marks, { maxAgeMs: 2 * 60 * 1000, force: options.force }),
  saveMark: async (data) => {
    const marks = await ApiService.getMarks();
    const existing = marks.find((m) => m.id === data.id);
    if (existing) {
      return withInvalidation(fetchJson(`/marks/${data.id}`, { method: 'PUT', body: JSON.stringify(data) }), [CACHE_KEYS.marks, CACHE_KEYS.assignments]);
    }
    return withInvalidation(fetchJson('/marks', { method: 'POST', body: JSON.stringify(data) }), [CACHE_KEYS.marks, CACHE_KEYS.assignments]);
  },

  // Timetables
  getTimetables: (options = {}) => cachedGet('/timetables', CACHE_KEYS.timetables, { maxAgeMs: 5 * 60 * 1000, force: options.force }),
  addTimetable: (data) => withInvalidation(fetchJson('/timetables', { method: 'POST', body: JSON.stringify(data) }), [CACHE_KEYS.timetables]),
  updateTimetable: (id, data) => withInvalidation(fetchJson(`/timetables/${id}`, { method: 'PUT', body: JSON.stringify(data) }), [CACHE_KEYS.timetables]),
  deleteTimetable: (id) => withInvalidation(fetchJson(`/timetables/${id}`, { method: 'DELETE' }), [CACHE_KEYS.timetables]),

  // Reports
  getReports: (options = {}) => cachedGet('/reports', CACHE_KEYS.reports, { maxAgeMs: 60 * 1000, force: options.force }),
  addReport: (data) => withInvalidation(fetchJson('/reports', { method: 'POST', body: JSON.stringify(data) }), [CACHE_KEYS.reports]),
  deleteAllReports: () => withInvalidation(fetchJson('/reports/all', { method: 'DELETE' }), [CACHE_KEYS.reports]),

  // Helpers
  getProjectById: async (id) => {
    const projects = await ApiService.getProjects();
    return projects.find((p) => p.id === id);
  },

  getAssignmentsForTeacher: async (teacherId) => {
    const [projects, assignments] = await Promise.all([ApiService.getProjects(), ApiService.getAssignments()]);
    const myProjectIds = projects.filter((p) => p.guideId === teacherId).map((p) => p.id);
    return assignments.filter((a) => myProjectIds.includes(a.projectId));
  },

  getAssignmentForStudent: async (username, options = {}) => {
    const [groups, assignments, projects] = await Promise.all([
      ApiService.getGroups({ force: options.force }),
      ApiService.getAssignments({ force: options.force }),
      ApiService.getProjects({ force: options.force })
    ]);
    const group = groups.find((g) => g.groupLeader === username || g.members.includes(username));
    if (!group) return null;

    const groupAssignments = (assignments || []).filter((a) => a.groupId === group.id);
    if (!groupAssignments.length) return null;

    const projectById = new Map((projects || []).map((p) => [p.id, p]));
    const withProject = groupAssignments.filter((a) => projectById.has(a.projectId));
    const withAssignedGuide = withProject.filter((a) => !!projectById.get(a.projectId)?.guideId);
    const source = withAssignedGuide.length ? withAssignedGuide : withProject;
    if (!source.length) return null;

    return [...source].sort((a, b) => new Date(b.assignedDate || 0) - new Date(a.assignedDate || 0))[0];
  },

  deleteMark: (id) => withInvalidation(fetchJson(`/marks/${id}`, { method: 'DELETE' }), [CACHE_KEYS.marks, CACHE_KEYS.assignments])
};
